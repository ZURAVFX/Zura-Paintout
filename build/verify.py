"""Check distribution integrity and graph structure. Does not run inference."""
from pathlib import Path
import ast
import hashlib
import json
import re
import tomllib
from urllib.parse import unquote

ROOT = Path(__file__).resolve().parents[1]


def check(condition, message):
    if not condition:
        raise SystemExit('FAIL: ' + message)


def main():
    manifest = json.loads((ROOT / 'build/source-manifest.json').read_text(encoding='utf-8'))
    actual = {p.relative_to(ROOT).as_posix() for p in ROOT.rglob('*')
              if p.is_file() and not {'.git', '__pycache__'}.intersection(p.parts) and p.suffix != '.pyc'}
    check(actual == set(manifest['files']) | {'build/source-manifest.json'}, 'manifest file set changed')
    for name, expected in manifest['files'].items():
        check(hashlib.sha256((ROOT / name).read_bytes()).hexdigest() == expected, 'hash mismatch: ' + name)
    for file in ROOT.rglob('*.py'):
        ast.parse(file.read_text(encoding='utf-8-sig'), filename=str(file))
    check('WEB_DIRECTORY = "./app"' in (ROOT / '__init__.py').read_text(encoding='utf-8'), 'frontend registration')
    check((ROOT / 'app/assets/fonts/Manrope-OFL.txt').is_file(), 'font licence')
    check((ROOT / 'app/assets/icons/Lucide-LICENSE.txt').is_file(), 'icon licence')
    metadata = tomllib.loads((ROOT / 'pyproject.toml').read_text(encoding='utf-8'))
    check(metadata['project']['name'] == 'zura-paintout', 'Registry node identifier')
    check(metadata['tool']['comfy']['PublisherId'] == 'zuravfx', 'Registry publisher')
    check(re.fullmatch(r'\d+\.\d+\.\d+', metadata['project']['version']), 'Registry semantic version')
    requirements = {line.strip() for line in (ROOT / 'requirements.txt').read_text().splitlines() if line.strip()}
    check(set(metadata['project']['dependencies']) == requirements, 'automatic installation dependencies')
    for file in ROOT.rglob('*.md'):
        for target in re.findall(r'\[[^\]]*\]\(([^)]+)\)', file.read_text(encoding='utf-8')):
            if re.match(r'[a-zA-Z][a-zA-Z0-9+.-]*:', target) or target.startswith('#'):
                continue
            target = unquote(target.split('#', 1)[0]).strip('<>')
            check((file.parent / target).exists(), f'broken link in {file.relative_to(ROOT)}: {target}')
    for name, minimum in [('Zura_Paintout_Targeted.json', 6), ('Zura_Paintout_Full_Scene.json', 5)]:
        workflow = json.loads((ROOT / 'workflows' / name).read_text(encoding='utf-8'))
        check(len(workflow.get('definitions', {}).get('subgraphs', [])) >= minimum, 'native subgraphs: ' + name)
        check(bool(workflow.get('nodes')), 'native nodes: ' + name)
        check((ROOT / 'example_workflows' / name).read_bytes() == (ROOT / 'workflows' / name).read_bytes(), 'Template Browser copy: ' + name)
    for name, targeted in [('targeted.api.json', True), ('full-scene.api.json', False)]:
        graph = json.loads((ROOT / 'workflows' / name).read_text(encoding='utf-8'))
        for node in graph.values():
            check(bool(node.get('class_type')) and isinstance(node.get('inputs'), dict), 'API node shape: ' + name)
            for value in node['inputs'].values():
                if isinstance(value, list):
                    check(len(value) == 2 and value[0] in graph and isinstance(value[1], int), 'API connection: ' + name)
        check(graph['source']['class_type'] == ('ZuraPaintoutCrop' if targeted else 'ZuraPaintoutFullFrame'), 'source mode')
        check(graph['source']['inputs']['framing_mode'] == 'Plate resolution (stretch to next grid)', 'plate sizing')
        check(graph['source']['inputs']['feather_pixels'] == 0, 'hard repair boundary')
        check(graph['save']['inputs']['plate'] == ['source', 2], 'original plate metadata delivery')
        check(graph['conditioning']['inputs']['frame_rate'] == ['take', 5], 'source timing')
        check(('anchors' in graph) == targeted, 'guide branch')
        if targeted:
            check(bool(json.loads(graph['anchors']['inputs']['anchors'])), 'guide records')
    print(f'PASS: {len(manifest["files"])} file hashes, Python syntax, local documentation links, licences, '
          'frontend registration, two native templates and two API graph structures. No GPU inference performed.')


if __name__ == '__main__':
    main()
