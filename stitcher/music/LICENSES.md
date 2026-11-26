# Music in Churpie reels

Every track sits quietly under the voices. `prepare.sh` holds each one at a steady -18 LUFS from start to finish, so a track that builds up never climbs over anyone. The reel maker picks a mood from the occasion, then the card theme, then the vibe. Within a mood, the card's id picks the track (see `pickMusic` in `stitch.js`).

To add a track, download it, run `./stitcher/music/prepare.sh <file> <mood>-<n>`, add a row below, push, and redeploy the reel maker.

Moods: `holiday`, `celebration`, `beat`, `slowdance`, `lullaby`, `reflective`, `everyday`.

**Pixabay tracks** are used under the [Pixabay Content License](https://pixabay.com/service/license-summary/): free for commercial use, with no attribution required. You can't sell or redistribute a track on its own. Each track's page showed no "Content ID Registered" label when it was downloaded. If a reel is ever flagged, check the track's page and swap the track out.

| File | Track | Artist | Source | License | Downloaded |
| --- | --- | --- | --- | --- | --- |
| holiday-1 | Angels We Have Heard on High (grand piano) | JuliusH | [Pixabay](https://pixabay.com/music/christmas-angels-we-have-heard-on-high-grand-piano-french-christmas-carol-1881/) | Pixabay Content License | 2026-11-25 |
| holiday-2 | Ambient Background Music for Winter and Christmas | JuliusH | [Pixabay](https://pixabay.com/music/christmas-ambient-background-music-for-winter-and-christmas-432410/) | Pixabay Content License | 2026-11-25 |
| celebration-1 | Happy Ukulele | ElectroAnimals | [Pixabay](https://pixabay.com/music/happy-childrens-tunes-happy-ukulele-600364/) | Pixabay Content License | 2026-11-25 |
| celebration-2 | Joyous Piano "Stratosphere" | Matthew_C_Wright | [Pixabay](https://pixabay.com/music/classical-piano-joyous-copyright-free-piano-quotstratospherequot-586797/) | Pixabay Content License | 2026-11-25 |
| beat-1 | Serendipity | PurrpleCat | [Pixabay](https://pixabay.com/music/beats-serendipity-635081/) | Pixabay Content License | 2026-11-25 |
| beat-2 | Long Day | PurrpleCat | [Pixabay](https://pixabay.com/music/beats-long-day-518602/) | Pixabay Content License | 2026-11-25 |
| beat-3 | Embrace | PurrpleCat | [Pixabay](https://pixabay.com/music/beats-embrace-631605/) | Pixabay Content License | 2026-11-25 |
| slowdance-1 | Pachelbel, Canon in D (piano) | GregorQuendel | [Pixabay](https://pixabay.com/music/classical-piano-pachelbel-canon-in-d-p-37-arranged-for-piano-227465/) | Pixabay Content License | 2026-11-25 |
| slowdance-2 | Piano Orchestra Ballad in D Major | JuliusH | [Pixabay](https://pixabay.com/music/modern-jazz-piano-orchestra-ballad-in-d-major-3691/) | Pixabay Content License | 2026-11-25 |
| slowdance-3 | Romantic Piano | AtlasAudio | [Pixabay](https://pixabay.com/music/solo-piano-romantic-piano-631946/) | Pixabay Content License | 2026-11-25 |
| slowdance-4 | Chopin, Waltz No. 10 Op. 69 No. 2 | GregorQuendel | [Pixabay](https://pixabay.com/music/modern-classical-chopin-waltz-no-10-op-69-no-2-239268/) | Pixabay Content License | 2026-11-25 |
| lullaby-1 | Music Box in the Rafters | u_temc2vqpw4 | [Pixabay](https://pixabay.com/music/lullabies-music-box-in-the-rafters-633387/) | Pixabay Content License | 2026-11-25 |
| lullaby-2 | Brahms Lullaby (music box) | GregorQuendel | [Pixabay](https://pixabay.com/music/lullabies-brahms-lullaby-wiegenlied-op49-no4-music-box-version-2-229418/) | Pixabay Content License | 2026-11-25 |
| reflective-1 | Satie, Gymnopédie No. 1 | Musopen | [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Erik_Satie_-_gymnopedies_-_la_1_ere._lent_et_douloureux.ogg) | Public domain | 2026-11-25 |
| reflective-2 | Peaceful Minimal Piano "A Big Full Heart" | Matthew_C_Wright | [Pixabay](https://pixabay.com/music/solo-piano-peaceful-minimal-piano-quota-big-full-heartquot-614208/) | Pixabay Content License | 2026-11-25 |
| reflective-3 | Amazing Grace (piano) | GregorQuendel | [Pixabay](https://pixabay.com/music/classical-piano-amazing-grace-william-walker-version-1835-arranged-for-piano-239125/) | Pixabay Content License | 2026-11-25 |
| everyday-1 | Guitar "Espresso Brown" | Matthew_C_Wright | [Pixabay](https://pixabay.com/music/solo-guitar-royalty-free-guitar-quotespresso-brownquot-640052/) | Pixabay Content License | 2026-11-25 |
| everyday-2 | Guitar "Comfy Cozy" | Matthew_C_Wright | [Pixabay](https://pixabay.com/music/solo-guitar-royalty-free-guitar-quotcomfy-cozyquot-621448/) | Pixabay Content License | 2026-11-25 |
| everyday-3 | Dreamy Jazz (piano and strings) | JuliusH | [Pixabay](https://pixabay.com/music/traditional-jazz-dreamy-jazz-slow-background-jazz-music-piano-and-seattle-strings-9998/) | Pixabay Content License | 2026-11-25 |
| celebration-churpie | Churpie's own (ukulele, glockenspiel) | Churpie | `compose.py` | Owned by Churpie | n/a |
| everyday-churpie | Churpie's own (guitar, piano) | Churpie | `compose.py` | Owned by Churpie | n/a |
| reflective-churpie | Churpie's own (solo piano) | Churpie | `compose.py` | Owned by Churpie | n/a |

`silence.mp3` is a blank placeholder, not music.
