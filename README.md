# 🎮 ValueTradeGame v0.3 (The Stability & Polish Update)

**Autor:** autoacts
**Engine:** v0.3.23

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
│  - /pro          │     │  - Cron Scheduler     │     │  - achievements  │
│  - /setpro       │     │  - Zocker-Montag      │     │  - collectibles  │
└─────────────────┘     └──────────┬───────────┘     │  - real_estate   │
                                   │                  │  - transactions  │
                        ┌──────────┴───────────┐     │  - fee_pool      │
                        │  React Web App v0.3   │     └────────┬─────────┘
                        │  (Vite + Tailwind)    │              │
                        │                       │     ┌────────┴─────────┐
                        │  - Spot Trading       │     │  Supabase S3     │
                        │  - Leverage Interface │     │  (Storage)       │
                        │  - Zocker-Modus UI    │     │                  │
                        │  - Collectibles/RE    │     │  - Avatars       │
                        │  - Leaderboard        │     │  - Backgrounds   │
                        │  - Affiliate System   │     └──────────────────┘
                        │  - Toast Feedback     │
                        │  - Fee-Transparenz    │
                        └───────────────────────┘
```

---

## Neue Features & Fixes in v0.3 🚀

### Kritische Bugfixes
- **Store-Vollständigkeit:** Fehlende Zustand-Funktionen ergänzt (`refreshPrices`, `loadVersion`, `buyCrypto`, `sellCrypto`, `partialClosePosition`, `loadPublicProfile`, `fetchLeverageHistory`). Ohne diese blieb die App im Ladebildschirm hängen.
- **Endlosschleife behoben:** `profile` aus dem useEffect-Dependency-Array in `App.jsx` entfernt. Die alte Version löste bei jedem Profil-Update einen Re-Render-Zyklus aus, der zu endlosen API-Calls führte.
- **Error-State korrigiert:** `fetchProfile` setzt jetzt nach 3 fehlgeschlagenen Retries korrekt `error` und `loading: false`, sodass der Fehler-Screen angezeigt wird statt eines ewigen Spinners.
- **getVersion Export (v0.3.21):** `start.js` exportierte `getVersion` nicht als Named Export — alle Importe in `economy.js` und `handler.js` schlugen fehl, was den Pro-Button für sämtliche User crashen ließ.
- **Story-Bonus Exploit (v0.3.22):** SELECT → UPDATE Race Condition erlaubte unbegrenztes Einsammeln des Story-Bonus. Atomares Update mit `.eq('story_bonus_claimed', false)` verhindert jetzt Double-Claims.

### Margin-System
- **Backend Policy:** Der `/positions`-Endpoint sendet nun `maxMarginPercent: 0.5` in der Policy-Response. Das Frontend zeigt die tatsächlich verfügbare Margin (50% vom Guthaben) korrekt an.
- **Abrundungs-Fix:** Die Prozent-Buttons (25/50/75/100%) im Leverage-Panel nutzen `Math.floor` statt `.toFixed(2)`, um Rundungsfehler zu vermeiden, die dazu führten, dass 100%-Einsätze als "unzureichende Margin" abgelehnt wurden.

### Gebühren-System (v0.3.23)
- **Spot Trading:** 0.25% Fee bei Kauf und Verkauf (vorher 0.5%)
- **Leverage Trading:** 0.1% Fee bei Eröffnung und Schließung (vorher 0.5%)
- **Season Pool:** Alle Fees (Spot + Leverage) fließen jetzt korrekt in den Season-Pool
- **Fee-Transparenz:** LeveragePanel zeigt Kostenaufstellung (Notional, Eröffnungsgebühr, Schließgebühr, Gesamtkosten)

### Zocker-Modus (v0.3.21)
- **x20 & x50 Hebel** für Pro-User dauerhaft freigeschaltet
- **Zocker-Montag:** Jeden Montag x20/x50 für ALLE User
- **Auto-Close:** Dienstag 00:01 werden Free-User Zocker-Positionen automatisch geschlossen
- **21:00 Warnung:** Betroffene Free-User werden 3 Stunden vorher benachrichtigt
- **Admin = Pro:** Admin-Status schaltet alle Pro-Features dauerhaft frei

### UI & Feedback
- **Toast-System:** Globale Toast-Benachrichtigungen in `App.jsx` integriert. Alle `showToast()`-Aufrufe (Kauf, Verkauf, Fehler, Bonus) werden jetzt als animierte Banner am oberen Bildschirmrand angezeigt. Auto-Dismiss nach 3 Sekunden.
- **Pulse-Slow Animation:** `animate-pulse-slow` in Tailwind-Config ergänzt für den Zocker-Montag-Banner.
- **Zocker-Buttons:** LeveragePanel zeigt dynamisch Standard-Hebel (2x–10x) und Zocker-Hebel (x20/x50) basierend auf User-Tier und Wochentag.

### Vollständige Feature-Liste

| Feature | Beschreibung |
|---|---|
| **Spot Trading** | Kauf/Verkauf von BTC, ETH, LTC mit 0.25% Gebühr |
| **Leverage Trading** | LONG/SHORT mit 2x–50x Hebel, 0.1% Fee, automatische Liquidation |
| **Zocker-Modus** | x20 & x50 Hebel — dauerhaft für Pro, Montags für alle |
| **Zocker-Montag** | Jeden Montag: Zocker-Hebel für alle User, Auto-Close Dienstag 00:01 |
| **Pro-Features** | Stop Loss, Take Profit, Limit Orders, Trailing Stop, 3 Positionen, Custom Backgrounds |
| **Collectibles** | Kaufbare Besitztümer mit 5% Luxussteuer (fließt in Season-Pool) |
| **Immobilien** | Kaufbare Properties mit täglicher Mieteinnahme |
| **Season-System** | Rangliste mit Jackpot-Ausschüttung (40/25/15/20%), Bonus-Abzug für faires Ranking |
| **Achievements** | 4 Stufen: Jung-Investor → Daytrader → Krypto-Wal → Marktmacher |
| **Affiliate** | 500€ Bonus für Werber und Geworbenen |
| **Live-Charts** | Recharts-basierte Kursansicht (1m, 3h, 12h, 24h) + SVG Mini-Chart (10m, 30m) |
| **Profil-System** | Avatar-Upload, Custom Backgrounds (Pro), öffentliche Profile |
| **Inaktivitäts-Bonus** | Automatischer Rückgewinnungs-Bonus via Deep-Link |
| **Fee-Transparenz** | Kostenaufstellung vor Trade-Eröffnung, alle Fees in Season-Pool |

---

## Gebührenstruktur

| Trade-Typ | Eröffnung | Schließung | Fließt in |
|---|---|---|---|
| **Spot (Kauf/Verkauf)** | 0.25% | 0.25% | Season-Pool |
| **Leverage (LONG/SHORT)** | 0.1% vom Notional | 0.1% vom Notional | Season-Pool |
| **Collectibles** | 5% Luxussteuer | — | Season-Pool |

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
│   ├── schema.sql
│   ├── v0321_update.sql
│   └── v0322_story_fix.sql
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
Zocker-Montag ──(Cron Di 00:01)──▶ Auto-Close Free-User x20/x50
                              │
Web App ◀──(GET /api)─────────┘  ← Profile Refresh 25s, Prices 60s
```

