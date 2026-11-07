param(
  [string]$SourceUrl = "https://rucu6.pages.dev/Plugins/bilibili.lpx",
  [string]$TargetPath = "Plugins/bilibili.lpx",
  [string]$ResponseSourceUrl = "https://rucu6.pages.dev/Scripts/bilibili/response.js",
  [string]$PopularScriptPath = "Scripts/bilibili/popular.js",
  [string]$RequestSourceUrl = "https://rucu6.pages.dev/Scripts/bilibili/request.js",
  [string]$RequestTestPath = $env:BILIBILI_REQUEST_SCRIPT_PATH
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

  $lineWithoutEnable = $Line -replace ',?\s*enable=\$?\{[^}]+\}', ''
  if ($Line -match '^\s*(request|response)\s+if\s') {
    return "$lineWithoutEnable$Separator" + 'enable=${' + $Flag + '}'
  }
  return "$lineWithoutEnable$Separator" + "enable={$Flag}"
}

function Get-SourceContent {
  param([string]$Url)

  $headers = @{
    "User-Agent" = "Loon/3.5.1 zwjtano-loon-sync"
    "Accept" = "application/vnd.github+json,text/plain,*/*"
  }
  $webClient = [System.Net.WebClient]::new()
  $webClient.Encoding = [System.Text.Encoding]::UTF8
  foreach ($key in $headers.Keys) {
    $webClient.Headers.Set($key, $headers[$key])
  }
  $text = $webClient.DownloadString($Url) -replace "`r`n", "`n"

  if ($Url -like "https://api.github.com/repos/*/contents/*") {
    $json = $text | ConvertFrom-Json
    if (-not $json.content) {
      throw "GitHub API response does not contain file content: $Url"
    }
    return [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String(($json.content -replace "\s", ""))) -replace "`r`n", "`n"
  }

  return $text
}

function Assert-LoonPlugin {
  param([string]$Content)

  if (-not $Content.TrimStart().StartsWith("#!name=") -or -not $Content.Contains("[Script]")) {
    $preview = $Content.Substring(0, [Math]::Min(160, $Content.Length)).Replace("`n", "\n")
    throw "Downloaded content is not a Loon plugin. Refusing to publish invalid content. Preview: $preview"
  }
}

function ConvertTo-PopularScript {
  param([string]$Source)

  $original = '["rcmdOneItem","smallCoverV5Ad","topicList"]'
  if ([regex]::Matches($Source, [regex]::Escape($original)).Count -ne 1 -or
      -not $Source.Contains('v1.Popular/Index')) {
    throw "Upstream popular filter changed. Refusing to publish an unchecked customization."
  }

  # Keep upstream ad/recommendation cleanup; only topicList follows the user's switch.
  $replacement = '["rcmdOneItem","smallCoverV5Ad",...(__loonPopularFilterHotSearch()?[''topicList'']:[])]'
  $helper = @'
// Generated from upstream response.js by tools/update-bilibili.ps1.
// Only the popular topicList decision is customized. Other handlers stay upstream.
function __loonPopularFilterHotSearch() {
  let args = typeof $argument === "undefined" ? null : $argument;
  if (typeof args === "string") {
    try { args = JSON.parse(args); } catch (_) { args = null; }
  }
  const value = args && args.filterHotSearch;
  return value !== false && value !== "false";
}
// Upstream response begins below.
'@
  return $helper + "`n" + $Source.Replace($original, $replacement)
}

function Assert-PatchedPlugin {
  param([string]$Content)

  $requiredMarkers = @(
    "Scripts/bilibili/home-tabs.js",
    "Scripts/bilibili/mine.js",
    "Scripts/bilibili/search-square.js",
    "Scripts/bilibili/default-search-word.js",
    "Scripts/bilibili/feed-index.js",
    "Scripts/bilibili/popular.js"
  )

  foreach ($marker in $requiredMarkers) {
    if (-not $Content.Contains($marker)) {
      throw "Generated plugin is missing required local customization: $marker"
    }
  }
}

function Assert-SponsorRequestScript {
  param([string]$Source)

  foreach ($route in @('view.v1.View/ViewProgress', 'viewunite.v1.View/ViewProgress', 'v1.DM/DmSegMobile')) {
    if (-not $Source.Contains($route) -or $Source.TrimStart().StartsWith('<')) {
      throw "Upstream sponsor request handler changed. Refusing to publish an unchecked route: $route"
    }
  }
}

