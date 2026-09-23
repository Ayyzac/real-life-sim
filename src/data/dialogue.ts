import type { RelationKind } from '../core/types';

/**
 * Conversations (GDD §11.6), written in advance as data - never generated
 * while the game runs (CLAUDE.md: no AI at runtime).
 *
 * Someone opens; the player answers in one of three styles. Whether that
 * lands depends on who they are: every person has a trait, hidden until the
 * player has worked it out. Placeholders: {name} (first name), {job}, {place},
 * {time} ("morning", "afternoon", "evening").
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

export interface Reply {
  style: ReplyStyle;
  text: string;
}

export interface Opener {
  id: string;
  /** Who might say it. Omitted means anyone grown up. */
  kinds?: readonly RelationKind[];
  /** Only for someone this close, or this distant. */
  minCloseness?: number;
  maxCloseness?: number;
  /** Only at this time of day. */
  when?: 'morning' | 'afternoon' | 'evening';
  /** Needs them to have a job to talk about. */
  job?: boolean;
  /** Children under 13 get their own lines. */
  young?: boolean;
  text: string;
  replies: readonly [Reply, Reply, Reply];
}

const J = (text: string): Reply => ({ style: 'joke', text });
const S = (text: string): Reply => ({ style: 'sincere', text });
const C = (text: string): Reply => ({ style: 'curious', text });

