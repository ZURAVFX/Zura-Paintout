# 0.1.0: standalone Registry testing release

Adds Registry metadata and automatic Python dependency declarations, native Template Browser entries and portable FFmpeg/ffprobe discovery without PATH changes. The workflow runs locally. API-format files are local queue exports; no cloud service is included.

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
