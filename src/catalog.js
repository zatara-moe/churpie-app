// Moments, ready-made prompts and vibes. Copy follows the voice guide: specific, active, no exclamation marks.
// The same file is served to the browser via /api/catalog so the pages never go out of sync.

export const MOMENTS = [
  { id: 'birthday', label: 'Birthday', prompt: 'One memory, one wish. Say their name first.', tone: 'funny', vibe: 'postcard' },
  { id: 'congrats', label: 'Congrats', prompt: 'Tell them what you saw them do to get here.', tone: 'hype', vibe: 'confettipop' },
  { id: 'thankyou', label: 'Thank you', prompt: 'Finish this sentence: because of you, I...', tone: 'heartfelt', vibe: 'milestonegold' },
  { id: 'getwell', label: 'Get well', prompt: "One thing you can't wait to do together when they're back.", tone: 'heartfelt', vibe: 'quietnote' },
  { id: 'missyou', label: 'Miss you', prompt: 'The thing you keep wanting to tell them.', tone: 'heartfelt', vibe: 'airmail' },
  { id: 'memory', label: 'In memory', prompt: 'Share one small moment you still think about.', tone: 'quiet', vibe: 'pressedflower' },
  { id: 'team', label: 'Team send-off', prompt: "The one thing we'll miss. Keep it to 15 seconds.", tone: 'funny', vibe: 'kraft' },
  { id: 'brand', label: 'For our customers', prompt: 'Tell us your first-day story, and say where you are from.', tone: 'heartfelt', vibe: 'postcard' },
]

// A card theme sets the frame around the reel (both the story and the wide file), the stickers and the music. One choice, not three.
export const VIBES = [
  { id: 'postcard', label: 'Postcard', for: 'birthdays and everyday', music: 'uplifting' },
  { id: 'milestonegold', label: 'Milestone gold', for: 'big birthdays and anniversaries', music: 'warm-acoustic' },
  { id: 'airmail', label: 'Airmail', for: 'welcome home, far away', music: 'warm-acoustic' },
  { id: 'quietnote', label: 'Quiet note', for: 'get well, hard moments', music: 'gentle-piano' },
  { id: 'kraft', label: 'Kraft parcel', for: 'holidays and big groups', music: 'warm-acoustic' },
  { id: 'pressedflower', label: 'Pressed flower', for: 'in memory', music: 'gentle-piano' },
  { id: 'confettipop', label: 'Confetti pop', for: "kids' birthdays", music: 'uplifting' },
  { id: 'lockernote', label: 'Locker note', for: 'teens and friend shout-outs', music: 'uplifting' },
]

export const TONES = [
  { id: 'funny', hint: 'keep it light' },
  { id: 'heartfelt', hint: 'say the real thing' },
  { id: 'hype', hint: 'big energy, say their name loud' },
  { id: 'quiet', hint: 'slow down, plain words' },
]

export const RULE_SUGGESTIONS = ['Say your name first', "Don't mention the party", 'Hold your phone upright', 'Wear something red', 'Kids welcome']
