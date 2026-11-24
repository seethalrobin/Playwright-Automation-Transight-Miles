# Runs a JMeter test plan headless and builds the HTML report.
# Usage:  .\jmeter\run.ps1                       (miles-login.jmx, defaults from the plan)
#         .\jmeter\run.ps1 -Plan miles-login.jmx -Users 5 -Loops 2
param(
  [string]$Plan = "miles-login.jmx",
  [int]$Users = 0,     # 0 = use the value saved in the plan
  [int]$Loops = 0
)
$ErrorActionPreference = "Stop"

$JMeterHome = if ($env:JMETER_HOME) { $env:JMETER_HOME } else { "C:\Users\user\Downloads\apache-jmeter-5.6.3\apache-jmeter-5.6.3" }
$here    = $PSScriptRoot
$stamp   = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir  = Join-Path $here "results\$stamp"
New-Item -ItemType Directory -Force $outDir | Out-Null

$jmArgs = @("-n", "-t", (Join-Path $here $Plan), "-l", "$outDir\results.jtl", "-j", "$outDir\jmeter.log", "-e", "-o", "$outDir\report")
if ($Users -gt 0) { $jmArgs += "-Jusers=$Users" }
if ($Loops -gt 0) { $jmArgs += "-Jloops=$Loops" }

& "$JMeterHome\bin\jmeter.bat" @jmArgs
Write-Host "`nReport: $outDir\report\index.html"

