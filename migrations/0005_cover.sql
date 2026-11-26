-- churpie · the cover a host designs: a song of their own, a headline, and a photo of the person.
-- src/index.js (coverDb) adds these on first use, so running this by hand is optional.
ALTER TABLE cards ADD COLUMN song TEXT;            -- a track id from src/catalog.js SONGS, or NULL to let the reel maker pick
ALTER TABLE cards ADD COLUMN cover_headline TEXT;  -- their own first line ("Good luck at State,"), or NULL for the occasion's
ALTER TABLE cards ADD COLUMN cover_photo_key TEXT; -- clips/:card_id/cover.(jpg|png|webp) in R2, deleted with the card
