🎮 ValueTradeGame v0.2 (The Leverage & Identity Update)
Autor: autoacts
Das ultimative Krypto-Trading-Erlebnis direkt in Telegram. In Version 0.2 liegt der Fokus auf Hochrisiko-Trading, exklusiven Pro-Features und einer erweiterten Identitätsverwaltung.
Architektur & Ökosystem v0.2
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Telegram Bot    │────▶│  Node.js Server  │────▶│   Supabase      │
│  (Entry Point)   │     │  (ValueTrade Engine)│     │   (PostgreSQL)  │
│                  │     │                  │     │                  │
│  - /start (Ref)  │     │  - Express API   │     │  - profiles      │
│  - /portfolio    │     │  - grammY Bot    │     │  - leveraged_pos │
│  - /admin        │     │  - Liq. Engine   │     │  - market_history│
│  - Pro-Support   │     │  - Cron Jobs     │     │  - achievements  │
└─────────────────┘     └────────┬─────────┘     └────────┬────────┘
│                        │
┌────────────┴────────────┐    ┌──────┴────────┐
│  React Web App v0.2     │    │  Supabase S3  │
│  (Vercel / Netlify)     │    │  (Storage)    │
│                         │    └───────────────┘
│  - Leverage Interface   │      - Avatars
│  - Monday Event UI      │      - Backgrounds
│  - Realtime Tickers     │
└─────────────────────────┘
Neue Features in v0.2 🚀
Hebel-System (Leverage): Eröffnung von LONG und SHORT Positionen mit bis zu 5x Hebel (Standard). Inklusive einer automatischen Liquidations-Engine im Backend.
Hebel-Montag Event: Jeden Montag wird das maximale Hebel-Limit systemweit auf 10x angehoben, begleitet von einem exklusiven UI-Banner.
Pro-Identity: Pro-User können nun ein individuelles Hintergrundbild für ihr Profil hochladen. Dieses wird in der PublicProfileView für alle Spieler sichtbar.
Intelligentes Cleanup: Automatisches Deaktivieren von Pro-Hintergründen bei Ablauf des Abos sowie restlose physische Löschung der Dateien nach 4 Wochen Inaktivität zur Speicherschonung.
Echtzeit-Feedback: Überarbeitete PriceTicker mit visuellen Glow-Effekten bei Kursänderungen und optimierte useGameData Hooks für verzögerungsfreie PnL-Updates.
Datenfluss: Kurse & Liquidation
Coinbase API ──(1min Cron)──▶ Supabase DB (prices + history)
│
ValueTrade Engine ──(Trigger)──▶ Check Open Leveraged Positions
│
Liquidation Event ──(Bot Push)──▶ Nachricht an User bei Margin Call
│
Web App ◀──(GET /api/leverage)───────┘  ← Live PnL Refresh alle 15s
Einrichtung & Deployment
1. Supabase & Storage
Führe das schema.sql v0.2 im SQL Editor aus.
Storage Buckets: Erstelle zwei Buckets und setze beide auf Public:
avatars (für Profilbilder)
backgrounds (für Pro-Hintergrundbilder)
Aktiviere den Service Role Key für administrative Backend-Tasks (Cleanup-Bot).
2. Telegram Bot
1. erstelle den Bot via @botfather
2. Setze die Commands: 
start - Spiel starten
portfolio - Guthaben & Status
rank - Leaderboard
pro - Pro-Vorteile & Hebel
settings - Name & Account
3. Konfiguration
Alle notwendigen Variablen für das Backend und Frontend müssen in der .env Datei definiert werden. Eine detaillierte Vorlage findest du in der Datei .env.example.
System Architect: @autoacts | Version: 0.2.0