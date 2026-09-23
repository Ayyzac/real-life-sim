import type { RelationKind } from '../core/types';
import type { ReplyStyle } from './dialogue';

/**
 * Conversations as trees (GDD §12, user decision 23 Sep 2026): pick a topic,
 * then a few turns where each answer leads somewhere of its own. Written in
 * advance - never generated while playing (CLAUDE.md: no AI at runtime).
 *
 * Branches meet again rather than fanning out forever, so a topic stays a
 * handful of lines. Nothing in an NPC's line assumes you can see them, so
 * the same trees work over the phone.
 *
 * Placeholders: {name} (their first name), {job}, {place}, {time}.
 * Adding a topic = adding an entry here; the tests check every branch leads
 * somewhere real and every placeholder can be filled.
 */

export type Offer = 'invite' | 'askOut';

export interface TopicReply {
  style: ReplyStyle;
  text: string;
  /** The next line in this topic. Omitted: the topic is finished. */
  next?: string;
  /** Something to suggest once this answer has landed. */
  offer?: Offer;
}

export interface TopicNode {
  npc: string;
  replies: readonly [TopicReply, TopicReply, TopicReply];
}

export interface Topic {
  id: string;
  label: string;
  /** Who brings it up. Omitted: any grown-up. */
  kinds?: readonly RelationKind[];
  minCloseness?: number;
  /** Needs them to have a job to talk about. */
  job?: boolean;
  /** Only for children under 13, who get nothing else. */
  young?: boolean;
  /** Only for saying hello to someone in the street. */
  stranger?: boolean;
  start: string;
  nodes: Readonly<Record<string, TopicNode>>;
}

const J = (text: string, next?: string, offer?: Offer): TopicReply => ({ style: 'joke', text, next, offer });
const S = (text: string, next?: string, offer?: Offer): TopicReply => ({ style: 'sincere', text, next, offer });
const C = (text: string, next?: string, offer?: Offer): TopicReply => ({ style: 'curious', text, next, offer });

