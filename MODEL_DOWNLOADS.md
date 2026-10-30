# Model downloads

These are the exact filenames used by the supplied recipes. Open each model card and review its separate terms before downloading. LTX 2.5, its clean-plate adapter and FLUX 3 currently require Hugging Face access approval or acceptance of their terms. Sign in on the model page if the file link is unavailable. Open Paintout > Models to download missing files into ComfyUI. Downloads are optional and user initiated; no model weights are bundled in this package.

| Model file | Put it in | Upstream file |
| --- | --- | --- |
| `ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors` | `models/diffusion_models/` | [File and access requirements](https://huggingface.co/Lightricks/LTX-2.5/blob/main/diffusion_models/ltx-2.5-22b-distilled-transformer-comfy-int8-convrot.safetensors) |
| `gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors` | `models/text_encoders/` | [File and access requirements](https://huggingface.co/Lightricks/LTX-2.5/blob/main/text_encoders/gemma4-12b-with-proj-ltx-2.5-comfy-int8-convrot.safetensors) |
| `ltx-2.5-video-vae-conv-bf16.safetensors` | `models/vae/` | [File and access requirements](https://huggingface.co/Lightricks/LTX-2.5/blob/main/vae/ltx-2.5-video-vae-conv-bf16.safetensors) |
| `ltx-2.5-audio-vae-bf16.safetensors` | `models/vae/` | [File and access requirements](https://huggingface.co/Lightricks/LTX-2.5/blob/main/vae/ltx-2.5-audio-vae-bf16.safetensors) |
| `LTX23_Obscura_Remova_v1.safetensors` | `models/loras/` | [File and access requirements](https://huggingface.co/WepeNerd/Obscura_Remova/blob/main/LTX23_Obscura_Remova_v1.safetensors) |
| `ltx-2.5-22b-ic-lora-clean-plate-1.0.safetensors` | `models/loras/` | [File and access requirements](https://huggingface.co/Lightricks/LTX-2.5-22b-IC-LoRA-Clean-Plate/blob/main/ltx-2.5-22b-ic-lora-clean-plate-1.0.safetensors) |
| `flux3-image-klein-int8-convrot.safetensors` | `models/diffusion_models/` | [File and access requirements](https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy/blob/main/diffusion_models/flux3-image-klein-int8-convrot.safetensors) |
| `qwen3vl_4b_int8_convrot.safetensors` | `models/text_encoders/` | [File and access requirements](https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy/blob/main/text_encoders/qwen3vl_4b_int8_convrot.safetensors) |
| `flux2-vae.safetensors` | `models/vae/` | [File and access requirements](https://huggingface.co/black-forest-labs/flux-3-image-klein-comfy/blob/main/vae/flux2-vae.safetensors) |
| `sam3.1_multiplex_fp16.safetensors` | `models/checkpoints/` | [File and access requirements](https://huggingface.co/Comfy-Org/sam3.1/blob/main/checkpoints/sam3.1_multiplex_fp16.safetensors) |

| `ltx-2.5-video-vae-bf16.safetensors` | `models/vae/` | [File and access requirements](https://huggingface.co/Lightricks/LTX-2.5/blob/49b093a39c19169a8a81721dcc541e07e945232f/vae/ltx-2.5-video-vae-bf16.safetensors) |
| `ltx-2.5-22b-ic-lora-sdr-to-hdr-1.0.safetensors` | `models/loras/` | [File and access requirements](https://huggingface.co/Lightricks/LTX-2.5-22b-IC-LoRA-SDR-To-HDR/blob/c7578ebddb54f4210e534e4d8cad698a5a520692/ltx-2.5-22b-ic-lora-sdr-to-hdr-1.0.safetensors) |
| `ltx-2.5-22b-ic-lora-sdr-to-hdr-scene-emb.safetensors` | `models/embeddings/` | [File and access requirements](https://huggingface.co/Lightricks/LTX-2.5-22b-IC-LoRA-SDR-To-HDR/blob/c7578ebddb54f4210e534e4d8cad698a5a520692/ltx-2.5-22b-ic-lora-sdr-to-hdr-scene-emb.safetensors) |

The three Klein files support the clean-frame editor. The LTX transformer, text encoder, two VAEs and targeted adapter support Targeted repair. The clean-plate adapter is used by Full-scene clean plate. Studio uses SAM for point selection and tracking; a matching black-and-white mask video can be imported instead.

The setup panel recognises existing valid files, including configured subfolders, and refreshes the model list after installation. Conflicting existing files are reported and never overwritten. After adding files manually, refresh ComfyUI's model list or restart it. Exact filenames matter. Existing extra model paths are supported; folders above are relative to the ComfyUI root. See DEPENDENCIES.md for the tested combination and the Obscura/LTX 2.5 compatibility qualification.

The pinned catalogue in paintout/model_downloads.py records the 13 current SDR/HDR recipe files with revision, size and SHA-256 checks. MODEL_SOURCES.json is the earlier source inventory and records observed revisions and URLs. This records source locations, not a verification that every local test weight matches that revision. No general open-weights-only eligibility claim is made.

Clean frames use the artist's instruction directly. Named removals keep the original image as the model reference; generic painted-area cleanup uses an erased reference. The painted area is the exact allowed edit boundary; erase any nearby details that must be protected. Each FLUX generation adds a paint layer automatically. Further generations use the current painted frame. Delete individual layers or remove all paint layers to return to the original. The separate vision-caption pass and its 9B prompt upsampler are no longer required.

HDR-to-HDR repair uses the HDR video VAE. SDR-to-HDR runs the SDR repair first, then a separate conversion using the HDR VAE, HDR adapter and scene embeddings. Choose the corresponding task in Models to download the complete set without duplicating shared files. FLUX itself edits an SDR view; HDR reconstruction inside the paint area is approximate.
