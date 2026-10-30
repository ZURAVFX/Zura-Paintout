"""HDR conversion adapters. Inference stays in the official native LTX graph."""
from pathlib import Path
import json
import math
import torch
from .paintout import (describe, frames, from_linear, native_colour, decode_ct,
                       resize, save_exr, frame_progress, is_hdr, selected_space, COLOUR_SPACES, CATEGORY)

MAX_HDR_FRAMES = 121
MAX_HDR_PIXEL_FRAMES = 40_000_000


def conversion_shape(width, height, count):
    if any(type(v) is not int or v < 1 for v in (width, height, count)):
        raise ValueError('HDR conversion needs positive whole dimensions and frame count.')
    pw, ph = math.ceil(width/64)*64, math.ceil(height/64)*64
    length = max(9, math.ceil((count-1)/8)*8+1)
    if count > MAX_HDR_FRAMES or max(pw, ph) > 4096 or pw*ph*length > MAX_HDR_PIXEL_FRAMES:
        raise ValueError('SDR to HDR conversion is limited to 121 frames and 40 million padded pixel-frames. Trim a shorter shot; no smaller proxy is substituted.')
    return pw, ph, length


class ZuraPaintoutColourCheck:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'source': ('STRING', {'default': ''}),
                'colour_space': (COLOUR_SPACES,),
                'pipeline': (['sdr_sdr', 'sdr_hdr', 'hdr_hdr'],),
                'frame_count': ('INT', {'default': 81, 'min': 1, 'max': 993})}}
    RETURN_TYPES = ('STRING',)
    RETURN_NAMES = ('validated_source',)
    FUNCTION = 'check'
    CATEGORY = CATEGORY

    @classmethod
    def IS_CHANGED(cls, **kwargs):
        return float('nan')

    def check(self, source, colour_space, pipeline, frame_count):
        from .browser import checked_path
        path = checked_path(source)
        description = describe(str(path))
        if colour_space not in COLOUR_SPACES or pipeline not in ('sdr_sdr', 'sdr_hdr', 'hdr_hdr'):
            raise ValueError('Choose a supported source colour space and colour pipeline.')
        space = selected_space(description, colour_space)
        if is_hdr(space) and pipeline != 'hdr_hdr':
            raise ValueError('This is HDR footage. Choose HDR to HDR to preserve its highlights.')
        if not is_hdr(space) and pipeline == 'hdr_hdr':
            raise ValueError('HDR to HDR needs HLG, PQ or a scene-linear/ACES source. Choose SDR to HDR for SDR footage.')
        if type(frame_count) is not int or not 1 <= frame_count <= 993:
            raise ValueError('Choose between 1 and 993 source frames.')
        if pipeline == 'sdr_hdr':
            conversion_shape(description['width'], description['height'], frame_count)
        return (str(path),)


class ZuraPaintoutHDRPrepare:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'saved_sequence': ('STRING',), 'plate': ('ZURA_PLATE',)}}
    RETURN_TYPES = ('IMAGE', 'ZURA_HDR_TAKE', 'INT', 'INT', 'INT', 'FLOAT')
    RETURN_NAMES = ('acescct_guide', 'take', 'width', 'height', 'frames', 'fps')
    FUNCTION = 'prepare'
    CATEGORY = CATEGORY

    def prepare(self, saved_sequence, plate):
        if plate.get('processing') != 'SDR (sRGB)' or is_hdr(plate.get('space')):
            raise ValueError('SDR to HDR conversion expects an SDR paintout result.')
        source = describe(saved_sequence)
        count = plate['count']
        if source['count'] != count or (source['width'], source['height']) != (plate['source']['width'], plate['source']['height']):
            raise ValueError('The repaired sequence does not match the original plate raster and frame count.')
        pw, ph, length = conversion_shape(source['width'], source['height'], count)
        images = []
        for a in frames(source, 0, count):
            srgb = from_linear(torch.from_numpy(a).float(), 'srgb_display')
            if not torch.isfinite(srgb).all() or srgb.min() < -.002 or srgb.max() > 1.002:
                raise ValueError('SDR conversion input contains invalid or extended-range pixels. Choose HDR to HDR for an HDR source.')
            images.append(resize(srgb.clamp(0, 1)[None], ph, pw))
        images = torch.cat(images)
        if length > count:
            images = torch.cat([images, images[-1:].expand(length-count, -1, -1, -1)])
        # Official 2.5 SDR-to-HDR conditioning uses ACEScct, never JPEG/CRF.
        guide = native_colour(images, 'sRGB', 'HDR ACEScct')
        take = dict(plate=plate, width=source['width'], height=source['height'], count=count,
                    padded=[ph, pw], padded_count=length)
        # The official conversion schedule conditions high-rate sources at 60;
        # delivery retains the original rational clock in the untouched take.
        conditioning_fps = 60.0 if float(plate['fps']) > 30 else float(plate['fps'])
        return guide, take, pw, ph, length, conditioning_fps


