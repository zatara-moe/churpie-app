// Moments, ready-made prompts and vibes. Copy follows the voice guide: specific, active, no exclamation marks.
// The same file is served to the browser via /api/catalog so the pages never go out of sync.

// Each prompt is a question asked to the person recording, about the person the card is for. {name} becomes
// their first name everywhere it appears, so a question never says "them" when it means two different people.
// ideas: other good questions for the same moment, offered under "Need an idea?".
export const MOMENTS = [
  { id: 'birthday', label: 'Birthday', icon: 'cake', prompt: "What's your favorite memory with {name}? End with a birthday wish.", ideas: ["What's one thing {name} taught you?", 'What do you hope this year brings {name}?', 'Describe {name} in three words, then explain one.'], tone: 'funny', vibe: 'postcard' },
  { id: 'congrats', label: 'Graduation & congrats', icon: 'graduation-cap', prompt: 'What are you proudest of {name} for?', ideas: ["What did you see {name} push through to get here?", 'What advice would you give {name} for what comes next?', "What's one moment you knew {name} would make it?"], tone: 'hype', vibe: 'confettipop' },
  { id: 'welcome', label: 'Welcome home', icon: 'house', prompt: "What's the first thing you want to do with {name} now that they're home?", ideas: ['What did you miss most while {name} was away?', 'What has {name} missed that they need to hear about?'], tone: 'heartfelt', vibe: 'airmail' },
  { id: 'getwell', label: 'Get well', icon: 'hand-heart', prompt: "What can't you wait to do with {name} again?", ideas: ['What do you want {name} to know right now?', "What's a memory with {name} that always makes you smile?"], tone: 'heartfelt', vibe: 'quietnote' },
  { id: 'retirement', label: 'Retirement', icon: 'clock-countdown', prompt: 'What will you miss most about working with {name}?', ideas: ["What should {name} do first with all that free time?", "What's your favorite story from working with {name}?"], tone: 'funny', vibe: 'kraft' },
  { id: 'thankyou', label: 'Thank you', icon: 'heart', prompt: 'What do you want to thank {name} for?', ideas: ['Finish this sentence: because of you, I...', 'When did {name} show up for you when it mattered?'], tone: 'heartfelt', vibe: 'milestonegold' },
  { id: 'team', label: 'Team send-off', icon: 'users-three', prompt: 'What will you miss most about working with {name}?', ideas: ["What's one thing {name} made better around here?", 'What do you wish {name} luck with next?'], tone: 'funny', vibe: 'kraft' },
  { id: 'missyou', label: 'Miss you', icon: 'paper-plane-tilt', prompt: 'What do you miss most about {name}?', ideas: ["What do you keep wanting to tell {name}?", "What's the first thing you'll do together next time?"], tone: 'heartfelt', vibe: 'airmail' },
  { id: 'memory', label: 'In memory', icon: 'flower-lotus', prompt: "What's one small moment with {name} you still think about?", ideas: ['What did {name} teach you that you still carry?', 'What would you tell {name} if you could?'], tone: 'quiet', vibe: 'pressedflower' },
  { id: 'brand', label: 'For a business', icon: 'users-four', prompt: "Tell your first-day story, and say where you're from.", ideas: ['What do you love about working here?'], tone: 'heartfelt', vibe: 'postcard' },
]

// Each theme lists the moments it suits, so an "in memory" frame can never sit on a birthday (and confetti never on a memorial).
// A card theme sets the frame around the reel (both the story and the wide file), the stickers and the music. One choice, not three.
export const VIBES = [
  { id: 'postcard', label: 'Postcard', for: 'birthdays and everyday', music: 'uplifting', moments: ['birthday', 'congrats', 'welcome', 'retirement', 'thankyou', 'getwell', 'missyou', 'team', 'brand'] },
  { id: 'milestonegold', label: 'Milestone gold', for: 'big birthdays and anniversaries', music: 'warm-acoustic', moments: ['birthday', 'congrats', 'retirement', 'thankyou', 'team', 'brand'] },
  { id: 'airmail', label: 'Airmail', for: 'welcome home, far away', music: 'warm-acoustic', moments: ['birthday', 'welcome', 'retirement', 'thankyou', 'getwell', 'missyou', 'team'] },
  { id: 'quietnote', label: 'Quiet note', for: 'get well, hard moments', music: 'gentle-piano', moments: ['welcome', 'thankyou', 'getwell', 'missyou', 'memory'] },
  { id: 'kraft', label: 'Kraft parcel', for: 'holidays and big groups', music: 'warm-acoustic', moments: ['birthday', 'congrats', 'welcome', 'retirement', 'thankyou', 'missyou', 'team', 'brand'] },
  { id: 'pressedflower', label: 'Pressed flower', for: 'in memory', music: 'gentle-piano', moments: ['memory'] },
  { id: 'confettipop', label: 'Confetti pop', for: "kids' birthdays", music: 'uplifting', moments: ['birthday', 'congrats'] },
  { id: 'lockernote', label: 'Locker note', for: 'teens and friend shout-outs', music: 'uplifting', moments: ['birthday', 'congrats', 'welcome', 'thankyou', 'getwell', 'missyou'] },
]

export const TONES = [
  { id: 'funny', label: 'Fun', hint: 'a laugh is welcome' },
  { id: 'heartfelt', label: 'Heartfelt', hint: 'say the real thing' },
  { id: 'hype', label: 'Big energy', hint: 'cheer them on' },
  { id: 'quiet', label: 'Gentle', hint: 'slow down, plain words' },
]

export const RULE_SUGGESTIONS = ['Say your name first', "Don't mention the party", 'Hold your phone upright', 'Wear something red', 'Kids welcome']

// The themes that suit a moment, the moment's own default first.
export function vibesFor(momentId) {
  const m = MOMENTS.find((x) => x.id === momentId)
  const fits = VIBES.filter((v) => v.moments.includes(momentId))
  return m ? [...fits.filter((v) => v.id === m.vibe), ...fits.filter((v) => v.id !== m.vibe)] : fits
}
