# 🎮 ValueTradeGame v0.3 (The Stability & Polish Update)

**Autor:** autoacts
**Engine:** v0.3.1

Das ultimative Krypto-Trading-Erlebnis direkt in Telegram. Version 0.3 fokussiert sich auf Stabilität, korrekte Margin-Berechnungen, fehlende Store-Funktionen und ein vollständiges UI-Feedback-System.

---

## Architektur & Ökosystem v0.3

```
┌─────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│  Telegram Bot    │────▶│  Node.js Server      │────▶│   Supabase       │
│  (Entry Point)   │     │  (ValueTrade Engine)  │     │   (PostgreSQL)   │
│                  │     │                       │     │                  │
│  - /start (Ref)  │     │  - Express API        │     │  - profiles      │
│  - /portfolio    │     │  - grammY Bot         │     │  - leveraged_pos │
│  - /admin        │     │  - Liquidation Engine │     │  - market_history│
│  - Pro-Support   │     │  - Cron Scheduler     │     │  - achievements  │
└─────────────────┘     └──────────┬───────────┘     │  - collectibles  │
                                   │                  │  - real_estate   │
                        ┌──────────┴───────────┐     │  - transactions  │
                        │  React Web App v0.3   │     └────────┬─────────┘
                        │  (Vite + Tailwind)    │              │
                        │                       │     ┌────────┴─────────┐
                        │  - Spot Trading       │     │  Supabase S3     │
                        │  - Leverage Interface │     │  (Storage)       │
                        │  - Collectibles/RE    │     │                  │
                        │  - Leaderboard        │     │  - Avatars       │
                        │  - Affiliate System   │     │  - Backgrounds   │
                        │  - Toast Feedback     │     └──────────────────┘
                        │  - Monday Event UI    │
                        └───────────────────────┘
```

---

## Neue Features & Fixes in v0.3 🚀

### Kritische Bugfixes
- **Store-Vollständigkeit:** Fehlende Zustand-Funktionen ergänzt (`refreshPrices`, `loadVersion`, `buyCrypto`, `sellCrypto`, `partialClosePosition`, `loadPublicProfile`, `fetchLeverageHistory`). Ohne diese blieb die App im Ladebildschirm hängen.
- **Endlosschleife behoben:** `profile` aus dem useEffect-Dependency-Array in `App.jsx` entfernt. Die alte Version löste bei jedem Profil-Update einen Re-Render-Zyklus aus, der zu endlosen API-Calls führte.
- **Error-State korrigiert:** `fetchProfile` setzt jetzt nach 3 fehlgeschlagenen Retries korrekt `error` und `loading: false`, sodass der Fehler-Screen angezeigt wird statt eines ewigen Spinners.

### Margin-System
- **Backend Policy:** Der `/positions`-Endpoint sendet nun `maxMarginPercent: 0.5` in der Policy-Response. Das Frontend zeigt die tatsächlich verfügbare Margin (50% vom Guthaben) korrekt an.
- **Abrundungs-Fix:** Die Prozent-Buttons (25/50/75/100%) im Leverage-Panel nutzen `Math.floor` statt `.toFixed(2)`, um Rundungsfehler zu vermeiden, die dazu führten, dass 100%-Einsätze als "unzureichende Margin" abgelehnt wurden.

### UI & Feedback
- **Toast-System:** Globale Toast-Benachrichtigungen in `App.jsx` integriert. Alle `showToast()`-Aufrufe (Kauf, Verkauf, Fehler, Bonus) werden jetzt als animierte Banner am oberen Bildschirmrand angezeigt. Auto-Dismiss nach 3 Sekunden.
- **Pulse-Slow Animation:** `animate-pulse-slow` in Tailwind-Config ergänzt für den Hebel-Montag-Banner.

### Vollständige Feature-Liste

| Feature | Beschreibung |
|---|---|
| **Spot Trading** | Kauf/Verkauf von BTC, ETH, LTC mit 0.5% Gebühr |
| **Leverage Trading** | LONG/SHORT mit 2x-10x Hebel, automatische Liquidation |
| **Hebel-Montag** | Jeden Montag: 10x Max-Hebel für alle User |
| **Pro-Features** | Stop Loss, Take Profit, Limit Orders, Trailing Stop, 3 Positionen, Custom Backgrounds |
| **Collectibles** | Kaufbare Besitztümer mit 5% Luxussteuer (fließt in Season-Pool) |
| **Immobilien** | Kaufbare Properties mit täglicher Mieteinnahme |
| **Season-System** | Rangliste mit Jackpot-Ausschüttung (40/25/15/20%) |
| **Achievements** | 4 Stufen: Jung-Investor → Daytrader → Krypto-Wal → Marktmacher |
| **Affiliate** | 500€ Bonus für Werber und Geworbenen |
| **Live-Charts** | Recharts-basierte Kursansicht (1m, 3h, 12h, 24h) + SVG Mini-Chart (10m, 30m) |
| **Profil-System** | Avatar-Upload, Custom Backgrounds (Pro), öffentliche Profile |
| **Inaktivitäts-Bonus** | Automatischer Rückgewinnungs-Bonus via Deep-Link |

---

## Tech Stack

