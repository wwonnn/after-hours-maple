param([string]$UnityPath)
$ErrorActionPreference = 'Stop'
$projectRoot = $PSScriptRoot
if (-not $UnityPath) {
    $UnityPath = Join-Path (Split-Path $projectRoot) '.tools\Unity6000\Editor\Unity.exe'
}
if (-not (Test-Path -LiteralPath $UnityPath)) {
    throw 'Pass -UnityPath with the path to a Unity 6000.0.74f1 Editor with Web Build Support.'
}
$logPath = Join-Path $projectRoot 'build-web.log'
$arguments = @('-batchmode', '-nographics', '-quit', '-projectPath', "`"$projectRoot`"", '-buildTarget', 'WebGL', '-executeMethod', 'WebBuild.Build', '-logFile', "`"$logPath`"")
$process = Start-Process -FilePath $UnityPath -ArgumentList $arguments -WindowStyle Hidden -PassThru -Wait
if ($process.ExitCode -ne 0) { throw "Unity build failed ($($process.ExitCode)). See $logPath" }
Write-Host "Web build: $(Join-Path $projectRoot 'Builds\Web\index.html')"
