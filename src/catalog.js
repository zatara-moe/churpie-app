// Moments, ready-made prompts and vibes. Copy follows the voice guide: specific, active, no exclamation marks.
// The same file is served to the browser via /api/catalog so the pages never go out of sync.

// Each prompt is a question asked to the person recording, about the person the card is for. {name} becomes
// their first name everywhere it appears, so a question never says "them" when it means two different people.
// ideas: other good questions for the same moment, offered under "Need an idea?".
// byTone: one more question for each feeling (fun, heartfelt, big energy, gentle), offered first once the host picks that feeling.
export const MOMENTS = [
  { id: 'birthday', label: 'Birthday', icon: 'cake', prompt: "What's your favorite memory with {name}? End with a birthday wish.", ideas: ["What's one thing {name} taught you?", 'What do you hope this year brings {name}?', 'Describe {name} in three words, then explain one.'], byTone: { funny: "What's the funniest thing {name} has ever done in front of you?", heartfelt: "What do you love about {name} that you've never said out loud?", hype: "Why is this going to be {name}'s best year yet?", quiet: "What's one small thing {name} does that makes your day better?" }, tone: 'funny', vibe: 'postcard' },
  // the season's own moments sit right after birthdays; move them down the list once the season has passed
  { id: 'holiday', label: 'Holidays', icon: 'gift', prompt: "What's your favorite holiday memory with {name}? End with a wish for the new year.", ideas: ["What are you grateful to {name} for this year?", "What tradition always makes you think of {name}?", "What do you hope next year brings {name}?"], byTone: { funny: "What's the holiday story about {name} that gets told every year?", heartfelt: "What did {name} do this year that meant a lot to you?", hype: "What should {name} be proud of from this year?", quiet: "What's one small moment with {name} from this year you want to keep?" }, tone: 'heartfelt', vibe: 'kraft' },
  { id: 'newyear', label: 'New Year', icon: 'confetti', prompt: "What's your wish for {name} in the new year?", ideas: ["What did {name} do this year that you'll remember?", "What are you looking forward to doing with {name} next year?"], byTone: { funny: "What should {name} absolutely not do again next year?", heartfelt: "What did {name} get you through this year?", hype: "What's {name} going to pull off next year?", quiet: "What do you hope {name} gets more of next year?" }, tone: 'hype', vibe: 'milestonegold' },
  { id: 'baby', label: 'New baby', icon: 'sparkle', prompt: "What do you want {name} to know when they're old enough to watch this?", ideas: ["What's your wish for {name}?", "What can't you wait to teach {name}?", "What was the day {name} arrived like for you?"], byTone: { funny: "What's one family secret {name} should know early?", heartfelt: "What did you feel the first time you heard about {name}?", hype: "Tell {name} about the family they just joined.", quiet: "What do you hope {name} always knows?" }, tone: 'heartfelt', vibe: 'postcard' },
  { id: 'congrats', label: 'Graduation & congrats', icon: 'graduation-cap', prompt: 'What are you proudest of {name} for?', ideas: ["What did you see {name} push through to get here?", 'What advice would you give {name} for what comes next?', "What's one moment you knew {name} would make it?"], byTone: { funny: "What did you honestly think the first time {name} told you the plan?", heartfelt: "What did it mean to you to watch {name} get here?", hype: "Tell {name} exactly how big this is.", quiet: "What do you hope {name} remembers about today?" }, tone: 'hype', vibe: 'confettipop' },
  { id: 'welcome', label: 'Welcome home', icon: 'house', prompt: "What's the first thing you want to do with {name} now that they're home?", ideas: ['What did you miss most while {name} was away?', 'What has {name} missed that they need to hear about?'], byTone: { funny: "What fell apart around here while {name} was gone?", heartfelt: "What felt different without {name} here?", hype: "What's the first thing we're all doing now that {name} is back?", quiet: "What's one ordinary thing you can't wait to do with {name} again?" }, tone: 'heartfelt', vibe: 'airmail' },
  { id: 'getwell', label: 'Get well', icon: 'hand-heart', prompt: "What can't you wait to do with {name} again?", ideas: ['What do you want {name} to know right now?', "What's a memory with {name} that always makes you smile?"], byTone: { funny: "What's a story that always makes {name} laugh?", heartfelt: "What does {name} mean to you?", hype: "Tell {name} why they've got this.", quiet: "What's one thing you're looking forward to doing with {name}, whenever they're ready?" }, tone: 'heartfelt', vibe: 'quietnote' },
  { id: 'retirement', label: 'Retirement', icon: 'clock-countdown', prompt: 'What will you miss most about working with {name}?', ideas: ["What should {name} do first with all that free time?", "What's your favorite story from working with {name}?"], byTone: { funny: "What's the story about {name} that still gets told at work?", heartfelt: "What did {name} teach you that you'll keep using?", hype: "What should {name} do on the very first Monday off?", quiet: "What's one small thing {name} did that made work better?" }, tone: 'funny', vibe: 'kraft' },
  { id: 'thankyou', label: 'Thank you', icon: 'heart', prompt: 'What do you want to thank {name} for?', ideas: ['Finish this sentence: because of you, I...', 'When did {name} show up for you when it mattered?'], byTone: { funny: "What's something {name} did for you that you still laugh about?", heartfelt: "What would have gone differently without {name}?", hype: "Tell {name} what a difference they made.", quiet: "What's one small kindness from {name} you never forgot?" }, tone: 'heartfelt', vibe: 'milestonegold' },
  { id: 'team', label: 'Team send-off', icon: 'users-three', prompt: 'What will you miss most about working with {name}?', ideas: ["What's one thing {name} made better around here?", 'What do you wish {name} luck with next?'], byTone: { funny: "What's the inside joke {name} is leaving us with?", heartfelt: "What did you learn from working next to {name}?", hype: "What is {name} going to be great at next?", quiet: "What will the room feel like without {name}?" }, tone: 'funny', vibe: 'kraft' },
  { id: 'missyou', label: 'Miss you', icon: 'paper-plane-tilt', prompt: 'What do you miss most about {name}?', ideas: ["What do you keep wanting to tell {name}?", "What's the first thing you'll do together next time?"], byTone: { funny: "What's happened lately that {name} would have laughed at?", heartfelt: "What reminds you of {name}?", hype: "What are we doing the day {name} is back?", quiet: "What's one small thing you miss about having {name} around?" }, tone: 'heartfelt', vibe: 'airmail' },
  { id: 'memory', label: 'In memory', icon: 'flower-lotus', prompt: "What's one small moment with {name} you still think about?", ideas: ['What did {name} teach you that you still carry?', 'What would you tell {name} if you could?'], byTone: { funny: "What's a story about {name} that still makes you smile?", heartfelt: "What did {name} mean to you?", quiet: "Where do you still feel {name} with you?" }, tone: 'quiet', vibe: 'pressedflower' },
  { id: 'brand', label: 'For a business', icon: 'users-four', prompt: "Tell your first-day story, and say where you're from.", ideas: ['What do you love about working here?'], tone: 'heartfelt', vibe: 'postcard' },
]

