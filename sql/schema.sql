-- ============================================================
-- VALUETRADEGAME - Supabase Schema v0.2
-- ============================================================

-- 1) PROFILES (Erweitert um Pro-Hintergrund & Boni)
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
  avatar_url                TEXT,
  background_url            TEXT DEFAULT NULL,            -- NEU: Pro-Hintergrund
  background_disabled_at    TIMESTAMPTZ DEFAULT NULL,     -- NEU: Cleanup Tracker
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
  type        TEXT NOT NULL, -- 'buy','sell','fee','rent','bailout','leverage_open','leverage_close','leverage_liquidated','achievement_reward'
  symbol      TEXT,
  amount      NUMERIC(18,8),
  price_eur   NUMERIC(18,2),
  fee_eur     NUMERIC(18,2) DEFAULT 0,
  total_eur   NUMERIC(18,2),
  details     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6) LEVERAGED_POSITIONS (Refactored für v0.2)
CREATE TABLE leveraged_positions (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id        UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol            TEXT NOT NULL,
  direction         TEXT CHECK (direction IN ('LONG', 'SHORT')),
  leverage          INTEGER NOT NULL,
  collateral        NUMERIC(18,2) NOT NULL,
  entry_price       NUMERIC(18,2) NOT NULL,
  exit_price        NUMERIC(18,2),
  liquidation_price NUMERIC(18,2) NOT NULL,
  pnl               NUMERIC(18,2) DEFAULT 0,
  equity_at_close   NUMERIC(18,2),
  status            TEXT DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'CLOSED', 'LIQUIDATED')),
  liquidation_reason TEXT,
  opened_at         TIMESTAMPTZ DEFAULT NOW(),
  closed_at         TIMESTAMPTZ
);
CREATE INDEX idx_lev_pos_profile ON leveraged_positions(profile_id, status);

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
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type_id       INT REFERENCES collectible_types(id),
  purchased_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 9) ACHIEVEMENTS
CREATE TABLE user_achievements (
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id INT NOT NULL,
  earned_at     TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (profile_id, achievement_id)
);

-- 10) DELETION_REQUESTS (Sicherheit)
CREATE TABLE deletion_requests (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- HELPER & VIEWS
-- ============================================================

-- Auto-Update Timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Erweitertes Leaderboard
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.telegram_id,
  p.username,
  p.first_name,
  p.balance,
  p.total_volume,
  p.is_pro,
  COALESCE(SUM(a.amount * cp.price_eur), 0) AS portfolio_value,
  p.balance + COALESCE(SUM(a.amount * cp.price_eur), 0) AS net_worth
FROM profiles p
LEFT JOIN assets a ON a.profile_id = p.id AND a.amount > 0
LEFT JOIN current_prices cp ON cp.symbol = a.symbol
GROUP BY p.id
ORDER BY net_worth DESC;

-- Pro-Hintergrund Cleanup Index
CREATE INDEX idx_pro_bg_cleanup ON profiles (background_disabled_at) WHERE background_disabled_at IS NOT NULL;
