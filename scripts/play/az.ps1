# Drive Azahar: az.ps1 launch | focus | shot <png> | press <btn[+btn]> [...] [-Hold ms] [-Gap ms] | tap <x> <y> | save | load
# Buttons follow qt-config.ini profile 1: a b x y up down left right l r start select, cup/cdown/cleft/cright = circle pad.
param([Parameter(Position=0)][string]$Cmd, [Parameter(Position=1, ValueFromRemainingArguments)][string[]]$Rest, [int]$Hold = 90, [int]$Gap = 120)
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot
$dll = Join-Path $dir 'AzCtl.dll'
if (-not (Test-Path $dll) -or (Get-Item "$dir\AzCtl.cs").LastWriteTime -gt (Get-Item $dll).LastWriteTime) {
  Add-Type -Path "$dir\AzCtl.cs" -ReferencedAssemblies System.Drawing -OutputAssembly $dll -OutputType Library
}
Add-Type -Path $dll

$vk = @{ a=0x41; b=0x53; x=0x5A; y=0x58; up=0x54; down=0x47; left=0x46; right=0x48; l=0x51; r=0x57;
         start=0x4D; select=0x4E; cup=0x26; cdown=0x28; cleft=0x25; cright=0x27; ctrl=0x11; enter=0x0D; esc=0x1B }
$rom = 'C:\Users\tyler\Downloads\Batch CIA 3DS Decryptor\00040000000A0500 Fire Emblem Awakening (CTR-P-AFEE) (v0.0.0) (U).legit-decrypted.cci'

function Chord([string]$s) { [uint16[]]($s -split '\+' | ForEach-Object { if (-not $vk.ContainsKey($_)) { throw "unknown button $_" }; $vk[$_] }) }

switch ($Cmd) {
  'launch' { Start-Process "$env:LOCALAPPDATA\Programs\Azahar\azahar.exe" -ArgumentList "`"$rom`"" ; 'launched' }
  'focus'  { [AzCtl]::Focus() }
  'shot'   { [void][AzCtl]::Focus(); Start-Sleep -Milliseconds 60; [AzCtl]::Shot($Rest[0]) }
  'press'  {
    # A modal Azahar dialog owns the foreground; Focus() would fail, so only require Azahar to be running.
    if ($Rest[0] -ne 'enter' -and -not [AzCtl]::Focus()) { throw 'could not focus Azahar' }
    foreach ($t in $Rest) {
      # "right*5" repeats; "wait500" pauses
      if ($t -match '^wait(\d+)$') { Start-Sleep -Milliseconds $Matches[1]; continue }
      $n = 1; if ($t -match '^(.+)\*(\d+)$') { $t = $Matches[1]; $n = [int]$Matches[2] }
      for ($i = 0; $i -lt $n; $i++) { [AzCtl]::Press((Chord $t), $Hold); Start-Sleep -Milliseconds $Gap }
    }
    'ok'
  }
  'tap'    { if (-not [AzCtl]::Focus()) { throw 'could not focus Azahar' }; [AzCtl]::Tap([int]$Rest[0], [int]$Rest[1], $Hold); 'tapped' }
  'save'   { [void][AzCtl]::Focus(); [AzCtl]::Press([uint16[]](0x11,0x43), 120); 'saved' }
  'load'   { [void][AzCtl]::Focus(); [AzCtl]::Press([uint16[]](0x11,0x56), 120); 'loaded' }
  default  { throw "usage: launch|focus|shot <png>|press <btn>...|save|load" }
}
