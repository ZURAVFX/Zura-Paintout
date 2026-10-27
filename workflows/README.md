# Workflow files

The `.json` files beginning `Zura_` are the editable ComfyUI templates. Drag them onto the canvas. Native subgraphs preserve the original processing layout. The `.api.json` files are flat queue graphs exported by the existing recipe builder; they are for `/prompt` clients and contain example paths.

| File | Purpose | Required artist inputs |
| --- | --- | --- |
| `Zura_Paintout_Targeted.json` | Main targeted repair template | Plate, aligned removal mask, clean-frame guide(s), source range and colour space |
| `targeted.api.json` | API version of the targeted recipe | Replace `source.inputs.plate_path`, `source.inputs.mask_path` and the JSON string in `anchors.inputs.anchors` |
| `Zura_Paintout_Full_Scene.json` | Separate full-scene clean plate | Plate, source range and colour space |
| `full-scene.api.json` | API version of the full-scene recipe | Replace `source.inputs.plate_path` |

Both API recipes use `sample.inputs.seed`, `positive.inputs.text` and `save.inputs.output_name`. Output names are relative to ComfyUI's output folder. `source.inputs.start_frame` and `frame_count` describe the selected original source frames. Guide frame numbers remain absolute, zero-based source-frame numbers after trimming.

An example guide list is stored as a JSON string:

```json
[{"file":"C:/path/to/clean_000000.exr","frame":0,"strength":0.75,"enabled":true,"colour_space":"srgb_display"}]
```

Replace every placeholder before queueing. Verify an imported mask's dimensions, timing and full source alignment. White removes; black keeps. The templates do not require SAM or FLUX if those assets are prepared externally.

The native templates retain the existing subgraph layout. This packaging pass does not certify a new visual-layout audit or a new GPU quality result.
