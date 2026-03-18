# Gewinnhai Mobile App + App-API

Diese Codebasis trennt die **Mobile App** jetzt sauber von der **Website**. Die App konsumiert ausschließlich eine dedizierte **App-API** unter `/app-api/*`. Diese API liest serverseitig direkt aus der bestehenden GewinnHai-Datenbank und setzt die App-Modelle dort zusammen.

## Neue Zielarchitektur

### Grundprinzip
- **Quelle der Wahrheit bleibt die bestehende Datenbank.**
- **Die Mobile App enthält keine DB-Zugangsdaten.**
- **Die Mobile App spricht nur die dedizierte App-API an.**
- **Die Website ist nicht mehr Transportweg für App-Daten.**
- **Keine WordPress-REST- oder HTML-Fallbacks mehr in der App.**

### Datenfluss
1. Die App ruft ausschließlich `/app-api/*` auf.
2. Der App-API-Server verbindet sich serverseitig mit der bestehenden GewinnHai-Datenbank.
3. Der Server liest Rohdaten aus den Tabellen, kombiniert Beiträge, Kategorien und Metadaten.
4. Der Server liefert bereits app-gerechtes JSON zurück.
5. Die App rendert diese Daten und cached nur Responses, nicht die Datenlogik.

---

## App-Endpunkte

Die App erwartet jetzt genau diese Endpunkte:

- `GET /app-api/giveaways`
- `GET /app-api/giveaways/:id-or-slug`
- `GET /app-api/categories`
- `GET /app-api/top10`
- `GET /app-api/search?q=...`

### Query-Parameter
- `GET /app-api/giveaways?categoryId=123`
- `GET /app-api/giveaways?categorySlug=technik`
- `GET /app-api/search?q=iphone`

---

## Mobile App

### Wichtige Änderungen
- Die App-Konfiguration zeigt auf die dedizierte API-Basis-URL, z. B. `https://api.gewinnhai.de`.
- Die bisherige Mehrfachstrategie mit `/wp-json/...`, RSS-Feeds und HTML-nahen Fallbacks wurde entfernt.
- Suchanfragen laufen explizit über `/app-api/search`.
- Fehler werden nun als **App-API-/Serverprobleme** klassifiziert, nicht als Website-/WordPress-Probleme.

### Relevante App-Dateien
- `src/api/client.ts`
- `src/api/giveaways.ts`
- `src/data/giveawaysRepository.ts`
- `src/hooks/useGiveaways.ts`
- `src/utils/query.ts`
- `src/config/env.ts`

---

## Serverseitige App-API

Die neue Server-Implementierung liegt unter:

- `server/app-api/server.js`
- `server/app-api/service.js`
- `server/app-api/db.js`

### Technische Eigenschaften
- Express-basierte JSON-API
- MySQL-Zugriff über `mysql2`
- DB-Zugangsdaten ausschließlich serverseitig per Environment Variables
- Zugriff direkt auf die bestehende Datenbank
- Kategorien, Suche, Detail und Top10 werden serverseitig zusammengesetzt
- Wenn kein eigenes Top10-Feld existiert, wird Top10 serverseitig aus vorhandenen Datensätzen abgeleitet

### Erwartete Server-Environment-Variablen
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`
- `WP_DB_PREFIX` (optional, Default `wp_`)
- `APP_API_PORT` (optional, Default `3001`)
- `APP_API_PUBLIC_ORIGIN` (optional, z. B. `https://www.gewinnhai.de`)
- `APP_API_CORS_ORIGIN` (optional)
- `APP_API_POST_TYPES` (optional, comma-separated)
- `APP_API_CATEGORY_TAXONOMY` (optional, Default `category`)
- `APP_API_TOP10_TAG_SLUG` (optional, Default `top10`)

### Starten der App-API
```bash
npm install
npm run server:app-api
```

---

## Deployment-Checkliste

### Serverseitig noch zu deployen
1. Node-App aus `server/app-api/*` auf dem Server bereitstellen.
2. Environment-Variablen für DB-Zugriff auf dem Server setzen.
3. Reverse-Proxy so konfigurieren, dass `/app-api/*` an den Node-Service weitergeleitet wird.
4. Optional eigene API-Subdomain nutzen, z. B. `api.gewinnhai.de`.
5. CORS für Mobile/Web sauber setzen.
6. Healthcheck `/health` an Monitoring anbinden.

### App-seitig noch zu deployen
1. `EXPO_PUBLIC_API_BASE_URL` auf die produktive API-URL zeigen lassen.
2. Neue App-Version mit der bereinigten API-Schicht bauen.
3. Tests gegen echte Staging-/Produktionsdatenbank durchführen.

---

## Architekturvorteil

Mit dieser Struktur bauen Website und App auf **derselben Datenbasis** auf, ohne doppelte Datenpflege. Die App bekommt ausschließlich serverseitig aufbereitete JSON-Daten aus der Datenbank und ist vollständig von WordPress-REST-, Website-HTML- oder sonstigen Web-Fallbacks entkoppelt.
