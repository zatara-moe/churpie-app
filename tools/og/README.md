# Link-preview images

`public/og/` holds the 1200×630 images shown when a churpie link is shared (iMessage, WhatsApp, Facebook, Slack, X).

| File | Used for |
| --- | --- |
| `<theme>.png` | An invite link (`/c/…`), in the card's theme. Also shown on the occasion pages. |
| `reel-<theme>.png` | A finished reel link (`/w/…`), in the card's theme. |
| `site.png` | Home, start a card, compare, privacy. |
| `birthday.png`, `retirement.png`, `get-well.png`, `memorial.png` | The occasion pages. |

No people or silhouettes: each message is a stamp with an initial, the same faces the card page uses.

To change the words or look, edit `og.html` (layout and themes) and `render.mjs` (the words), then run:

```
node tools/og/render.mjs
```

Keep each image under 300 KB (WhatsApp skips bigger ones). render.mjs writes full-color PNGs; squeeze them with any PNG optimizer, for example `pngquant --force --ext .png public/og/*.png`.

Apps cache previews by URL, so an old image can linger in a chat for a while after a change.
