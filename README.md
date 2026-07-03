# Loon Plugins

This repository keeps local Loon plugin customizations.

## Plugins

### FotMob ad block

```text
https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/FotMob_remove_ads.lpx
```

Built from Loon HAR captures. It clears FotMob house ads and blocks captured ad SDK, image, and bidding endpoints.

### MyBlockAds with Bilibili search preserved

```text
https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/myblockads-bilibili-search-preserved.lpx
```

Synced from RuCu6's MyBlockAds plugin and patched to preserve Bilibili hot search, search discovery, and default search words when those rules appear upstream.

### Bilibili custom plugin

```text
https://raw.githubusercontent.com/zwjtano/loon-/master/Plugins/bilibili.lpx
```

## Update upstream Bilibili plugin

Run this from the repository root:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File tools\update-bilibili.ps1
```

The script downloads the latest upstream `bilibili.lpx` from:

```text
https://rucu6.pages.dev/Plugins/bilibili.lpx
```

Then it reapplies the local switches for:

- hot search / popular topic filtering
- search suggestion filtering
- default search box keyword filtering
