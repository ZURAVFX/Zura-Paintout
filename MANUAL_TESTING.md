# Start here: v1.0.0-rc.1

Use a copy of a short, continuous shot. Start with a visible object against a recoverable background. The bedroom overlap test is a stress test and remains unsuitable as the final demonstration.

## First test

1. If ComfyUI shows its first-run template chooser, close it to reach Paintout. Choose Targeted repair or Full-scene clean plate, then add footage. Check its original dimensions, duration and frame rate. For an image sequence, set its intended frame rate before working. Import must open **Trim clip**. Drag In/Out to choose the exported section, then click **Use trimmed clip**. Targeted repair must continue to Mask; full-scene mode must continue to Render.
2. In Mask, use Select subject / Exclude area points in the viewer toolbar. The red preview must update automatically after each point change; there is no Preview button. Paint mask can also create the starting mask directly. Click **Track mask through shot** once the red selection is ready. Alternatively use Import mask video: white removes, black keeps; match the original plate dimensions, frame rate and full length. In Mask, drag the timeline In and Out handles to choose the tracking range; focused handles also accept arrow keys for one-frame adjustments. Confirm these handles do not change the export range. Reopen **Trim clip**, change the exported section and confirm it again. Scrub the entire range, especially entry, exit and overlap frames. Trimming never renumbers or deletes your guides.
3. Use **Add mask** for another object or missed coverage. Completed masks must remain visible in red while selecting additional coverage. Scrub to any frame and use Paint mask or Erase mask to fix it. Corrections save automatically to that frame. Adjust Expand mask while watching the hard red boundary; Red overlay only changes display opacity. Track a correction through a section explicitly if needed. Mark genuinely absent sections explicitly. Use Review next change for amber warnings; confirm it seeks only within the trim and does not change masks. Inspect the result yourself: area checks cannot reliably identify occlusion.
4. Scrub to the desired frame and click Add clean frame (or press K while the timeline is focused). Paint the unwanted area, including shadows if needed, and expand this guide’s mask independently of the video mask. Run FLUX and compare with Show original. The result must become an active paint layer without an acceptance button. Paint again to add another repair. Delete an individual poor layer and confirm the others remain, or choose Remove all paint layers to restore the original. Use only fully clean guides. Add two or three informative guides where the background or occlusion changes.
5. Test the external-edit route: download one original, edit it and import it onto the same frame card. The image must retain source dimensions and have normal orientation. Drag-and-drop imports are also supported. Change one area inside the repair and another outside it: the latter must appear in red during review. Test Keep current repair area and confirm the outside change is excluded, then reimport and test Include highlighted edits. Only this clean guide should expand; the shot removal mask must remain unchanged. Generate two FLUX layers on different areas. Both must be used without an acceptance button. Delete the older layer and confirm its paint disappears while later paint remains. Reload and check the retained stack. Use Remove all paint layers and verify the original frame returns, the guide is no longer used for rendering, and the shot mask is unchanged. Paint again to start a new stack.
6. In Render, the mask from Mask is used automatically. Incomplete mask coverage directs you back to Mask. Check range, prompt and export format. Processing stretches to the nearest larger 64-pixel grid. Delivery retains the original dimensions, frame rate and selected number of frames. Choose EXR + SDR video for a reviewable master and preview.
7. Play the result, inspect edges frame by frame and compare the scene outside the repair. Report remnants, jitter, texture changes and unwanted edits separately from UI faults.

## Reliability checks

- Reopen the project from Projects, reload the browser and verify guides, frame numbers, mask revision and settings.
- Switch Mask / Clean frames / Render, then Source / Result. No stale overlay should remain on the result.
- Cancel a queued or running tool job. Only that job should stop; the previous active guide must survive.
- Import a wrong-size image. It should be rejected without replacing the active guide.
- Try dark/light themes, window resizing, zoom/pan, timeline zoom, arrow keys and K to add a guide.
- Open the editable graph and return to the workspace. Essential controls and native model stages remain editable.
- Check output with your usual VFX tool: width, height, frame rate, frame count, first/last frame and audio synchronisation.

## Feedback format

Copy this for each issue:

```
Build: 1.0.0-rc.1
Shot: name, dimensions, frame rate, selected source range
Stage: Mask / Clean frames / Render / Project / Install
Steps:
Expected:
Actual:
Frame numbers:
Screenshot or short recording:
ComfyUI error if present:
Priority: prevents work / workaround available / polish
```

