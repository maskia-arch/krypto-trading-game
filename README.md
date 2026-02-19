# 🎮 ValueTradeGame v0.151 (The Growth Update)
**Autor:** [autoacts](https://t.me/autoacts)

> Die Version wird zentral in `version.txt` verwaltet. Alle Komponenten (Bot, Web App, API) lesen die Version von dort.

## Architektur & Ökosystem

┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Telegram Bot    │────▶│  Node.js Server  │────▶│   Supabase      │
│  (Entry Point)   │     │  (render.com)    │     │   (PostgreSQL)  │
│                  │     │                  │     │                  │
│  - /start (Ref)  │     │  - Express API   │     │  - profiles      │
│  - /portfolio    │     │  - grammY Bot    │     │  - assets        │
│  - /admin        │     │  - Cron Jobs     │     │  - market_history│
│  - Deep-Links    │     │  - Affiliate/    │     │  - transactions  │
│  - Pro-Management│     │    Achievements  │     │  - achievements  │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
│                        │
┌────────────┴────────────┐    ┌──────┴────────┐
│  React Web App          │    │  S3 Storage   │
│  (Vercel / Netlify)     │    │  (Avatars)    │
│                         │    └───────────────┘
│  - Trading Interface    │
│  - Public Profiles      │
│  - Affiliate Dashboard  │
│  - Faires Ranking       │
└─────────────────────────┘

## Neue Features in v0.151 🚀
* **Affiliate & Referral System:** Deep-Link-Integration (`start=ref_ID`). User werben Freunde und beide erhalten vollautomatisch 500€ Start-Bonus. Inklusive UI-Dashboard zur Verwaltung der Invites.
* **Faires Ranking-System:** Die Rangliste berechnet nun das echte Netto-Vermögen (Cash + Assets) minus Startkapital und zieht geschenkte Affiliate-/Inaktivitäts-Boni ab, um Manipulation zu verhindern.
* **Retention & Deep-Linking:** Inaktive Spieler können über `startapp=claim_bonus` via Telegram-Nachricht zurückgeholt werden und erhalten ihren Bonus direkt in der WebApp.
* **Custom Avatare & Public Profiles:** Profilbilder via S3 Storage, Gast-Ansicht fremder Profile und Identitäts-Management (Wechsel zwischen In-Game und Telegram-Namen).

## Datenfluss: Kurse & Events

CoinGecko API ──(1min Cron)──▶ Supabase DB (prices + history)
│
Handels/Invite-Event ──(Trigger)──▶ API / Bot ──▶ Belohnung & Push-Nachricht
│
Web App ◀──(GET /api/prices)──────────┘     ← Alle 15s auto-refresh
Web App ◀──(GET /api/referrals)───────┘     ← Lädt geworbene Freunde

---

## Schritt 1: Supabase & Storage einrichten

1.  Neues Projekt auf [supabase.com](https://supabase.com) erstellen.
2.  **SQL Editor**: Den Inhalt von `sql/schema.sql` ausführen. Für das v0.151 Update zwingend diese Spalten hinzufügen:
    ```sql
    ALTER TABLE profiles 
    ADD COLUMN IF NOT EXISTS referred_by BIGINT DEFAULT NULL,
    ADD COLUMN IF NOT EXISTS bonus_received NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS claimable_bonus NUMERIC DEFAULT 0,
    ADD COLUMN IF NOT EXISTS inactivity_bonus_claimed BOOLEAN DEFAULT false;
    ```
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

## Schritt 3: Backend & Frontend Deployment

**Backend Environment Variables (Render.com / Node.js):**
```env
BOT_TOKEN=dein_telegram_bot_token
ADMIN_ID=deine_telegram_id
SUPABASE_URL=[https://dein-projekt.supabase.co](https://dein-projekt.supabase.co)
SUPABASE_SERVICE_KEY=dein_service_role_key
WEBAPP_URL=[https://deine-webapp.vercel.app](https://deine-webapp.vercel.app)
PORT=3000
