# Foundation and contest work

Zura Paintout develops the author's existing Zura Nodes paintout workflow. It is not a claim that the full Zura Studio product, model architectures or third-party adapters were created during this contest.

| Part | Origin or change |
| --- | --- |
| LTX plate, guide and delivery foundation | Existing Zura Nodes work, retained under AGPL-3.0-only |
| Model inference | ComfyUI, LTX 2.5, SAM3.1 and FLUX 3 Klein; third-party code and weights keep their own terms |
| Targeted repair adapter | Obscura Remova; compatibility and source notes are in the model guide |
| Scene clean plate adapter | Lightricks LTX clean-plate adapter |
| Artist preparation | Interactive trim, hard masks, per-frame corrections and independent tracking segments |
| Clean guides | Timeline cards, precise FLUX crop-and-stitch, independent edit masks, automatically used paint layers with individual deletion and external-edit difference review |
| Delivery | One plate-space transform shared by video, masks and guides, followed by restoration of original dimensions and timing |
| Entry packaging | Workflow-first README, native and API workflow files, optional `app/`, build/model guide and structural verification |
| Format reference | Comfy OpenJutsu's repository presentation; no OpenJutsu application code is included |

The integrated public implementation used for this package includes the fixes in Zura Nodes 1.3.34, commit `c5444fe97f50148ad09133ad03c77964c6fa158e`. A source manifest records the actual packaged file hashes.

Representative final demos, independent-machine installation and final artist acceptance remain separate checks. No contest form or social post is submitted by building this package.

## Post-Registry development fixes, 29 October 2026

The current GitHub development build fixes a small brightness shift when decoding native 8-bit RGB video. It decodes these formats directly rather than converting them through FFmpeg's RGB16 path. YUV and higher-depth video retain 16-bit decoding. Cache keys distinguish the new representation. Regression tests cover exact levels, trim order, both cache and pipe reads, and RGB16 precision. Registry 0.1.0 predates this change; no new Registry version is claimed here.

## HDR conversion staging and streaming development, 30 October 2026

Studio now saves the SDR repair before offering **Convert repaired clip to HDR**. The saved checkpoint supports HDR-only retry and survives browser reload. The complete native graph remains available for direct ComfyUI use. Cached model weights are unloaded before conversion; this does not guarantee that every VRAM allocation is cleared.

Streaming TiledFusion keeps the original output raster, frame rate and selected frame count. The 121-source-frame cap remains. The 40-million pixel-frame guide-encoding guard now applies per 9- or 17-frame window; a separate 8 GiB guard bounds the CPU guide allocation. No automatic smaller processing proxy is used. This streaming route has not yet passed a GPU render test.

Generated clean-frame results are used automatically as paint layers. Individual deletion removes one edit; **Remove all paint layers** restores the original frame. Named-target FLUX instructions use the original crop reference, while generic painted-area cleanup uses an erased reference. The controlled car test is not a promise of arbitrary-shot removal quality.
