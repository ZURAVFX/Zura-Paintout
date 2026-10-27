# Zura Paintout

A ComfyUI workflow for artist-guided video cleanup. Remove a subject using a tracked mask and clean-frame references, then deliver the repaired shot at the original plate dimensions and frame rate.

**The ComfyUI workflow is the main entry.** Paintout Studio, in [`app/`](app/README.md), is an optional full-window interface for preparing masks, editing clean frames and running the same processing graphs. You can use the workflows directly without opening the interface.

LTX 2.5 performs the video repair. The optional preparation tools use SAM3.1 for selection and tracking, and FLUX 3 Klein for clean-frame editing. Existing masks and externally painted clean frames work too. Inference runs on your ComfyUI machine; no hosted account or paid API is required by this package.

This develops the existing [Zura Nodes](https://github.com/ZURAVFX/ComfyUI_zura_nodes) paintout foundation. It does not claim authorship of ComfyUI, the models or their adapters. See [what changed](build/CHANGES.md) and [third-party notices](THIRD_PARTY_NOTICES.md).

This is a public testing build for the contest entry. Final demonstration media and artist acceptance are still pending.

## Run the Comfy workflow

Get the source from [ZURAVFX/Zura-Paintout](https://github.com/ZURAVFX/Zura-Paintout), or [download the source ZIP](https://github.com/ZURAVFX/Zura-Paintout/archive/refs/heads/main.zip). Extract it before running the installer. To install manually, copy the extracted folder into `ComfyUI/custom_nodes/Zura-Paintout`.

1. Prepare ComfyUI, the required node packs and the LTX model files using [`build/model-files.md`](build/model-files.md). The optional SAM and FLUX models are listed separately.
2. Install this node pack into ComfyUI's `custom_nodes` directory and install `requirements.txt` with **ComfyUI's own Python**. The Windows helper is `Install.ps1`. If you already have Zura Nodes with Paintout, use that installation instead: do not enable both packs, as they register the same node IDs and routes.
3. Restart ComfyUI. Open [`workflows/Zura_Paintout_Targeted.json`](workflows/Zura_Paintout_Targeted.json) by dragging it onto the ComfyUI canvas.
4. In the source node, choose your original plate and a matching black-and-white mask video or image sequence. White marks removal; black keeps the source. Set source colour space, start frame and frame count. The mask must align with the full source plate.
5. In the clean-frame guides node, replace the example image path with a genuinely clean frame. Set its original, zero-based source frame number and colour space. Add more guide records when the background or overlap changes. These frames can come from your own image editor; the app is optional.
6. Check the prompt, model filenames, seed and output settings, then queue the graph. Start with a short, continuous shot and a recoverable background. Inspect the saved result in motion and frame by frame.

The targeted template uses an existing removal mask and prepared clean frames. Interactive mask creation and FLUX editing are preparation tools in the optional app, not hidden stages of this render template.

For a complete scene without moving subjects, open [`workflows/Zura_Paintout_Full_Scene.json`](workflows/Zura_Paintout_Full_Scene.json). It uses the clean-plate adapter and does not require a removal mask. This is a separate workflow, rather than a late switch in a targeted repair.

## Comfy workflow

The editable templates use native ComfyUI subgraphs for model loading, conditioning and sampling. Packaged Zura nodes handle plate reading, guide coordinates, bounded guide attention and delivery. Native LTX nodes perform the model processing.

Matching API graphs are included as [`targeted.api.json`](workflows/targeted.api.json) and [`full-scene.api.json`](workflows/full-scene.api.json). They contain example paths, not ready-to-run media. See [`workflows/README.md`](workflows/README.md) for the inputs and node IDs.

### Plate handling

The plate, masks and guides share a full-frame stretch to the smallest enclosing supported 64-pixel grid. For example, 1920 × 1080 processes at 1920 × 1088 and returns to 1920 × 1080. No centre crop or smaller proxy is silently substituted.

Delivery restores the original plate dimensions, source frame rate and selected frame count. Image sequences use the chosen sequence frame rate. EXR delivery can preserve source pixels outside the effective repair region; encoded review video is not a pixel-identical master.

## Run the optional app

After installing the same node pack, choose **Open Zura Paintout** from ComfyUI's command search, use its visible **Zura Paintout** button, or add `?paintout=1` to your own ComfyUI URL. With integrated Zura Nodes, use **Paintout Studio** instead.

The interface supplies an interactive timeline, hard-mask painting and erasing, independent tracking segments, clean-frame cards, FLUX crop-and-stitch editing, external-edit review and saved projects. It submits local ComfyUI graphs; it does not replace ComfyUI with another inference backend.

Here, `app/` is the optional frontend source directory. It runs as a ComfyUI extension in a full-window workspace. It is not a separate Next.js server or a hosted `/app` endpoint. No Node.js build is needed for this interface. See [`app/README.md`](app/README.md).

## Change the workflow or app

Open the native workflow in ComfyUI and explore its subgraphs. Keep the plate transform, guide frame numbers and delivery metadata connected when changing the sampling path. Export **Workflow (API)** for external queue clients.

The existing graph builder is `app/paintout_recipes.js`; the interactive controller is `app/paintout_editor.js`. The source-space viewer and timeline are separate modules. `paintout/` contains the Python node implementations. Review [`build/CHANGES.md`](build/CHANGES.md) before treating the broader Zura Studio project as contest-specific work.

## Build the Comfy environment

Use [`build/model-files.md`](build/model-files.md) for node dependencies and model locations. [`build/tested-environment.json`](build/tested-environment.json) records the observed development setup; it is not a minimum hardware specification or a reproducible lockfile.

Run the package's structural checks without loading models:

```sh
python build/verify.py
```

The development GPU was an RTX 4080 with 16 GB VRAM. Fresh CPU dependency installation passed on the same Windows workstation. An independent-machine installation and representative final-shot acceptance remain outstanding.

## Limits

- Use one continuous shot. Heavy occlusion and backgrounds that are never visible may require additional clean guides or a different shot.
- Tracking can lose the subject. Review the whole mask and repair difficult sections; multiple passes are supported.
- Never accept a clean guide with remnants of the removed subject or distorted subjects that should remain.
- Shot length, resolution and guide count affect memory. The current 993-frame validation ceiling is not a promise that every such render fits the GPU.
- The native file picker targets local Windows ComfyUI. Other operating systems and remote-browser file selection have not been validated.
- Models may require separate access approval and licence acceptance. No weights, footage or showcase results are bundled.
- This is a contest preparation build. Demo media and the submission video are still to be supplied by the artist.

## Licence

Application code is AGPL-3.0-only. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Models and separately installed node packs retain their own terms.

The repository presentation follows [Comfy OpenJutsu](https://github.com/Comfy-Org/comfy-openjutsu) as a format reference. Its cloud setup and MIT licence do not apply to this project.
