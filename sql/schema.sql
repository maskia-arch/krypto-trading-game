-- ============================================================
-- VALUETRADEGAME - Supabase Schema v0.3
-- ============================================================

-- 1) PROFILES
CREATE TABLE profiles (
  id                        UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id               BIGINT UNIQUE NOT NULL,
  username                  TEXT,
  first_name                TEXT,
  balance                   NUMERIC(18,2) DEFAULT 10000.00,
  total_volume              NUMERIC(18,2) DEFAULT 0.00,
  bonus_received            NUMERIC(18,2) DEFAULT 0.00,
  claimable_bonus           NUMERIC(18,2) DEFAULT 0.00,
  inactivity_bonus_claimed  BOOLEAN DEFAULT FALSE,
  story_bonus_claimed       BOOLEAN DEFAULT FALSE,
  feedback_sent             BOOLEAN DEFAULT FALSE,
  bailout_count             INT DEFAULT 0,
  bailout_last              TIMESTAMPTZ,
  is_pro                    BOOLEAN DEFAULT FALSE,
  pro_until                 TIMESTAMPTZ,
  is_admin                  BOOLEAN DEFAULT FALSE,
  hide_collectibles         BOOLEAN DEFAULT FALSE,
  username_changes          INT DEFAULT 0,
  avatar_url                TEXT,
  background_url            TEXT DEFAULT NULL,
  background_disabled_at    TIMESTAMPTZ DEFAULT NULL,
  referred_by               BIGINT,
  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- 2) ASSETS
CREATE TABLE assets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  amount      NUMERIC(18,8) DEFAULT 0,
  avg_buy     NUMERIC(18,2) DEFAULT 0,
  first_buy   TIMESTAMPTZ,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, symbol)
);

-- 3) MARKET_HISTORY
CREATE TABLE market_history (
  id          BIGSERIAL PRIMARY KEY,
  symbol      TEXT NOT NULL,
  price_eur   NUMERIC(18,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_market_symbol_time ON market_history(symbol, recorded_at DESC);

-- 4) CURRENT_PRICES
CREATE TABLE current_prices (
  symbol      TEXT PRIMARY KEY,
  price_eur   NUMERIC(18,2) NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5) TRANSACTIONS
CREATE TABLE transactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL,
  symbol      TEXT,
  amount      NUMERIC(18,8),
  price_eur   NUMERIC(18,2),
  fee_eur     NUMERIC(18,2) DEFAULT 0,
  total_eur   NUMERIC(18,2),
  details     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6) LEVERAGED_POSITIONS (v0.3 – mit Order-ID & Pro-Features)
CREATE TABLE leveraged_positions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id          TEXT UNIQUE NOT NULL,
  profile_id        UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  direction         TEXT CHECK (direction IN ('LONG', 'SHORT')),
  leverage          INTEGER NOT NULL,
  collateral        NUMERIC(18,2) NOT NULL,
  entry_price       NUMERIC(18,2) NOT NULL,
  close_price       NUMERIC(18,2),
  liquidation_price NUMERIC(18,2) NOT NULL,
  pnl               NUMERIC(18,2) DEFAULT 0,
  equity_at_close   NUMERIC(18,2),
  status            TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LIQUIDATED')),
  liquidation_reason TEXT,
  stop_loss         NUMERIC(18,2),
  take_profit       NUMERIC(18,2),
  limit_price       NUMERIC(18,2),
  trailing_stop     BOOLEAN DEFAULT FALSE,
  is_limit_order    BOOLEAN DEFAULT FALSE,
  entry_time        TIMESTAMPTZ DEFAULT NOW(),
  close_time        TIMESTAMPTZ
);
CREATE INDEX idx_lev_pos_profile ON leveraged_positions(profile_id, status);
CREATE INDEX idx_lev_pos_open ON leveraged_positions(status) WHERE status = 'OPEN';

-- 7) REAL_ESTATE
CREATE TABLE real_estate_types (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  price_eur   NUMERIC(18,2) NOT NULL,
  daily_rent  NUMERIC(18,2) NOT NULL,
  emoji       TEXT DEFAULT '🏠',
  min_volume  NUMERIC(18,2) DEFAULT 30000
);

INSERT INTO real_estate_types (name, price_eur, daily_rent, emoji, min_volume) VALUES
  ('Garage',        5000,   50,  '🏗️', 30000),
  ('Apartment',    15000,  180,  '🏢', 50000),
  ('Haus',         40000,  500,  '🏠', 80000),
  ('Villa',       100000, 1400,  '🏰', 150000),
  ('Wolkenkratzer',250000, 3800, '🏙️', 300000);

