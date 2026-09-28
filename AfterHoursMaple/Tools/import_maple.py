"""Reproducible GMS v83 importer. Original coordinates, art and portal links.
PNG: MapleStory.io. Layout/anchor metadata: HeavenMS WZ XML (v83).
No credentials. Cache/retry; records missing assets instead of invented substitutes.
"""
import concurrent.futures as futures,urllib.request,urllib.error,xml.etree.ElementTree as ET
import pathlib,json,hashlib,zipfile,io,time,threading,shutil,posixpath
from PIL import Image
PROJECT=pathlib.Path(__file__).resolve().parents[1]
CACHE=PROJECT/'Tools/cache'; OUT=PROJECT/'Assets/StreamingAssets/Maple'
for p in [CACHE,OUT/'images',OUT/'maps']:p.mkdir(parents=True,exist_ok=True)
API='https://maplestory.io/api/'; XML='https://raw.githubusercontent.com/ronancpl/HeavenMS/master/wz/'
lock=threading.Lock(); trees={}; archives={}; asset_records={}; missing=[]
def fetch(url,suffix='.bin'):
    p=CACHE/(hashlib.sha256(url.encode()).hexdigest()+suffix)
    if p.exists():return p.read_bytes()
    for i in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(url,headers={'User-Agent':'AfterHours-AssetImporter/1.0'}),timeout=90) as r:data=r.read()
            p.write_bytes(data);return data
        except Exception:
            if i==2:raise
            time.sleep(1+i)
def val(node,key,default=0):
    if node is None:return default
    e=node.find(f"*[@name='{key}']")
    if e is None:return default
    v=e.get('value',default)
    if e.tag in ('int','short','long','float','double'):return float(v) if '.' in str(v) else int(v)
    if e.tag=='vector':return {'x':int(e.get('x',0)),'y':int(e.get('y',0))}
    return v
def node(root,path):
    cur=root
    for part in path.split('/'):
        if part:cur=cur.find(f"*[@name='{part}']") if cur is not None else None
    return cur
def tree(container):
    if container not in trees:
        package,rest=container.split('/',1)
        trees[container]=ET.fromstring(fetch(XML+package+'.wz/'+rest+'.xml','.xml'))
    return trees[container]
def prepare_container(container):
    try:
        tree(container)
        data=fetch(API+'wz/export/GMS/83/'+container,'.zip')
        archives[container]=zipfile.ZipFile(io.BytesIO(data))
        print('CONTAINER',container,len(archives[container].namelist()),flush=True)
    except Exception as e:
        missing.append({'container':container,'error':str(e)});print('CONTAINER FAIL',container,str(e),flush=True)