No lower-resolution processing proxy is substituted automatically. Plates above the current 4096-pixel-per-side limit are rejected. Model memory limits can require a shorter section. Variable-frame-rate or rotated video must be conformed first. HDR FLUX clean-frame editing uses an SDR display view and approximate reconstruction inside its edit area; inspect it carefully or use externally prepared HDR guides. EXR delivery carries RGB, not source alpha, AOVs or all source headers. Video previews may be smaller than the master; judge master dimensions using the main export or EXR sequence. Odd-size video masters use 4:4:4 encoding to preserve dimensions; some players may need an EXR or an even-size viewing proxy.

Do not call this final v1 until your acceptance pass is complete.

## Mask segments and clean-frame expansion

- Each completed mask appears as a timeline bar. Click a bar to select its mask; drag either end to trim its duration. Extend it again within its tracked frames and verify the mask returns. Focus a handle and use arrow keys for one-frame changes. Source trim and mask trim must remain independent.
- Choose **Add mask** at the playhead, select or paint another subject and track it. Point previews must update automatically. A second bar must appear without changing the first. Correct a selected mask on the first bad frame and choose **Update tracking from here**. Earlier frames and other masks must remain unchanged. Delete one overlapping mask with its bar’s × and verify the other remains. Clear an untracked selection and confirm it is removed without changing completed masks. For reappearance after occlusion, add a second mask starting later; there is no split tool.
- In **Clean frames**, select a painted clean frame and increase **Expand mask**. The red boundary must expand immediately and remain after switching frames. This changes only that guide. Each generation uses the current painted frame and creates a new active layer. The next layer starts with an empty paint mask. Generate again to add another repair.

## FLUX target-reference checks

- Paint over an object and name it explicitly in the removal instruction, for example Remove the silver car. Confirm the original crop reference still shows the named object to FLUX, while the final result changes only the effective hard paint area. Compare with the source and inspect retained people and neighbouring objects.
- Repeat with a generic painted-area cleanup instruction. This route should use the erased reference. Judge both results separately; the controlled frame-0 car test does not establish success for every shot.

## HDR acceptance checks

- Test all three Render colour choices with correctly identified sources. SDR → SDR must retain the SDR route. HDR → HDR must reject an explicitly SDR source; HDR footage must not silently use the SDR route.
- For HDR → HDR, use a short HLG/PQ clip or scene-linear EXR sequence with known highlights. Export EXR + HLG video. Check original dimensions, rational frame rate, selected frame count and first/last frame. Check scene-linear highlight values, exposure and colour in a colour-managed VFX viewer. Compare the EXR outside the effective repair against the source; encoded video is not an exact-pixel reference.
- Clean one HDR guide with FLUX. Check its display preview looks normal, its active master is HDR EXR, and pixels outside its edit/protection areas remain unchanged. Inspect repaired highlights and mask joins: FLUX’s SDR-view reconstruction is approximate inside the edit.
- For SDR → HDR, use a short clip within the 121-source-frame limit. Confirm the 40-million pixel-frame guard applies per 9- or 17-frame guide window, with a separate 8 GiB CPU guide limit. Run the repair and confirm Repair saved appears before conversion begins. Click Convert repaired clip to HDR to queue the second stage. Inspect the entire image for generative changes, including outside the original mask. Verify restored dimensions, selected frame count and frame rate.
- Cancel the HDR stage, then reload the browser. Confirm the saved SDR repair and conversion checkpoint remain. Use Retry HDR conversion and verify only HDR is queued, not the repair. Repeat with a simulated failed conversion. Check cancellation and retry do not erase earlier outputs. Cached model weights should be unloaded at the HDR boundary; do not assume this clears every VRAM allocation.
- Render a streaming TiledFusion clip long enough to use overlapping windows. Inspect every temporal join for seams, exposure jumps and discontinuity. This route has not yet passed a GPU render test; report actual raster, count, tile settings and memory outcome.
- Try an over-limit SDR → HDR clip. It must stop with guidance to trim shorter; it must not silently reduce resolution. Missing HDR models must show a setup message.
- Test source tags set to Auto and an explicit, correct colour-space override. Do not use metadata tags alone as evidence that a result contains usable HDR.

These checks require real renders and artist review. Passing automated colour-transform, graph and file tests alone does not qualify HDR production quality.