CREATE TABLE real_estate (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type_id       INT REFERENCES real_estate_types(id),
  last_collect  TIMESTAMPTZ DEFAULT NOW(),
  purchased_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8) COLLECTIBLES
CREATE TABLE collectible_types (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  price_eur   NUMERIC(18,2) NOT NULL,
  emoji       TEXT DEFAULT '💎',
  min_volume  NUMERIC(18,2) DEFAULT 10000
);

INSERT INTO collectible_types (name, price_eur, emoji, min_volume) VALUES
  ('Goldbarren',      2000, '🥇', 10000),
  ('Diamant',         5000, '💎', 20000),
  ('Rolex',          10000, '⌚', 30000),
  ('Lamborghini',    50000, '🏎️', 60000),
  ('Yacht',         120000, '🛥️', 100000),
  ('Privatjet',     300000, '✈️', 200000);

CREATE TABLE user_collectibles (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id      UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type_id         INT REFERENCES collectible_types(id),
  purchase_price  NUMERIC(18,2),
  purchased_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 9) ACHIEVEMENTS
CREATE TABLE user_achievements (
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id INT NOT NULL,
  earned_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (profile_id, achievement_id)
);

-- 10) SEASONS
CREATE TABLE seasons (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  status      TEXT DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 11) FEE_POOL
CREATE TABLE fee_pool (
  id          SERIAL PRIMARY KEY,
  season_id   INT REFERENCES seasons(id),
  amount      NUMERIC(18,2) DEFAULT 0,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 12) DELETION_REQUESTS
CREATE TABLE deletion_requests (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HELPER & VIEWS
-- ============================================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.telegram_id,
  p.username,
  p.first_name,
  p.balance,
  p.total_volume,
  p.is_pro,
  p.avatar_url,
  COALESCE(SUM(a.amount * cp.price_eur), 0) AS portfolio_value,
  p.balance + COALESCE(SUM(a.amount * cp.price_eur), 0) AS net_worth
FROM profiles p
LEFT JOIN assets a ON a.profile_id = p.id AND a.amount > 0
LEFT JOIN current_prices cp ON cp.symbol = a.symbol
GROUP BY p.id
ORDER BY net_worth DESC;

CREATE INDEX idx_pro_bg_cleanup ON profiles (background_disabled_at) WHERE background_disabled_at IS NOT NULL;
Falls du die DB nicht neu aufsetzen willst, hier die Migration für bestehende Daten:
-- Migration v0.2 → v0.3 (nur ausführen wenn DB bereits existiert)
ALTER TABLE leveraged_positions ADD COLUMN IF NOT EXISTS order_id TEXT UNIQUE;
ALTER TABLE leveraged_positions ADD COLUMN IF NOT EXISTS stop_loss NUMERIC(18,2);
ALTER TABLE leveraged_positions ADD COLUMN IF NOT EXISTS take_profit NUMERIC(18,2);
ALTER TABLE leveraged_positions ADD COLUMN IF NOT EXISTS limit_price NUMERIC(18,2);
ALTER TABLE leveraged_positions ADD COLUMN IF NOT EXISTS trailing_stop BOOLEAN DEFAULT FALSE;
ALTER TABLE leveraged_positions ADD COLUMN IF NOT EXISTS is_limit_order BOOLEAN DEFAULT FALSE;
ALTER TABLE leveraged_positions ADD COLUMN IF NOT EXISTS entry_time TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE leveraged_positions ADD COLUMN IF NOT EXISTS close_time TIMESTAMPTZ;
ALTER TABLE leveraged_positions ADD COLUMN IF NOT EXISTS close_price NUMERIC(18,2);

-- Bestehende Positionen mit Order-IDs nachfüllen
UPDATE leveraged_positions SET order_id = CONCAT(
  CASE WHEN direction = 'LONG' THEN 'L-' ELSE 'S-' END,
  UPPER(LEFT(REPLACE(id::TEXT, '-', ''), 8))
) WHERE order_id IS NULL;

-- Danach NOT NULL setzen
ALTER TABLE leveraged_positions ALTER COLUMN order_id SET NOT NULL;

-- Spalten-Rename falls opened_at/closed_at existieren
ALTER TABLE leveraged_positions RENAME COLUMN opened_at TO entry_time;
ALTER TABLE leveraged_positions RENAME COLUMN closed_at TO close_time;
ALTER TABLE leveraged_positions RENAME COLUMN exit_price TO close_price;

-- Neuer Index für atomare Closes
CREATE INDEX IF NOT EXISTS idx_lev_pos_open ON leveraged_positions(status) WHERE status = 'OPEN';

-- Profiles erweitern
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username_changes INT DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by BIGINT;

-- Collectibles erweitern
ALTER TABLE user_collectibles ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(18,2);