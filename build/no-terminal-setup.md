# Set up Paintout without a terminal

Use the local ComfyUI workflow. A paid API key, Comfy credits and a separate application are not required.

## Install the extension

The standalone Registry package is `zura-paintout`, displayed as **Zura Paintout**, published by `zuravfx`. Registry availability will be recorded in the main README once confirmed.

Once available, open ComfyUI's Manager or Extensions panel, search **Zura Paintout**, choose Install and restart when prompted. Manager handles the Python dependencies. If you already use Paintout in Zura Nodes, use that installation instead of enabling both copies.

While the listing is being processed, Manager's **Install via Git URL** can install `https://github.com/ZURAVFX/Zura-Paintout` where that option is available. Do not lower Manager's security settings to enable it.

Install **ComfyUI-LTXVideo** and **ComfyUI-KJNodes** through the same Manager interface. These supply the model guide and mask-processing nodes. Use Manager's missing-node installation when the loaded workflow reports dependencies, then restart if requested.

## Add the models once

Open the links in [model files](model-files.md) in your browser. For targeted repair, download the LTX transformer, text encoder, two VAEs and Obscura adapter. Place each file in the folder shown in the table using File Explorer. Sign in and accept the model provider's terms where required.

SAM and FLUX files are needed only for Studio's optional tracking and clean-frame editing. You can use your existing mask and clean images directly in the native workflow.

## If FFmpeg is missing

Paintout first uses FFmpeg and ffprobe already available to ComfyUI. If it reports either missing:

1. Open [FFmpeg's official download page](https://ffmpeg.org/download.html). For Windows, follow one of its Windows-build links and download a ZIP build containing both `ffmpeg.exe` and `ffprobe.exe`.
2. Extract the ZIP with File Explorer. Open its `bin` folder.
3. In your ComfyUI folder, beside `main.py`, create `ffmpeg`, then `bin` inside it.
4. Copy both executables into that folder. The resulting paths are `ComfyUI/ffmpeg/bin/ffmpeg.exe` and `ComfyUI/ffmpeg/bin/ffprobe.exe`.

No PATH edit or terminal command is needed. The next attempt will discover the files. FFmpeg is downloaded separately and retains its own licence.

## Open the workflow

Choose **Workflow → Browse Templates**, find the Paintout pack and open **Zura_Paintout_Targeted**. The pack supplies `example_workflows/` specifically for ComfyUI's built-in Template Browser. If your version has not refreshed its templates, restart or use **Workflow → Open** to load the JSON from the pack's `workflows` folder.

Add your plate, aligned removal mask and clean-frame guides. White in the mask removes; black keeps. Check the original source frame numbers, colour space and selected range, then queue the repair. Watch the whole result before accepting it.

For guided preparation, the optional **Zura Paintout** button opens Studio inside the same ComfyUI installation.