export const TOPICS: readonly Topic[] = [
  {
    id: 'day',
    label: 'How the day went',
    start: 'start',
    nodes: {
      start: {
        npc: '"So, how has your day been, honestly?"',
        replies: [J('"Long. I aged a year. Possibly two."', 'rough'), S('"Better now I am talking to you."', 'nice'), C('"Fine - but tell me about yours first."', 'theirs')],
      },
      rough: {
        npc: '{name} laughs. "Same here. What made it so bad?"',
        replies: [J('"Everything. The kettle started it."', 'close'), S('"Just tired, honestly. It helps to say it."', 'close'), C('"Nothing, really. What made yours bad?"', 'theirs')],
      },
      nice: {
        npc: '"That is a lovely thing to say. You are in a good mood this {time}."',
        replies: [J('"Do not get used to it."', 'close'), S('"I am. It has been a while."', 'close'), C('"Am I usually not?"', 'close')],
      },
      theirs: {
        npc: '"Mine? Busy, mostly. Nothing I would want to live through twice."',
        replies: [J('"Live it again as a musical. I will buy a ticket."', 'close'), S('"I am sorry. You deserve an easier one."', 'close'), C('"What was the hardest part?"', 'close')],
      },
      close: {
        npc: '"Anyway. It is good to catch up with you."',
        replies: [J('"We should do this professionally."'), S('"It is. Let us do it more often."', undefined, 'invite'), C('"Same time tomorrow?"')],
      },
    },
  },
  {
    id: 'work',
    label: 'Their work',
    job: true,
    start: 'start',
    nodes: {
      start: {
        npc: '"Being a {job} is wearing me out this week."',
        replies: [J('"Run away and join the circus. You have the shoes."', 'boss'), S('"You work so hard. I hope they notice."', 'noticed'), C('"What is the worst part of it?"', 'boss')],
      },
      boss: {
        npc: '"Honestly? The boss. Changes their mind twice before lunch."',
        replies: [J('"Change yours back at them. Every day."', 'future'), S('"That sounds exhausting. You handle it well."', 'future'), C('"Have you told them how it feels?"', 'future')],
      },
      noticed: {
        npc: '"They do not. But thank you for saying so. It helps."',
        replies: [J('"I will send them a strongly worded card."', 'future'), S('"Then I will notice for them."', 'future'), C('"Would somewhere else treat you better?"', 'future')],
      },
      future: {
        npc: '"Sometimes I think about doing something else entirely."',
        replies: [J('"Professional napper. The hours are great."'), S('"You would be good at anything you chose."'), C('"Like what? Tell me the dream."', 'dream')],
      },
      dream: {
        npc: '"Something with my hands. A little workshop, maybe. Is that silly?"',
        replies: [J('"Only if the workshop makes silly hats."'), S('"Not silly at all. I can see it."'), C('"What would you make first?"')],
      },
    },
  },
  {
    id: 'weekend',
    label: 'Plans for the weekend',
    start: 'start',
    nodes: {
      start: {
        npc: '"Got anything planned for the weekend?"',
        replies: [J('"Lying very still, mostly."', 'lazy'), S('"Not yet. I would like to spend some of it with you."', 'together'), C('"Why - are you doing something good?"', 'theirs')],
      },
      lazy: {
        npc: '"Honestly, that sounds perfect. I might copy you."',
        replies: [J('"I charge for lessons."', 'end'), S('"You have earned a rest."', 'end'), C('"What would you do if you had no plans at all?"', 'theirs')],
      },
      together: {
        npc: '"I would like that. Somewhere we can actually talk."',
        replies: [J('"A library. We will whisper."', 'end', 'invite'), S('"Let us find somewhere good."', 'end', 'invite'), C('"Where would you pick?"', 'end', 'invite')],
      },
      theirs: {
        npc: '"Thinking about seeing a film. It has been months."',
        replies: [J('"Pick one with explosions."', 'end'), S('"You should. You deserve a treat."', 'end'), C('"Which one? I might come."', 'end', 'invite')],
      },
      end: {
        npc: '"Right. Something to look forward to, then."',
        replies: [J('"Or dread. Both are fun."'), S('"Definitely."'), C('"Let me know how it goes."')],
      },
    },
  },
  {
    id: 'food',
    label: 'Food',
    start: 'start',
    nodes: {
      start: {
        npc: '"I have been thinking about noodles all day. Is that normal?"',
        replies: [J('"It is the only normal thing about you."', 'where'), S('"Completely. Noodles are a good use of a day."', 'where'), C('"Which place does the best ones?"', 'where')],
      },
      where: {
        npc: '"There is a place near the Mall. The broth is ridiculous. Have you been?"',
        replies: [J('"I have. I still dream about it."', 'cook'), S('"Not yet. I would love to."', 'cook', 'invite'), C('"What makes the broth so good?"', 'cook')],
      },
      cook: {
        npc: '"Do you cook much yourself, or is it all takeaways?"',
        replies: [J('"I cook toast. Excellently."'), S('"I try. It is nicer with someone to cook for."'), C('"Why - are you any good?"', 'good')],
      },
      good: {
        npc: '"I make a curry that has made grown adults cry. Happily."',
        replies: [J('"Prove it. Bring tissues."'), S('"I would love to try it one day."'), C('"What is the secret?"')],
      },
    },
  },
  {
    id: 'gossip',
    label: 'Gossip',
    kinds: ['friend', 'colleague'],
    minCloseness: 25,
    start: 'start',
    nodes: {
      start: {
        npc: '{name} lowers their voice. "Did you hear what happened down by the Stadium?"',
        replies: [J('"If it involves a pigeon, I was not there."', 'tell'), S('"No - I hope nobody was hurt."', 'tell'), C('"No! Tell me everything."', 'tell')],
      },
      tell: {
        npc: '"Someone drove a scooter straight into the fountain. On purpose, they say."',
        replies: [J('"Finally, some culture in this town."', 'who'), S('"Were they all right?"', 'fine'), C('"On purpose? Who would do that?"', 'who')],
      },
      who: {
        npc: '"Nobody knows. Everyone has a theory. Mine is the man from the bakery."',
        replies: [J('"It is always the baker."'), S('"Poor man. He probably just slipped."'), C('"What makes you think it was him?"')],
      },
      fine: {
        npc: '"Soaked, and very embarrassed. But fine. You are kind to ask first."',
        replies: [J('"I only ask so I can laugh with a clear conscience."'), S('"Of course. People matter more than the story."'), C('"Did anyone film it?"')],
      },
    },
  },
  {
    id: 'family_news',
    label: 'Family news',
    kinds: ['family'],
    start: 'start',
    nodes: {
      start: {
        npc: '"Everyone keeps asking after you. Are you eating properly?"',
        replies: [J('"I eat constantly. It is a problem."', 'call'), S('"I am trying. Thank you for worrying."', 'call'), C('"Who has been asking?"', 'asking')],
      },
      asking: {
        npc: '"Your aunt, mostly. She says you never visit. I told her you are busy."',
        replies: [J('"Tell her I have been kidnapped. Politely."', 'call'), S('"I will visit soon. I mean it."', 'call'), C('"How is she doing?"', 'call')],
      },
      call: {
        npc: '"It would be nice to hear from you more. We used to talk every day."',
        replies: [J('"We are talking now. Premium service."', 'old'), S('"You are right. I will do better."', 'old'), C('"What have I missed?"', 'old')],
      },
      old: {
        npc: '"When I was your age, this town was all fields. Now look at it."',
        replies: [J('"And you walked to school uphill both ways."'), S('"I wish I had seen it like that."'), C('"What was it like, growing up here?"')],
      },
    },
  },
  {
    id: 'dreams',
    label: 'What they want from life',
    minCloseness: 45,
    start: 'start',
    nodes: {
      start: {
        npc: '"Can I ask you something? Are you happy - with how things are going?"',
        replies: [J('"Ask me after lunch."', 'honest'), S('"Mostly. Talking to you helps."', 'honest'), C('"Why do you ask? Are you?"', 'them')],
      },
      honest: {
        npc: '"I only ask because I have been wondering the same about myself."',
        replies: [J('"We should start a club. Snacks provided."', 'them'), S('"You can tell me anything, you know."', 'them'), C('"What has made you wonder?"', 'them')],
      },
      them: {
        npc: '"I think I want more than this. I just do not know what yet."',
        replies: [J('"More snacks. Start there."', 'last'), S('"You will find it. I am sure of that."', 'last'), C('"If money did not matter, what would you do?"', 'travel')],
      },
      travel: {
        npc: '"Travel. Properly. See places I have only read about."',
        replies: [J('"Take me. I fit in a suitcase."', 'last'), S('"Then you should. Life is short."', 'last'), C('"Where would you go first?"', 'last')],
      },
      last: {
        npc: '"Thank you. I do not talk like this with many people."',
        replies: [J('"I am very exclusive."'), S('"I am glad you talk to me."'), C('"Why not, do you think?"')],
      },
    },
  },
  {
    id: 'romance',
    label: 'The two of you',
    kinds: ['friend', 'colleague', 'dating', 'partner'],
    minCloseness: 55,
    start: 'start',
    nodes: {
      start: {
        npc: '"I was hoping I would get to talk to you today."',
        replies: [J('"I was hoping too. I also practised."', 'why'), S('"I was hoping the same thing."', 'why'), C('"Were you? Why?"', 'why')],
      },
      why: {
        npc: '{name} hesitates. "I just like how things are when you are around."',
        replies: [J('"Loud and slightly chaotic?"', 'more'), S('"I feel the same about you."', 'more', 'askOut'), C('"How are they, when I am around?"', 'more')],
      },
      more: {
        npc: '"Easy. Warm. Like I do not have to pretend."',
        replies: [J('"I pretend enough for both of us."'), S('"You never have to, with me."', undefined, 'askOut'), C('"Is that why you wanted to talk?"', 'honest')],
      },
      honest: {
        npc: '"Maybe. I think I wanted to see if you felt it too."',
        replies: [J('"Felt what? I am joking. I do."', undefined, 'askOut'), S('"I do. I have for a while."', undefined, 'askOut'), C('"And what if I did?"', undefined, 'askOut')],
      },
    },
  },
  {
    id: 'kid',
    label: 'What they found',
    young: true,
    start: 'start',
    nodes: {
      start: {
        npc: '"Guess what I found today! Guess!"',
        replies: [J('"A dragon. I knew it."', 'stone'), S('"Show me. I want to know."', 'stone'), C('"What? Tell me everything."', 'stone')],
      },
      stone: {
        npc: '"A shiny stone! It might be magic. Can I keep it forever?"',
        replies: [J('"Only if it does your homework."', 'why'), S('"Of course. Keep it somewhere safe."', 'why'), C('"What kind of magic do you think it does?"', 'why')],
      },
      why: {
        npc: '"Why is the sky up and not down?"',
        replies: [J('"Because it would get stepped on."'), S('"That is a very good question. I love that you ask."'), C('"What do you think the answer is?"')],
      },
    },
  },
  {
    id: 'stranger',
    label: 'Saying hello',
    stranger: true,
    start: 'start',
    nodes: {
      start: {
        npc: '"Oh - hello. Do I know you?"',
        replies: [J('"Not yet. That is the exciting part."', 'meet'), S('"No - you just looked like someone worth saying hello to."', 'meet'), C('"No. Do you come this way often?"', 'meet')],
      },
      meet: {
        npc: '"Ha. Well, it is nice to meet someone new. What do you do with yourself?"',
        replies: [J('"Mostly this. Surprising strangers."'), S('"Trying to meet more people, honestly. Like you."'), C('"Not much - what about you?"')],
      },
    },
  },
];

export function findTopic(id: string): Topic | undefined {
  return TOPICS.find((topic) => topic.id === id);
}
