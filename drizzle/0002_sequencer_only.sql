-- Replace the old song-with-versions/slots/takes/mixes model with a single
-- jsonb blob on `songs`. The sequencer owns its own state shape end-to-end.
-- Any existing songs were pre-sequencer data; the new editor wouldn't know
-- how to render them, so we clear them rather than ship invalid blobs.
TRUNCATE TABLE "songs" CASCADE;
DROP TABLE IF EXISTS "read_state" CASCADE;
DROP TABLE IF EXISTS "activities" CASCADE;
DROP TABLE IF EXISTS "comments" CASCADE;
DROP TABLE IF EXISTS "reactions" CASCADE;
DROP TABLE IF EXISTS "mix_selections" CASCADE;
DROP TABLE IF EXISTS "mixes" CASCADE;
DROP TABLE IF EXISTS "takes" CASCADE;
DROP TABLE IF EXISTS "slots" CASCADE;
DROP TABLE IF EXISTS "sections" CASCADE;
DROP TABLE IF EXISTS "drum_kit_pads" CASCADE;
DROP TABLE IF EXISTS "drum_kits" CASCADE;
DROP TABLE IF EXISTS "song_versions" CASCADE;

ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "sequencer_data" jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE "songs" ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone NOT NULL DEFAULT now();
ALTER TABLE "songs" ALTER COLUMN "sequencer_data" DROP DEFAULT;
