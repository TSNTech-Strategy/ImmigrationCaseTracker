# CasePingo — Official Working Brand Asset Kit (v1)

**Owner:** TSN TECH & STRATEGY NETWORK LLC  
**Product:** CasePingo (consumer), CasePingo Pro (law firms)  
**Tagline:** Never Miss a Case Update  
**Status:** Design working assets. Subject to trademark/domain clearance and brand sign-off.

## Included assets

| File | Use |
| --- | --- |
| `ios/AppIcon-1024.png` | iOS App Store / Expo iOS app icon; 1024×1024, opaque |
| `android/play-store-512.png` | Google Play Store icon, 512×512 |
| `android/adaptive-icon-foreground-432.png` | Android adaptive icon foreground, transparent |
| `android/adaptive-icon-background-432.png` | Android adaptive icon background |
| `android/notification-icon-96.png` | Preliminary monochrome status-bar icon; review in Android simulator |
| `web/favicon-16.png`, `favicon-32.png`, `favicon-48.png`, `favicon-64.png` | Web favicon sizes |
| `web/icon-192.png`, `icon-512.png` | PWA icons |
| `web/apple-touch-icon-180.png` | Apple web home screen icon |
| `web/open-graph-1200x630.png` | Social sharing preview |
| `branding/casepingo-horizontal-logo.png` | Horizontal brand logo on light backgrounds |
| `branding/casepingo-horizontal-logo-dark.png` | Horizontal brand logo for dark backgrounds |
| `branding/casepingo-horizontal-logo.svg` | Editable scalable wordmark |
| `branding/casepingo-app-icon.svg` | Scalable full-background app mark |
| `branding/casepingo-symbol.svg` | Transparent scalable symbol |

## Colors

- Navy: `#0A2345`
- Blue: `#1758A8`
- Red accent: `#E43B53`
- White: `#FFFFFF`

## Expo setup

Copy `ios/AppIcon-1024.png` to `apps/mobile/assets/icon.png` and `android/adaptive-icon-foreground-432.png` and `android/adaptive-icon-background-432.png` to the same assets folder. In `app.config.ts` or `app.json`, configure:

```json
{
  "expo": {
    "name": "CasePingo",
    "slug": "casepingo",
    "icon": "./assets/icon.png",
    "ios": { "icon": "./assets/icon.png" },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon-foreground.png",
        "backgroundImage": "./assets/adaptive-icon-background.png"
      }
    }
  }
}
```

## Web setup (Next.js App Router)

Put `favicon-32.png` (renamed to `favicon.ico` only after converting to ICO, NOT by simply renaming), `icon-192.png`, and `apple-touch-icon-180.png` in your Next.js static assets under `public/` or use route-based metadata. For `app/icon.png`, copy `icon-512.png`; for `app/apple-icon.png`, copy `apple-touch-icon-180.png`.

## Privacy and brand notes

- CasePingo is an independent commercial tracking platform, **not USCIS or a U.S. government agency**.
- Avoid placing the official USCIS seal or making government-affiliation claims in the icon or store metadata.
- Keep API client secrets server-side.
- Trademark, domain, and App Store listing availability still require verification.
- Review final icons at real device sizes (16px favicons, home screens) before submission.
