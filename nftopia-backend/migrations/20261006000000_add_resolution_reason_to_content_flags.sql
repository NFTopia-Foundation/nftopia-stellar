-- Persist the optional moderator rationale attached to a resolved flag.
ALTER TABLE content_flags ADD COLUMN IF NOT EXISTS resolution_reason TEXT;
