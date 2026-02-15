-- Add metadata and lifecycle fields to games (universes)
ALTER TABLE games ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE games ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;
ALTER TABLE games ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true NOT NULL;
ALTER TABLE games ADD COLUMN IF NOT EXISTS updated_at timestamptz;