$targetFullPath = Join-Path (Get-Location) $TargetPath
$targetDir = Split-Path -Parent $targetFullPath
if (-not (Test-Path $targetDir)) {
  New-Item -ItemType Directory -Path $targetDir | Out-Null
}

$content = Get-SourceContent -Url $SourceUrl
Assert-LoonPlugin -Content $content
$popularScript = ConvertTo-PopularScript -Source (Get-SourceContent -Url $ResponseSourceUrl)
$requestScript = Get-SourceContent -Url $RequestSourceUrl
Assert-SponsorRequestScript -Source $requestScript
$content = [regex]::Replace($content, '(?m)^#!author=(.*)$', {
  param($Match)

  if ($Match.Value -match 'zwjtano') {
    return $Match.Value
  }

  return $Match.Value + ', zwjtano[https://github.com/zwjtano]'
})

$content = [regex]::Replace($content, '(?m)^#!icon=.*$', '#!icon=https://raw.githubusercontent.com/zwjtano/icons/main/icons/bilibili.png')


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
  (ConvertFrom-Base64Utf8 "ZmlsdGVyVmVydGljYWxWaWRlbz1zd2l0Y2gsIGZhbHNlLCB0cnVlLCB0YWc96L+H5ruk44CM56uW5bGP6KeG6aKR44CNLCBkZXNjPS0gdHJ1ZTog5byA5ZCvXG4tIGZhbHNlOiDlhbPpl60="),
  (ConvertFrom-Base64Utf8 "ZmlsdGVyTGl2ZT1zd2l0Y2gsIHRydWUsIGZhbHNlLCB0YWc96L+H5ruk44CM55u05pKt5o6o6I2Q44CNLCBkZXNjPeS7hei/h+a7pOmmlumhteaOqOiNkOa1geS4reeahOebtOaSreWNoeeJh++8m+WFs+mXreWQjuS/neeVmeebtOaSreaOqOiNkA=="),
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
$sponsorDescription = ConvertFrom-Base64Utf8 "OS4xNy4w5Y+K5Lul5LiK5qCH6K6w5bm/5ZGK56ug6IqC77yM6ZyA5omL5Yqo54K55Ye76Lez6L2s77yb5pen54mI6Ieq5Yqo56m66ZmN6KeG5LiK5ri46YCC6YWN77yb5LuF5a+55pyJ56S+5Yy65qCH5rOo55qE6KeG6aKR55Sf5pWI"
$content = $content -replace '(?m)^(sponsorBlock=.*?desc=).*$', ('${1}' + $sponsorDescription)

$repoRawBase = "https://raw.githubusercontent.com/zwjtano/loon-/master"
$searchSquareTag = ConvertFrom-Base64Utf8 "6L+H5ruk5pCc57Si5o6o6I2Q"
$defaultSearchWordTag = ConvertFrom-Base64Utf8 "5bGP6JS96buY6K6k5pCc57Si5qGG5YWz6ZSu6K+N"
$searchSquareScript = "http-response ^https:\/\/app\.bilibili\.com\/x\/v2\/search\/square\? script-path=$repoRawBase/Scripts/bilibili/search-square.js, requires-body=false, tag=$searchSquareTag, enable={filterSearchSuggest}"
$defaultSearchWordScript = "http-request ^https:\/\/(?:app\.bilibili\.com|grpc\.biliapi\.net)\/bilibili\.app\.interface\.v1\.Search\/DefaultWords$ script-path=$repoRawBase/Scripts/bilibili/default-search-word.js, requires-body=false, binary-body-mode=true, tag=$defaultSearchWordTag, enable={filterDefaultSearchWord}"
$homeTabsTag = ConvertFrom-Base64Utf8 "6Ieq5a6a5LmJ6aaW6aG16aG26YOo5qCH562+"
$homeTabsScript = "http-response ^https:\/\/app\.bilibili\.com\/x\/resource\/show\/tab\/v2\? script-path=$repoRawBase/Scripts/bilibili/home-tabs.js, requires-body=true, tag=$homeTabsTag, argument=[{homeTopTabs},{customizeHomeTabs},{hideHomeTopGameCenter},{hideHomeBottomPublish},{hideHomeBottomMall}]"
$minePageTag = ConvertFrom-Base64Utf8 "57K+566A5oiR55qE6aG16Z2i"
$minePageScript = "http-response ^https:\/\/app\.bilibili\.com\/x\/v2\/account\/mine script-path=$repoRawBase/Scripts/bilibili/mine.js, requires-body=true, tag=$minePageTag, enable={customizeMinePage}"
$feedIndexTag = ConvertFrom-Base64Utf8 "6L+H5ruk6aaW6aG15o6o6I2Q5rWB"
$feedIndexScript = "http-response ^https:\/\/app\.bilibili\.com\/x\/v2\/feed\/index script-path=$repoRawBase/Scripts/bilibili/feed-index.js, requires-body=true, tag=$feedIndexTag, argument=[{customizeHomeFeed},{filterVerticalVideo},{filterLive}]"
$viewProgressScript = 'request if ${url} ~= /^https:\/\/(?:app\.bilibili\.com|grpc\.biliapi\.net)\/bilibili\.app\.view(?:unite)?\.v1\.View\/ViewProgress$/i then script("https://rucu6.pages.dev/Scripts/bilibili/request.js", {${logLevel}}) with enable=${sponsorBlock}, tag="SponsorBlock ViewProgress", timeout=10, requires_body=true, binary_body_mode=true'