class ZuraPaintoutHDRSave:
    @classmethod
    def INPUT_TYPES(cls):
        return {'required': {'images': ('IMAGE',), 'take': ('ZURA_HDR_TAKE',),
                'output_name': ('STRING', {'default': 'paintout/hdr'}),
                'precision': (['float32', 'float16'],),
                'export_format': (['HLG video', 'EXR sequence', 'EXR + HLG video'],)}}
    RETURN_TYPES = ('STRING',)
    RETURN_NAMES = ('saved_sequence',)
    OUTPUT_NODE = True
    FUNCTION = 'save'
    CATEGORY = CATEGORY

    def save(self, images, take, output_name, precision, export_format):
        import folder_paths
        from .media import Delivery
        if images.ndim != 4 or images.shape[-1] != 3 or len(images) < take['count'] or tuple(images.shape[1:3]) != tuple(take['padded']):
            raise ValueError('HDR decode does not match the internal frame/raster padding.')
        if precision not in ('float32', 'float16') or export_format not in ('HLG video', 'EXR sequence', 'EXR + HLG video'):
            raise ValueError('Choose a supported HDR export format and EXR precision.')
        if not torch.isfinite(images).all():
            raise ValueError('HDR decode contains invalid pixels. No master was exported.')
        base = Path(folder_paths.get_output_directory()).resolve()
        relative = Path(output_name)
        if relative.is_absolute() or '..' in relative.parts or not str(relative).strip():
            raise ValueError('Use an output folder inside ComfyUI output.')
        root = base/relative
        root.parent.mkdir(parents=True, exist_ok=True)
        for index in range(1, 100000):
            target = root.parent/f'{root.name}_hdr_{index:04d}'
            try: target.mkdir(); break
            except FileExistsError: continue
        else: raise ValueError('No free HDR output directory.')
        plate = dict(take['plate'], space='acescg', processing='HDR (ACEScct)')
        delivery = Delivery(target, plate, export_format, True)
        progress = frame_progress(take['count'])
        for index in range(take['count']):
            linear = resize(decode_ct(images[index:index+1].detach().float().cpu()), take['height'], take['width'])[0]
            if not torch.isfinite(linear).all():
                raise ValueError('HDR decode exceeds finite scene-linear range. No usable master was exported.')
            if precision == 'float16' and export_format != 'HLG video' and linear.abs().max() > 65504:
                raise ValueError('HDR pixels exceed half-float EXR range. Choose float32 precision.')
            if export_format != 'HLG video':
                save_exr(target/f"frame_{plate['start']+index:06d}.exr", linear.numpy(), 'acescg', precision=='float16')
            delivery.append(linear)
            progress(index+1)
        (target/'paintout.json').write_text(json.dumps(dict(pipeline='sdr_hdr', plate={k:v for k,v in plate.items() if not k.startswith('_')},
            notes='Official LTX SDR-to-HDR conversion after SDR repair. Full-frame generative conversion can change unmasked pixels. Original raster, frame count, rate and source audio restored.'), indent=2), encoding='utf-8')
        return {'ui': {'text': [f"Saved {take['count']} HDR frames: {target}"], **delivery.finish()}, 'result': (str(target),)}


NODE_CLASS_MAPPINGS = {c.__name__: c for c in (ZuraPaintoutColourCheck, ZuraPaintoutHDRPrepare, ZuraPaintoutHDRSave)}
NODE_DISPLAY_NAME_MAPPINGS = {'ZuraPaintoutColourCheck': 'Check SDR / HDR Colour Pipeline', 'ZuraPaintoutHDRPrepare': 'Prepare Repaired SDR for HDR', 'ZuraPaintoutHDRSave': 'Save HDR at Original Plate Size / Rate'}
