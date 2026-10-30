"""Reversible frame crops and mask-contained composites for native FLUX editing."""
from __future__ import annotations

import base64
import binascii
import io
import math
import secrets
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from PIL import Image
from scipy.ndimage import maximum_filter, distance_transform_edt

from .paintout import (
    COLOUR_SPACES, CATEGORY, composite_crop, describe, frames, is_hdr,
    resize, save_exr, selected_space, working, protection_mask, plate_processing_size,
    to_linear, unworking, sdr_view,
)


def validate_edit_orientation(path):
    """Require explicit pixel orientation so imports align with source coordinates."""
    import OpenImageIO as oiio
    reader = oiio.ImageInput.open(str(path))
    if not reader:
        raise ValueError('The edited image could not be read.')
    try:
        orientation = reader.spec().get_int_attribute('Orientation', 1)
        if orientation not in (0, 1):
            raise ValueError('Bake rotation or mirroring into the edited image, then export it with normal orientation before importing.')
    finally:
        reader.close()


def decode_mask(encoded, width, height):
    if not isinstance(encoded, str) or not encoded:
        raise ValueError('Draw over the object to remove first.')
    if len(encoded) > 90 * 1024 * 1024:
        raise ValueError('The painted mask is too large. Use a smaller source image.')
    if encoded.startswith('data:'):
        prefix, separator, encoded = encoded.partition(',')
        if not separator or prefix != 'data:image/png;base64':
            raise ValueError('The painted mask must be a PNG image.')
    try:
        payload = base64.b64decode(encoded, validate=True)
        with Image.open(io.BytesIO(payload)) as image:
            if image.format != 'PNG' or image.size != (width, height):
                raise ValueError('The painted mask must match the original frame dimensions.')
            mask = np.asarray(image.convert('L'), dtype=np.float32) / 255.0
    except (binascii.Error, OSError) as error:
        raise ValueError('The painted mask could not be read. Draw it again.') from error
    if not np.any(mask > .001):
        raise ValueError('Draw over the object to remove first.')
    return mask


def plan_crop(mask, grow=0, feather=0, context=128, max_side=1024):
    """Return source bounds and a reversible, aspect-preserving model transform."""
    if mask.ndim != 2 or not np.isfinite(mask).all():
        raise ValueError('The edit mask must be a finite two-dimensional image.')
    for name, value, low, high in (
        ('Grow', grow, 0, 256), ('Edge softness', feather, 0, 256),
        ('Crop context', context, 0, 2048), ('Crop size', max_side, 64, 2048),
    ):
        if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
            raise ValueError(f'{name} must be a whole number from {low} to {high}.')
    yy, xx = np.where(mask > .001)
    if not len(xx):
        raise ValueError('Draw over the object to remove first.')
    height, width = mask.shape
    margin = max(context, grow + feather + 48)
    left, top = max(0, int(xx.min()) - margin), max(0, int(yy.min()) - margin)
    right = min(width, int(xx.max()) + 1 + margin)
    bottom = min(height, int(yy.max()) + 1 + margin)
    crop_width, crop_height = right - left, bottom - top
    scale = min(1.0, max_side / max(crop_width, crop_height))
    resized_width = max(1, round(crop_width * scale))
    resized_height = max(1, round(crop_height * scale))
    return {
        'rect': [left, top, crop_width, crop_height],
        'resized': [resized_height, resized_width],
        'padded': [max(64, math.ceil(resized_height / 16) * 16),
                   max(64, math.ceil(resized_width / 16) * 16)],
        'grow': grow, 'feather': feather,
    }


def prepare_patch(original, mask, grow=0, feather=0, context=128, max_side=1024):
    if original.ndim != 3 or original.shape[-1] != 3 or original.shape[:2] != mask.shape:
        raise ValueError('The edit mask must match the original RGB frame.')
    if not np.isfinite(original).all():
        raise ValueError('The original frame contains non-finite pixels.')
    transform = plan_crop(mask, grow, feather, context, max_side)
    x, y, width, height = transform['rect']
    rh, rw = transform['resized']
    ph, pw = transform['padded']
    image = torch.from_numpy(original[y:y+height, x:x+width].copy())[None].float()
    matte = torch.from_numpy(mask[y:y+height, x:x+width].copy())[None, :, :, None].float()
    image = resize(image, rh, rw)
    matte = resize(matte, rh, rw, 'nearest-exact')
    image = F.pad(image.movedim(-1, 1), (0, pw-rw, 0, ph-rh), mode='replicate').movedim(1, -1)
    matte = F.pad(matte.movedim(-1, 1), (0, pw-rw, 0, ph-rh)).squeeze(1)
    patch = {**transform, 'original': original.copy(), 'mask': mask.copy()}
    return image, matte, patch


