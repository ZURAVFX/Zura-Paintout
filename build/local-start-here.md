# Start here: local testing

Zura Paintout runs in your existing ComfyUI installation. No Comfy account, API key, paid credits or hosted service is required. Downloading models requires an internet connection and may require the model provider's access approval.

## Install once

1. The [Registry listing](https://registry.comfy.org/nodes/zura-paintout) has 0.1.3 Pending review; Manager installation is not yet verified. Use Manager's **Install via Git URL** for `https://github.com/ZURAVFX/Zura-Paintout` if available under your existing settings, then restart. See [setup without a terminal](no-terminal-setup.md) for the current installation route and fallback.
2. Install **ComfyUI-LTXVideo** and **ComfyUI-KJNodes** through Manager.
3. Follow [model files](model-files.md) and [setup without a terminal](no-terminal-setup.md). The native render workflow needs LTX and its repair adapter. SAM and FLUX are optional preparation models.
4. If you already have Zura Nodes enabled, use its Paintout Studio and these workflows there. Do not enable both packs together.

## Recommended: native ComfyUI workflow

Open **Workflow → Browse Templates → Zura Paintout → Zura_Paintout_Targeted**. Supply a short plate, a matching removal mask (white removes, black keeps) and clean guides with their original source frame numbers. Set the model names, source range and output location, then queue.

Start with a subject whose background is visible elsewhere in the shot. Check that every guide removes the subject completely and preserves other people. Review the result in motion and verify output dimensions, frame rate and frame count.

## Optional: Paintout Studio

Use the **Zura Paintout** button or **Open Zura Paintout** command in ComfyUI. With integrated Zura Nodes, choose **Paintout Studio**. **Add footage** opens **Trim clip** first. Choose the exported section and click **Use trimmed clip**. In Mask, select the subject with points for an automatic red preview, or paint the starting mask directly, then track it. You can also import a matching mask video. The Mask timeline In/Out controls tracking only; reopen Trim clip to change the export. Each completed mask appears as a trimmable timeline bar with a delete control. Select a bar for corrections, or use Add mask at a later frame for another segment. Clear selection removes an untracked selection.

Add clean frames on the timeline. Check mask expansion visually, clean with FLUX or import your own edited frame, then compare with Show original. Generated results become active paint layers automatically. Delete an individual layer to remove that edit and restore its hard mask for retry. Use Remove all paint layers to restore the original frame while keeping its paint mask ready for another attempt. Each layer has adjacent Blend edge and Brightness controls. They update on release without another FLUX run. Blending stays inside the mask and keeps repairs opaque where they leave the frame. New FLUX results conservatively match exposure using unchanged crop context. The last cleanup instruction stays across frames and reload until Start over. Imported edits still require the boundary review. Render after the masks and guides are clean. Choose the colour pipeline in Render; [HDR pipelines](hdr.md) explains the extra models and current limits. For SDR to HDR, save the repair first, then click Convert repaired clip to HDR. A failed conversion can be retried from the saved repair without generating the repair again.

## Acceptance and feedback

Use the full [manual test checklist](manual-testing.md) before treating this testing build as final v1. In particular test mask corrections on later frames, independent clean-guide expansion, external imports, save/reopen and original-resolution output.

Report: build/commit, shot dimensions and frame rate, source range, stage, steps, expected result, actual result, affected frame numbers and any ComfyUI error. Include a screenshot or short capture where useful.

Independent-machine installation and artist acceptance remain open. Passing automated checks does not establish final shot quality.

## Finding the controls

The viewer keeps Select, Paint, Erase and Pan together. Mask options contains imported masks, tracking settings and mask history. Frame actions contains imports, downloads and Remove all paint layers. Workspace holds saved projects, model downloads and history, with Start a new paintout separated at the bottom. View switches between source, mask, painted frame and result. Processing size, clip range and delivery options are under Settings on Render. Input/output SDR or HDR stays visible in the header.
