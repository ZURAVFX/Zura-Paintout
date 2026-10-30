# 0.1.3: paint-layer retry and blending

Removing paint layers keeps the effective mask ready to retry. Adds adjacent brightness and blend controls, conservative exposure matching for new generations and opaque coverage at physical frame edges.

# 0.1.2: installed VAE compatibility

Recognises the authentic FLUX.2-dev VAE variant after full upstream hash verification, without replacing working models. Includes current local setup guidance.

# 0.1.1: local setup and repair testing update

Adds guided model downloads, layered clean-frame controls, mask timeline improvements and staged HDR conversion. This remains a testing release; Registry review and artist acceptance are separate gates.

# 0.1.0: standalone Registry testing release

Adds Registry metadata and automatic Python dependency declarations, native Template Browser entries and portable FFmpeg/ffprobe discovery without PATH changes. The workflow runs locally. API-format files are local queue exports; no cloud service is included.

# 30 October 2026: quieter Studio controls (development)

One short instruction per step, compact labelled tools and contextual action menus. Workspace groups Projects, Models and History; Start a new paintout is separated at the bottom. View groups preview choices. Frame actions groups imports, downloads and removing paint layers. Tracking settings and mask history remain available under Mask options. SDR/HDR input and output stay visible. Keyboard dismissal, focus return, contextual model setup and desktop/narrow dark/light layouts are checked. No processing settings or model quality changed.

# 30 October 2026: native Open graph stages (development)

Open graph now uses native editable stages for targeted/full-scene and SDR/HDR workflows. Root artist controls and inference settings survive export/reload. Removes the unnecessary layout-library dependency. This frontend update is newer than Registry 0.1.3.

# 30 October 2026 paint brightness and retry fixes

- Added Brightness beside each layer's Blend edge control. Exposure adjustment is saved per layer, works without another FLUX run and respects the hard repair and protection boundaries in SDR and HDR.
- Frame borders no longer fade towards the original plate when blending an edge-clipped repair. Interior joins retain the adjustable blend.
- New FLUX results use a conservative scalar exposure match from paired unchanged raw crop context, with a neutral fallback for insufficient or inconsistent context. This replaces frame-editor per-channel fitting and does not alter the video compositor.
- Remove all paint layers restores the original image while retaining a usable effective paint mask for immediate retry. It does not remove the tracked shot mask.

# 30 October 2026 model setup in Paintout

- Recognise the authentic FLUX.2-dev VAE variant already used by some Klein installations. Its different file size is accepted only after a full match against the pinned upstream SHA-256; verification is cached. The default download is unchanged.
- Models opens a guided setup panel for masking, FLUX clean frames, LTX repair and HDR conversion. Download missing models installs the pinned files into ComfyUI, reuses valid existing files and shared dependencies, and shows byte progress, cancellation and retry.
- Restricted Hugging Face files show their licence/access links and an optional read-token field. Paintout does not store that token. Missing custom-node code has separate ComfyUI Manager guidance.
- Workflow model selection recognises installed subfolders. New downloads are verified before installation and never overwrite existing final files.
- Downloader checks use synthetic local HTTP fixtures. Full model downloads and a fresh-machine GPU run remain manual validation.

# 30 October 2026 navigation clarity

- Next: clean frames and Next: render now appear beside the instructions above the viewer, with blue buttons and a directional icon. Generation actions remain lime. Existing stage and busy-state checks are preserved.
- The output summary and Generate action use a wrapping layout with explicit spacing, stacking on narrow screens. Verified in both Studio mounts, dark and light themes, at desktop and narrow widths.

# 30 October 2026 paint-layer controls and retry guidance

- Replaced the slow full-resolution CPU mask expansion after footage loading with identical square dilation using a fast filter. Exact-mask tests include Grow 55 and frame edges. A synthetic 78-frame 1920 x 1088 Grow 55 expansion completed in 0.9 seconds; this is not whole-render timing.

