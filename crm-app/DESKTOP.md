# Desktop Distribution

PureCRM uses Tauri 2, which packages the existing Vite/React app with the
operating system's native webview instead of bundling a full browser.

## Downloadable builds

The GitHub workflow at `.github/workflows/desktop-release.yml` builds:

- Windows NSIS installer (`.exe`)
- Universal macOS application and disk image (`.app` / `.dmg`)

Push a tag matching `purecrm-v*` to create a GitHub Release:

```bash
git tag v1.2.0
git push origin v1.2.0
```

## Local build

Install the official Tauri prerequisites for the current operating system,
including Rust, then run:

```bash
npm install
npm run desktop:build
```

## Signing

Unsigned installers are suitable for development and portfolio demos, but
Windows SmartScreen and macOS Gatekeeper may warn users.

Warning-free public distribution requires:

- a Windows code-signing certificate, and
- an Apple Developer ID certificate plus notarization credentials.

Add signing only through encrypted GitHub repository secrets. Never commit
certificates or passwords.

The desktop identifier intentionally remains `com.cleancrm.desktop` so existing
local PureCRM data survives the product rename.
