/**
 * How people take what the player says (GDD §11.6), written in advance as
 * data - never generated while the game runs (CLAUDE.md: no AI at runtime).
 * The conversations themselves are trees in ./conversations.ts.
 *
 * Every answer has one of three styles. Whether it lands depends on who they
 * are: every person has a trait, hidden until the player has worked it out.
 * Placeholders: {name} (first name), {full}, {job}.
 */

export type ReplyStyle = 'joke' | 'sincere' | 'curious';
export type Verdict = 'good' | 'neutral' | 'bad';

export interface Trait {
  id: string;
  label: string;
  /** Shown once the trait is known, so the player can use it. */
  hint: string;
  likes: Record<ReplyStyle, Verdict>;
}

export const TRAITS: readonly Trait[] = [
  { id: 'joker', label: 'Joker', hint: 'Loves a laugh. Takes nothing too seriously.', likes: { joke: 'good', sincere: 'neutral', curious: 'neutral' } },
  { id: 'serious', label: 'Serious', hint: 'Wants to be taken seriously. Jokes fall flat.', likes: { joke: 'bad', sincere: 'good', curious: 'neutral' } },
  { id: 'sensitive', label: 'Sensitive', hint: 'Opens up to questions. Teasing stings.', likes: { joke: 'bad', sincere: 'neutral', curious: 'good' } },
  { id: 'ambitious', label: 'Ambitious', hint: 'Likes to talk plans. Finds sentiment soft.', likes: { joke: 'neutral', sincere: 'bad', curious: 'good' } },
  { id: 'easygoing', label: 'Easygoing', hint: 'Happy with almost anything, and a joke most of all.', likes: { joke: 'good', sincere: 'neutral', curious: 'good' } },
  { id: 'romantic', label: 'Romantic', hint: 'Listens for what you really mean.', likes: { joke: 'neutral', sincere: 'good', curious: 'neutral' } },
];

/** How the reply landed, by style and verdict. {name} is their first name. */
export const REACTIONS: Record<ReplyStyle, Record<Verdict, readonly string[]>> = {
  joke: {
    good: ['{name} laughs properly, the kind you cannot fake.', '{name} snorts, then laughs harder for having snorted.'],
    neutral: ['{name} smiles politely.', 'A small laugh from {name}. Fair enough.'],
    bad: ['{name} does not laugh. The silence is long.', '{name} looks away. That one missed.'],
  },
  sincere: {
    good: ['{name} goes quiet, then squeezes your arm.', 'Something in {name}\'s face softens.'],
    neutral: ['{name} nods. "Thanks."', '"That is kind," {name} says, and means it a little.'],
    bad: ['{name} shifts, uncomfortable. "Right. Okay."', '{name} changes the subject quickly.'],
  },
  curious: {
    good: ['{name} lights up and talks for twenty minutes straight.', '{name} leans in. Nobody usually asks.'],
    neutral: ['{name} answers, briefly.', '{name} shrugs and gives you the short version.'],
    bad: ['"Why do you want to know?" {name} asks.', '{name} goes guarded. Too many questions.'],
  },
};

/**
 * The same, heard down a phone line (GDD §12): nothing anyone would have to
 * see to know.
 */
export const CALL_REACTIONS: Record<ReplyStyle, Record<Verdict, readonly string[]>> = {
  joke: {
    good: ['A proper laugh down the line.', '{name} laughs so hard the phone crackles.'],
    neutral: ['A polite chuckle on the other end.', '"Ha," says {name}. Fair enough.'],
    bad: ['Silence on the line. That one missed.', '{name} does not laugh. "Right."'],
  },
  sincere: {
    good: ['A pause. "That means a lot," {name} says quietly.', '{name}\'s voice goes soft. "Thank you."'],
    neutral: ['"Thanks," says {name}.', '"That is kind," {name} says, and means it a little.'],
    bad: ['"Okay..." {name} sounds uncomfortable.', '{name} changes the subject quickly.'],
  },
  curious: {
    good: ['{name} talks and talks. Nobody usually asks.', 'You can hear {name} smiling as they answer.'],
    neutral: ['{name} answers, briefly.', 'You get the short version.'],
    bad: ['"Why do you want to know?" {name} asks.', '{name} goes guarded. Too many questions.'],
  },
};

/** Words for moments that are not a normal chat. */
export const LINES = {
  talkedOut: '{name} smiles. "We have talked a lot today. Go on, I will see you tomorrow."',
  askOutYes: '{name} says yes before you finish asking.',
  askOutNo: '{name} looks down. "I like you. Just not like that - not yet."',
  breakup: '{name} ended things. It had been cold between you for a long time.',
  inviteYes: '{name} is in. "Give me ten minutes."',
  inviteBusy: '{name} cannot make it right now.',
  inviteNo: '{name} makes an excuse. You are not close enough yet.',
  greetMet: 'You got talking to {full}, a {job}. They seemed glad you said hello.',
  greetMissed: 'They smiled and walked on.',
  greetFull: 'A nice chat, but your life is full enough right now.',
} as const;
