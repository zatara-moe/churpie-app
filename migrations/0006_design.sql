-- churpie · a cover built layer by layer. src/index.js (coverDb) adds this on first use; running it by hand is optional.
ALTER TABLE cards ADD COLUMN cover_design TEXT;    -- a design built layer by layer (JSON: paper, edge, decor, fall, type, accent), or NULL for the look as made
