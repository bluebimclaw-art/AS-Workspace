"""Restore the verified release frontend into a fresh checkout only.
No model calls, credentials, accounts, database initialization or server startup.
"""
from pathlib import Path,PurePosixPath
import argparse,hashlib,json,zipfile,shutil
p=argparse.ArgumentParser();p.add_argument('--archive',required=True);args=p.parse_args();repo=Path(__file__).resolve().parent.parent;archive=Path(args.archive).resolve()
meta=json.loads((repo/'deployment/frontend-archive.json').read_text());manifest=json.loads((repo/'deployment/frontend-manifest.json').read_text());assert hashlib.sha256(archive.read_bytes()).hexdigest()==meta['sha256'],'Archive SHA256 mismatch'
assert not (repo/'dist').exists(),'Refuse overwriting any existing dist; use a fresh checkout'
public_names=('canvas-web','gridcraft','office','excalidraw-assets')
assert all(not (repo/'public'/n).exists() for n in public_names),'Refuse overwriting public assets'
with zipfile.ZipFile(archive) as z:
 assert set(z.namelist())=={f['file'] for f in manifest['files']},'Unexpected ZIP paths'
 for item in manifest['files']:
  relative=PurePosixPath(item['file']);assert relative.parts[0]=='dist' and '..' not in relative.parts and not relative.is_absolute()
  target=repo.joinpath(*relative.parts);target.parent.mkdir(parents=True,exist_ok=True)
  with z.open(item['file']) as src,target.open('wb') as dst:shutil.copyfileobj(src,dst)
  assert hashlib.sha256(target.read_bytes()).hexdigest()==item['sha256'],item['file']
for name in public_names:
 source=repo/'dist'/name
 if source.exists():shutil.copytree(source,repo/'public'/name)
print(json.dumps({'status':'passed','verifiedFrontendFiles':len(manifest['files']),'restoredDist':True,'restoredPublicEditorAssets':True,'serverStarted':False,'companyDataRestored':False}))