def composite_patch(patch, generated, match_context=True):
    image = generated.detach().float().cpu() if isinstance(generated, torch.Tensor) else torch.from_numpy(np.asarray(generated)).float()
    if image.ndim == 3:
        image = image[None]
    ph, pw = patch['padded']
    if tuple(image.shape) != (1, ph, pw, 3):
        raise ValueError('FLUX returned an unexpected image size; the clean frame was not replaced.')
    if not torch.isfinite(image).all():
        raise ValueError('FLUX returned invalid pixels; try another seed.')
    rh, rw = patch['resized']
    x, y, width, height = patch['rect']
    restored = resize(image[:, :rh, :rw], height, width)[0].numpy()
    original = patch['original']
    result = original.copy()
    result[y:y+height, x:x+width], _ = composite_crop(
        original[y:y+height, x:x+width], restored,
        patch['mask'][y:y+height, x:x+width], patch['grow'], patch['feather'], match_context,
        protection=patch['protection'][y:y+height, x:x+width] if patch.get('protection') is not None else None,
    )
    if patch.get('delivery_original') is not None:
        original = patch['delivery_original']
        height,width = original.shape[:2]
        restored = resize(torch.from_numpy(result)[None], height, width)[0].numpy()
        result,_ = composite_crop(original, restored, patch['delivery_mask'], patch['delivery_grow'],
                                  patch['delivery_feather'], False, protection=patch.get('delivery_protection'))
    if patch.get('hdr_original') is not None:
        # FLUX sees a fixed SDR view, never ACEScct or extended-range samples.
        # Reconstruct only its edited support in AP1; untouched master pixels
        # are copied directly, including negative values and bright highlights.
        linear = unworking(torch.from_numpy(result)[None], patch['hdr_source_space'], 'SDR (sRGB)')[0].numpy()
        if not np.isfinite(linear).all():
            raise ValueError('The HDR clean frame contains invalid pixels; try another edit.')
        original = patch['hdr_original']
        mask = patch.get('delivery_mask', patch['mask'])
        grow = patch.get('delivery_grow', patch['grow'])
        feather = patch.get('delivery_feather', patch['feather'])
        support = maximum_filter(mask > .001, size=2*grow+1) if grow else mask > .001
        if feather:
            support = support | (distance_transform_edt(~support) < feather)
        protection = patch.get('delivery_protection', patch.get('protection'))
        if protection is not None:
            support[np.asarray(protection) > .001] = False
        result = original.copy()
        result[support] = linear[support]
    return result


def prepare_plate_patch(original, mask, grow=0, feather=0, context=128, max_side=1024, protection=None):
    """Use the video's exact full-plate transform before the reversible local crop."""
    height,width = original.shape[:2]
    pw,ph = plate_processing_size(width,height)
    if max(pw,ph)>4096:
        raise ValueError('This plate exceeds the current 4096-pixel processing limit.')
    image = resize(torch.from_numpy(original)[None], ph, pw)[0].numpy()
    matte = resize(torch.from_numpy(mask)[None,:,:,None], ph, pw, 'nearest-exact')[0,:,:,0].numpy()
    protected = None if protection is None else resize(torch.from_numpy(protection)[None,:,:,None],ph,pw,'nearest-exact')[0,:,:,0].numpy()
    scale=max(pw/width,ph/height)
    crop,crop_mask,patch=prepare_patch(image,matte,math.ceil(grow*scale),math.ceil(feather*scale),math.ceil(context*scale),max_side)
    patch.update(protection=protected,delivery_original=original.copy(),delivery_mask=mask.copy(),
                 delivery_protection=protection,delivery_grow=grow,delivery_feather=feather,
                 plate_processing_size=[pw,ph])
    return crop,crop_mask,patch


def source_identity(description):
    paths = description['files'] if description['kind'] == 'sequence' else [description['path']]
    return [(str(Path(path).resolve()), Path(path).stat().st_size, Path(path).stat().st_mtime_ns) for path in paths]


def save_png16(path, image):
    import OpenImageIO as oiio
    pixels = np.ascontiguousarray((np.clip(image, 0, 1) * 65535).round().astype(np.uint16))
    spec = oiio.ImageSpec(image.shape[1], image.shape[0], 3, oiio.UINT16)
    spec.attribute('oiio:ColorSpace', 'sRGB')
    writer = oiio.ImageOutput.create(str(path))
    if not writer:
        raise ValueError('Could not create the clean-frame PNG.')
    try:
        if not writer.open(str(path), spec) or not writer.write_image(pixels):
            raise ValueError('Could not save the clean-frame PNG.')
    finally:
        writer.close()


