-- ============================================================
-- MIGRATION: v0.3.32 — Glücksrad: Nur Cash + Crypto Gewinne
-- ============================================================

-- Feature-Felder aus spin_config entfernen
DELETE FROM spin_config WHERE reward_type = 'feature';

-- Bestehende Felder löschen und neu anlegen (sauberer Reset)
DELETE FROM spin_config;

-- FREE Rad: Nur Cash + Crypto
INSERT INTO spin_config (tier, label, reward_type, reward_value, reward_symbol, reward_detail, probability, color, sort_order) VALUES
  ('free', '50€',        'cash',   50,     NULL,  NULL, 0.30, '#22d68a', 1),
  ('free', '100€',       'cash',   100,    NULL,  NULL, 0.25, '#38bdf8', 2),
  ('free', '250€',       'cash',   250,    NULL,  NULL, 0.15, '#a78bfa', 3),
  ('free', '500€',       'cash',   500,    NULL,  NULL, 0.05, '#fbbf24', 4),
  ('free', '0.001 BTC',  'crypto', 0.001,  'BTC', NULL, 0.10, '#f97316', 5),
  ('free', '0.01 ETH',   'crypto', 0.01,   'ETH', NULL, 0.10, '#6366f1', 6),
  ('free', '0.1 LTC',    'crypto', 0.1,    'LTC', NULL, 0.05, '#38bdf8', 7);

-- PRO Rad: Bis zu 5x mehr Gewinne
INSERT INTO spin_config (tier, label, reward_type, reward_value, reward_symbol, reward_detail, probability, color, sort_order) VALUES
  ('pro', '250€',           'cash',   250,    NULL,  NULL, 0.25, '#fbbf24', 1),
  ('pro', '500€',           'cash',   500,    NULL,  NULL, 0.20, '#f59e0b', 2),
  ('pro', '1.000€',         'cash',   1000,   NULL,  NULL, 0.15, '#eab308', 3),
  ('pro', '2.500€',         'cash',   2500,   NULL,  NULL, 0.05, '#fbbf24', 4),
  ('pro', '0.005 BTC',      'crypto', 0.005,  'BTC', NULL, 0.12, '#f97316', 5),
  ('pro', '0.05 ETH',       'crypto', 0.05,   'ETH', NULL, 0.12, '#6366f1', 6),
  ('pro', '0.5 LTC',        'crypto', 0.5,    'LTC', NULL, 0.06, '#38bdf8', 7),
  ('pro', '5.000€ JACKPOT', 'cash',   5000,   NULL,  NULL, 0.05, '#fbbf24', 8);
