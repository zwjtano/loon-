# Loon Modules

This repository keeps local Loon plugin customizations.

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
