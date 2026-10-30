# Optional Paintout Studio interface

The main entry is the [ComfyUI workflow](../README.md#run-the-comfy-workflow). This folder provides an optional full-window ComfyUI frontend for preparing its masks and clean-frame guides.

After installing the node pack, use **Open Zura Paintout**, the visible **Zura Paintout** button, or `?paintout=1` on your ComfyUI address. The integrated Zura Nodes version is called **Paintout Studio**. Neither route requires a launcher node.

1. Choose Targeted repair and add footage. **Trim clip** opens first. Drag In/Out to choose the exported clip, then click **Use trimmed clip** to continue to Mask. Reopen Trim clip to change delivery later.
2. Use the viewer toolbar to click the subject with positive/negative points. The red mask previews automatically. Or paint the starting mask directly, then click **Track mask through shot**. Import mask video accepts a matching black-and-white mask instead. In Mask, timeline In/Out chooses the tracking range only; it cannot alter the export range.
3. Scrub to paint or erase corrections. Each completed mask becomes a timeline bar: select it to edit, drag its ends to trim, or click its x to delete. **Add mask** starts another selection; overlapping masks combine. **Clear selection** removes an untracked selection.
4. Add clean-frame cards on the timeline. Draw the removal area, include shadows where needed and adjust its hard expansion. Clean with FLUX 3 Klein or import an external edit. Accept only a clean, undistorted guide; X discards an unaccepted candidate when a text field is not focused.
5. Choose the Render colour pipeline, then render through ComfyUI's queue and inspect the output. See [HDR pipelines](../build/hdr.md) for SDR to HDR and HDR to HDR requirements and limits.

The app is a ComfyUI web extension, not a separately hosted service. It uses the same Python nodes, native graph recipes, models and queue as the workflow. Local filesystem dialogs open on the machine running ComfyUI. A remote browser does not make processing local to that browser.

`paintout_app.js` opens the workspace; `studio_paintout.js` owns source/configuration; `paintout_editor.js` handles editing and project state; `paintout_recipes.js` builds the LTX graphs. UI assets are bundled locally. There is no Next.js or Node.js requirement.

See [manual testing](../build/manual-testing.md) before calling this final v1. Do not install this standalone pack alongside an enabled integrated Zura Nodes Paintout backend.
