-- ============================================================
-- v0.3.24 Migration: Admin/Timezone Fix
-- ============================================================

-- Fehlende last_active Spalte hinzufügen
-- (wurde von auth.js referenziert, existierte aber nie im Schema)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_active TIMESTAMPTZ DEFAULT NOW();

-- Bestehende Profiles: last_active aus updated_at nachfüllen
UPDATE profiles SET last_active = COALESCE(updated_at, created_at) WHERE last_active IS NULL;
