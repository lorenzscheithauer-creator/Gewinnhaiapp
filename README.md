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
  "apiBaseUrl": "https://www.gewinnhai.de/api",
  "apiTimeoutMs": 10000
}
```

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