---

## Einrichtung & Deployment

### 1. Supabase & Storage
- Führe `sql/schema.sql` im SQL Editor aus
- Danach `sql/v0321_update.sql` und `sql/v0322_story_fix.sql` ausführen
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
   - `rent` - Mieteinnahmen einsammeln
   - `bailout` - Onkel Heinrich Rettungspaket

### 3. Environment Variables

**Bot (.env):**
```
BOT_TOKEN=
ADMIN_ID=
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

### v0.3.23 – Fee-Restrukturierung
- Spot Fees reduziert: 0.5% → 0.25% (Kauf & Verkauf)
- Leverage Fees reduziert: 0.5% → 0.1% (Eröffnung & Schließung)
- Leverage-Fees fließen jetzt korrekt in den Season-Pool (vorher verworfen)
- Fee-Transparenz im LeveragePanel: Kostenaufstellung vor Trade-Eröffnung
- Getrennte Fee-Konfiguration: `SPOT_FEE_RATE` und `LEVERAGE_FEE_RATE` in config.js

### v0.3.22 – Story-Bonus Exploit Fix
- Race Condition beim Story-Bonus behoben (SELECT → UPDATE nicht atomar)
- Atomares Update mit `.eq('story_bonus_claimed', false)` verhindert Double-Claims
- Exploiter-Korrektur via SQL-Migration (überschüssiges Geld abgezogen)

### v0.3.21 – Hotfix + Zocker-Modus
- **CRITICAL:** `getVersion` Export in `start.js` gefixed (Pro-Button crashte für alle User)
- **CRITICAL:** `buy_pro` Callback-Mismatch zwischen economy.js und handler.js behoben
- Zocker-Modus: x20 & x50 Hebel für Pro (dauerhaft) und Free (nur Montags)
- Auto-Close: Free-User Zocker-Positionen werden Dienstag 00:01 geschlossen
- 21:00 Warnung an Free-User mit offenen Zocker-Positionen
- Admin-Status = dauerhaft Pro in allen Code-Paths
- Leaderboard: Inaktive User (0 Volume) werden ausgeblendet
- Bonus-Abzug: Geschenktes Geld (Story, Miete, Referral) zählt nicht als Profit
- Admin-Panel Callbacks (Users, Pool, Deletions, Season, Prices) repariert
- `/setpro` Command registriert
- `getAllOpenLeveragedPositions()` für Scheduler hinzugefügt

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

**System Architect:** @autoacts | **Version:** 0.3.23
