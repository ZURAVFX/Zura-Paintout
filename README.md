# Zura Paintout

**Precise video object removal in ComfyUI.**

Remove unwanted people, objects and distractions from your shots with control over exactly where the repair happens. Give LTX a removal mask and clean-frame references, guide the reconstruction, and deliver the shot at its original resolution and frame rate.

**Recommended: use the workflow directly in ComfyUI.** Install the custom node pack, add the required models, open the included template and queue your repair. Everything runs in your existing ComfyUI installation. No separate application is required.

- **Control the removal.** Use a mask to define the repair area and clean-frame guides to show what belongs behind the subject.
- **Keep the plate aligned.** Video, masks and guides share the same processing transform; delivery restores the original dimensions, frame rate and selected frame count.
- **Fit your VFX pipeline.** Use masks and clean frames from your existing tools, export EXR masters and keep the native ComfyUI graph editable.
- **Work locally.** LTX 2.5 runs on your ComfyUI machine. This package requires no hosted account or paid API.

Want a guided interface for preparing the inputs? Optional [Paintout Studio](app/README.md) adds a timeline, mask painting and tracking, and precise FLUX 3 Klein clean-frame editing. It is included in the same node pack and uses ComfyUI's queue.

## Run the Comfy workflow

**This is the recommended way to use Zura Paintout.** Installation is being prepared for ComfyUI's extension manager. Registry submission and availability are separate steps; this README will link the listing once publication is confirmed.

The intended setup uses ComfyUI's interface throughout:

1. Open **Manager / Extensions**, search for **Zura Paintout**, install it and restart when prompted. Manager installs the Python dependencies declared by the pack.
2. Install **ComfyUI-LTXVideo** and **ComfyUI-KJNodes** through Manager if they are missing. Download the required LTX model files using the links in [`build/model-files.md`](build/model-files.md), then place them in the listed folders using your file browser. Model access approval may be required. If FFmpeg is missing, copy `ffmpeg` and `ffprobe` into `ComfyUI/ffmpeg/bin/`. See [setup without a terminal](build/no-terminal-setup.md).
3. Open **Workflow → Browse Templates** and choose **Zura Paintout → Zura_Paintout_Targeted**. Both native templates are included in `example_workflows/` for ComfyUI's Template Browser.
4. Enter the plate, mask and clean-guide paths, check the source range and colour space, then queue the repair.

For the current GitHub build, use Manager's **Install via Git URL** option if your version supports it, with `https://github.com/ZURAVFX/Zura-Paintout`. Do not change Manager's security settings to enable this. The manual fallback below remains available while the listing is pending.

### Manual installation and workflow inputs

1. **Install the custom node pack.** [Download the source ZIP](https://github.com/ZURAVFX/Zura-Paintout/archive/refs/heads/main.zip), extract it into `ComfyUI/custom_nodes/Zura-Paintout`, then install `requirements.txt` with **ComfyUI's own Python**. The Windows helper is `Install.ps1`. You can also clone [this repository](https://github.com/ZURAVFX/Zura-Paintout) directly into that folder.
2. **Set up the required models once.** Install ComfyUI-LTXVideo, ComfyUI-KJNodes, FFmpeg/ffprobe and the LTX files listed in [`build/model-files.md`](build/model-files.md). For targeted repair, use the Obscura adapter. SAM and FLUX are optional: the main workflow accepts masks and clean frames you have already prepared.
3. **Restart ComfyUI and load the workflow.** Drag [`Zura_Paintout_Targeted.json`](workflows/Zura_Paintout_Targeted.json) onto the canvas.
4. **Add the plate and removal mask.** In the source node, enter your original plate and matching black-and-white mask video or image sequence. White marks removal; black keeps the source. Set source colour space, start frame and frame count. The mask must align with the full source plate.
5. **Add clean-frame guides.** Replace the example image path with a clean frame and set its original, zero-based source frame number and colour space. Add guides where the background or overlap changes. Use your preferred image editor or the optional Studio.
6. **Queue the repair.** Check the prompt, model filenames, seed and output settings, then queue the graph. Review the saved result in motion and frame by frame.

Already using Paintout through Zura Nodes? Keep that installation and load these workflows there. Do not enable both packs: they register the same node IDs and routes.

The targeted template uses an existing removal mask and prepared clean frames. Interactive mask creation and FLUX editing are preparation tools in the optional app, not hidden stages of this render template.

For a complete scene without moving subjects, open [`workflows/Zura_Paintout_Full_Scene.json`](workflows/Zura_Paintout_Full_Scene.json). It uses the clean-plate adapter and does not require a removal mask. This is a separate workflow, rather than a late switch in a targeted repair.

## Comfy workflow

The editable templates use native ComfyUI subgraphs for model loading, conditioning and sampling. Packaged Zura nodes handle plate reading, guide coordinates, bounded guide attention and delivery. Native LTX nodes perform the model processing.

Matching API graphs are included as [`targeted.api.json`](workflows/targeted.api.json) and [`full-scene.api.json`](workflows/full-scene.api.json). These are local ComfyUI queue graphs for developers, not a hosted API service. They contain example paths, not ready-to-run media. See [`workflows/README.md`](workflows/README.md) for the inputs and node IDs. A separately deployable cloud version is not included in this release.

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

Developers can run the package's structural checks with Python 3.11 or newer, without loading models:

```sh
python build/verify.py
```

The development GPU was an RTX 4080 with 16 GB VRAM. Fresh CPU dependency installation passed on the same Windows workstation. An independent-machine installation and representative final-shot acceptance remain outstanding.

## Limits

- This is a public testing build for the contest entry. Final demonstration media and artist acceptance are still pending.
- Use one continuous shot. Heavy occlusion and backgrounds that are never visible may require additional clean guides or a different shot.
- Tracking can lose the subject. Review the whole mask and repair difficult sections; multiple passes are supported.
- Never accept a clean guide with remnants of the removed subject or distorted subjects that should remain.
- Shot length, resolution and guide count affect memory. The current 993-frame validation ceiling is not a promise that every such render fits the GPU.
- The native file picker targets local Windows ComfyUI. Other operating systems and remote-browser file selection have not been validated.
- Models may require separate access approval and licence acceptance. No weights, footage or showcase results are bundled.

## Licence

Application code is AGPL-3.0-only. See [`LICENSE`](LICENSE) and [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md). Models and separately installed node packs retain their own terms.

Zura Paintout develops the existing [Zura Nodes](https://github.com/ZURAVFX/ComfyUI_zura_nodes) paintout foundation. See [what changed](build/CHANGES.md) for the entry's contribution and model attribution.

The repository presentation follows [Comfy OpenJutsu](https://github.com/Comfy-Org/comfy-openjutsu) as a format reference. Its cloud setup and MIT licence do not apply to this project.