def image_ref(container,path):
    original=path
    root=tree(container);e=node(root,path)
    for _ in range(12):
        if e is None:raise ValueError('Missing metadata '+container+'/'+path)
        if e.tag!='uol':break
        path=posixpath.normpath(posixpath.join(posixpath.dirname(path),e.get('value')));e=node(root,path)
    if e.tag!='canvas':raise ValueError('Not canvas '+container+'/'+path)
    full=container+'/'+path;key=hashlib.sha1(full.encode()).hexdigest()[:20]
    target=OUT/'images'/(key+'.png')
    if not target.exists():
        z=archives.get(container);name=full.replace('/','-')+'.png'
        try:data=z.read(name) if z else fetch(API+'wz/img/GMS/83/'+full,'.png')
        except KeyError:data=fetch(API+'wz/img/GMS/83/'+full,'.png')
        with Image.open(io.BytesIO(data)) as im:im.verify()
        target.write_bytes(data)
    with Image.open(target) as im:w,h=im.size
    origin=val(e,'origin',{'x':0,'y':0});delay=val(e,'delay',100)
    if not isinstance(delay,(int,float)):
        de=node(root,posixpath.normpath(posixpath.join(posixpath.dirname(path),str(delay))))
        try:delay=int(de.get('value',100)) if de is not None else 100
        except (TypeError,ValueError):delay=100
    with lock:asset_records[key]={'key':key,'source':API+'wz/img/GMS/83/'+full,'width':w,'height':h,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
    return {'key':key,'w':w,'h':h,'ox':origin['x'],'oy':origin['y'],'delay':max(30,delay)}
def frames(container,path):
    e=node(tree(container),path)
    if e is None:raise ValueError('Missing '+container+'/'+path)
    if e.tag in ('canvas','uol'):return [image_ref(container,path)]
    nums=[c.get('name') for c in e if c.get('name','').isdigit()]
    return [image_ref(container,path+'/'+n) for n in sorted(nums,key=int)]
def map_root(mid):return ET.fromstring(fetch(XML+f'Map.wz/Map/Map{mid//100000000}/{mid:09}.img.xml','.xml'))
def summary(mid,r):
    portals=[];pn=node(r,'portal')
    for e in pn if pn is not None else []:
        portals.append({'x':val(e,'x'),'y':val(e,'y'),'type':val(e,'pt'),'target':val(e,'tm',999999999),'name':val(e,'pn',''),'targetName':val(e,'tn',''),'script':val(e,'script','')})
    return portals
def get_containers(r):
    result=set()
    for i in range(8):
        l=node(r,str(i))
        if l is None:continue
        ts=val(node(l,'info'),'tS','')
        if ts:result.add('Map/Tile/'+ts+'.img')
        o=node(l,'obj')
        for e in o if o is not None else []:result.add('Map/Obj/'+val(e,'oS','')+'.img')
    b=node(r,'back')
    for e in b if b is not None else []:
        bs=val(e,'bS','')
        if bs:result.add('Map/Back/'+bs+'.img')
    return result
def build_map(mid,r):
    try:
        mm=node(r,'miniMap');info=node(r,'info');vr={k:val(info,'VR'+k,None) for k in ['Left','Top','Right','Bottom']}
        left=-val(mm,'centerX',400);top=-val(mm,'centerY',300);width=val(mm,'width',800);height=val(mm,'height',600)
        if vr['Left'] is not None and vr['Right'] is not None and vr['Right']>vr['Left']:left=vr['Left'];width=vr['Right']-left
        if vr['Top'] is not None and vr['Bottom'] is not None and vr['Bottom']>vr['Top']:top=vr['Top'];height=vr['Bottom']-top
        name={100000000:'헤네시스',101000000:'엘리니아',102000000:'페리온',103000000:'커닝시티',104000000:'리스항구'}.get(mid,str(mid))
        try:
            nm=json.loads(fetch(API+f'GMS/83/map/{mid}/name','.json'))
            if isinstance(nm,dict):name=nm.get('name') or nm.get('mapName') or name
        except Exception:pass
        kr={100000000:'헤네시스',101000000:'엘리니아',102000000:'페리온',103000000:'커닝시티',104000000:'리스항구'}
        name=kr.get(mid,name)
        data={'id':mid,'name':name,'left':left,'top':top,'width':width,'height':height,'miniLeft':-val(mm,'centerX',400),'miniTop':-val(mm,'centerY',300),'miniWidth':val(mm,'width',800),'miniHeight':val(mm,'height',600),'draws':[],'backgrounds':[],'footholds':[],'ladders':[],'npcs':[],'portals':summary(mid,r)}
        for i in range(8):
            l=node(r,str(i))
            if l is None:continue
            ts=val(node(l,'info'),'tS','')
            for kind in ['obj','tile']:
                entries=node(l,kind)
                for e in entries if entries is not None else []:
                    try:
                        if kind=='obj':container='Map/Obj/'+val(e,'oS','')+'.img';path='/'.join(str(val(e,k,'')) for k in ['l0','l1','l2']);z=val(e,'z')
                        else:container='Map/Tile/'+ts+'.img';path=str(val(e,'u',''))+'/'+str(val(e,'no'));z=10000+val(e,'zM')
                        fs=frames(container,path)
                        data['draws'].append({'x':val(e,'x'),'y':val(e,'y'),'z':i*20000+z,'flip':bool(val(e,'f')),'frames':fs})
                    except Exception as ex:missing.append({'map':mid,'path':container+'/'+path,'error':str(ex)})
        data['draws'].sort(key=lambda d:d['z'])
        b=node(r,'back')
        for e in b if b is not None else []:
            bs=val(e,'bS','')
            if not bs:continue
            try:
                path=('ani/' if val(e,'ani') else 'back/')+str(val(e,'no'))
                fs=frames('Map/Back/'+bs+'.img',path)
                data['backgrounds'].append({k:val(e,k) for k in ['x','y','rx','ry','cx','cy','type','front','a','f']}|{'frames':fs})
            except Exception as ex:missing.append({'map':mid,'background':bs,'error':str(ex)})
        fh=node(r,'foothold')
        if fh is not None:
            for layer in fh:
                for group in layer:
                    for e in group:data['footholds'].append({k:val(e,k) for k in ['x1','y1','x2','y2','prev','next']}|{'id':int(e.get('name')),'layer':int(layer.get('name'))})
        lr=node(r,'ladderRope')
        for e in lr if lr is not None else []:data['ladders'].append({k:val(e,k) for k in ['x','y1','y2','l']})
        life=node(r,'life')
        for e in life if life is not None else []:
            if val(e,'type','')=='n':data['npcs'].append({'id':int(val(e,'id')),'x':val(e,'x'),'y':val(e,'cy',val(e,'y')),'flip':bool(val(e,'f')),'hidden':bool(val(e,'hide'))})
        # Minimap from map's own canvas, exact same region/version.
        try:
            png=fetch(API+f'GMS/83/map/{mid}/minimap','.png');p=OUT/'images'/f'minimap-{mid}.png';p.write_bytes(png);data['minimap']='minimap-'+str(mid)
        except Exception:pass
        (OUT/'maps'/f'{mid}.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf8')
        print('MAP',mid,name,len(data['draws']),'draws',len(data['npcs']),'NPCs',flush=True)
        return data
    except Exception as e:missing.append({'map':mid,'fatal':str(e)});print('MAP FAIL',mid,str(e),flush=True)
def main():
    roots={};pending=[100000000,100000201,101000000,101000003,102000000,103000000,104000000]
    # Include every linked interior in each town's 10000-ID group recursively.
    while pending:
        batch=[m for m in set(pending) if m not in roots];pending=[]
        if not batch:break
        with futures.ThreadPoolExecutor(max_workers=6) as pool:
            for mid,r in zip(batch,pool.map(map_root,batch)):
                roots[mid]=r
                for p in summary(mid,r):
                    target=p['target']
                    if target//10000==mid//10000 and target not in roots:pending.append(target)
        print('DISCOVER',len(roots),'maps',flush=True)
    containers=set().union(*(get_containers(r) for r in roots.values()))
    containers|={'UI/StatusBar.img','UI/Basic.img','Map/MapHelper.img','Map/WorldMap/WorldMap010.img'}
    # UIWindow subset export avoids unrelated multi-megabyte UI assets.
    containers.add('UI/UIWindow.img')
    with futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(prepare_container,sorted(containers)))
    maps=[]
    with futures.ThreadPoolExecutor(max_workers=5) as pool:
        for m in pool.map(lambda mr:build_map(*mr),roots.items()):
            if m:maps.append(m)
    ids=sorted(set(n['id'] for m in maps for n in m['npcs']))
    npcs=[]
    def npc(nid):
        try:
            meta=json.loads(fetch(API+f'GMS/83/npc/{nid}','.json'));fs=[]
            for i in range(min(8,meta.get('framebooks',{}).get('stand',1))):
                png=fetch(API+f'GMS/83/npc/{nid}/render/stand/{i}','.png');key=f'npc-{nid}-{i}';(OUT/'images'/(key+'.png')).write_bytes(png)
                with Image.open(io.BytesIO(png)) as im:w,h=im.size
                fs.append({'key':key,'w':w,'h':h,'ox':w//2,'oy':h,'delay':170})
            return {'id':nid,'name':meta.get('name',str(nid)),'function':meta.get('function',''),'frames':fs}
        except Exception as e:missing.append({'npc':nid,'error':str(e)});return {'id':nid,'name':str(nid),'frames':[]}
    with futures.ThreadPoolExecutor(max_workers=6) as pool:npcs=list(pool.map(npc,ids))
    ui=[]
    for container,prefixes in [('UI/StatusBar.img',['base']),('UI/Basic.img',['BtOK','BtCancel','BtClose','BtYes','BtNo']),('UI/UIWindow.img',['UtilDlgEx','MiniMap','WorldMap','Messenger']),('Map/MapHelper.img',['portal/game','worldMap']),('Map/WorldMap/WorldMap010.img',['BaseImg'])]:
        def walk(e,path):
            if e.tag=='canvas':
                try:ui.append({'path':container+'/'+path,'frame':image_ref(container,path)})
                except Exception as ex:missing.append({'ui':container+'/'+path,'error':str(ex)})
            else:
                for c in e:
                    if c.tag in ['canvas','imgdir']:walk(c,path+'/'+c.get('name'))
        for prefix in prefixes:
            e=node(tree(container),prefix)
            if e is not None:walk(e,prefix)
    catalog={'region':'GMS','version':'83','maps':[{'id':m['id'],'name':m['name']} for m in maps],'npcs':npcs,'ui':ui,'player':[]}
    old=json.loads((PROJECT.parent/'assets/maplestory-samples/manifest.json').read_text(encoding='utf8'));avatar=next(x['url'] for x in old if x['file']=='characters/beginner-stand.png')
    for action,count in [('stand1',3),('walk1',4),('jump',1),('ladder',2),('rope',2),('alert',3)]:
        fs=[]
        for i in range(count):
            try:
                png=fetch(avatar.replace('/stand1/0',f'/{action}/{i}'),'.png');key=f'player-{action}-{i}';(OUT/'images'/(key+'.png')).write_bytes(png)
                with Image.open(io.BytesIO(png)) as im:w,h=im.size
                fs.append({'key':key,'w':w,'h':h,'ox':w//2,'oy':h,'delay':150})
            except Exception as ex:missing.append({'player':action,'frame':i,'error':str(ex)})
        catalog['player'].append({'action':action,'frames':fs})
    (OUT/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf8')
    (PROJECT/'Tools/import-report.json').write_text(json.dumps({'maps':len(maps),'npcs':len(npcs),'images':len(asset_records),'sources':list(asset_records.values()),'missing':missing},ensure_ascii=False,indent=2),encoding='utf8')
    print('DONE',len(maps),'maps',len(npcs),'npcs',len(asset_records),'original images','missing',len(missing),flush=True)
if __name__=='__main__':main()
