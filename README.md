# Gewinnhai Mobile App (Android + iOS)

Diese Umsetzung liefert eine produktionsnahe Cross-Plattform-App (React Native + Expo) mit **einer Codebasis** für Android und iOS.

> Hinweis zur Analyse: Im bereitgestellten Repository waren keine bestehenden Website-Dateien enthalten (nur `.git` + `.gitkeep`). Daher wurde die Anbindung so aufgebaut, dass eure vorhandenen Website-/Backend-APIs direkt verwendet werden können, ohne neue Datenbasis.

## 1) Technische Architektur (empfohlen)

### Ziele
- Keine doppelte Content-Pflege
- Live-Daten aus bestehendem Backend
- Stabile, erweiterbare Struktur
- App-Store-/Play-Store-fähige Grundlage

### Architektur
- **UI:** React Native (Expo), native Navigation (Stack + Tabs)
- **Datenzugriff:** Axios API-Client gegen bestehende Endpunkte
- **State/Sync:** TanStack React Query (Caching, Refetch, Error-Handling)
- **Offline/Performance:** AsyncStorage-Fallback-Cache bei Netzfehlern
- **Konfiguration:** zentrale API-Base-URL in `app.json` (`expo.extra.apiBaseUrl`)

### Datenfluss
1. Screen triggert Query (`useGiveaways`, `useCategories`, `useTop10`)
2. Service ruft bestehende API-Endpunkte auf (`/giveaways`, `/categories`, `/top10`)
3. Antwort wird im Cache gespeichert
4. Bei Verbindungsfehlern: letzter erfolgreicher Cache wird angezeigt

So landen neue Inhalte, Kategorien und Gewinnspiele automatisch in der App, sobald sie im bestehenden Backend verfügbar sind.

---

## 2) Ordnerstruktur

```text
.
├── App.tsx
├── app.json
├── package.json
├── src
│   ├── api
│   │   ├── client.ts
│   │   └── giveaways.ts
│   ├── components
│   │   ├── ErrorState.tsx
│   │   ├── GiveawayCard.tsx
│   │   └── LoadingState.tsx
│   ├── config
│   │   └── env.ts
│   ├── hooks
│   │   ├── useGiveawayDetail.ts
│   │   └── useGiveaways.ts
│   ├── navigation
│   │   ├── screens
│   │   │   ├── CategoriesScreen.tsx
│   │   │   ├── GiveawayDetailScreen.tsx
│   │   │   ├── HomeScreen.tsx
│   │   │   └── Top10Screen.tsx
│   │   └── types.ts
│   ├── types
│   │   ├── api.ts
│   │   └── models.ts
│   └── utils
│       └── cache.ts
└── README.md
```

---

## 3) Funktional umgesetzt

- Startseite mit aktuellen Gewinnspielen
- Kategorien
- Detailseite je Gewinnspiel
- Top10-Bereich
- Suche (Textsuche auf Startseite via Query-Param)
- Pull-to-refresh
- Fehlerzustand bei Offline/Fehlern
- Lokales Caching (Fallback)

---

## 4) Backend-Anbindung (bestehende Datenquelle)

Die App ist auf Wiederverwendung bestehender APIs ausgelegt.

### Erwartete Endpunkte
- `GET /giveaways?query=...&categoryId=...`
- `GET /giveaways/:idOrSlug`
- `GET /categories`
- `GET /top10`

### Konfiguration
In `app.json`:

```json
"extra": {
  "apiBaseUrl": "https://www.gewinnhai.de",
  "apiTimeoutMs": 10000
}
```


### Reale Datenquellen (priorisiert + kompatible Fallbacks)
Die App fragt jetzt **mehrere bestehende Endpunkte in Reihenfolge** ab und nutzt den ersten funktionierenden Treffer:

- Gewinnspiele: `/api/giveaways` → Fallback `/wp-json/wp/v2/posts?_embed=1`
- Gewinnspiel-Detail: `/api/giveaways/{idOrSlug}` → Fallback `/wp-json/wp/v2/posts/{id}` oder `?slug=...`
- Kategorien: `/api/categories` → Fallback `/wp-json/wp/v2/categories`
- Top10: `/api/top10` → Fallback `/wp-json/wp/v2/posts?tags=top10&_embed=1`