class ZuraPaintoutFrameCrop:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {
            'source': ('STRING', {'default': ''}),
            'frame': ('INT', {'default': 0, 'min': 0, 'max': 1000000}),
            'colour_space': (COLOUR_SPACES,),
            'mask': ('STRING', {'default': '', 'multiline': True}),
            'grow': ('INT', {'default': 0, 'min': 0, 'max': 256}),
            'feather': ('INT', {'default': 0, 'min': 0, 'max': 256}),
            'context': ('INT', {'default': 128, 'min': 0, 'max': 2048}),
            'max_side': ('INT', {'default': 1024, 'min': 64, 'max': 2048}),
        }, 'optional': {
            'project': ('STRING', {'default': ''}),
            'mask_revision': ('INT', {'default': -1, 'min': -1, 'max': 1000000}),
        }}

    RETURN_TYPES = ('IMAGE', 'MASK', 'ZURA_FRAME_PATCH', 'INT', 'INT', 'IMAGE')
    RETURN_NAMES = ('context_image', 'edit_mask', 'patch', 'width', 'height', 'selection_preview')
    FUNCTION = 'prepare'
    CATEGORY = CATEGORY

    @classmethod
    def IS_CHANGED(cls, source, frame, **kwargs):
        try:
            return repr(source_identity(describe(source)))
        except (OSError, ValueError):
            return float('nan')

    def prepare(self, source, frame, colour_space, mask, grow, feather, context, max_side, project='', mask_revision=-1):
        from .browser import checked_path
        path = checked_path(source)
        description = describe(str(path))
        if isinstance(frame, bool) or not isinstance(frame, int) or not 0 <= frame < description['count']:
            raise ValueError('Choose a source frame inside the footage.')
        space = selected_space(description, colour_space)
        encoded = next(frames(description, frame, 1))
        if not np.isfinite(encoded).all():
            raise ValueError('The source frame contains non-finite pixels.')
        hdr_original = to_linear(torch.from_numpy(encoded.copy()).float(), space).numpy() if is_hdr(space) else None
        if hdr_original is not None and not np.isfinite(hdr_original).all():
            raise ValueError('The HDR source cannot be converted to finite scene-linear pixels. Check its colour space.')
        original = working(torch.from_numpy(encoded.copy())[None].float(), space, 'SDR (sRGB)')[0].cpu().numpy()
        matte = decode_mask(mask, description['width'], description['height'])
        protection = None
        if project:
            from .editor_store import mask_descriptor, source_identity as mask_source_identity
            if mask_revision < 0:
                raise ValueError('Choose a saved mask revision before cleaning this frame.')
            descriptor = mask_descriptor(project, mask_revision)
            if descriptor['source'] != mask_source_identity(str(path), description):
                raise ValueError('This mask belongs to different or modified footage. Reload the source.')
            protection = protection_mask(descriptor, frame)
            matte[protection > .001] = 0
        image, crop_mask, patch = prepare_plate_patch(original, matte, grow, feather, context, max_side, protection)
        patch.update(source=str(path), frame=frame, colour_space='acescg' if hdr_original is not None else 'srgb_display',
                     description=description, identity=source_identity(description))
        if hdr_original is not None:
            patch.update(hdr_original=hdr_original, hdr_source_space=space, edit_view='SDR shoulder view; FLUX is not a native HDR model')
        # The captioner sees the selection; FLUX receives the unmarked reference.
        selection = image.clone()
        coverage = crop_mask[..., None] * .45
        colour = torch.tensor([1., .05, .05], dtype=selection.dtype)
        selection = selection * (1-coverage) + colour * coverage
        return image, crop_mask, patch, image.shape[2], image.shape[1], selection


class ZuraPaintoutFrameComposite:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'patch': ('ZURA_FRAME_PATCH',), 'image': ('IMAGE',)},
                'optional': {'match_context': ('BOOLEAN', {'default': True})}}

    RETURN_TYPES = ('STRING',)
    RETURN_NAMES = ('candidate_frame',)
    OUTPUT_NODE = True
    FUNCTION = 'save'
    CATEGORY = CATEGORY

    def save(self, patch, image, match_context=True):
        import folder_paths
        from .browser import grant
        if source_identity(patch['description']) != patch['identity']:
            raise ValueError('The source changed during editing. Reload the footage before accepting this frame.')
        result = composite_patch(patch, image, match_context)
        directory = Path(folder_paths.get_output_directory()) / 'paintout' / 'clean_frames'
        directory.mkdir(parents=True, exist_ok=True)
        stem = f"clean_{patch['frame']:06d}_{secrets.token_hex(6)}"
        png, master = directory / (stem + '.png'), directory / (stem + '.exr')
        # The float EXR keeps untouched working-space samples exact. PNG is a portable, quantised preview.
        colour_space = patch.get('colour_space', 'srgb_display')
        save_exr(str(master), result, colour_space, False)
        preview = sdr_view(torch.from_numpy(result), True).numpy() if colour_space == 'acescg' else result
        save_png16(png, preview)
        row = {'file': str(master), 'png_file': str(png), 'url': grant(png),
               'master_url': grant(master), 'frame': patch['frame'],
               'colour_space': colour_space, 'preview_colour_space': 'srgb_display',
               'edit_view': patch.get('edit_view', 'SDR'), 'width': result.shape[1], 'height': result.shape[0]}
        descriptor = {'filename': png.name, 'subfolder': 'paintout/clean_frames', 'type': 'output'}
        return {'ui': {'zura_frame': [row], 'images': [descriptor]}, 'result': (str(master),)}


NODE_CLASS_MAPPINGS = {cls.__name__: cls for cls in (ZuraPaintoutFrameCrop, ZuraPaintoutFrameComposite)}
NODE_DISPLAY_NAME_MAPPINGS = {
    'ZuraPaintoutFrameCrop': 'Prepare Precise Frame Edit',
    'ZuraPaintoutFrameComposite': 'Blend Clean Frame into Original',
}
