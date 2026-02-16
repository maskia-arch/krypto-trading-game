# 🎮 Krypto Trading Game v0.1

> Version wird zentral in `version.txt` verwaltet. Alle Komponenten (Bot, Web App, API) lesen die Version von dort.

## Architektur

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Telegram Bot    │────▶│  Node.js Server  │────▶│   Supabase      │
│  (Entry Point)   │     │  (render.com)    │     │   (PostgreSQL)  │
│                  │     │                  │     │                  │
│  - /start        │     │  - Express API   │     │  - profiles      │
│  - /portfolio    │     │  - grammY Bot    │     │  - assets        │
│  - /admin        │     │  - Cron Jobs     │     │  - market_history│
│  - WebApp Button │     │  - Price Fetcher │     │  - transactions  │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    │  React Web App          │
                    │  (Vercel / Netlify)     │
                    │                         │
                    │  - Trading Interface    │
                    │  - Live Charts          │
                    │  - Immobilien & Assets  │
                    │  - Rangliste            │
                    └─────────────────────────┘
```

## Datenfluss: Kurse

```
CoinGecko API ──(1min Cron)──▶ Supabase DB (current_prices + market_history)
                                      │
Web App ◀──(GET /api/prices)──────────┘     ← Alle 15s auto-refresh
Web App ◀──(GET /api/chart/:sym)──────┘     ← Live Chart alle 30s
```

## Versionierung

Die Datei `version.txt` im Projekt-Root ist die **Single Source of Truth**:
- **Bot** liest `version.txt` beim Start und zeigt sie im Admin-Dashboard
- **API** stellt `/api/version` Endpoint bereit
- **Web App** lädt die Version per API und zeigt sie im Header

Zum Version-Bump einfach die Zahl in `version.txt` ändern und deployen.

---

## Schritt 1: Supabase einrichten

1. Neues Projekt auf [supabase.com](https://supabase.com) erstellen
2. **SQL Editor** öffnen → gesamten Inhalt von `sql/schema.sql` einfügen und ausführen
3. Notieren:
   - **Project URL**: `https://xxx.supabase.co`
   - **Anon Key**: Settings → API → `anon/public`
   - **Service Role Key**: Settings → API → `service_role` (GEHEIM!)

---

## Schritt 2: Telegram Bot erstellen

1. [@BotFather](https://t.me/BotFather) öffnen → `/newbot`
2. **Bot Token** notieren
3. `/setcommands`:
   ```
   start - Spiel starten
   portfolio - Dein Portfolio
   rank - Rangliste
   bailout - Rettungsschirm
   rent - Mieteinnahmen
   pro - Pro-Version
   ```
4. Eigene Telegram ID herausfinden → [@userinfobot](https://t.me/userinfobot) → das wird `ADMIN_ID`

---

## Schritt 3: Bot auf Render.com deployen

### Dateien für Render (Bot-Ordner als Repo-Root):
```
krypto-bot/
├── package.json
├── bot.js
└── version.txt    ← Kopie aus Root
```

### Render.com Setup:
1. "New Web Service" → GitHub Repo verbinden
2. Konfiguration:
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. **Environment Variables**:
   ```
   BOT_TOKEN = (dein Token)
   ADMIN_ID = (deine Telegram ID)
   SUPABASE_URL = (Supabase URL)
   SUPABASE_SERVICE_KEY = (Service Key)
   WEBAPP_URL = (wird nach Webapp-Deploy gesetzt)
   PORT = 3000
   ```

### Render wach halten (UptimeRobot):

1. [uptimerobot.com](https://uptimerobot.com) → neuen Monitor anlegen
2. **Monitor Type**: HTTP(s)
3. **URL**: `https://dein-bot.onrender.com/`
4. **Monitoring Interval**: 5 Minuten
5. Fertig – Render schläft nicht mehr ein

---

## Schritt 4: Web App deployen

### Vercel (empfohlen):
1. Zweites GitHub Repo mit dem `webapp/` Ordner als Root
2. [vercel.com](https://vercel.com) → "Import Project"
3. Environment Variable:
   ```
   VITE_API_URL = https://dein-bot.onrender.com
   ```
4. Deploy → URL kopieren → in Render als `WEBAPP_URL` setzen

---

## Schritt 5: Telegram WebApp verbinden

1. @BotFather → `/setmenubutton` → Bot wählen
2. URL: `https://deine-webapp.vercel.app`
3. Text: `🎮 Trading starten`

---

## Admin-Befehle

| Befehl | Beschreibung |
|--------|-------------|
| `/admin` | Dashboard mit Stats + Buttons |
| `/user <telegram_id>` | User-Details |
| `/setbalance <id> <betrag>` | Balance setzen |
| `/broadcast <text>` | Nachricht an alle |
| Button: Season starten | Neue 30-Tage Season |
| Button: Season auswerten | Preisgelder verteilen |

---

## API Endpoints

| Methode | Endpoint | Beschreibung |
|---------|----------|-------------|
| GET | `/api/version` | App-Version aus version.txt |
| GET | `/api/profile` | Profil + Assets + Preise |
| GET | `/api/prices` | Aktuelle Kurse |
| GET | `/api/chart/:symbol?range=3h` | Chart-Daten (3h/12h/24h) |
| POST | `/api/trade` | Kaufen/Verkaufen |
| GET | `/api/leaderboard` | Rangliste + Season |
| GET | `/api/realestate/types` | Immobilien-Katalog |
| POST | `/api/realestate/buy` | Immobilie kaufen |
| POST | `/api/realestate/collect` | Miete einsammeln |
| GET | `/api/collectibles/types` | Besitztümer-Katalog |
| POST | `/api/collectibles/buy` | Besitztum kaufen |
| POST | `/api/leverage/open` | Hebel öffnen (Pro) |
| POST | `/api/leverage/close` | Hebel schließen |
| POST | `/api/alert` | Preis-Alarm (Pro) |
| GET | `/api/transactions` | Trade-History |

---

## Troubleshooting

| Problem | Lösung |
|---------|--------|
| Bot antwortet nicht | Render Logs checken, BOT_TOKEN prüfen |
| Web App lädt nicht | VITE_API_URL prüfen, Browser-Console checken |
| Preise = 0 | CoinGecko Rate Limit (warten), `/admin` → Preise fetchen |
| WebApp öffnet nicht | URL muss HTTPS sein, in BotFather richtig setzen |
| Render schläft ein | UptimeRobot Monitor prüfen |
