using UnityEngine;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEditor.Build.Reporting;
using UnityEditor.Build;
using System.IO;
public static class WebBuild {
 public static void Build(){
  Directory.CreateDirectory("Assets/Scenes");var scene=EditorSceneManager.NewScene(NewSceneSetup.EmptyScene,NewSceneMode.Single);
  var camera=new GameObject("Camera").AddComponent<Camera>();camera.clearFlags=CameraClearFlags.SolidColor;camera.backgroundColor=Color.black;camera.orthographic=true;
  EditorSceneManager.SaveScene(scene,"Assets/Scenes/AfterHours.unity");
  PlayerSettings.companyName="AfterHoursLocal";PlayerSettings.productName="After Hours Maple";PlayerSettings.bundleVersion="0.1.0";
  PlayerSettings.defaultScreenWidth=1280;PlayerSettings.defaultScreenHeight=720;PlayerSettings.runInBackground=true;
  PlayerSettings.WebGL.template="PROJECT:AfterHours";PlayerSettings.WebGL.compressionFormat=WebGLCompressionFormat.Disabled;PlayerSettings.WebGL.dataCaching=true;
  PlayerSettings.SetScriptingBackend(NamedBuildTarget.WebGL,ScriptingImplementation.IL2CPP);
  PlayerSettings.SetManagedStrippingLevel(NamedBuildTarget.WebGL,ManagedStrippingLevel.Low);
  PlayerSettings.colorSpace=ColorSpace.Gamma;QualitySettings.vSyncCount=0;
  var settings=new SerializedObject(AssetDatabase.LoadAllAssetsAtPath("ProjectSettings/ProjectSettings.asset")[0]);var input=settings.FindProperty("activeInputHandler");if(input!=null){input.intValue=0;settings.ApplyModifiedPropertiesWithoutUndo();}
  AssetDatabase.SaveAssets();
  var report=BuildPipeline.BuildPlayer(new BuildPlayerOptions{scenes=new[]{"Assets/Scenes/AfterHours.unity"},locationPathName="Builds/Web",target=BuildTarget.WebGL,options=BuildOptions.None});
  Debug.Log("AFTER_HOURS_BUILD "+report.summary.result+" "+report.summary.totalSize);
  if(report.summary.result!=BuildResult.Succeeded)throw new System.Exception("Web build failed: "+report.summary.totalErrors);
 }
}
