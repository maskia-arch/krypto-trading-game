-- ============================================================
-- MIGRATION: v0.3.30 — Copy Trading + Daily Login Bonus (Glücksrad)
-- ============================================================

-- ==================== COPY TRADING ====================

-- 1) copy_subscriptions: Wer kopiert wen, mit welchem Budget und für wie lange
CREATE TABLE IF NOT EXISTS copy_subscriptions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  copier_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  target_id       UUID REFERENCES profiles(id) ON DELETE CASCADE,
  budget          NUMERIC(18,2) NOT NULL,        -- Anfangs-Budget (Einsatz)
  remaining       NUMERIC(18,2) NOT NULL,        -- Verbleibendes Budget
  fee_paid        NUMERIC(18,2) DEFAULT 0,       -- 1% Gebühr an den Kopierten
  duration_hours  INT NOT NULL DEFAULT 24,        -- Dauer in Stunden
  status          TEXT DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_copy_subs_active ON copy_subscriptions(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_copy_subs_target ON copy_subscriptions(target_id, status);
CREATE INDEX IF NOT EXISTS idx_copy_subs_copier ON copy_subscriptions(copier_id, status);

-- 2) copy_trades: Protokoll aller kopierten Trades
CREATE TABLE IF NOT EXISTS copy_trades (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  subscription_id   UUID REFERENCES copy_subscriptions(id) ON DELETE CASCADE,
  original_tx_id    UUID,                          -- Referenz zur Original-Transaktion
  copier_id         UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  action            TEXT NOT NULL CHECK (action IN ('buy', 'sell')),
  amount_eur        NUMERIC(18,2) NOT NULL,
  amount_crypto     NUMERIC(18,8),
  price_eur         NUMERIC(18,2),
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- 3) free_copy_usage: Trackt wann Free User zuletzt kopiert haben (30 Tage Cooldown)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_free_copy TIMESTAMPTZ;

-- ==================== DAILY LOGIN BONUS (GLÜCKSRAD) ====================

-- 4) spin_config: Admin-konfigurierbare Glücksrad-Felder (getrennt für Free/Pro)
CREATE TABLE IF NOT EXISTS spin_config (
  id              SERIAL PRIMARY KEY,
  tier            TEXT NOT NULL CHECK (tier IN ('free', 'pro')),  -- free oder pro Rad
  label           TEXT NOT NULL,                                   -- Anzeige-Text auf dem Rad
  reward_type     TEXT NOT NULL CHECK (reward_type IN ('cash', 'crypto', 'feature')),
  reward_value    NUMERIC(18,8) DEFAULT 0,       -- Betrag (EUR für cash, Menge für crypto)
  reward_symbol   TEXT,                           -- z.B. 'BTC', 'ETH' für crypto; Feature-Key für feature
  reward_detail   TEXT,                           -- z.B. 'zocker_mode', 'trailing_stop' etc.
  probability     NUMERIC(5,4) NOT NULL,          -- 0.0000 - 1.0000 (Summe aller Felder pro tier = 1)
  color           TEXT DEFAULT '#38bdf8',          -- Farbe auf dem Rad
  sort_order      INT DEFAULT 0,                   -- Reihenfolge auf dem Rad
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 5) spin_history: Protokoll der Drehungen
CREATE TABLE IF NOT EXISTS spin_history (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  tier            TEXT NOT NULL,
  config_id       INT REFERENCES spin_config(id),
  reward_type     TEXT NOT NULL,
  reward_value    NUMERIC(18,8),
  reward_symbol   TEXT,
  reward_detail   TEXT,
  spun_at         TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_spin_history_profile ON spin_history(profile_id, spun_at DESC);

-- 6) temp_features: Temporäre Feature-Freischaltungen (24h Glücksrad-Gewinne)
CREATE TABLE IF NOT EXISTS temp_features (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  feature_key     TEXT NOT NULL,                   -- z.B. 'zocker_mode', 'trailing_stop', 'limit_orders', 'multi_positions'
  granted_at      TIMESTAMPTZ DEFAULT NOW(),
  expires_at      TIMESTAMPTZ NOT NULL,
  source          TEXT DEFAULT 'spin',             -- Wie aktiviert: 'spin', 'admin', etc.
  UNIQUE(profile_id, feature_key)
);
CREATE INDEX IF NOT EXISTS idx_temp_features_active ON temp_features(profile_id, expires_at);

-- 7) Default Spin-Config für Free User
INSERT INTO spin_config (tier, label, reward_type, reward_value, reward_symbol, reward_detail, probability, color, sort_order) VALUES
  ('free', '50€',          'cash',    50,     NULL,  NULL,            0.30, '#22d68a', 1),
  ('free', '100€',         'cash',    100,    NULL,  NULL,            0.20, '#38bdf8', 2),
  ('free', '250€',         'cash',    250,    NULL,  NULL,            0.10, '#a78bfa', 3),
  ('free', '500€',         'cash',    500,    NULL,  NULL,            0.05, '#fbbf24', 4),
  ('free', '0.001 BTC',    'crypto',  0.001,  'BTC', NULL,            0.10, '#f97316', 5),
  ('free', '0.01 ETH',     'crypto',  0.01,   'ETH', NULL,            0.10, '#6366f1', 6),
  ('free', '24h Zocker',   'feature', 0,      NULL,  'zocker_mode',   0.10, '#f43f5e', 7),
  ('free', '24h Trailing', 'feature', 0,      NULL,  'trailing_stop', 0.05, '#ec4899', 8)
ON CONFLICT DO NOTHING;

-- 8) Default Spin-Config für Pro User (bessere Preise)
INSERT INTO spin_config (tier, label, reward_type, reward_value, reward_symbol, reward_detail, probability, color, sort_order) VALUES
  ('pro', '200€',          'cash',    200,    NULL,  NULL,            0.25, '#fbbf24', 1),
  ('pro', '500€',          'cash',    500,    NULL,  NULL,            0.20, '#f59e0b', 2),
  ('pro', '1.000€',        'cash',    1000,   NULL,  NULL,            0.10, '#eab308', 3),
  ('pro', '2.500€',        'cash',    2500,   NULL,  NULL,            0.05, '#fbbf24', 4),
  ('pro', '0.005 BTC',     'crypto',  0.005,  'BTC', NULL,            0.15, '#f97316', 5),
  ('pro', '0.05 ETH',      'crypto',  0.05,   'ETH', NULL,            0.15, '#6366f1', 6),
  ('pro', '0.5 LTC',       'crypto',  0.5,    'LTC', NULL,            0.05, '#38bdf8', 7),
  ('pro', '5.000€ JACKPOT','cash',    5000,   NULL,  NULL,            0.05, '#fbbf24', 8)
ON CONFLICT DO NOTHING;

-- Profil-Feld für letzte Rad-Drehung (Reset um 0 Uhr DE)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_spin TIMESTAMPTZ;
