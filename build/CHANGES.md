# Foundation and contest work

Zura Paintout develops the author's existing Zura Nodes paintout workflow. It is not a claim that the full Zura Studio product, model architectures or third-party adapters were created during this contest.

| Part | Origin or change |
| --- | --- |
| LTX plate, guide and delivery foundation | Existing Zura Nodes work, retained under AGPL-3.0-only |
| Model inference | ComfyUI, LTX 2.5, SAM3.1 and FLUX 3 Klein; third-party code and weights keep their own terms |
| Targeted repair adapter | Obscura Remova; compatibility and source notes are in the model guide |
| Scene clean plate adapter | Lightricks LTX clean-plate adapter |
| Artist preparation | Interactive trim, hard masks, per-frame corrections and independent tracking segments |
| Clean guides | Timeline cards, precise FLUX crop-and-stitch, independent edit masks, candidate acceptance, saved versions and external-edit difference review |
| Delivery | One plate-space transform shared by video, masks and guides, followed by restoration of original dimensions and timing |
| Entry packaging | Workflow-first README, native and API workflow files, optional `app/`, build/model guide and structural verification |
| Format reference | Comfy OpenJutsu's repository presentation; no OpenJutsu application code is included |

The integrated public implementation used for this package includes the fixes in Zura Nodes 1.3.34, commit `c5444fe97f50148ad09133ad03c77964c6fa158e`. A source manifest records the actual packaged file hashes.

Representative final demos, independent-machine installation and final artist acceptance remain separate checks. No contest form or social post is submitted by building this package.