export const OPENERS: readonly Opener[] = [
  // Anyone, any time.
  { id: 'how_are_you', text: '"Hey, you. How are things, honestly?"', replies: [J('"Honestly? I peaked at breakfast."'), S('"Up and down. Better for seeing you."'), C('"Fine - but tell me about you first."')] },
  { id: 'long_week', text: '"Is it just me, or has this week lasted a month?"', replies: [J('"It has. I checked. Twice."'), S('"It has been a lot. Glad it is nearly done."'), C('"What made it so long for you?"')] },
  { id: 'weather', text: '{name} squints at the window. "Can you believe this weather?"', replies: [J('"I blame you personally."'), S('"I like it, actually. It suits the day."'), C('"Are you a sun person or a rain person?"')] },
  { id: 'news', text: '"Did you hear what happened down by the Stadium?"', replies: [J('"If it involves a pigeon, I was not there."'), S('"No - I hope nobody was hurt."'), C('"No, what happened? Tell me everything."')] },
  { id: 'tired', text: '{name} stifles a yawn. "Sorry. Long night."', replies: [J('"Party animal. I knew it."'), S('"Do not apologise. Want a coffee?"'), C('"What kept you up?"')] },
  { id: 'food', text: '"I have been thinking about noodles all day. Is that normal?"', replies: [J('"It is the only normal thing about you."'), S('"Completely. Noodles are a good use of a day."'), C('"Which place does the best ones?"')] },
  { id: 'music', text: '"I cannot get this song out of my head."', replies: [J('"Hum it. I dare you."'), S('"The good ones do that. It means it is yours now."'), C('"Which one? Maybe I know it."')] },
  { id: 'plans', text: '"Got anything planned for the weekend?"', replies: [J('"Lying very still, mostly."'), S('"Not yet. I would like to see more of you, though."'), C('"Why - are you doing something good?"')] },
  { id: 'town', text: '"This town is changing. Did you see the new place on Eastside?"', replies: [J('"I did. I have already judged it."'), S('"I miss how it used to be, a little."'), C('"Have you been in yet? What is it like?"')] },
  { id: 'money', text: '"Everything costs double what it used to. How does anyone manage?"', replies: [J('"I have decided to live on air."'), S('"It is hard. You are not the only one feeling it."'), C('"Is something going on? You can tell me."')] },

  // Time of day.
  { id: 'morning_early', when: 'morning', text: '"You are up early. Or have you not been to bed?"', replies: [J('"Bed is a myth."'), S('"Early. I like the town before it wakes."'), C('"Same question back at you."')] },
  { id: 'morning_coffee', when: 'morning', text: '{name} wraps both hands round a cup. "Do not talk to me until this is gone."', replies: [J('"Then I will just stand here, breathing."'), S('"Fair. I will wait."'), C('"How many is that today?"')] },
  { id: 'afternoon_slump', when: 'afternoon', text: '"Three o\'clock. The worst hour. Everyone knows it."', replies: [J('"Legally, nothing can be expected of us."'), S('"Hang in there. Nearly done."'), C('"What would you rather be doing right now?"')] },
  { id: 'evening_done', when: 'evening', text: '"Done for the day. Finally. How was yours?"', replies: [J('"I survived. Hold the applause."'), S('"Better now. Good to see you."'), C('"Good - but what about yours?"')] },
  { id: 'evening_late', when: 'evening', text: '"Should we both be home by now, do you think?"', replies: [J('"Home is wherever the snacks are."'), S('"Probably. I am glad we are not, though."'), C('"What is waiting for you at home?"')] },

  // About their job.
  { id: 'job_day', job: true, text: '"Another day as a {job}. You would not believe the half of it."', replies: [J('"Try me. I believe everything."'), S('"You work hard. People should notice more."'), C('"Go on - what was the worst bit?"')] },
  { id: 'job_change', job: true, text: '"Sometimes I wonder if I should stop being a {job} and do something else."', replies: [J('"Professional napper. Think about it."'), S('"You would be good at whatever you chose."'), C('"What would you do instead?"')] },
  { id: 'job_boss', job: true, text: '"My boss said something today I cannot stop thinking about."', replies: [J('"Was it \'you\'re fired\'? Because that sticks."'), S('"That sounds hard. Do you want to talk about it?"'), C('"What did they say, exactly?"')] },

  // Close friends and family.
  { id: 'close_remember', minCloseness: 60, text: '"Do you remember when we first met? You were so different."', replies: [J('"Taller. I was definitely taller."'), S('"I do. I am glad you stuck around."'), C('"Different how? Be honest."')] },
  { id: 'close_worry', minCloseness: 60, text: '{name} goes quiet. "Can I tell you something I have not told anyone?"', replies: [J('"If it is about the cake, I already know."'), S('"Of course. Whatever it is."'), C('"Always. What is on your mind?"')] },
  { id: 'close_proud', minCloseness: 70, text: '"I do not say it enough, but I am proud of you."', replies: [J('"Write it down. I want it framed."'), S('"That means more than you know."'), C('"What brought that on?"')] },

  // People they barely know.
  { id: 'distant_again', maxCloseness: 30, text: '"Oh - hi. It has been a while, hasn\'t it?"', replies: [J('"Ages. You look exactly the same. Suspicious."'), S('"Too long. I am sorry about that."'), C('"It has. What have you been up to?"')] },
  { id: 'distant_name', maxCloseness: 30, text: '{name} hesitates, then smiles. "Sorry, I was miles away."', replies: [J('"Anywhere nice?"'), S('"No need to apologise. Good to see you."'), C('"What were you thinking about?"')] },

  // Family.
  { id: 'family_eating', kinds: ['family'], text: '"Are you eating properly? You look thin."', replies: [J('"I eat constantly. It is a problem."'), S('"I am trying. Thank you for worrying."'), C('"Why - do I really look that bad?"')] },
  { id: 'family_call', kinds: ['family'], text: '"You never call. We used to talk every day."', replies: [J('"I am here now, in person. Premium service."'), S('"You are right. I will do better."'), C('"What have I missed?"')] },
  { id: 'family_old', kinds: ['family'], text: '"When I was your age, this town was all fields."', replies: [J('"And you walked to school uphill both ways."'), S('"I wish I had seen it like that."'), C('"What was it like, growing up here?"')] },

  // Colleagues.
  { id: 'colleague_meeting', kinds: ['colleague'], text: '"That meeting could have been an email. Again."', replies: [J('"That meeting could have been a nap."'), S('"I know. Your time matters."'), C('"What did they even decide?"')] },
  { id: 'colleague_promotion', kinds: ['colleague'], text: '"Did you hear who got the promotion? Unbelievable."', replies: [J('"Me? Finally, justice."'), S('"You deserved it more, honestly."'), C('"Who? And why unbelievable?"')] },

  // Someone you are seeing, and the one you married.
  { id: 'dating_nervous', kinds: ['dating'], text: '{name} tucks their hair back. "I was hoping I would run into you."', replies: [J('"I was hoping too. I also ran, a bit."'), S('"I was hoping the same thing."'), C('"Were you? Why?"')] },
  { id: 'dating_future', kinds: ['dating'], minCloseness: 60, text: '"Where do you see this going? Us, I mean."', replies: [J('"Somewhere with snacks."'), S('"Somewhere good. With you."'), C('"Where would you like it to go?"')] },
  { id: 'partner_day', kinds: ['partner'], text: '"There you are. I missed you today."', replies: [J('"Obviously. I am very missable."'), S('"I missed you too. All day."'), C('"What did you get up to?"')] },
  { id: 'partner_house', kinds: ['partner'], text: '"We should do something about the house. Or not. What do you think?"', replies: [J('"Burn it down, start again."'), S('"Whatever makes it feel like home to you."'), C('"What would you change first?"')] },

  // Grown-up children.
  { id: 'child_grown', kinds: ['child'], text: '"You always said I would understand when I was older. I think I do now."', replies: [J('"Great. Can you explain it to me?"'), S('"I am so proud of who you have become."'), C('"Understand what, exactly?"')] },

  // Young children.
  { id: 'kid_drawing', kinds: ['child'], young: true, text: '"Look! I drew you. That is your nose."', replies: [J('"My nose is not that big. Is it?"'), S('"It is wonderful. Can I keep it?"'), C('"And who is this next to me?"')] },
  { id: 'kid_why', kinds: ['child'], young: true, text: '"Why is the sky up and not down?"', replies: [J('"Because it would get stepped on."'), S('"That is a very good question. I love that you ask."'), C('"What do you think the answer is?"')] },
  { id: 'kid_bored', kinds: ['child'], young: true, text: '"I am bored. Are you bored? Play with me."', replies: [J('"I am never bored. I am a professional."'), S('"Of course. What shall we play?"'), C('"What game do you want to play?"')] },
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

/** Words for moments that are not a normal chat. */
export const LINES = {
  talkedToday: '{name} smiles. "Twice in one day? Go on, I will see you tomorrow."',
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
