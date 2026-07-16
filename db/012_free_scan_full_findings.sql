-- Free tool is self-serve, no login: show the user ALL problems in their own repo
-- and let them download a PDF. Store the full (sanitized) findings list, not just a teaser.
-- Deviation from FR-11 gating — deliberate product call: the free scan is a complete tool.
ALTER TABLE free_scans ADD COLUMN IF NOT EXISTS findings JSONB NOT NULL DEFAULT '[]';