- Deleting a paint layer restores its effective hard mask with growth reset to zero, including when deleting the last layer, so the same area can be retried. Remove all paint layers restores the original frame and clears the paint mask.
- Each layer has a 0-100 px Blend edge control. Releasing the slider recomposes the preview without rerunning FLUX. Blending softens the join inside that layer's mask; outside and protected pixels remain unchanged in SDR and HDR.
- Default FLUX crop context increases from 128 to 256 source pixels. The maximum model side remains 1024 and the allowed repair boundary does not expand.
- The default instruction is Remove the foreground object. The last artist-entered instruction persists across frames, layers, new footage and browser reload until Start over.
- Clean-frame generation guidance uses Prepare, Generate and Save phases with a next action. These controls have structural and pixel-preservation checks; improved model quality is not established.

# 30 October 2026 HDR conversion staging and streaming development

- Studio saves the SDR repair before presenting Convert repaired clip to HDR. Conversion can be retried from the saved checkpoint without repeating the repair; reload restores the pending stage.
- Streaming TiledFusion keeps original-resolution delivery and uses overlapping temporal windows. The 121-source-frame limit remains. The 40-million pixel-frame guide-encoding limit applies per 9- or 17-frame window, with an 8 GiB CPU guide allocation guard. No smaller processing proxy is substituted.
- Cached model weights are unloaded at the conversion boundary. Other allocations may remain; this is not a guarantee of a full VRAM reset.
- The full native repair-and-conversion graph remains available. The streaming route has not yet passed a GPU render test; temporal joins, memory behaviour and final HDR shot quality still need manual validation.

# 30 October 2026 clean-frame removal fix

- Named removal instructions use the original crop as the FLUX reference, so the object named in the prompt remains visible to the model. Controlled frame-0 tests remove the foreground silver car instead of copying the grey blanking fill. Generic painted-area cleanup retains the erased reference. The hard final paint boundary and layer controls are unchanged.

- Clean-frame paint layers stack automatically after each FLUX generation. New edits use the current painted frame; delete individual layers without restoring older paint outside their masks, or choose Remove all paint layers to start from the original. No Use clean frame approval is required. Layer recomposition preserves source dimensions and HDR master pixels outside the retained masks.
- Remove repeated-edge crop padding. Crops take real adjacent image context to reach the model grid, including when touching the source edge; tiny or downscaled crops use a recorded reversible grid resize.
- Correct corrupted UTF-8 punctuation in progress and frame labels; package verification rejects common corrupted-text sequences.
- Show a plain-language next action above the viewer throughout trimming, masking, tracking, clean-frame review and rendering. Instructions stay visible on narrow screens. Accepted clean frames expose Next: render beside the editing controls.
- FLUX uses a single reference. Named-object removal uses the original crop so the named target remains visible to the model; generic painted-area cleanup uses an erased reference. A controlled frame-0 test removed the silver car. Unseen background and retained subjects still require artist review.
- Model-facing selection now follows mask expansion in original plate pixels, including protected areas. Final compositing keeps the original effective boundary without applying growth twice.
- Render settings expose mask block size, including Off. This changes LTX guidance, not the final repair boundary.

# 29 October 2026 development fix

- Preserve exact encoded levels when decoding native 8-bit RGB video. FFmpeg RGB8-to-RGB16 conversion on the tested build slightly darkened the source before repair; RGB8 now decodes directly, while YUV and high-bit-depth sources retain the 16-bit path. The raw-frame cache format is versioned to prevent old decoded pixels being reused.
- Added regression coverage for RGB8 levels, cached and streaming frame reads, trimmed frame order, and sub-8-bit precision in RGB16 footage.

# 1.0.0-rc.1

- Clean-frame Expand mask restores the red overlay on accepted frames, saves guide-only bounds and leaves the shot mask unchanged. Pending generated candidates lock the bounds until accepted or discarded.
- Visible Repair tracking from here and Add another mask actions expose segment ranges, direction and saved tracking passes. Each new segment keeps its own raw seed, so additive tracking cannot accidentally follow the cumulative mask. Foreground protection survives tracked replacement.

First manual-testing candidate. Local ComfyUI workspace using Zura Studio's interface styles, Manrope font and theme controls.

