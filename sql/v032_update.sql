-- =====================================================
-- V0.3.2 SQL Updates für Supabase
-- Einfach in den Supabase SQL-Editor kopieren und ausführen
-- =====================================================

-- 1. RPC Funktion: Transaktions-Count pro User
-- (wird vom Leaderboard genutzt um inaktive User auszufiltern)
CREATE OR REPLACE FUNCTION get_user_tx_counts()
RETURNS TABLE(profile_id uuid, tx_count bigint) AS $$
  SELECT profile_id, COUNT(*) as tx_count
  FROM transactions
  WHERE type IN ('buy', 'sell', 'LEVERAGE_OPEN', 'LEVERAGE_CLOSE', 'LIQUIDATION')
  GROUP BY profile_id;
$$ LANGUAGE sql STABLE;


-- 2. View: Aktive Spieler für Rangliste
-- Nur Spieler mit mindestens 1 Trading-Transaktion
CREATE OR REPLACE VIEW active_leaderboard_players AS
SELECT p.*
FROM profiles p
WHERE EXISTS (
  SELECT 1 FROM transactions t 
  WHERE t.profile_id = p.id 
  AND t.type IN ('buy', 'sell', 'LEVERAGE_OPEN', 'LEVERAGE_CLOSE', 'LIQUIDATION')
);


-- 3. FIX: Story Bonus nachträglich in bonus_received aufnehmen
-- Spieler die den Story Bonus bekommen haben aber wo er nicht in 
-- bonus_received getrackt wurde
UPDATE profiles 
SET bonus_received = COALESCE(bonus_received, 0) + 1000
WHERE story_bonus_claimed = true
AND id NOT IN (
  -- Nur wenn der Bonus noch nicht in bonus_received enthalten ist
  -- Sicherheits-Check: Wenn bonus_received bereits >= 1000 sein könnte
  -- durch andere Boni, dann nur updaten wenn story_bonus NICHT schon drin ist
  SELECT p.id FROM profiles p
  WHERE p.story_bonus_claimed = true
  AND p.bonus_received >= 1000
  AND EXISTS (
    SELECT 1 FROM transactions t 
    WHERE t.profile_id = p.id 
    AND t.symbol = 'STORY' 
    AND t.type = 'achievement_reward'
  )
);

-- Alternativ-Version (sicherer, einzeln ausführen falls oben Probleme macht):
-- UPDATE profiles SET bonus_received = COALESCE(bonus_received, 0) + 1000 
-- WHERE story_bonus_claimed = true AND COALESCE(bonus_received, 0) < 1000;


-- 4. FIX: Mieteinnahmen nachträglich in bonus_received aufnehmen
-- Berechne die Summe aller bisherigen Mieteinnahmen pro Spieler
-- und addiere sie zu bonus_received
WITH rent_totals AS (
  SELECT profile_id, SUM(COALESCE(total_eur, 0)) as total_rent
  FROM transactions
  WHERE type = 'rent'
  GROUP BY profile_id
)
UPDATE profiles p
SET bonus_received = COALESCE(p.bonus_received, 0) + rt.total_rent
FROM rent_totals rt
WHERE p.id = rt.profile_id
AND rt.total_rent > 0;


-- 5. Sicherstellung: bonus_received darf nicht NULL sein
UPDATE profiles SET bonus_received = 0 WHERE bonus_received IS NULL;
