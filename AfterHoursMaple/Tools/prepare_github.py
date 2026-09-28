"""Copy the game project and verified Web build into its separate GitHub checkout."""
from pathlib import Path
import shutil, hashlib, json

project = Path(__file__).resolve().parents[1]
workspace = project.parent
target = workspace / 'publish/after-hours-maple'
if not (target / '.git').is_dir():
    raise SystemExit('Clone the after-hours-maple repository into publish/after-hours-maple first.')

def copy(source, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)

for directory in ['Assets', 'Packages', 'ProjectSettings', 'Verification', 'Builds/Web']:
    for source in (project / directory).rglob('*'):
        if source.is_file():
            copy(source, target / 'AfterHoursMaple' / source.relative_to(project))
for name in ['README.md', 'Build-Web.ps1', 'Play.cmd']:
    copy(project / name, target / 'AfterHoursMaple' / name)
for source in (project / 'Tools').iterdir():
    if source.is_file() and (source.suffix in ('.py', '.cjs') or source.name in ('asset-check.json', 'import-report.json')):
        copy(source, target / 'AfterHoursMaple/Tools' / source.name)
for name in ['smoking-simulator.js', 'smoking-simulator.template.html', 'assets/maplestory-samples/manifest.json', 'docs/after-hours-maple-romance-design-v1.md', 'tests/smoking-simulator-smoke.cjs']:
    copy(workspace / name, target / name)
for directory in ['assets/maplestory-samples/bgm', 'assets/smoking']:
    for source in (workspace / directory).rglob('*'):
        if source.is_file():
            copy(source, target / source.relative_to(workspace))
(target / '.gitignore').write_text('''**/__pycache__/
**/*.log
AfterHoursMaple/Library/
AfterHoursMaple/Temp/
AfterHoursMaple/Obj/
AfterHoursMaple/Logs/
AfterHoursMaple/UserSettings/
AfterHoursMaple/Tools/cache/
AfterHoursMaple/Builds/*.zip
.tools/
''', encoding='utf8')
(target / 'AfterHoursMaple/Builds/Web/.nojekyll').touch()
build_files = [p for p in (project / 'Builds/Web').rglob('*') if p.is_file()]
for source in build_files:
    uploaded = target / 'AfterHoursMaple' / source.relative_to(project)
    assert hashlib.sha256(source.read_bytes()).digest() == hashlib.sha256(uploaded.read_bytes()).digest(), str(source)
print(json.dumps({'checkout': str(target), 'verifiedBuildFiles': len(build_files), 'buildBytes': sum(p.stat().st_size for p in build_files)}))
