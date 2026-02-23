-- ==============================================
-- v0.3.21 SQL Migration
-- Nur ausführen falls bonus_received noch nicht existiert
-- ==============================================

-- 1. bonus_received Spalte hinzufügen (ignoriert Fehler wenn bereits vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'bonus_received'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bonus_received NUMERIC DEFAULT 0;
  END IF;
END $$;

-- 2. Sicherstellen dass alle NULL-Werte auf 0 gesetzt werden
UPDATE profiles SET bonus_received = 0 WHERE bonus_received IS NULL;

-- 3. Retroaktiv: Story-Bonus-Empfänger nachträglich korrigieren
UPDATE profiles 
SET bonus_received = COALESCE(bonus_received, 0) + 1000 
WHERE story_bonus_claimed = true 
  AND bonus_received = 0;

-- 4. Retroaktiv: Mieteinnahmen nachträglich korrigieren
UPDATE profiles p 
SET bonus_received = COALESCE(p.bonus_received, 0) + COALESCE(rent_total.total, 0)
FROM (
  SELECT profile_id, SUM(ABS(total_eur)) as total 
  FROM transactions 
  WHERE type = 'rent' 
  GROUP BY profile_id
) rent_total
WHERE p.id = rent_total.profile_id
  AND p.bonus_received = 0;

-- 5. Referral-Boni nachträglich korrigieren  
UPDATE profiles p
SET bonus_received = COALESCE(p.bonus_received, 0) + COALESCE(ref_total.total, 0)
FROM (
  SELECT referred_by as telegram_id, COUNT(*) * 500 as total
  FROM profiles
  WHERE referred_by IS NOT NULL
  GROUP BY referred_by
) ref_total
WHERE p.telegram_id = ref_total.telegram_id
  AND p.bonus_received <= 1000;

-- Fertig
SELECT 'v0.3.21 Migration abgeschlossen' AS status;