Damit bleibt die App mit bestehender PHP/API-Logik kompatibel und kann gleichzeitig mit vorhandenen WordPress-REST-Daten arbeiten, ohne neue Datenbasis.

Wenn eure Website aktuell andere Endpunkte/Response-Formate nutzt, muss nur `src/api/giveaways.ts` angepasst werden. UI und App-Architektur bleiben unverändert.

---

## 5) Build-Anleitung (Android/iOS)

## Voraussetzungen
- Node.js LTS
- npm oder yarn
- Expo CLI (optional) / `npx expo`
- Für Store-Builds: EAS CLI (`npm i -g eas-cli`)

### Lokal starten
```bash
npm install
npm run start
```

### Android (lokal)
```bash
npm run android
```

### iOS (lokal, macOS nötig)
```bash
npm run ios
```

### Store-fähige Builds (empfohlen mit EAS)
```bash
eas build:configure
eas build -p android --profile production
eas build -p ios --profile production
```

---

## 6) Deployment-Hinweise (Play Store / App Store)

### Android (Play Store)
- Paketname final festlegen (`android.package`)
- Signierung via EAS/Keystore
- Privacy-Policy-URL hinterlegen
- Content-Rating + Data Safety korrekt ausfüllen

### iOS (App Store)
- Bundle Identifier final (`ios.bundleIdentifier`)
- App-Icons/Splash in finaler Qualität bereitstellen
- App Privacy / Tracking-Angaben pflegen
- TestFlight-Runde vor Release

---

## 7) Wie neue Website-Inhalte automatisch in der App erscheinen

Da die App keine eigene getrennte Datenbank nutzt und direkt dieselben APIs abfragt:
- Neue Gewinnspiele/Kategorien/Top-Inhalte erscheinen automatisch
- Pull-to-refresh erzwingt sofortiges Nachladen
- Optional kann man zusätzlich Background Refresh/Push einbauen

---

## Optionaler nächster Schritt (für perfekte Kompatibilität)

Sobald die echten Website-Dateien/API-Spezifikation vorliegen:
1. Exakte Endpoint-Mapping-Tabelle erstellen
2. Response-Mapping 1:1 in `src/api/giveaways.ts` finalisieren
3. Auth/Cookie/Token-Flows ergänzen (falls nötig)
4. E2E-Tests gegen Staging-Backend ergänzen

---

## 8) Status nach Härtung für erste echte Testversion

### Was jetzt funktioniert
- Live-Datenanbindung wurde auf robuste Mehrfach-Endpunkte gehärtet (inkl. Retry/Timeout und robusteres Mapping bei Feldabweichungen und HTML-Responses).
- Home, Kategorien, Top10 und Detail arbeiten mit echten API-/WordPress-Live-Daten inklusive robusterer Detailauflösung für Slug/ID-Varianten.
- Loading-, Error-, Empty- und Offline-States sind auf allen Kernscreens konsistent und enthalten jetzt zusätzliche Retry-Möglichkeiten.
- Pull-to-refresh und Fokus-Refetch sind stabilisiert und auf App-Reopen aktiv, inklusive React-Query-OfflineFirst-Verhalten.
- Deep-Link-Pfade für Gewinnspiel-Details sind im Navigation- und Plattform-Setup vorbereitet.
- Android/iOS-Build-Konfiguration ist für interne Testbuilds konkretisiert (VersionCode/BuildNumber, EAS-Profile, ENV-Variablen, Intent-Filter/Associated Domains).

### Geänderte Kernbereiche
- API-Client und Daten-Mapping (`src/api/client.ts`, `src/api/giveaways.ts`, `src/api/mappers.ts`)
- Query- und Fokus-Refetching (`App.tsx`, `src/hooks/*`, `src/utils/query.ts`)
- Zustände in Hauptscreens (`src/navigation/screens/*`)
- Build-/Config-Dateien (`app.json`, `eas.json`, `src/config/env.ts`)

### Für ersten Geräte-Test noch offen
- Echte Testläufe auf physischen Android-/iOS-Geräten (inkl. langsamer Netze/offline/restore).
- Finales QA der Top10-Datenquelle auf Backend-Seite (Tag/Endpoint-Strategie je nach CMS-Datenstand).
- Store-relevante Metadaten finalisieren (Datenschutz-URL, Impressum, finale Assets/Listing-Texte, Signing-Setup).
