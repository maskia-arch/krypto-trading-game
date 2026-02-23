-- v0.3.22: Story Bonus Exploit Fix
-- Stellt sicher dass story_bonus_claimed existiert und korrigiert Mehrfach-Claims

-- 1. Spalte sicherstellen (falls nicht vorhanden)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'story_bonus_claimed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN story_bonus_claimed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. Exploit-Erkennung: Alle User die Story-Bonus mehrfach kassiert haben
-- Zeigt an wer wie oft kassiert hat (zur Prüfung VOR dem Fix)
SELECT p.telegram_id, p.username, p.first_name, COUNT(*) as claim_count, SUM(t.total_eur) as total_claimed
FROM transactions t
JOIN profiles p ON p.id = t.profile_id
WHERE t.symbol = 'STORY' AND t.type = 'achievement_reward'
GROUP BY p.telegram_id, p.username, p.first_name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;

-- 3. Überschüssiges Geld abziehen (alles über 1x 1000€)
UPDATE profiles p
SET 
  balance = balance - (exploit.extra_claims * 1000),
  bonus_received = GREATEST(0, bonus_received - (exploit.extra_claims * 1000))
FROM (
  SELECT t.profile_id, COUNT(*) - 1 as extra_claims
  FROM transactions t
  WHERE t.symbol = 'STORY' AND t.type = 'achievement_reward'
  GROUP BY t.profile_id
  HAVING COUNT(*) > 1
) exploit
WHERE p.id = exploit.profile_id;

-- 4. Doppelte Story-Transactions löschen (nur die älteste behalten)
DELETE FROM transactions
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (PARTITION BY profile_id ORDER BY created_at ASC) as rn
    FROM transactions
    WHERE symbol = 'STORY' AND type = 'achievement_reward'
  ) ranked
  WHERE rn > 1
);

-- 5. Alle Story-Empfänger auf claimed = true setzen
UPDATE profiles SET story_bonus_claimed = true
WHERE id IN (
  SELECT DISTINCT profile_id FROM transactions 
  WHERE symbol = 'STORY' AND type = 'achievement_reward'
);

SELECT 'v0.3.22 Story Exploit Fix abgeschlossen' AS status;
