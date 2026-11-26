# Web2APK — Turn any website into an Android app

Paste a website link, choose the features you want and press **Build APK**. The server generates a native
Kotlin Android project, compiles it with Gradle, and gives you a signed APK to download.

## Getting started

Double-click **`start.bat`**, or run:

```
node server.js
```

Then open http://localhost:3000. Phones on the same Wi-Fi can use the "On your network" address shown in the console.

Requirements: Node.js 18+, a JDK (17 or newer), and the Android SDK (the one installed by Android Studio works,
or set `ANDROID_HOME`). The first build downloads Gradle dependencies and takes longer; later builds take about 40 seconds.

## Features

| Feature | What it does |
|---|---|
| Block ads | Blocks requests to ad and tracker networks (built-in list, plus an optional list of 80,000+ domains) and hides common ad containers |
| Block redirects | Stops navigation to other sites that the user didn't tap, including automatic `intent://` and `market://` redirects |
| Block pop-ups | Stops `window.open`, new-tab and pop-under ads. Pop-ups to the same site open inside the app |
| Swipe down to refresh | Pull-to-refresh that respects pages with their own scrolling areas |
| Desktop mode | Desktop user agent and wide viewport. Can also be switched on and off from the floating menu |
| Rotation | Follow phone setting, always rotate, lock to portrait, or lock to landscape. "Rotate screen" in the menu |
| Responsive auto-fit | Pages are scaled to fit the screen width |
| Floating menu | Draggable button with Home, Refresh, Desktop mode, Rotate, Share, Open in browser, Clear cache and Exit |
| More | Fullscreen, pinch to zoom, loading bar, downloads, file uploads, dark mode, keep screen on, block screenshots, press back twice to exit, page cache |
| Advanced | Allowed domains, custom user agent, custom CSS and JavaScript injection |

Fullscreen video, a "No connection" screen with a Retry button, and back-button history navigation are also included.

## Install with a QR code

After a build finishes, the result card shows a QR code. Scan it with the phone's camera (the phone must be on the
same Wi-Fi as the computer). It opens an install page with a Download button and step-by-step install help.
If Windows Firewall asks, allow Node.js on private networks. Finished builds survive a server restart, so old QR codes keep working.

## Project layout

- `server.js` — the build server (no npm packages needed)
- `start.bat` — one-click launcher for Windows
- `public/` — the website
  - `main.js` — puts the page together
  - `components/` — one folder per component (each with its own `.js` and `.css`): app-header, page-intro, card, url-card, details-card, icon-editor, color-picker, toggle-switch, feature-card, behavior-card, advanced-card, build-panel, build-progress, error-box, result-card, qr-code, phone-preview, toast
  - `services/` — server calls (`api.js`), build payload, build progress stages
  - `core/` — shared state store and initial state
  - `config/` — feature list and color palette
  - `utils/` — helpers (URL, validation, icon drawing, colors, clipboard, icons)
  - `styles/` — design tokens and shared form controls
  - `install/` — the phone install page opened by the QR code
  - `vendor/qrcode.js` — QR code generator (MIT)
- `template/` — the Kotlin Android app source (`MainActivity.kt`, `AdBlocker.kt`, `AppConfig.kt`)
- `builds/` — finished APKs
- `keystore/` — the signing key, created on the first build. **Back it up.** An update installs over an existing app only if it is signed with the same key.

Built apps need Android 8.0 (API 26) or newer.
