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
  (ConvertFrom-Base64Utf8 "Y3VzdG9taXplRHluYW1pY1BhZ2U9c3dpdGNoLCB0cnVlLCBmYWxzZSwgdGFnPeeyvueugOOAjOWKqOaAgemhteOAjSwgZGVzYz0tIHRydWU6IOW8gOWQr1xuLSBmYWxzZTog5YWz6Zet"),
  (ConvertFrom-Base64Utf8 "Y3VzdG9taXplSG9tZVRhYnM9c3dpdGNoLCB0cnVlLCBmYWxzZSwgdGFnPeiHquWumuS5ieOAjOmmlumhtemhtumDqOagh+etvuOAjSwgZGVzYz0tIHRydWU6IOaMieS4i+aWueWIl+ihqOS/neeVmemikemBk1xuLSBmYWxzZTog5LiN5aSE55CG6aG26YOo6aKR6YGT"),
  (ConvertFrom-Base64Utf8 "aG9tZVRvcFRhYnM9aW5wdXQsICLmjqjojZAs54Ot6ZeoLOW9seinhizliqjnlLss6Laz55CD5a2jIiwgdGFnPemmlumhtemhtumDqOagh+etviwgZGVzYz3nlKjpgJflj7fliIbpmpTpopHpgZPlkI3vvIzkvovlpoLvvJrmjqjojZAs54Ot6ZeoLOW9seinhizliqjnlLss6Laz55CD5a2jLOeVquWJpw=="),
  (ConvertFrom-Base64Utf8 "aGlkZUhvbWVUb3BHYW1lQ2VudGVyPXN3aXRjaCwgdHJ1ZSwgZmFsc2UsIHRhZz3pmpDol4/pppbpobXjgIzmuLjmiI/kuK3lv4PjgI0sIGRlc2M9LSB0cnVlOiDlvIDlkK9cbi0gZmFsc2U6IOWFs+mXrQ=="),
  (ConvertFrom-Base64Utf8 "aGlkZUhvbWVCb3R0b21QdWJsaXNoPXN3aXRjaCwgdHJ1ZSwgZmFsc2UsIHRhZz3pmpDol4/lupXmoI/jgIzlj5HluIPjgI0sIGRlc2M9LSB0cnVlOiDlvIDlkK9cbi0gZmFsc2U6IOWFs+mXrQ=="),
  (ConvertFrom-Base64Utf8 "aGlkZUhvbWVCb3R0b21NYWxsPXN3aXRjaCwgdHJ1ZSwgZmFsc2UsIHRhZz3pmpDol4/lupXmoI/jgIzkvJrlkZjotK3jgI0sIGRlc2M9LSB0cnVlOiDlvIDlkK9cbi0gZmFsc2U6IOWFs+mXrQ=="),
  (ConvertFrom-Base64Utf8 "Y3VzdG9taXplUGdjUGFnZT1zd2l0Y2gsIHRydWUsIGZhbHNlLCB0YWc957K+566A44CM6KeC5b2x6aG144CNLCBkZXNjPS0gdHJ1ZTog5byA5ZCvXG4tIGZhbHNlOiDlhbPpl60="),
  (ConvertFrom-Base64Utf8 "Y3VzdG9taXplTWluZVBhZ2U9c3dpdGNoLCB0cnVlLCBmYWxzZSwgdGFnPeeyvueugOOAjOaIkeeahOmhtemdouOAjSwgZGVzYz0tIHRydWU6IOW8gOWQr1xuLSBmYWxzZTog5YWz6Zet"),
  (ConvertFrom-Base64Utf8 "Y3VzdG9taXplSG9tZUZlZWQ9c3dpdGNoLCB0cnVlLCBmYWxzZSwgdGFnPei/h+a7pOOAjOmmlumhteaOqOiNkOa1geOAjSwgZGVzYz0tIHRydWU6IOW8gOWQr1xuLSBmYWxzZTog5YWz6Zet"),
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

$repoRawBase = "https://raw.githubusercontent.com/zwjtano/loon-/master"
$searchSquareTag = ConvertFrom-Base64Utf8 "6L+H5ruk5pCc57Si5o6o6I2Q"
$defaultSearchWordTag = ConvertFrom-Base64Utf8 "5bGP6JS96buY6K6k5pCc57Si5qGG5YWz6ZSu6K+N"
$searchSquareScript = "http-response ^https:\/\/app\.bilibili\.com\/x\/v2\/search\/square\? script-path=$repoRawBase/Scripts/bilibili/search-square.js, requires-body=false, tag=$searchSquareTag, enable={filterSearchSuggest}"
$defaultSearchWordScript = "http-request ^https:\/\/(?:app\.bilibili\.com|grpc\.biliapi\.net)\/bilibili\.app\.interface\.v1\.Search\/DefaultWords$ script-path=$repoRawBase/Scripts/bilibili/default-search-word.js, requires-body=false, binary-body-mode=true, tag=$defaultSearchWordTag, enable={filterDefaultSearchWord}"
$homeTabsTag = ConvertFrom-Base64Utf8 "6Ieq5a6a5LmJ6aaW6aG16aG26YOo5qCH562+"
$homeTabsScript = "http-response ^https:\/\/app\.bilibili\.com\/x\/resource\/show\/tab\/v2\? script-path=$repoRawBase/Scripts/bilibili/home-tabs.js, requires-body=true, tag=$homeTabsTag, argument=[{homeTopTabs},{customizeHomeTabs},{hideHomeTopGameCenter},{hideHomeBottomPublish},{hideHomeBottomMall}]"

$lines = $content -split "`n"
$newLines = New-Object System.Collections.Generic.List[string]
$insertedSearchScripts = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  if ($line -like '*app\.bilibili\.com\/x\/v2\/search\/square*') {
    continue
  }

  if ($line -like '*app\.bilibili\.com\/x\/resource\/show\/tab\/v2*') {
    $newLines.Add($homeTabsScript)
    continue
  }

  if ($line -like '*bilibili\.app\.interface\.v1\.Search\/DefaultWords*mock-response-body*') {
    continue
  }

  if ($line -like '*bilibili\.app\.dynamic\.v2\.Dynamic\/DynAll*') {
    $newLines.Add((Add-EnableFlag -Line $line -Flag "customizeDynamicPage"))
    continue
  }

  if ($line -like 'http-response *api\.bilibili\.com\/pgc\/page\/*') {
    $newLines.Add((Add-EnableFlag -Line $line -Flag "customizePgcPage"))
    continue
  }

  if ($line -like '*app\.bilibili\.com\/x\/v2\/account\/mine*') {
    $newLines.Add((Add-EnableFlag -Line $line -Flag "customizeMinePage"))
    continue
  }

  if ($line -like '*app\.bilibili\.com\/x\/v2\/feed\/index*') {
    $newLines.Add((Add-EnableFlag -Line $line -Flag "customizeHomeFeed"))
    continue
  }

  if ($line -like '*bilibili\.app\.show\.v1\.Popular\/Index*') {
    $line = Add-EnableFlag -Line $line -Flag "filterHotSearch"
    $newLines.Add($line)

    if (-not $insertedSearchScripts) {
      $newLines.Add($searchSquareScript)
      $newLines.Add($defaultSearchWordScript)
      $insertedSearchScripts = $true
    }
    continue
  }

  $newLines.Add($line)
}

$content = ($newLines -join "`n").TrimEnd() + "`n"
[System.IO.File]::WriteAllText($targetFullPath, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "Updated $TargetPath from $SourceUrl and reapplied local Loon switches."