| Komponente | Technologie |
|---|---|
| **Bot** | Node.js, grammY, Express |
| **Frontend** | React 18, Vite 5, Zustand, Recharts, Tailwind CSS 3 |
| **Datenbank** | Supabase (PostgreSQL) |
| **Storage** | Supabase S3 (Avatars, Backgrounds) |
| **Hosting** | Render.com (Bot), Vercel/Netlify (WebApp) |
| **Fonts** | Outfit, JetBrains Mono |

---

## Projektstruktur

```
├── bot/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── collectibles.js
│   │   │   ├── economy.js
│   │   │   ├── leverage.js
│   │   │   ├── profile.js
│   │   │   └── trading.js
│   │   ├── auth.js
│   │   └── server.js
│   ├── callbacks/
│   │   └── handler.js
│   ├── commands/
│   │   ├── admin.js
│   │   ├── economy.js
│   │   ├── portfolio.js
│   │   └── start.js
│   ├── core/
│   │   ├── db/
│   │   │   ├── achievements.js
│   │   │   ├── assets.js
│   │   │   ├── leaderboard.js
│   │   │   ├── leverage.js
│   │   │   ├── pro.js
│   │   │   ├── profiles.js
│   │   │   ├── realEstate.js
│   │   │   └── transactions.js
│   │   ├── config.js
│   │   ├── database.js
│   │   └── utils.js
│   ├── cron/
│   │   └── scheduler.js
│   ├── services/
│   │   ├── priceService.js
│   │   ├── seasonService.js
│   │   └── tradeService.js
│   ├── bot.js
│   └── package.json
├── webapp/
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Header.jsx
│   │   │   │   ├── Navbar.jsx
│   │   │   │   └── PriceTicker.jsx
│   │   │   ├── modals/
│   │   │   │   └── TradeInfoModal.jsx
│   │   │   └── trading/
│   │   │       ├── LeveragePanel.jsx
│   │   │       ├── LiveChart30m.jsx
│   │   │       ├── OrderHistory.jsx
│   │   │       └── PositionsTable.jsx
│   │   ├── lib/
│   │   │   ├── api.js
│   │   │   └── store.js
│   │   ├── views/
│   │   │   ├── AffiliateView.jsx
│   │   │   ├── AssetsView.jsx
│   │   │   ├── ChartView.jsx
│   │   │   ├── ProfileView.jsx
│   │   │   ├── PublicProfileView.jsx
│   │   │   ├── RankView.jsx
│   │   │   ├── SettingsView.jsx
│   │   │   ├── TradeView.jsx
│   │   │   └── WalletView.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   └── main.jsx
│   ├── index.html
│   ├── package.json
│   ├── postcss.config.js
│   ├── tailwind.config.js
│   └── vite.config.js
├── sql/
│   └── schema.sql
├── version.txt
└── README.md
```

---

## Datenfluss: Kurse & Liquidation

```
Coinbase API ──(Cron)──▶ Supabase DB (prices + market_history)
                              │
ValueTrade Engine ──(Trigger)──▶ Check Open Leveraged Positions
                              │
Liquidation Event ──(Bot Push)──▶ Nachricht an User bei Margin Call
                              │
Web App ◀──(GET /api)─────────┘  ← Profile Refresh 25s, Prices 60s
```

---

## Einrichtung & Deployment

### 1. Supabase & Storage
- Führe `sql/schema.sql` im SQL Editor aus
- Storage Buckets erstellen (beide auf Public):
  - `avatars` (Profilbilder)
  - `backgrounds` (Pro-Hintergrundbilder)
- Service Role Key für Backend-Tasks aktivieren

### 2. Telegram Bot
1. Bot erstellen via @BotFather
2. Commands setzen:
   - `start` - Spiel starten
   - `portfolio` - Guthaben & Status
   - `rank` - Leaderboard
   - `pro` - Pro-Vorteile & Hebel
   - `settings` - Name & Account

### 3. Environment Variables

**Bot (.env):**
```
BOT_TOKEN=
SUPABASE_URL=
SUPABASE_KEY=
SUPABASE_SERVICE_KEY=
WEBAPP_URL=
```

**WebApp (.env):**
```
VITE_API_URL=https://your-bot.onrender.com
VITE_BOT_USERNAME=DeinBotName
```

### 4. Deployment
```bash
# Bot (Render.com)
cd bot && npm install && node bot.js

# WebApp (Vercel/Netlify)
cd webapp && npm install && npm run build
```

---

## Changelog

### v0.3.1 – Stability & Polish Update
- 6 fehlende Store-Funktionen ergänzt
- Endlosschleife in App.jsx behoben
- Margin-Berechnung: Backend sendet `maxMarginPercent`, Frontend respektiert 50%-Regel
- Prozent-Buttons: Abrundungs-Fix mit `Math.floor`
- Toast-System global integriert
- Error-State mit Retry-Logik und Fallback
- `animate-pulse-slow` für Hebel-Montag-Banner
- `useRef` für Profile-Interval statt Dependency

### v0.2.0 – Leverage & Identity Update
- Hebel-System mit LONG/SHORT und Liquidation Engine
- Hebel-Montag Event (10x für alle)
- Pro-Identity: Custom Backgrounds
- Automatisches Cleanup bei Pro-Ablauf
- Echtzeit PriceTicker mit Glow-Effekten

### v0.1.0 – Initial Release
- Spot Trading (BTC, ETH, LTC)
- Leaderboard & Season-System
- Immobilien & Collectibles
- Affiliate-System
- Achievement-System

---

**System Architect:** @autoacts | **Version:** 0.3.1
