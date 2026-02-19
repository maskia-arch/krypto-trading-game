# 🎮 ValueTradeGame v0.150.8
**Autor:** [autoacts](https://t.me/autoacts)

> Die Version wird zentral in `version.txt` verwaltet. Alle Komponenten (Bot, Web App, API) lesen die Version von dort.

## Architektur & Ökosystem

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Telegram Bot    │────▶│  Node.js Server  │────▶│   Supabase      │
│  (Entry Point)   │     │  (render.com)    │     │   (PostgreSQL)  │
│                  │     │                  │     │                  │
│  - /start        │     │  - Express API   │     │  - profiles      │
│  - /portfolio    │     │  - grammY Bot    │     │  - assets        │
│  - /admin        │     │  - Cron Jobs     │     │  - market_history│
│  - WebApp Button │     │  - Achievement   │     │  - transactions  │
│  - Pro-Management│     │    Engine        │     │  - achievements  │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
│                        │
┌────────────┴────────────┐    ┌──────┴────────┐
│  React Web App          │    │  S3 Storage   │
│  (Vercel / Netlify)     │    │  (Avatars)    │
│                         │    └───────────────┘
│  - Trading Interface    │
│  - Public Profiles      │
│  - Achievement Gallery  │
│  - Rangliste (Visual)   │
└─────────────────────────┘
## Neue Features in v0.150.x
* **Profilbilder:** Unterstützung für Custom Avatare via Base64/S3 Storage direkt in der WebApp.
* **Achievement-System:** Automatische Vergabe von Abzeichen (💰 Jung-Investor, 📊 Daytrader, etc.) inklusive Cash-Belohnungen.
* **Public Profiles:** Spieler können Profile anderer Trader über die Rangliste einsehen (Gast-Ansicht).
* **Identitäts-Management:** Wechsel zwischen In-Game Username und Telegram-Identität sowie Admin/Pro-Status Anzeige.

## Datenfluss: Kurse & Events

CoinGecko API ──(1min Cron)──▶ Supabase DB (prices + history)
│
Handels-Event ──(Trigger)────▶ Achievement Engine ──▶ Belohnung (EUR)
│
Web App ◀──(GET /api/prices)──────────┘     ← Alle 15s auto-refresh
Web App ◀──(GET /api/profile)─────────┘     ← Inkl. Avatare & Badges

---

## Schritt 1: Supabase & Storage einrichten

1.  Neues Projekt auf [supabase.com](https://supabase.com) erstellen.
2.  **SQL Editor**: Den Inhalt von `sql/schema.sql` (inkl. der neuen Tabellen für Achievements und der Spalte `avatar_url`) ausführen.
3.  **Storage**: Erstelle einen neuen Bucket namens `avatars`.
    * Setze den Bucket auf **Public**, damit die Bilder für alle Spieler geladen werden können.
4.  Notieren: **Project URL**, **Anon Key** und den **Service Role Key** (für das Backend).

---

## Schritt 2: Telegram Bot & Admin Setup

1.  [@BotFather](https://t.me/BotFather) öffnen → `/newbot`.
2.  `/setcommands` konfigurieren:
    ```
    start - Spiel starten & Profil laden
    portfolio - Dein Portfolio & Status
    rank - Globale Rangliste
    bailout - Rettungsschirm (bei Bankrott)
    rent - Mieteinnahmen abholen
    pro - Pro-Status Informationen
    ```
3.  Eigene Telegram ID als `ADMIN_ID` in der `.env` festlegen.

---

## Schritt 3: Backend Deployment (Render.com)

**Environment Variables:**
```env
BOT_TOKEN=dein_telegram_bot_token
ADMIN_ID=deine_telegram_id
SUPABASE_URL=[https://dein-projekt.supabase.co](https://dein-projekt.supabase.co)
SUPABASE_SERVICE_KEY=dein_service_role_key
WEBAPP_URL=[https://deine-webapp.vercel.app](https://deine-webapp.vercel.app)
PORT=3000

Wichtig: Das JSON-Limit im Server muss auf 5mb erhöht sein, um die Base64-Strings der Profilbilder zu verarbeiten.
Schritt 4: API Endpoints (v0.150.8)

Methode Endpoint Beschreibung
GET /api/version Liefert die aktuelle v0.150.8
GET /api/profile Eigenes Profil + Assets + Badges
GET /api/profile/public/:id Gast-Ansicht eines Traders via UUID
POST /api/profile/avatar Profilbild hochladen (Base64)
DELETE /api/profile/avatar Profilbild unwiderruflich löschen
POST /api/profile/update-username In-Game Anzeigename ändern
GET /api/economy/leaderboard Rangliste inkl. Avatar-URLs
POST /api/trade Trade ausführen + Achievement Check

Troubleshooting

Problem Lösung
Avatare werden nicht angezeigt Prüfe, ob der Supabase Bucket avatars öffentlich (Public) ist.
Name ändert sich nicht Namensänderung für Standard-User auf 1x begrenzt (Pro = unbegrenzt).
Achievement wird nicht getriggert Transaktion im SQL-Log prüfen; Engine benötigt Mindestumsatz/Kontostand.
Payload Too Large (413) app.use(express.json({limit: '5mb'})) im Express-Server prüfen.

ValueTradeGame – Das nächste Level des Krypto-Tradings auf Telegram.
© 2026 autoacts.