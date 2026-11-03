# The home-page demo reel

`public/demo/reel.mp4` is the silent loop taped inside the postcard on the home page. It's built from free stock clips (Pexels and Mixkit; no attribution required, commercial use allowed) so the site looks finished before any real cards exist. Real reels can replace it later by dropping a file at the same path.

## Change it in three steps

1. Open `demo/reel.txt`. Each line is one moment: which clip, where it starts, how long, how it's framed, the name sticker, the place sticker. Reorder lines, change names, swap clips, trim seconds.
2. In Terminal: `./demo/build.sh` (about a minute).
3. `npx wrangler deploy`.

To see every clip at a glance, run `./demo/build.sh sheet` and open `demo/contact-sheet.png`.

## Change who the card is for

The caption under the card ("happy 60th, Rosa") and the stamp ("38 showed up") live in `public/index.html`. Search for `happy 60th` and `38`.

## Add new clips

Drop an `.mp4` into `demo/clips/` with the next number (`clip-14.mp4`). Any size works; the build scales it. Look for people facing the camera: the viewer should feel waved at. Vertical clips use `crop`, horizontal ones with more than one person use `blur`.

## What makes it work

- 1.5–2.2 seconds per person. Long enough to see a face, short enough to feel like a reel.
- Alternate one face and a group. End on a warm gesture; it loops back to a wave.
- Silent. It autoplays on phones only because it's muted.
- Name stickers are the same style the real reels get.