// Each theme lists the moments it suits, so an "in memory" frame can never sit on a birthday (and confetti never on a memorial).
// A card theme sets the frame around the reel (both the story and the wide file), the stickers and the music. One choice, not three.
export const VIBES = [
  { id: 'postcard', label: 'Postcard', for: 'birthdays and everyday', music: 'uplifting', moments: ['birthday', 'congrats', 'welcome', 'retirement', 'thankyou', 'getwell', 'missyou', 'team', 'brand', 'holiday', 'newyear', 'baby'] },
  { id: 'milestonegold', label: 'Milestone gold', for: 'big birthdays and anniversaries', music: 'warm-acoustic', moments: ['birthday', 'congrats', 'retirement', 'thankyou', 'team', 'brand', 'holiday', 'newyear', 'baby'] },
  { id: 'airmail', label: 'Airmail', for: 'welcome home, far away', music: 'warm-acoustic', moments: ['birthday', 'welcome', 'retirement', 'thankyou', 'getwell', 'missyou', 'team', 'holiday', 'baby'] },
  { id: 'quietnote', label: 'Quiet note', for: 'get well, hard moments', music: 'gentle-piano', moments: ['welcome', 'thankyou', 'getwell', 'missyou', 'memory', 'holiday', 'baby'] },
  { id: 'kraft', label: 'Kraft parcel', for: 'holidays and big groups', music: 'warm-acoustic', moments: ['birthday', 'congrats', 'welcome', 'retirement', 'thankyou', 'missyou', 'team', 'brand', 'holiday', 'newyear'] },
  { id: 'pressedflower', label: 'Pressed flower', for: 'in memory', music: 'gentle-piano', moments: ['memory'] },
  { id: 'confettipop', label: 'Confetti pop', for: "kids' birthdays", music: 'uplifting', moments: ['birthday', 'congrats', 'newyear'] },
  { id: 'lockernote', label: 'Locker note', for: 'teens and friend shout-outs', music: 'uplifting', moments: ['birthday', 'congrats', 'welcome', 'thankyou', 'getwell', 'missyou', 'newyear'] },
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
