param(
  [string]$SourceUrl = "https://rucu6.pages.dev/Plugins/bilibili.lpx",
  [string]$TargetPath = "Plugins/bilibili.lpx"
)

$ErrorActionPreference = "Stop"

function ConvertFrom-Base64Utf8 {
  param([string]$Value)

  return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($Value))
}

function Add-EnableFlag {
  param(
    [string]$Line,
    [string]$Flag,
    [string]$Separator = ", "
  )

  $lineWithoutEnable = $Line -replace ",?\s*enable=\{[^}]+\}", ""
  return "$lineWithoutEnable$Separator" + "enable={$Flag}"
}

$targetFullPath = Join-Path (Get-Location) $TargetPath
$targetDir = Split-Path -Parent $targetFullPath
if (-not (Test-Path $targetDir)) {
  New-Item -ItemType Directory -Path $targetDir | Out-Null
}

$webClient = [System.Net.WebClient]::new()
$sourceBytes = $webClient.DownloadData($SourceUrl)
$content = [System.Text.Encoding]::UTF8.GetString($sourceBytes) -replace "`r`n", "`n"

$arguments = @(
  (ConvertFrom-Base64Utf8 "ZmlsdGVySG90U2VhcmNoPXN3aXRjaCwgdHJ1ZSwgZmFsc2UsIHRhZz3ov4fmu6TjgIzng63mkJwv54Ot6Zeo6K+d6aKY44CNLCBkZXNjPS0gdHJ1ZTog5byA5ZCvXG4tIGZhbHNlOiDlhbPpl60="),
  (ConvertFrom-Base64Utf8 "ZmlsdGVyU2VhcmNoU3VnZ2VzdD1zd2l0Y2gsIHRydWUsIGZhbHNlLCB0YWc96L+H5ruk44CM5pCc57Si5o6o6I2Q44CNLCBkZXNjPS0gdHJ1ZTog5byA5ZCvXG4tIGZhbHNlOiDlhbPpl60="),
  (ConvertFrom-Base64Utf8 "ZmlsdGVyRGVmYXVsdFNlYXJjaFdvcmQ9c3dpdGNoLCB0cnVlLCBmYWxzZSwgdGFnPeWxj+iUveOAjOm7mOiupOaQnOe0ouahhuWFs+mUruivjeOAjSwgZGVzYz0tIHRydWU6IOW8gOWQr1xuLSBmYWxzZTog5YWz6Zet")
)

foreach ($argument in $arguments) {
  $name = ($argument -split "=", 2)[0]
  $content = $content -replace "(?m)^$name=.*\n?", ""
}

$insertAfter = '(?m)^(displayUpList=.*)$'
$argumentBlock = '$1' + "`n" + ($arguments -join "`n")
$content = $content -replace $insertAfter, $argumentBlock

$lines = $content -split "`n"
for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]

  if ($line -like '*app\.bilibili\.com\/x\/v2\/search\/square*') {
    $lines[$i] = Add-EnableFlag -Line $line -Flag "filterSearchSuggest" -Separator " "
    continue
  }

  if ($line -like '*bilibili\.app\.interface\.v1\.Search\/DefaultWords*mock-response-body*') {
    $lines[$i] = Add-EnableFlag -Line $line -Flag "filterDefaultSearchWord" -Separator " "
    continue
  }

  if ($line -like '*bilibili\.app\.show\.v1\.Popular\/Index*') {
    $lines[$i] = Add-EnableFlag -Line $line -Flag "filterHotSearch"
    continue
  }
}

$content = ($lines -join "`n").TrimEnd() + "`n"
[System.IO.File]::WriteAllText($targetFullPath, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "Updated $TargetPath from $SourceUrl and reapplied local Loon switches."