$lines = $content -split "`n"
$hasViewProgressRequest = @($lines | Where-Object { $_ -match '^request if ' -and $_.Contains('ViewProgress') -and $_.Contains('Scripts/bilibili/request.js') }).Count -gt 0
$newLines = New-Object System.Collections.Generic.List[string]
$insertedSearchScripts = $false

for ($i = 0; $i -lt $lines.Count; $i++) {
  $line = $lines[$i]
  if ($line -eq '[Script]' -and -not $hasViewProgressRequest) {
    $newLines.Add($line)
    $newLines.Add($viewProgressScript)
    continue
  }
  if ($line -like '*app\.bilibili\.com\/x\/v2\/search\/square*') {
    continue
  }

  if ($line -like '*app\.bilibili\.com\/x\/resource\/show\/tab\/v2*') {
    $newLines.Add($homeTabsScript)
    continue
  }

  if ($line -like '*bilibili\.app\.interface\.v1\.Search\/DefaultWords*' -and
      ($line -like '*mock-response-body*' -or $line -like '*response.body.mock*')) {
    continue
  }

  if ($line -like '*bilibili\.app\.dynamic\.v2\.Dynamic\/DynAll*') {
    $newLines.Add((Add-EnableFlag -Line $line -Flag "customizeDynamicPage"))
    continue
  }

  if ($line -like '*api\.bilibili\.com\/pgc\/page\/*' -and $line -like '*Scripts/bilibili/json.js*') {
    $newLines.Add((Add-EnableFlag -Line $line -Flag "customizePgcPage"))
    continue
  }

  if ($line -like '*app\.bilibili\.com\/x\/v2\/account\/mine*') {
    $newLines.Add($minePageScript)
    continue
  }

  if ($line -like '*app\.bilibili\.com\/x\/v2\/feed\/index*') {
    $newLines.Add($feedIndexScript)
    continue
  }

  if ($line -like '*bilibili\.app\.show\.v1\.Popular\/Index*') {
    if ($line -notmatch '^response if ' -or
        -not $line.Contains('https://rucu6.pages.dev/Scripts/bilibili/response.js') -or
        -not $line.Contains('}) with ')) {
      throw "Upstream popular rule changed. Refusing to disable core ad filtering."
    }
    $line = $line.Replace('https://rucu6.pages.dev/Scripts/bilibili/response.js', "$repoRawBase/Scripts/bilibili/popular.js")
    $line = $line.Replace('}) with ', ', ${filterHotSearch}}) with ')
    $line = $line -replace ',?\s*enable=\$?\{[^}]+\}', ''
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
Assert-PatchedPlugin -Content $content
if ($RequestTestPath) {
  $requestTestFullPath = if ([System.IO.Path]::IsPathRooted($RequestTestPath)) { $RequestTestPath } else { Join-Path (Get-Location) $RequestTestPath }
  [System.IO.Directory]::CreateDirectory((Split-Path -Parent $requestTestFullPath)) | Out-Null
  [System.IO.File]::WriteAllText($requestTestFullPath, $requestScript, [System.Text.UTF8Encoding]::new($false))
}
$popularFullPath = Join-Path (Get-Location) $PopularScriptPath
[System.IO.Directory]::CreateDirectory((Split-Path -Parent $popularFullPath)) | Out-Null
[System.IO.File]::WriteAllText($popularFullPath, $popularScript, [System.Text.UTF8Encoding]::new($false))
[System.IO.File]::WriteAllText($targetFullPath, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "Updated $TargetPath from $SourceUrl and reapplied local Loon switches."
