using UnityEngine;
using UnityEngine.Networking;
using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;

public class MapleGame:MonoBehaviour {
 const float VW=1280,VH=720;const string SaveKey="after-hours-maple-v1";
 public MapleCatalog catalog; public MapleMap map;public SaveData save=new SaveData();
 Dictionary<string,Texture2D> textures=new Dictionary<string,Texture2D>();Dictionary<int,NpcInfo> npcInfos=new Dictionary<int,NpcInfo>();
 Dictionary<string,MapleFrame[]> actions=new Dictionary<string,MapleFrame[]>();Dictionary<string,MapleFrame> ui=new Dictionary<string,MapleFrame>();
 string root,status="원작 맵 데이터를 읽고 있습니다…",notice="";float noticeUntil,px,py,vx,vy,camX,camY,clock,portalCooldown,actionTime;bool loading=true,grounded,flip,encounter,worldMap,phone,taxi,help=true,muted;int selectedContact=-1,dialogueStep,sceneVisits;
 MapleLadder climbing;MapleNpc selectedNpc;Contact activeContact;GUIStyle label,small,big;Font font;float guiScale;Vector2 chatScroll;AudioSource music;
 int taxiStage,taxiDestination,taxiNpcId;
 string talk="";string[] choices=Array.Empty<string>();bool consent;
 [DllImport("__Internal")] static extern void AH_OpenSmoke(string url,string payload);
 [DllImport("__Internal")] static extern void AH_UpdateSmoke(string payload);
 [DllImport("__Internal")] static extern void AH_CloseSmoke();
 [DllImport("__Internal")] static extern void AH_Register();
 [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)] static void Boot(){if(FindFirstObjectByType<MapleGame>()==null)new GameObject("AfterHours").AddComponent<MapleGame>();}
 IEnumerator Start(){
  gameObject.name="AfterHours";Application.targetFrameRate=60;root=Application.streamingAssetsPath+"/Maple/";font=Resources.Load<Font>("MapleFont");
  music=gameObject.AddComponent<AudioSource>();music.loop=true;music.volume=.2f;
  if(PlayerPrefs.HasKey(SaveKey)){try{var loaded=JsonUtility.FromJson<SaveData>(PlayerPrefs.GetString(SaveKey));if(loaded!=null&&loaded.schema==1)save=loaded;}catch{}}
  clock=save.clock;
  string raw=null;yield return ReadText(root+"catalog.json",s=>raw=s);if(raw==null)yield break;
  catalog=JsonUtility.FromJson<MapleCatalog>(raw);foreach(var n in catalog.npcs)npcInfos[n.id]=n;
  foreach(var p in catalog.player)actions[p.action]=p.frames;
  foreach(var a in catalog.ui)ui[a.path]=a.frame;
  var baseKeys=catalog.ui.Select(a=>a.frame.key).Concat(catalog.player.SelectMany(p=>p.frames).Select(f=>f.key)).Distinct();
  yield return LoadTextures(baseKeys);
  #if UNITY_WEBGL && !UNITY_EDITOR
  AH_Register();
  #endif
  yield return LoadMap(save.mapId,"sp",save.positioned);
 }
 IEnumerator ReadText(string url,Action<string> callback){using(var r=UnityWebRequest.Get(url)){yield return r.SendWebRequest();if(r.result!=UnityWebRequest.Result.Success){status="자료를 불러오지 못했습니다: "+r.error;Debug.LogError(url+" "+r.error);callback(null);}else callback(r.downloadHandler.text);}}
 IEnumerator LoadTextures(IEnumerable<string> keys){
  var pending=new Queue<string>(keys.Where(k=>!string.IsNullOrEmpty(k)&&!textures.ContainsKey(k)).Distinct());int all=pending.Count,done=0;
  while(pending.Count>0){var batch=new List<KeyValuePair<string,UnityWebRequest>>();for(int i=0;i<10&&pending.Count>0;i++){var k=pending.Dequeue();var r=UnityWebRequestTexture.GetTexture(root+"images/"+k+".png");r.SendWebRequest();batch.Add(new KeyValuePair<string,UnityWebRequest>(k,r));}
   foreach(var p in batch){while(!p.Value.isDone)yield return null;if(p.Value.result==UnityWebRequest.Result.Success){var t=DownloadHandlerTexture.GetContent(p.Value);t.filterMode=FilterMode.Point;t.wrapMode=TextureWrapMode.Clamp;textures[p.Key]=t;}else Debug.LogError("Missing texture "+p.Key+" "+p.Value.error);p.Value.Dispose();done++;}status=$"원작 에셋 준비 중  {done} / {all}";yield return null;
  }
 }
 public IEnumerator LoadMap(int id,string portal="sp",bool restore=false){
  if(catalog==null||!catalog.maps.Any(m=>m.id==id)){Toast("이 연결 맵은 현재 빌드에 포함되지 않았습니다.");yield break;}
  loading=true;worldMap=phone=taxi=false;selectedNpc=null;climbing=null;status="맵을 불러오는 중…";
  string raw=null;yield return ReadText(root+"maps/"+id+".json",s=>raw=s);if(raw==null){loading=false;yield break;}
  map=JsonUtility.FromJson<MapleMap>(raw);
  var keys=map.draws.SelectMany(d=>d.frames).Concat(map.backgrounds.SelectMany(b=>b.frames)).Select(f=>f.key).ToList();
  foreach(var n in map.npcs)if(npcInfos.ContainsKey(n.id))keys.AddRange(npcInfos[n.id].frames.Select(f=>f.key));keys.Add(map.minimap);
  yield return LoadTextures(keys);
  var spawn=map.portals.FirstOrDefault(p=>p.name==portal)??map.portals.FirstOrDefault(p=>p.type==0);
  if(restore){px=save.x;py=save.y;}else if(spawn!=null){px=spawn.x;py=spawn.y-2;}else{px=map.left+map.width*.5f;py=map.top+20;}
  vx=vy=0;grounded=false;camX=px-VW/2;camY=py-410;loading=false;portalCooldown=.8f;Save();StartCoroutine(LoadMusic(id));
 }
 IEnumerator LoadMusic(int id){int town=id/1000000*1000000;string file=town==100000000?"henesys":town==101000000?"ellinia":town==103000000?"kerning-city":null;
  if(file==null){music.Stop();yield break;}using(var r=UnityWebRequestMultimedia.GetAudioClip(Application.streamingAssetsPath+"/Audio/"+file+".mp3",AudioType.MPEG)){yield return r.SendWebRequest();if(r.result==UnityWebRequest.Result.Success){var old=music.clip;music.clip=DownloadHandlerAudioClip.GetContent(r);if(old)Destroy(old);if(!muted)music.Play();}}
 }
 void Update(){if(loading||map==null)return;float dt=Mathf.Min(Time.deltaTime,.035f);clock+=dt;portalCooldown-=dt;
  foreach(var ct in save.contacts)if(ct.due>0&&clock>=ct.due&&!encounter){ct.due=-1;ct.unread=true;ct.invite="초대 도착";ct.lines.Add(new PhoneLine{text=ct.memory=="quiet"?"조용한 시간 좋아한다고 했지. 난 늘 여기 있어. 잠깐 올래?":"잠깐 시간 있어? 여기서 같이 쉬자. 늘 있던 자리야."});Toast(ct.name+"에게 연락이 왔습니다.  [P]");Save();}
  if(encounter)return;
  if(Input.GetKeyDown(KeyCode.Escape)){selectedNpc=null;worldMap=phone=taxi=false;help=false;}
  if(Input.GetKeyDown(KeyCode.W)){worldMap=!worldMap;phone=taxi=false;}
  if(Input.GetKeyDown(KeyCode.P)){phone=!phone;worldMap=taxi=false;if(phone&&save.contacts.Count>0)SelectContact(0);}
  if(Input.GetKeyDown(KeyCode.H))help=!help;
  if(worldMap||phone||taxi||selectedNpc!=null){vx=0;return;}
  actionTime+=dt;float axis=(Input.GetKey(KeyCode.RightArrow)?1:0)-(Input.GetKey(KeyCode.LeftArrow)?1:0);
  if(axis!=0)flip=axis>0;vx=Mathf.MoveTowards(vx,axis*125,dt*(axis==0?1700:1200));
  float oldY=py;float up=(Input.GetKey(KeyCode.DownArrow)?1:0)-(Input.GetKey(KeyCode.UpArrow)?1:0);
  if(climbing==null&&up!=0)climbing=map.ladders.FirstOrDefault(l=>Mathf.Abs(px-l.x)<10&&py>=l.y1-6&&py<=l.y2+8);
  if(climbing!=null){px=climbing.x;py+=up*115*dt;vx=vy=0;grounded=false;if(py<climbing.y1-4){py=climbing.y1-8;climbing=null;}else if(py>climbing.y2+3)climbing=null;
   if(Input.GetKeyDown(KeyCode.Space)||Input.GetKeyDown(KeyCode.LeftAlt)){climbing=null;vy=-420;vx=axis*140;}}
  else{
   if((Input.GetKeyDown(KeyCode.Space)||Input.GetKeyDown(KeyCode.LeftAlt))&&grounded){bool drop=Input.GetKey(KeyCode.DownArrow)&&map.footholds.Any(f=>f.x1!=f.x2&&px>=Mathf.Min(f.x1,f.x2)&&px<=Mathf.Max(f.x1,f.x2)&&Mathf.Min(f.y1,f.y2)>py+12);if(drop){py+=8;oldY=py;vy=60;}else vy=-555;grounded=false;}
   px+=vx*dt;vy=Mathf.Min(vy+2000*dt,670);py+=vy*dt;grounded=false;
   if(vy>=0){float best=float.PositiveInfinity;foreach(var f in map.footholds){if(Mathf.Abs(f.x2-f.x1)<.1f)continue;float lo=Mathf.Min(f.x1,f.x2),hi=Mathf.Max(f.x1,f.x2);if(px<lo||px>hi)continue;float fy=Mathf.Lerp(f.y1,f.y2,(px-f.x1)/(f.x2-f.x1));if(oldY<=fy+7&&py>=fy&&fy<best)best=fy;}if(best<float.PositiveInfinity){py=best;vy=0;grounded=true;}}
  }
  px=Mathf.Clamp(px,map.left+8,map.left+map.width-8);if(py>map.top+map.height+150){var sp=map.portals.FirstOrDefault(p=>p.type==0);if(sp!=null){px=sp.x;py=sp.y-5;}vy=0;}
  camX=Mathf.Lerp(camX,px-VW/2,dt*7);camY=Mathf.Lerp(camY,py-410,dt*5);ClampCamera();
  if(Input.GetKeyDown(KeyCode.UpArrow)&&portalCooldown<=0&&climbing==null){var p=map.portals.FirstOrDefault(q=>q.type!=0&&(q.target!=999999999||q.script=="enterAchter"||q.script=="enterMagiclibrar")&&Mathf.Abs(q.x-px)<28&&Mathf.Abs(q.y-py)<65);if(p!=null){int target=p.script=="enterAchter"?100000201:p.script=="enterMagiclibrar"?101000003:p.target;StartCoroutine(LoadMap(target,p.script=="enterAchter"?"out02":p.targetName));return;}}
  if(Input.GetKeyDown(KeyCode.F)||Input.GetKeyDown(KeyCode.Return)){var n=NearestNpc();if(n!=null)OpenNpc(n);else Toast("NPC 옆에서 F 또는 Enter로 말을 걸 수 있습니다.");}
 }
 void ClampCamera(){camX=map.width<VW?map.left+(map.width-VW)/2:Mathf.Clamp(camX,map.left,map.left+map.width-VW);camY=map.height<VH?map.top+(map.height-VH)/2:Mathf.Clamp(camY,map.top,map.top+map.height-VH);}
 MapleNpc NearestNpc(){return map.npcs.Where(n=>!n.hidden&&Mathf.Abs(n.x-px)<95&&Mathf.Abs(n.y-py)<85).OrderBy(n=>Mathf.Abs(n.x-px)).FirstOrDefault();}
 string NpcName(int id){var names=new Dictionary<int,string>{{1051000,"마니"},{1051001,"돈황"},{1051002,"명약국"},{1052017,"홍아저씨"},{1052102,"슈미"},{1052103,"넬라"},{1052106,"이카루스"},{1012101,"마야"},{1032100,"요정 아르웬"},{1032101,"요정 로웬"},{1012003,"장로 스탄"},{1052002,"뒷골목의 제이엠"},{1002100,"제인"},{1022002,"만지"},{1052001,"다크로드"},{1032001,"하인즈"},{1012100,"헬레나"},{1052000,"알렉스"},{1052016,"택시"},{1002007,"택시"},{1012000,"택시"},{1032000,"택시"},{1022001,"택시"},{1052003,"크리스"}};return names.ContainsKey(id)?names[id]:(npcInfos.ContainsKey(id)?npcInfos[id].name:id.ToString());}
 bool IsTaxi(int id){if(!npcInfos.ContainsKey(id))return false;string name=(npcInfos[id].name??"").ToLowerInvariant();return name.Contains("taxi")||name.Contains("cab");}
 void OpenNpc(MapleNpc n){flip=px<n.x;selectedNpc=n;consent=false;talk=IsTaxi(n.id)?"빅토리아 아일랜드의 다른 마을로 이동하시겠습니까?":"안녕하세요. 무슨 일이세요?";if(IsTaxi(n.id)){taxi=true;taxiStage=0;taxiDestination=0;taxiNpcId=n.id;selectedNpc=null;} }
 void OnGUI(){
  guiScale=Mathf.Min(Screen.width/VW,Screen.height/VH);GUI.matrix=Matrix4x4.TRS(new Vector3((Screen.width-VW*guiScale)/2,(Screen.height-VH*guiScale)/2),Quaternion.identity,new Vector3(guiScale,guiScale,1));
  if(label==null){label=new GUIStyle(GUI.skin.label){font=font,fontSize=16,wordWrap=true,normal={textColor=new Color(.15f,.19f,.22f)}};small=new GUIStyle(label){fontSize=12};big=new GUIStyle(label){fontSize=23,fontStyle=FontStyle.Bold};GUI.skin.button.font=font;GUI.skin.button.fontSize=15;}
  if(loading||map==null){Fill(new Rect(0,0,VW,VH),new Color(.06f,.11f,.17f));Text("AFTER HOURS",410,270,500,55,true,Color.white);Text(status,360,340,650,60,false,Color.white);return;}
  DrawWorld();
  if(encounter){DrawEncounter();return;}
  DrawHud();
  if(help)DrawHelp();if(selectedNpc!=null)DrawDialog();if(taxi)DrawTaxi();if(worldMap)DrawWorldMap();if(phone)DrawPhone();
  if(Time.unscaledTime<noticeUntil){Fill(new Rect(320,90,640,52),new Color(.05f,.1f,.17f,.9f));Text(notice,335,101,610,42,false,Color.white);}
 }
 void Fill(Rect r,Color c){var old=GUI.color;GUI.color=c;GUI.DrawTexture(r,Texture2D.whiteTexture);GUI.color=old;}
 void Text(string s,float x,float y,float w,float h,bool bold=false,Color? color=null){var st=new GUIStyle(bold?big:label);if(color.HasValue)st.normal.textColor=color.Value;GUI.Label(new Rect(x,y,w,h),s,st);}
 MapleFrame Frame(MapleFrame[] fs){if(fs==null||fs.Length==0)return null;float total=0;foreach(var f in fs)total+=Mathf.Max(30,f.delay);float t=(Time.time*1000)%total;foreach(var f in fs){t-=Mathf.Max(30,f.delay);if(t<0)return f;}return fs[0];}
 void DrawFrame(MapleFrame f,float x,float y,float scale=1,bool flipX=false,bool anchor=true){if(f==null||!textures.ContainsKey(f.key))return;float xx=anchor?(flipX?x-(f.w-f.ox)*scale:x-f.ox*scale):x,yy=anchor?y-f.oy*scale:y;Rect r=new Rect(xx,yy,f.w*scale,f.h*scale);if(r.xMax<0||r.yMax<0||r.x>VW||r.y>VH)return;
  if(flipX){var mat=GUI.matrix;GUIUtility.ScaleAroundPivot(new Vector2(-1,1),new Vector2(r.center.x,r.center.y));GUI.DrawTexture(r,textures[f.key]);GUI.matrix=mat;}else GUI.DrawTexture(r,textures[f.key]);}
 void DrawWorld(){
  Fill(new Rect(0,0,VW,VH),Color.black);
  foreach(var b in map.backgrounds.Where(b=>b.front==0))DrawBack(b);
  foreach(var d in map.draws)DrawFrame(Frame(d.frames),d.x-camX,d.y-camY,1,d.flip);
  foreach(var n in map.npcs){if(n.hidden||!npcInfos.ContainsKey(n.id)||(encounter&&n==selectedNpc))continue;var inf=npcInfos[n.id];DrawFrame(Frame(inf.frames),n.x-camX,n.y-camY,1,n.flip);if(!encounter){var r=new Rect(n.x-camX-100,n.y-camY+4,200,20);var s=new GUIStyle(small){alignment=TextAnchor.MiddleCenter,normal={textColor=Color.yellow}};GUI.Label(r,NpcName(n.id),s);if(Event.current.type==EventType.MouseDown&&new Rect(n.x-camX-40,n.y-camY-95,80,115).Contains(Event.current.mousePosition)){if(Mathf.Abs(px-n.x)<95&&Mathf.Abs(py-n.y)<85)OpenNpc(n);else Toast("NPC 옆까지 직접 이동해 주세요.");Event.current.Use();}}}
  if(!encounter){string act=climbing!=null?(climbing.l==1?"ladder":"rope"):!grounded?"jump":Mathf.Abs(vx)>2?"walk1":"stand1";if(actions.ContainsKey(act))DrawFrame(Frame(actions[act]),px-camX,py-camY,1,flip);}
  foreach(var b in map.backgrounds.Where(b=>b.front!=0))DrawBack(b);
  var pf=ui.FirstOrDefault(k=>k.Key.Contains("portal/game/pv/")).Value;
  foreach(var p in map.portals){if(p.type==2&&pf!=null)DrawFrame(pf,p.x-camX,p.y-camY);}
 }
 void DrawBack(MapleBack b){var f=Frame(b.frames);if(f==null||!textures.ContainsKey(f.key))return;float x=b.x+(camX+VW/2)*b.rx/100f+VW/2,y=b.y+(camY+VH/2)*b.ry/100f+VH/2;int tw=b.cx>0?(int)b.cx:f.w,th=b.cy>0?(int)b.cy:f.h;bool repeatX=b.type==1||b.type==3||b.type==4||b.type==6,repeatY=b.type==2||b.type==3||b.type==5||b.type==7;
  if(b.type==0){x=b.x-camX;y=b.y-camY;}if(repeatX)x=(x-f.ox)%Mathf.Max(tw,1)-tw+f.ox;if(repeatY)y=(y-f.oy)%Mathf.Max(th,1)-th+f.oy;
  Color old=GUI.color;GUI.color=new Color(1,1,1,b.a/255f);for(float yy=y;yy<(repeatY?VH+f.h:y+1);yy+=Mathf.Max(th,1))for(float xx=x;xx<(repeatX?VW+f.w:x+1);xx+=Mathf.Max(tw,1))DrawFrame(f,xx,yy,1,b.f==1);GUI.color=old;
 }
 MapleFrame Ui(string suffix){return ui.FirstOrDefault(k=>k.Key.EndsWith(suffix,StringComparison.Ordinal)).Value;}
 void RawUi(string suffix,Rect r){var f=Ui(suffix);if(f!=null&&textures.ContainsKey(f.key))GUI.DrawTexture(r,textures[f.key]);}
 void Panel(Rect r,string title){
  const string p="UIWindow.img/MiniMap/MinMap/";
  Fill(new Rect(r.x+6,r.y+29,r.width-12,r.height-43),new Color(.94f,.96f,.98f));
  RawUi(p+"c",new Rect(r.x+6,r.y+29,r.width-12,r.height-43));
  RawUi(p+"n",new Rect(r.x+6,r.y,r.width-12,29));RawUi(p+"s",new Rect(r.x+6,r.yMax-14,r.width-12,14));
  RawUi(p+"w",new Rect(r.x,r.y+29,6,r.height-43));RawUi(p+"e",new Rect(r.xMax-6,r.y+29,6,r.height-43));
  RawUi(p+"nw",new Rect(r.x,r.y,6,29));RawUi(p+"ne",new Rect(r.xMax-6,r.y,6,29));
  RawUi(p+"sw",new Rect(r.x,r.yMax-14,6,14));RawUi(p+"se",new Rect(r.xMax-6,r.yMax-14,6,14));
  Text(title,r.x+13,r.y+3,r.width-26,25,false,new Color(.13f,.23f,.31f));
 }
 bool Button(string title,Rect r){return GUI.Button(r,title);}
 void DrawHud(){
  RawUi("StatusBar.img/base/backgrnd",new Rect(0,VH-72,VW,72));Fill(new Rect(0,VH-41,VW,41),new Color(.08f,.13f,.2f,.94f));
  Text("AFTER HOURS  |  "+map.name,14,VH-34,500,30,false,Color.white);Text("성인 플레이어  /  "+save.mesos+" 메소",470,VH-32,260,26,false,Color.white);
  if(Button("월드맵 W",new Rect(817,680,127,29))){worldMap=!worldMap;phone=taxi=false;}
  int unread=save.contacts.Count(c=>c.unread);if(Button("메신저 P"+(unread>0?"  ●":""),new Rect(955,680,136,29))){phone=!phone;if(phone&&save.contacts.Count>0)SelectContact(0);worldMap=taxi=false;}
  if(Button(muted?"소리 켜기":"소리 끄기",new Rect(1100,680,85,29))){muted=!muted;music.mute=muted;}
  if(Button("도움 H",new Rect(1191,680,76,29)))help=!help;
  Panel(new Rect(12,12,235,154),map.name);if(!string.IsNullOrEmpty(map.minimap)&&textures.ContainsKey(map.minimap)){var texture=textures[map.minimap];float scale=Mathf.Min(212f/texture.width,103f/texture.height);var mr=new Rect(23+(212-texture.width*scale)/2,49+(103-texture.height*scale)/2,texture.width*scale,texture.height*scale);GUI.DrawTexture(mr,texture);float sx=(px-map.miniLeft)/Mathf.Max(1,map.miniWidth),sy=(py-map.miniTop)/Mathf.Max(1,map.miniHeight);Fill(new Rect(mr.x+Mathf.Clamp01(sx)*mr.width-2,mr.y+Mathf.Clamp01(sy)*mr.height-2,5,5),Color.yellow);}
  var near=NearestNpc();if(near!=null&&!phone&&!worldMap&&selectedNpc==null){Fill(new Rect(420,590,440,39),new Color(.04f,.12f,.18f,.88f));Text("[F / Enter]  "+NpcName(near.id)+"에게 말 걸기",438,597,420,30,false,Color.white);}
 }
 void DrawHelp(){Panel(new Rect(925,16,340,208),"빅뱅 이전 · 조작 안내");Text("← →  이동      SPACE / Alt  점프 · ↓+점프 내려가기\n↑ ↓  사다리 · 로프\n↑     출입구 / 포털 이용\nF / Enter  가까운 NPC와 대화\nW  월드맵     P  메신저\nNPC는 항상 원작 좌표에 고정됩니다.",940,59,310,155);}
 void DrawDialog(){var r=new Rect(270,440,740,217);RawUi("UIWindow.img/UtilDlgEx/t",new Rect(r.x,r.y,r.width,28));RawUi("UIWindow.img/UtilDlgEx/c",new Rect(r.x,r.y+28,r.width,r.height-86));RawUi("UIWindow.img/UtilDlgEx/s",new Rect(r.x,r.yMax-58,r.width,58));Text(NpcName(selectedNpc.id),r.x+22,r.y+8,r.width-44,28,false,new Color(.13f,.23f,.31f));var f=npcInfos.ContainsKey(selectedNpc.id)?Frame(npcInfos[selectedNpc.id].frames):null;DrawFrame(f,340,605,1.3f);Text(talk,421,490,560,90);
  if(Button(consent?"그 자리에서 시작":"여기서 같이 담배 피울래요?",new Rect(418,597,365,39))){if(!consent){consent=true;talk="좋아. 멀리 갈 필요 없지. 여기서 잠깐 이야기하자.";}else BeginEncounter();}
  if(Button("다음에 이야기해요",new Rect(795,597,195,39)))selectedNpc=null;
 }
 int TaxiFare(int target){return (target==101000000?800:1000)/10;}
 void DrawTaxi(){
  var r=new Rect(330,240,620,340);RawUi("UIWindow.img/UtilDlgEx/t",new Rect(r.x,r.y,r.width,28));RawUi("UIWindow.img/UtilDlgEx/c",new Rect(r.x,r.y+28,r.width,r.height-86));RawUi("UIWindow.img/UtilDlgEx/s",new Rect(r.x,r.yMax-58,r.width,58));
  Text("택시",355,249,500,30);if(npcInfos.ContainsKey(taxiNpcId))DrawFrame(Frame(npcInfos[taxiNpcId].frames),413,422);
  if(taxiStage==0){Text("안녕하세요! 다른 마을로 빠르고 편안하게 이동하시려면 저희 택시를 이용해 주세요.",488,299,419,150);if(Button("다음",new Rect(797,536,122,30)))taxiStage=1;}
  else if(taxiStage==1){Text("초보자에게는 90% 할인해 드립니다.\n어느 마을로 가시겠습니까?",488,289,419,64);int i=0;foreach(int id in new[]{104000000,102000000,100000000,101000000,103000000}){if(id==map.id)continue;var m=catalog.maps.First(a=>a.id==id);if(Button(m.name+" ("+TaxiFare(id)+" 메소)",new Rect(487,358+i++*36,420,30))){taxiDestination=id;taxiStage=2;}}}
  else {string destination=catalog.maps.First(a=>a.id==taxiDestination).name;Text(destination+"로 이동하시겠습니까?\n요금은 "+TaxiFare(taxiDestination)+" 메소입니다.",488,300,419,100);if(Button("예",new Rect(637,458,127,34))){if(save.mesos<TaxiFare(taxiDestination))Toast("메소가 부족합니다.");else{save.mesos-=TaxiFare(taxiDestination);StartCoroutine(LoadMap(taxiDestination));}}if(Button("아니오",new Rect(779,458,127,34)))taxiStage=1;}
  if(Button("취소",new Rect(355,536,104,30)))taxi=false;
 }

 void DrawWorldMap(){Panel(new Rect(282,83,716,560),"월드맵 · 빅토리아 아일랜드");var f=Ui("WorldMap010.img/BaseImg/0");if(f!=null)DrawFrame(f,320,121,1,false,false);Text("지도는 위치 확인용입니다. 이동은 원작 포털과 택시를 이용하세요.",306,604,671,28);if(Button("닫기",new Rect(907,89,75,25)))worldMap=false;}
 void SelectContact(int index){selectedContact=index;save.contacts[index].unread=false;chatScroll=new Vector2(0,100000);Save();}
 void DrawPhone(){Panel(new Rect(360,82,860,566),"Maple Messenger");var bg=Ui("UIWindow.img/Messenger/backgrnd");if(bg!=null)DrawFrame(bg,373,121,.65f,false,false);if(Button("닫기",new Rect(1127,88,77,24)))phone=false;
  if(save.contacts.Count==0){Text("아직 연락처가 없습니다.\nNPC와 첫 만남을 마치면 연락처를 교환합니다.",410,180,690,100);return;}
  for(int i=0;i<save.contacts.Count;i++)if(Button(save.contacts[i].name+(save.contacts[i].unread?" ●":""),new Rect(379,132+i*44,180,37)))SelectContact(i);
  if(selectedContact<0||selectedContact>=save.contacts.Count)selectedContact=0;var ct=save.contacts[selectedContact];
  Text(ct.name+" · "+(ct.visits>=3?"편한 사이":"안면 있는 사이")+"   "+ct.invite,583,130,600,40,true);
  float height=ct.lines.Count*72+30;chatScroll=GUI.BeginScrollView(new Rect(580,177,613,345),chatScroll,new Rect(0,0,590,height));
  for(int i=0;i<ct.lines.Count;i++){var l=ct.lines[i];Fill(new Rect(l.mine?85:5,i*72,490,61),l.mine?new Color(1,.9f,.56f):Color.white);Text(l.text,l.mine?99:18,i*72+8,466,55);}GUI.EndScrollView();
  if(ct.invite=="초대 도착"){if(Button("지금 갈게",new Rect(590,542,175,39)))Reply(ct,"지금 갈게. 늘 있던 자리에서 보자.","수락");if(Button("조금 뒤에 갈게",new Rect(780,542,186,39)))Reply(ct,"조금 뒤에 찾아갈게.","미루기");if(Button("오늘은 어려워",new Rect(982,542,205,39)))Reply(ct,"오늘은 어려울 것 같아. 다음에 보자.","거절");}
  else{if(Button("오늘은 어땠어?",new Rect(590,542,273,39))){ct.lines.Add(new PhoneLine{mine=true,text="오늘은 어땠어?"});ct.lines.Add(new PhoneLine{text=ct.visits>1?"덕분에 조금 나았어. 지난번 얘기도 기억하고 있어.":"그냥 평소 같았어. 네가 다녀가서 덜 심심했지."});ct.trust++;if(ct.due<0)ct.due=clock+40;Save();}if(Button("나중에 또 찾아갈게",new Rect(880,542,304,39))){ct.lines.Add(new PhoneLine{mine=true,text="나중에 또 찾아갈게."});ct.lines.Add(new PhoneLine{text="응. 난 여기 있을게."});ct.due=clock+30;Save();}}
  Text("만남 위치: "+catalog.maps.First(m=>m.id==ct.mapId).name+" / "+ct.name,589,597,590,28);
 }
 void Reply(Contact c,string message,string choice){c.unread=false;c.lines.Add(new PhoneLine{mine=true,text=message});c.lines.Add(new PhoneLine{text=choice=="거절"?"알겠어. 다음에 편할 때 와.":"좋아. 난 늘 있던 곳에 있어."});c.invite=choice=="수락"?"약속 수락":choice=="미루기"?"나중에 만나기":"";if(choice=="거절")c.due=clock+100;Save();}
 void BeginEncounter(){
  encounter=true;help=false;dialogueStep=0;vx=vy=0;activeContact=save.contacts.FirstOrDefault(c=>c.id==selectedNpc.id);sceneVisits=activeContact==null?0:activeContact.visits;
  if(activeContact==null)activeContact=new Contact{id=selectedNpc.id,mapId=map.id,name=NpcName(selectedNpc.id),due=-1};
  talk=sceneVisits==0?"여기 처음 와? 자주 보던 얼굴은 아닌데.":activeContact.memory=="quiet"?"조용한 시간 좋아한다고 했지. 네 얘기 기억하고 있어.":"다시 왔네. 오늘은 어떻게 지냈어?";choices=new[]{"그냥 걷다가 왔어.","네가 있어서 멈췄지.","조용히 있고 싶었어."};
  Save();
  #if UNITY_WEBGL && !UNITY_EDITOR
  AH_OpenSmoke(Application.streamingAssetsPath+"/Smoke/encounter.html",Payload());
  #endif
 }
 string Payload(){return JsonUtility.ToJson(new EncounterPayload{name=NpcName(selectedNpc.id),location=map.name,text=talk,choices=choices,returning=sceneVisits>0});}
 public void OnSmokeChoice(string value){if(!encounter)return;if(value=="end"){EndEncounter();return;}int choice;if(!int.TryParse(value,out choice)||choice<0||choice>2)return;
  if(dialogueStep==0){if(choice==2)activeContact.memory="quiet";activeContact.trust+=choice==1?2:1;talk=choice==2?"그럼 잠깐 말없이 있어도 괜찮아. 같은 자리에 있어도 기분은 매일 다르니까.":choice==1?"그렇게 바로 말하니까 조금 놀랐네. 그래도… 나쁘진 않아.":"가끔은 목적 없이 걷는 것도 좋지. 여기서 잠깐 쉬어.";choices=new[]{"너는 오늘 어땠어?","이 시간 분위기가 좋네.","조용히 함께 있기"};}
  else if(dialogueStep==1){talk=sceneVisits>0?"이렇게 다시 찾아오는 거, 생각보다 반갑네. 다음에도 연락해도 되지?":"별일은 없었어. 그런데 누가 이렇게 찾아오면 하루가 좀 달라져.";choices=new[]{"응, 연락해.","내가 먼저 연락할게.","고마워. 편하다."};activeContact.trust++;}
  else {talk=activeContact.visits>=2?"너랑 있으면 시간이 빨리 가네. 우리… 서로 조금 특별한 사이인 것 같아.":"그럼 나중에 연락할게. 난 늘 여기 있어. 조금 더 있다 가도 좋아.";choices=Array.Empty<string>();}
  dialogueStep++;
  #if UNITY_WEBGL && !UNITY_EDITOR
  AH_UpdateSmoke(Payload());
  #endif
 }
 void EndEncounter(){if(!encounter)return;
  #if UNITY_WEBGL && !UNITY_EDITOR
  AH_CloseSmoke();
  #endif
  activeContact.visits++;activeContact.invite="";activeContact.due=clock+35;activeContact.unread=true;activeContact.lines.Add(new PhoneLine{text=activeContact.visits==1?"아까 반가웠어. 다음에도 여기로 와.":"오늘도 와 줘서 고마워. 조심히 가."});if(!save.contacts.Contains(activeContact))save.contacts.Add(activeContact);
  encounter=false;selectedNpc=null;activeContact=null;Save();Toast("연락처에 새 메시지가 있습니다.  [P]");
 }
 void DrawEncounter(){
  Fill(new Rect(0,0,VW,VH),new Color(.04f,.07f,.1f,.25f));var f=npcInfos.ContainsKey(selectedNpc.id)?Frame(npcInfos[selectedNpc.id].frames):null;
  // Original NPC pixels retained. Same map remains behind this close view.
  DrawFrame(f,640,585,Mathf.Min(4,350f/Mathf.Max(1,f==null?100:f.h)),selectedNpc.flip);
  #if !UNITY_WEBGL || UNITY_EDITOR
  Panel(new Rect(90,570,1100,128),NpcName(selectedNpc.id));Text(talk,110,611,1050,49);for(int i=0;i<choices.Length;i++)if(Button(choices[i],new Rect(815,300+i*53,355,43)))OnSmokeChoice(i.ToString());if(Button("만남 마치기",new Rect(1030,22,205,37)))EndEncounter();Text("흡연 정밀 렌더러는 Web 빌드에서 실행됩니다.",33,76,900,40,false,Color.white);
  #endif
 }
 public void OnBrowserFocus(string value){if(value=="hidden"||value=="save")Save();if(value=="hidden")Time.timeScale=0;if(value=="visible")Time.timeScale=1;}
 void Toast(string message){notice=message;noticeUntil=Time.unscaledTime+4;}
 void Save(){if(map!=null){save.mapId=map.id;save.x=px;save.y=py;save.positioned=true;}save.clock=clock;PlayerPrefs.SetString(SaveKey,JsonUtility.ToJson(save));PlayerPrefs.Save();}
 void OnApplicationPause(bool p){if(p)Save();}void OnApplicationQuit(){Save();}
 // Read-only state hook used by the Web build smoke check.
 public void ReportState(string unused){var state=new RuntimeState{mapId=map==null?0:map.id,x=px,y=py,loading=loading,grounded=grounded,encounter=encounter,phone=phone,npc=selectedNpc==null?0:selectedNpc.id,contacts=save.contacts.Count,clock=clock,mesos=save.mesos};Debug.Log("AH_STATE "+JsonUtility.ToJson(state));}
}
