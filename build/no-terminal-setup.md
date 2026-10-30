# Set up Paintout without a terminal

Use the local ComfyUI workflow. A paid API key, Comfy credits and a separate application are not required.

## Install the extension

The standalone Registry package is [`zura-paintout`](https://registry.comfy.org/nodes/zura-paintout), displayed as **Zura Paintout**, published by `zuravfx`. The public listing and search result are verified. Version 0.1.0 is currently marked Pending; the install API already returns its archive, but installation through a user's Manager has not yet been verified.

Once available, open ComfyUI's Manager or Extensions panel, search **Zura Paintout**, choose Install and restart when prompted. Manager handles the Python dependencies. If you already use Paintout in Zura Nodes, use that installation instead of enabling both copies.

While the listing is being processed, Manager's **Install via Git URL** can install `https://github.com/ZURAVFX/Zura-Paintout` where that option is available. Do not lower Manager's security settings to enable it.

Install **ComfyUI-LTXVideo** and **ComfyUI-KJNodes** through the same Manager interface. These supply the model guide and mask-processing nodes. Use Manager's missing-node installation when the loaded workflow reports dependencies, then restart if requested.

## Add the models once

Open **Zura Paintout → Models** inside ComfyUI. Choose the tool you want to use and click **Download missing models**. The panel shows which files are already installed, the download size and progress. Shared files are reused, including models stored in configured extra model folders. You can cancel and retry a download without using a terminal.

For gated models, open the licence link, sign in to Hugging Face and accept the publisher's terms. If access is still required, paste a Hugging Face read token into **Model licences and access** for that download. Paintout does not save the token. Existing Hugging Face credentials on the server can also be used.

Missing custom-node code is shown separately: install those packs through ComfyUI Manager. Model downloads do not install node packs. The [manual model links](model-files.md) remain available if you prefer to download files yourself.

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
