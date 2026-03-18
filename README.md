# Gewinnhai Mobile App

Diese Version der App verwendet **ausschließlich die produktiven PHP-Endpunkte der bestehenden GewinnHai-Website**. Die zuvor begonnene parallele Node-/`/app-api/*`-Architektur wurde entfernt, damit App und Deployment wieder auf einem klaren, funktionierenden Datenweg basieren.

## Endgültige Datenstrategie

- **Produktive Quelle:** `https://www.gewinnhai.de/api/*.php`
- **Keine parallele App-API mehr**
- **Keine WordPress-REST-, HTML- oder Fantasie-Endpunkte**
- **Keine `/app-api/*`-Annahmen mehr**

Die App spricht nur noch diese echten Website-Endpunkte an:

- `GET /api/home.php`
- `GET /api/list.php`
- `GET /api/item.php`
- `GET /api/top10.php`
- `GET /api/top3.php`
- `GET /api/stats.php`
- `GET /api/newest.php`

## Client-Verhalten

### Home
- Lädt über `GET /api/home.php`
- Erwartet kombinierte Daten für:
  - `stats`
  - `top3`
  - `newest`

### Kategorien
- Es gibt serverseitig **keinen dedizierten Kategorien-Endpunkt**
- Kategorien werden deshalb **konsistent aus echten Listen-Daten** aus `GET /api/list.php` abgeleitet
- Es werden keine Phantom-Routen wie `/api/categories` oder `/app-api/categories` benutzt

### Suche
- Es gibt serverseitig **keinen dedizierten Such-Endpunkt**
- Suche läuft daher über mehrere echte Seiten aus `GET /api/list.php`
- Anschließend filtert die App clientseitig auf Basis realer Datensätze
- Es werden **keine falschen** `/app-api/search`- oder `/wp-json/...`-Endpunkte mehr verwendet

### Detailseite
- Lädt ausschließlich über `GET /api/item.php`
- Unterstützte Parameter-Varianten werden aus Slug/ID/URL-Segmenten sauber erzeugt

### Top10
- Lädt ausschließlich über `GET /api/top10.php`

## Konfiguration

Die produktive Basis-URL liegt in `app.json` und kann bei Bedarf zusätzlich per Expo-Umgebungsvariable überschrieben werden:

- `EXPO_PUBLIC_API_BASE_URL`
- `EXPO_PUBLIC_API_TIMEOUT_MS`
- `EXPO_PUBLIC_APP_ENV`

## Deployment

Da nun nur noch die bestehenden PHP-Endpunkte verwendet werden, ist **keine zusätzliche Node-Schicht** erforderlich.

### Für den Server notwendig
1. Sicherstellen, dass die vorhandenen PHP-Endpunkte unter `/api/*.php` erreichbar sind.
2. Sicherstellen, dass sie JSON liefern und von mobilen Clients erreichbar sind.
3. Falls ein Reverse Proxy genutzt wird, darf `/api/` nicht auf eine andere, unvollständige API-Schicht umgeleitet werden.

### Für die App notwendig
1. `app.json` bzw. `EXPO_PUBLIC_API_BASE_URL` auf die produktive Website-Domain zeigen lassen.
2. Neue Expo-/EAS-Builds mit dieser Konfiguration ausrollen.
3. Gegen die echten `/api/*.php`-Antworten auf Gerät testen.

## Entwicklung

```bash
npm run start
npm run typecheck
npm run lint
```

> Hinweis: In eingeschränkten Umgebungen können `npm install`, `npm run typecheck` oder `npm run lint` fehlschlagen, wenn Registry-Zugriff oder lokale Node-Module fehlen.
