# Colour pipelines

Choose the colour pipeline in Paintout Studio's Render section. The two included native templates remain the SDR starting workflows; the Studio's editable graph reflects its selected colour route. Do not turn an SDR workflow into HDR by changing output tags alone.

| Pipeline | Processing | Delivery and preservation |
| --- | --- | --- |
| SDR to SDR | Existing SDR LTX repair | SDR video and/or scene-linear EXR. Targeted EXR delivery preserves the source outside the effective repair. |
| SDR to HDR | SDR repair, then a separate official LTX SDR-to-HDR conversion | ACEScg EXR and/or HLG video. The second pass is generative over the whole image and can change unmasked areas. |
| HDR to HDR | HDR source converted to ACEScct for LTX repair | ACEScg EXR and/or HLG video. Targeted EXR delivery preserves original HDR pixels outside the effective repair. Encoded video is not pixel-identical. |

Set the source colour space correctly. Auto uses detected metadata where available; use an explicit override for known scene-linear or incorrectly tagged material. HDR to HDR accepts the supported HLG, PQ and scene-linear/ACES inputs. There is no HDR-to-SDR repair route in this interface.

## Extra model files

The existing repair models are listed in [model files](model-files.md). These additions are needed for HDR:

| File | ComfyUI folder | Needed for |
| --- | --- | --- |
| `ltx-2.5-video-vae-bf16.safetensors` | `models/vae/` | HDR to HDR and SDR to HDR |
| `ltx-2.5-22b-ic-lora-sdr-to-hdr-1.0.safetensors` | `models/loras/` | SDR to HDR only |
| `ltx-2.5-22b-ic-lora-sdr-to-hdr-scene-emb.safetensors` | `models/embeddings/` | SDR to HDR only |

Use the model providers' files and review their access and licence requirements: [Lightricks LTX 2.5](https://huggingface.co/Lightricks/LTX-2.5) and [official SDR-to-HDR adapter](https://huggingface.co/Lightricks/LTX-2.5-22b-IC-LoRA-SDR-To-HDR). The HDR route uses the standard video VAE above, not the SDR convolution VAE. The conversion graph promotes VAE processing to float32.

Use current ComfyUI, ComfyUI-KJNodes and ComfyUI-LTXVideo with the required HDR nodes. Paintout includes its own narrow HDR scene-embedding loader, so this conversion does not depend on a locally patched LTX conditioning loader. Missing models or nodes must be resolved before generation. Model weights are not bundled.

## Repair first, then convert

With **SDR to HDR** selected, Studio saves the SDR repair as a checkpoint. When **Repair saved** appears, click **Convert repaired clip to HDR**. This starts a separate queued conversion. The native editable graph still contains the complete repair-and-conversion route for direct ComfyUI use.

If HDR conversion fails or is cancelled, the repaired clip stays saved. Use **Retry HDR conversion** to repeat only the HDR stage. Reloading the browser restores the saved conversion checkpoint. Check the current queue before retrying after an uncertain connection; do not submit duplicate jobs. The application unloads cached model weights before HDR conversion, but execution caches or other allocations may remain, so this is not a guarantee of a complete VRAM reset.

## Clip limits and alignment

The Studio uses streaming TiledFusion conversion, with at most **121 source frames**. The **40-million pixel-frame** guard applies to each full-resolution guide-encoding window of **9 or 17 frames**, not to the whole clip. Temporal windows overlap and their sampled results are fused. The CPU guide allocation has a separate **8 GiB** guard. A raster that cannot fit even a nine-frame guide window is rejected; spatial denoise tiling cannot remove that guide-encoding limit.

The processing raster is stretched to the next larger 64-pixel grid and the temporal length is extended to the required 8n+1 length by holding the last frame. Final delivery restores the original dimensions, selected frame count and source frame rate. No smaller processing proxy is substituted. Shorten a clip that exceeds the count or CPU allocation limit. Prepare a smaller plate separately if its raster exceeds the minimum-window limit.

Trim clip defines the export section. In the Mask stage, timeline In/Out controls tracking only and cannot change export duration. Reopen Trim clip to change delivery.

## Clean HDR guides

FLUX 3 Klein remains the clean-frame editor. For HDR, it edits an SDR display view; the changed region is reconstructed into a scene-linear HDR master. This reconstruction is approximate inside the edit area, not native HDR image generation. Original ACEScg pixels outside the edit and in protected areas remain exact. The PNG preview and EXR master deliberately use separate colour metadata.

Inspect repaired highlights, exposure and mask joins before using a guide in the render. Each FLUX result is used automatically as a paint layer; delete an unsuitable layer or use **Remove all paint layers** to restore the original frame. Use externally edited HDR guides when the display-view approximation is unsuitable. No alternative HDR image model has been qualified as the default for precise production removal.

## Validation status

Automated checks cover colour transforms, HDR values, actual EXR/PNG files, output metadata, graph wiring and exact preservation outside clean-frame edits. They do not establish final image quality. Complete [manual testing](manual-testing.md) with representative SDR and HDR footage, actual model renders and a colour-managed viewer before relying on HDR delivery in production. SDR-to-HDR needs whole-frame review because its changes are not limited to the removal mask.

A local nine-frame model smoke test exercised SDR-to-HDR and targeted HDR-to-HDR on an odd 257 × 145 plate at 24000/1001 fps with audio. Both completed at the original raster/count/rate. HDR-to-HDR retained outside-mask source ACEScg samples exactly and values above reference white. The synthetic SDR-to-HDR result did not produce values above reference white, so it establishes wiring and delivery rather than expanded highlight range. A colour-tag loss found during the run was fixed and the saved frames were re-exported successfully with BT.2020/HLG tags. This is a small integration test, not shot-quality approval.

The streaming TiledFusion route has not yet passed a GPU render test. The small model smoke test above predates that route and does not validate its performance, seams or memory behaviour. Complete real tiled renders and inspect temporal joins before treating streaming conversion as qualified.
