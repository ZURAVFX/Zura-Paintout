# Runtime and model dependencies

The package uses ComfyUI's Python, PyTorch, native model loading, queue and memory management. It does not bundle those runtimes or model weights. Install current ComfyUI, LTXVideo and KJNodes. FFmpeg and ffprobe are needed for video probing/decoding/encoding; use an existing PATH installation or copy both executables into `ComfyUI/ffmpeg/bin/` using your file browser. EXR support depends on OpenImageIO.

Model filenames expected by the supplied recipes:

| Purpose | File |
| --- | --- |
| LTX transformer | `ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors` |
| LTX text encoder | `gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors` |
| LTX video VAE | `ltx-2.5-video-vae-conv-bf16.safetensors` |
| LTX audio VAE | `ltx-2.5-audio-vae-bf16.safetensors` |
| Targeted paintout adapter | `LTX23_Obscura_Remova_v1.safetensors` |
| Full clean plate adapter | `ltx-2.5-22b-ic-lora-clean-plate-1.0.safetensors` |
| Klein transformer | `flux3-image-klein-int8-convrot.safetensors` |
| Klein text encoder | `qwen3vl_4b_int8_convrot.safetensors` |
| Klein VAE | `flux2-vae.safetensors` |
| Segmentation | `sam3.1_multiplex_fp16.safetensors` |

MODEL_DOWNLOADS.md links every required upstream file and target folder. MODEL_SOURCES.json records observed source revisions and gated access. TESTED_ENVIRONMENT.json records the exact development code/library versions. Use the upstream model cards and ComfyUI's model directory conventions. The workspace reports missing node types and available model filenames. No weights are included.

The targeted adapter is [WepeNerd/Obscura_Remova](https://huggingface.co/WepeNerd/Obscura_Remova). Its model card identifies LTX 2.3 as its base and links the [LTX 2 community licence](https://huggingface.co/Lightricks/LTX-2.3/blob/main/LICENSE). The local file used in testing matches the upstream SHA-256: `e58ff6e1076caf40707b9b890aeae1d1c0bd26f285f7666aafc052a06d35f22a`. Running it with LTX 2.5 is this application's tested combination, not an upstream compatibility claim. Review those model terms for your intended use.

Install transformer weights in `models/diffusion_models/`, text encoders in `models/text_encoders/`, VAEs in `models/vae/`, adapters in `models/loras/`, and SAM in `models/checkpoints/`. Existing extra model paths are supported. FFmpeg **and ffprobe** must be available, either on PATH or under `ComfyUI/ffmpeg/bin/`. OpenCV, OpenImageIO, Pillow and SciPy are direct Python requirements.

The development GPU checks used ComfyUI 0.42.5, frontend 1.55.18, Python 3.13.12 and an RTX 4080 with 16 GB VRAM. These checks establish operation on that machine, not a minimum hardware specification or a fresh-machine installation guarantee. Test shorter shots first. First model loads take longer than warm runs.

Inherited application modules originate from the user's Zura-Nodes installation and retain its AGPL-3.0 licence. LTXVideo and KJNodes remain separately installed projects under their own licences. Model usage terms are independent of the application's licence.

Clean frames use an erased reference and the artist's instruction directly. The painted area is the exact allowed edit boundary; erase any nearby details that must be protected. Each FLUX generation adds a paint layer automatically. Further generations use the current painted frame. Delete individual layers or remove all paint layers to return to the original. The separate vision-caption pass and its 9B prompt upsampler are no longer required.