- Mask review hints flag abrupt area changes, unmarked empty ranges and reappearance, with amber timeline marks and trimmed next-change navigation. Explicit absent ranges suppress the hints; masks stay unchanged.
- Native SAM text conditioning now requests up to 24 separate detections instead of its default single-object limit.
- Multiple detected subjects stay separate and appear as red-overlay choices. Selecting one applies only that subject to the detected frame, with source/revision checks.
- Hidden source-video events cannot move the active mask editor playhead.
- Workflow selection before adding footage; Render reuses the selected workflow and mask automatically.
- Paint/erase corrections auto-save on any timeline frame, preserving adjacent frames. Import matching black-and-white mask videos directly in Mask.
- Labelled Lucide paintbrush, eraser, hand and point icons; explicit preview, track and review guidance.
- Add clean frame button at the playhead; independent per-guide FLUX masks and grow controls, retained when X discards a candidate. Discarding advances the next seed.
- Mask, Clean frames and Render stages, responsive source viewport and full-source timeline with interactive In/Out trimming and exact keyboard adjustments.
- Saved-version selection for accepted clean frames, with image/colour/preview restoration and preserved frame masks. Browser refresh restores the selected card and playhead; leaving an unfinished preview releases its loading state.
- Clean guides outside the trim remain visible and stored, are excluded from rendering, and become active when the range expands again.
- Imported edits require an explicit difference review before acceptance. Keep the current repair or include highlighted changes in this guide only; the shot mask stays unchanged. Acceptance writes a float EXR with exact source pixels outside the chosen hard repair.
- External edits are copied into project ownership. Original-frame exports offer a reference file with exact source frame, dimensions, frame rate and colour interpretation.
- SAM text, Include/Exclude points, painted seeds, correction ranges, foreground protection and explicit subject-absent ranges.
- Hard-edged repair masks with immediate expansion feedback and a full-resolution red overlay. Earlier soft-mask drafts migrate to zero feather.
- Clean-frame cards with precise FLUX crop/stitch, candidate acceptance/rejection, original comparison, external frame download and validated import.
- Disk-backed projects, immutable mask revisions, mask undo, project reopening and source fingerprint checks.
- Targeted and general LTX paintout with native model nodes, individual job cancellation and progress stages.
- SDR, HLG and EXR delivery with original source timing and optional source audio.
- Automatic upward rounding to the nearest 64-pixel model grid, shared plate/guide/mask stretch and exact original delivery dimensions. Fractional source clocks are preserved. Odd-size masters use 4:4:4 instead of silent padding.

This candidate is ready for artist acceptance testing, not a claim that arbitrary shots produce production-quality removal. Overlap and fast-motion edges require close review. The bedroom boy-removal test remains diagnostic.

Windows file picking is implemented. Rotated video must be conformed first; imported edits must have normal orientation and exact source dimensions. Native model support depends on current ComfyUI. No models or sample footage are bundled.

### Viewer toolbar refinement, 29 October 2026

Moved selection, paint, erase, pan, undo and clear into a right-aligned viewer header, preserving image visibility and narrow-screen access. Removed text subject selection from the Studio interface; point selection, mask preview, manual painting and imported masks remain. Native graph text-selection support is unchanged.

### Guided mask start, 29 October 2026

New targeted footage explicitly opens Mask with the point tool selected after import. Centred the mask preview action, enlarged its target and added a contextual next-step hint; tracking receives primary emphasis once its mask is ready.

### Trimmable mask timeline, 29 October 2026

Completed masks now form independent timeline bars. Drag either end to trim, click to edit, or remove a bar. Add mask starts a separate point selection at the playhead; overlapping masks combine without destructive merging. Trim ranges are reversible within tracked frames, and corrections affect only the selected mask. Existing projects migrate as one Original mask. Draft previews stay out of the output union until tracking completes. Advanced tracking/pass controls are removed from the main panel. No split tool. Restart ComfyUI after updating this development build. Registry 0.1.0 is unchanged.

Mask tracking now derives its range from the visible timeline rather than stale hidden controls. Preview and tracking share a compact action area. A nearby progress bar shows submitting, queued and processing states, supports legacy ComfyUI progress events, and retains live progress during polling. Frontend refresh required.

Previous mask layers now use the same red preview opacity as the active mask and refresh immediately when starting an additional mask. This preview does not alter the selected mask.
