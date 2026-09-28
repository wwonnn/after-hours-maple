using System;
using System.Collections.Generic;
[Serializable] public class MapleFrame { public string key; public int w,h; public float ox,oy,delay; }
[Serializable] public class MapleDraw { public float x,y;public int z;public bool flip;public MapleFrame[] frames; }
[Serializable] public class MapleBack { public float x,y,rx,ry,cx,cy;public int type,front,a,f; public MapleFrame[] frames; }
[Serializable] public class MapleFoothold {public float x1,y1,x2,y2;public int id,prev,next,layer;}
[Serializable] public class MapleLadder {public float x,y1,y2;public int l;}
[Serializable] public class MaplePortal {public float x,y;public int type,target;public string name,targetName,script;}
[Serializable] public class MapleNpc {public int id;public float x,y;public bool flip,hidden;}
[Serializable] public class NpcInfo {public int id;public string name,function;public MapleFrame[] frames;}
[Serializable] public class UiAsset {public string path;public MapleFrame frame;}
[Serializable] public class PlayerAction {public string action;public MapleFrame[] frames;}
[Serializable] public class MapEntry {public int id;public string name;}
[Serializable] public class MapleCatalog {public string region,version;public MapEntry[] maps;public NpcInfo[] npcs;public UiAsset[] ui;public PlayerAction[] player;}
[Serializable] public class MapleMap {public int id;public string name,minimap;public float left,top,width,height,miniLeft,miniTop,miniWidth,miniHeight;public MapleDraw[] draws;public MapleBack[] backgrounds;public MapleFoothold[] footholds;public MapleLadder[] ladders;public MapleNpc[] npcs;public MaplePortal[] portals;}
[Serializable] public class PhoneLine {public string text;public bool mine;}
[Serializable] public class Contact {public int id,mapId,visits,trust;public string name,memory="",invite="";public float due;public bool unread;public List<PhoneLine> lines=new List<PhoneLine>();}
[Serializable] public class SaveData {public int schema=1,mapId=103000000,mesos=5000;public float x,y,clock;public bool positioned;public List<Contact> contacts=new List<Contact>();}
[Serializable] public class EncounterPayload {public string name,location,text;public string[] choices;public bool returning;}

[Serializable] public class RuntimeState {public int mapId,npc,contacts,mesos;public float x,y,clock;public bool loading,grounded,encounter,phone;}
