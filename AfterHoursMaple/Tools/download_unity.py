import urllib.request,concurrent.futures,pathlib,time,shutil
root=pathlib.Path(__file__).resolve().parents[2]/'.tools/installers'
root.mkdir(parents=True,exist_ok=True)
def download(url,name):
    req=urllib.request.Request(url,headers={'Range':'bytes=0-0'})
    with urllib.request.urlopen(req,timeout=60) as r:
        assert r.status==206,r.status
        total=int(r.headers['Content-Range'].split('/')[-1])
    size=16*1024*1024;parts=root/(name+'.parts');parts.mkdir(exist_ok=True)
    def part(i):
        start=i*size;end=min(start+size,total)-1;p=parts/str(i)
        if p.exists() and p.stat().st_size==end-start+1:return
        for attempt in range(4):
            try:
                with urllib.request.urlopen(urllib.request.Request(url,headers={'Range':f'bytes={start}-{end}'}),timeout=120) as r:
                    assert r.status==206 and r.headers['Content-Range'].startswith(f'bytes {start}-'),r.headers
                    with p.open('wb') as f:shutil.copyfileobj(r,f)
                assert p.stat().st_size==end-start+1
                return
            except Exception:
                if attempt==3:raise
                time.sleep(2)
    n=(total+size-1)//size
    with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:
        for j,_ in enumerate(pool.map(part,range(n))):
            if j%8==0:print(name,j+1,'/',n,flush=True)
    with (root/name).open('wb') as f:
        for i in range(n):
            with (parts/str(i)).open('rb') as src:shutil.copyfileobj(src,f)
    print('COMPLETE',name,total,flush=True)
base='https://download.unity3d.com/download_unity/7685f01dc6be/'
download(base+'Windows64EditorInstaller/UnitySetup64-6000.0.74f1.exe','UnitySetup64.exe')
download(base+'TargetSupportInstaller/UnitySetup-WebGL-Support-for-Editor-6000.0.74f1.exe','UnityWeb.exe')
