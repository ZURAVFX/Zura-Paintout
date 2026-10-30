# Start here: local testing

Zura Paintout runs in your existing ComfyUI installation. No Comfy account, API key, paid credits or hosted service is required. Downloading models requires an internet connection and may require the model provider's access approval.

## Install once

1. In ComfyUI Manager / Extensions, search for **Zura Paintout**, install and restart. The [Registry listing](https://registry.comfy.org/nodes/zura-paintout) exists; search availability can lag. See the [README](../README.md#run-the-comfy-workflow) for the current fallback.
2. Install **ComfyUI-LTXVideo** and **ComfyUI-KJNodes** through Manager.
3. Follow [model files](model-files.md) and [setup without a terminal](no-terminal-setup.md). The native render workflow needs LTX and its repair adapter. SAM and FLUX are optional preparation models.
4. If you already have Zura Nodes enabled, use its Paintout Studio and these workflows there. Do not enable both packs together.

## Recommended: native ComfyUI workflow

Open **Workflow → Browse Templates → Zura Paintout → Zura_Paintout_Targeted**. Supply a short plate, a matching removal mask (white removes, black keeps) and clean guides with their original source frame numbers. Set the model names, source range and output location, then queue.

Start with a subject whose background is visible elsewhere in the shot. Check that every guide removes the subject completely and preserves other people. Review the result in motion and verify output dimensions, frame rate and frame count.

## Optional: Paintout Studio

Use the **Zura Paintout** button or **Open Zura Paintout** command in ComfyUI. With integrated Zura Nodes, choose **Paintout Studio**. **Add footage** opens **Trim clip** first. Choose the exported section and click **Use trimmed clip**. In Mask, select the subject with points for an automatic red preview, or paint the starting mask directly, then track it. You can also import a matching mask video. The Mask timeline In/Out controls tracking only; reopen Trim clip to change the export. Each completed mask appears as a trimmable timeline bar with a delete control. Select a bar for corrections, or use Add mask at a later frame for another segment. Clear selection removes an untracked selection.

Add clean frames on the timeline. Check mask expansion visually, clean with FLUX or import your own edited frame, then compare and accept. Press X to discard an unaccepted generation while retaining its mask. Render after the masks and guides are clean. Choose the colour pipeline in Render; [HDR pipelines](hdr.md) explains the extra models and current limits.

## Acceptance and feedback

Use the full [manual test checklist](manual-testing.md) before treating this testing build as final v1. In particular test mask corrections on later frames, independent clean-guide expansion, external imports, save/reopen and original-resolution output.

Report: build/commit, shot dimensions and frame rate, source range, stage, steps, expected result, actual result, affected frame numbers and any ComfyUI error. Include a screenshot or short capture where useful.

Independent-machine installation and artist acceptance remain open. Passing automated checks does not establish final shot quality.
