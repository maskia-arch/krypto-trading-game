-- ============================================================
-- KRYPTO TRADING GAME - Supabase Schema
-- ============================================================

-- 1) PROFILES
CREATE TABLE profiles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  telegram_id   BIGINT UNIQUE NOT NULL,
  username      TEXT,
  first_name    TEXT,
  balance       NUMERIC(18,2) DEFAULT 10000.00,
  total_volume  NUMERIC(18,2) DEFAULT 0.00,       -- Gesamt-Umsatz
  bailout_count INT DEFAULT 0,                     -- Rettungsschirm-Zähler
  bailout_last  TIMESTAMPTZ,                       -- Letzter Rettungsschirm
  is_pro        BOOLEAN DEFAULT FALSE,
  pro_until     TIMESTAMPTZ,
  is_admin      BOOLEAN DEFAULT FALSE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2) ASSETS (Krypto-Bestand pro User)
CREATE TABLE assets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,                        -- 'BTC', 'ETH', 'LTC'
  amount      NUMERIC(18,8) DEFAULT 0,
  avg_buy     NUMERIC(18,2) DEFAULT 0,             -- Durchschnittlicher Kaufpreis
  first_buy   TIMESTAMPTZ,                         -- Für Haltedauer-Check
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id, symbol)
);

-- 3) MARKET_HISTORY (Minuten-Preise aus CoinGecko)
CREATE TABLE market_history (
  id          BIGSERIAL PRIMARY KEY,
  symbol      TEXT NOT NULL,
  price_eur   NUMERIC(18,2) NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_market_symbol_time ON market_history(symbol, recorded_at DESC);

-- 4) CURRENT_PRICES (Cache für aktuellen Kurs)
CREATE TABLE current_prices (
  symbol      TEXT PRIMARY KEY,
  price_eur   NUMERIC(18,2) NOT NULL,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 5) TRANSACTIONS (Kauf/Verkauf History + Fees)
CREATE TABLE transactions (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN ('buy','sell','fee','rent','bailout','leverage')),
  symbol      TEXT,
  amount      NUMERIC(18,8),
  price_eur   NUMERIC(18,2),
  fee_eur     NUMERIC(18,2) DEFAULT 0,
  total_eur   NUMERIC(18,2),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 6) FEE_POOL (Globaler Gebühren-Topf)
CREATE TABLE fee_pool (
  id          INT PRIMARY KEY DEFAULT 1,
  total_eur   NUMERIC(18,2) DEFAULT 0,
  season_id   UUID,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO fee_pool (id, total_eur) VALUES (1, 0) ON CONFLICT DO NOTHING;

-- 7) SEASONS (Wettbewerb)
CREATE TABLE seasons (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT NOT NULL,
  start_date  TIMESTAMPTZ NOT NULL,
  end_date    TIMESTAMPTZ NOT NULL,
  fee_pool    NUMERIC(18,2) DEFAULT 0,
  is_active   BOOLEAN DEFAULT TRUE,
  winners     JSONB,                                -- {1st: {id, amount}, 2nd: ...}
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 8) REAL_ESTATE (Immobilien)
CREATE TABLE real_estate_types (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  price_eur   NUMERIC(18,2) NOT NULL,
  daily_rent  NUMERIC(18,2) NOT NULL,               -- Tägliche Mieteinnahmen
  emoji       TEXT DEFAULT '🏠',
  min_volume  NUMERIC(18,2) DEFAULT 30000            -- Mindest-Umsatz
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

-- 9) COLLECTIBLES / BESITZTÜMER
CREATE TABLE collectible_types (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  price_eur   NUMERIC(18,2) NOT NULL,
  emoji       TEXT DEFAULT '💎',
  min_volume  NUMERIC(18,2) DEFAULT 10000,
  min_hold_h  INT DEFAULT 1                         -- Min. Haltedauer in Stunden
);

INSERT INTO collectible_types (name, price_eur, emoji, min_volume, min_hold_h) VALUES
  ('Goldbarren',      2000, '🥇', 10000, 1),
  ('Diamant',         5000, '💎', 20000, 2),
  ('Rolex',          10000, '⌚', 30000, 3),
  ('Lamborghini',    50000, '🏎️', 60000, 5),
  ('Yacht',         120000, '🛥️', 100000, 8),
  ('Privatjet',     300000, '✈️', 200000, 12);

CREATE TABLE collectibles (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type_id       INT REFERENCES collectible_types(id),
  purchased_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 10) PRICE_ALERTS (Pro Feature)
CREATE TABLE price_alerts (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol      TEXT NOT NULL,
  target_price NUMERIC(18,2) NOT NULL,
  direction   TEXT CHECK (direction IN ('above','below')),
  triggered   BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 11) PRO_REQUESTS (Kauf-Anfragen)
CREATE TABLE pro_requests (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id  UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 12) LEVERAGE_POSITIONS (Pro Feature - Hebelwetten)
CREATE TABLE leverage_positions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id    UUID REFERENCES profiles(id) ON DELETE CASCADE,
  symbol        TEXT NOT NULL,
  direction     TEXT CHECK (direction IN ('long','short')),
  leverage      INT DEFAULT 2 CHECK (leverage BETWEEN 2 AND 10),
  entry_price   NUMERIC(18,2) NOT NULL,
  amount_eur    NUMERIC(18,2) NOT NULL,
  liquidation   NUMERIC(18,2) NOT NULL,
  is_open       BOOLEAN DEFAULT TRUE,
  exit_price    NUMERIC(18,2),
  pnl           NUMERIC(18,2),
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  closed_at     TIMESTAMPTZ
);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Auto-Update updated_at
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_profiles_updated
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER trg_assets_updated
  BEFORE UPDATE ON assets FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Leaderboard View
CREATE OR REPLACE VIEW leaderboard AS
SELECT
  p.id,
  p.telegram_id,
  p.username,
  p.first_name,
  p.balance,
  p.total_volume,
  COALESCE(SUM(a.amount * cp.price_eur), 0) AS portfolio_value,
  p.balance + COALESCE(SUM(a.amount * cp.price_eur), 0) AS net_worth
FROM profiles p
LEFT JOIN assets a ON a.profile_id = p.id AND a.amount > 0
LEFT JOIN current_prices cp ON cp.symbol = a.symbol
GROUP BY p.id
ORDER BY net_worth DESC;

-- RLS Policies (optional, für direkte Supabase-Zugriffe)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
