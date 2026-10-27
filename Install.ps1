param(
    [Parameter(Mandatory = $true)]
    [string]$ComfyUIPath,
    [switch]$InstallRequirements,
    [string]$PythonPath
)
$ErrorActionPreference = 'Stop'

$comfyRoot = (Resolve-Path -LiteralPath $ComfyUIPath).Path
if (!(Test-Path -LiteralPath (Join-Path $comfyRoot 'main.py') -PathType Leaf)) {
    throw 'Choose the ComfyUI root folder containing main.py.'
}
$customNodes = Join-Path $comfyRoot 'custom_nodes'
if (!(Test-Path -LiteralPath $customNodes -PathType Container)) {
    throw 'This ComfyUI folder has no custom_nodes directory.'
}
$target = Join-Path $customNodes 'Zura-Paintout'
if (Test-Path -LiteralPath $target) {
    throw 'Zura-Paintout already exists. Back up or remove that installation before replacing it.'
}

# This pack duplicates route and node ownership from the older integrated Studio pack.
# Inspect its marker files too, so renaming the older folder does not evade the guard.
foreach ($pack in Get-ChildItem -LiteralPath $customNodes -Directory -Force) {
    if ($pack.Name -like '*.disabled' -or $pack.Name -eq '.disabled') { continue }
    $legacyPaintout = Join-Path $pack.FullName 'paintout/paintout.py'
    if (!(Test-Path -LiteralPath $legacyPaintout -PathType Leaf)) { continue }
    $legacySource = Get-Content -LiteralPath $legacyPaintout -Raw
    if ($legacySource -match 'class\s+ZuraPaintoutCrop\b' -and $legacySource -match 'CATEGORY\s*=.*Zura/Paintout') {
        throw "The enabled custom node pack '$($pack.Name)' already registers Zura Paintout nodes and routes. Disable that pack in ComfyUI Manager, restart ComfyUI, then run this installer again. No files have been changed."
    }
}

if (!(Test-Path -LiteralPath (Join-Path $PSScriptRoot '__init__.py') -PathType Leaf) -or
    !(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'requirements.txt') -PathType Leaf) -or
    !(Test-Path -LiteralPath (Join-Path $PSScriptRoot 'paintout') -PathType Container)) {
    throw 'Run Install.ps1 from the extracted Zura-Paintout package folder.'
}

if ($PythonPath -and !$InstallRequirements) {
    throw 'Use -PythonPath together with -InstallRequirements, or omit both to install the files only.'
}
if ($InstallRequirements) {
    if ($PythonPath) {
        $python = (Resolve-Path -LiteralPath $PythonPath).Path
    } else {
        $pythonCandidates = @(
            (Join-Path $comfyRoot '.venv/Scripts/python.exe'),
            (Join-Path (Split-Path $comfyRoot) 'python_embeded/python.exe')
        )
        $python = $pythonCandidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
    }
    if (!$python -or !(Test-Path -LiteralPath $python -PathType Leaf)) {
        throw 'Could not find ComfyUI Python. Set -PythonPath to its interpreter, or install requirements.txt manually with that interpreter.'
    }
    & $python -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) {
        throw 'Dependency installation failed. Zura-Paintout files have not been copied.'
    }
}

$stage = Join-Path $customNodes ('.Zura-Paintout.install-' + [guid]::NewGuid().ToString('N'))
$resolvedStage = [System.IO.Path]::GetFullPath($stage)
$resolvedTarget = [System.IO.Path]::GetFullPath($target)
$resolvedCustomNodes = [System.IO.Path]::GetFullPath($customNodes)
if ((Split-Path -Parent $resolvedStage) -ne $resolvedCustomNodes -or (Split-Path -Parent $resolvedTarget) -ne $resolvedCustomNodes) {
    throw 'The installation paths must stay inside the selected custom_nodes directory.'
}
New-Item -ItemType Directory -Path $resolvedStage | Out-Null
try {
    Get-ChildItem -LiteralPath $PSScriptRoot -Force | Copy-Item -Destination $stage -Recurse
    Move-Item -LiteralPath $resolvedStage -Destination $resolvedTarget
} catch {
    if (Test-Path -LiteralPath $resolvedStage) {
        if ((Split-Path -Parent ([System.IO.Path]::GetFullPath($resolvedStage))) -ne $resolvedCustomNodes) { throw 'Refusing cleanup outside custom_nodes.' }
        Remove-Item -LiteralPath $resolvedStage -Recurse -Force
    }
    throw
}
Write-Host 'Installed Zura Paintout. Install ComfyUI-LTXVideo and ComfyUI-KJNodes, add the models in DEPENDENCIES.md, restart ComfyUI, then open Zura Paintout.'
