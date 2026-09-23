import { findTopic, type TopicReply } from '../data/conversations';
import { CALL_REACTIONS, LINES, REACTIONS, type Verdict } from '../data/dialogue';
import { hashText } from '../core/hash';
import { lookOf } from '../core/look';
import { marriageCandidates, RELATIONSHIP_BALANCE } from '../core/relationships';
import {
  OUTINGS,
  canAskOut,
  fillLine,
  firstName,
  greetBlocker,
  inviteBlocker,
  inviteMinutes,
  strangerTrait,
  talkBlocker,
  talkMinutes,
  topicsFor,
  traitKnown,
  traitOf,
  verdictFor,
  type Outing,
} from '../core/talk';
import type { Person, WorldState } from '../core/types';
import { BALANCE } from '../data/balance';
import { money } from './format';
import { Portrait } from './Portrait';
import { ProgressBar } from './ProgressBar';
import { runTimed, useProgress } from './progress';
import { closeTalk, updateTalk, type OpenTalk } from './talk';
import { gameStore } from './useGame';

/**
 * A conversation (GDD §11.6, §12): pick a topic, then a few turns where each
 * answer leads to a line of its own. How an answer lands depends on who they
 * are; their nature stays "???" until a couple of answers have landed well.
 */

const STYLE_LABEL: Record<TopicReply['style'], string> = { joke: 'Joke', sincere: 'Sincere', curious: 'Ask' };
const OUTING_BUTTON: Record<Outing, string> = { dinner: 'Dinner', film: 'A film', home: 'Come over' };

function reactionText(style: TopicReply['style'], verdict: Verdict, key: string, remote: boolean): string {
  const pool = (remote ? CALL_REACTIONS : REACTIONS)[style][verdict];
  return pool[hashText(key) % pool.length]!;
}

function Replies({
  replies,
  disabled,
  fill,
  onPick,
}: {
  replies: readonly TopicReply[];
  disabled: boolean;
  fill: (text: string) => string;
  onPick: (index: number) => void;
}): React.JSX.Element {
  return (
    <div className="talk__replies">
      {replies.map((reply, index) => (
        <button key={reply.style} type="button" className="choice" disabled={disabled} onClick={() => onPick(index)}>
          <span className="talk__style">{STYLE_LABEL[reply.style]}</span>
          <span>{fill(reply.text)}</span>
        </button>
      ))}
    </div>
  );
}

function Reaction({ open }: { open: OpenTalk }): React.JSX.Element | null {
  if (!open.reaction) return null;
  return <p className={`talk__line talk__line--${open.reaction.verdict}`}>{open.reaction.text}</p>;
}

/** Someone the player knows, in person or on the phone. */
function PersonTalk({ world, open, person }: { world: WorldState; open: OpenTalk; person: Person }): React.JSX.Element {
  const busy = useProgress() !== null;
  const remote = open.remote === true;
  const name = firstName(person);
  const trait = traitOf(person);
  const blocker = talkBlocker(world, person, remote);
  const topic = open.topicId ? findTopic(open.topicId) : undefined;
  const node = topic && open.nodeId ? topic.nodes[open.nodeId] : undefined;
  const topics = topicsFor(world, person);
  const fill = (text: string): string => fillLine(text, person, world);
  // Some things are only asked face to face.
  const canPropose = !remote && marriageCandidates(world.people).some((p) => p.id === person.id);
  const affordWedding = world.character.stats.money >= RELATIONSHIP_BALANCE.weddingCost;

  const answer = (index: number): void => {
    if (!topic || !node || !open.nodeId) return;
    const reply = node.replies[index]!;
    const verdict = verdictFor(person, reply.style);
    const text = fill(reactionText(reply.style, verdict, `${person.id}:${world.clockDay}:${open.nodeId}:${index}`, remote));
    updateTalk({
      reaction: { text, verdict },
      offer: reply.offer,
      topicId: reply.next ? topic.id : undefined,
      nodeId: reply.next,
    });
    runTimed(remote ? `On the phone with ${name}` : `Talking with ${name}`, talkMinutes(remote), {
      type: 'talk',
      personId: person.id,
      topicId: topic.id,
      nodeId: open.nodeId,
      reply: index,
      remote,
    });
  };

  return (
    <>
      <header className="talk__head">
        <Portrait look={lookOf(person)} scale={4} className="person__face" />
        <div className="talk__who">
          <h2 className="talk__name" id="talk-name">
            {person.name} <span className="badge">{person.kind === 'dating' ? 'seeing' : person.kind}</span>
            {remote && <span className="badge">on the phone</span>}
          </h2>
          <p className="talk__trait">
            {traitKnown(person) ? (
              <>
                <strong>{trait.label}.</strong> {trait.hint}
              </>
            ) : (
              'Personality: ??? - see how your answers land.'
            )}
          </p>
          <div className="stat__track person__track">
            <div className="stat__fill stat__fill--mood" style={{ width: `${Math.round(person.closeness)}%` }} />
          </div>
          <span className="person__closeness">closeness {Math.round(person.closeness)}</span>
        </div>
      </header>

      <ProgressBar />
      {!busy && <Reaction open={open} />}

      {busy ? null : node ? (
        <>
          <p className="talk__line">{fill(node.npc)}</p>
          <Replies replies={node.replies} disabled={blocker !== null} fill={fill} onPick={answer} />
          {blocker && <p className="action__why">{blocker}</p>}
        </>
      ) : blocker === 'Talked enough for today' || (topics.length === 0 && !blocker) ? (
        <p className="talk__line">{fill(LINES.talkedOut)}</p>
      ) : (
        <>
          <p className="talk__prompt">{open.reaction ? 'Anything else?' : `What do you talk about with ${name}?`}</p>
          <div className="person__actions">
            {topics.map((t) => (
              <button
                key={t.id}
                type="button"
                className="btn btn--small"
                disabled={blocker !== null}
                onClick={() => updateTalk({ topicId: t.id, nodeId: t.start, reaction: undefined, offer: undefined })}
              >
                {t.label}
              </button>
            ))}
          </div>
          {blocker && <p className="action__why">{blocker}</p>}
        </>
      )}

      {!busy && open.offer === 'invite' && (
        <div className="person__actions">
          <span className="talk__prompt">Suggest:</span>
          {(Object.keys(OUTINGS) as Outing[]).map((outing) => {
            const why = inviteBlocker(world, person, outing);
            const cost = OUTINGS[outing].cost;
            return (
              <button
                key={outing}
                type="button"
                className="btn btn--small"
                disabled={why !== null}
                title={why ?? `${OUTINGS[outing].label}${cost > 0 ? `, ${money(cost)} for two` : ''}`}
                onClick={() => {
                  closeTalk();
                  runTimed(`${OUTINGS[outing].label} with ${name}`, inviteMinutes(world, person), {
                    type: 'invite',
                    personId: person.id,
                    outing,
                  });
                }}
              >
                {OUTING_BUTTON[outing]}
              </button>
            );
          })}
        </div>
      )}

      <div className="talk__actions">
        {!remote && canAskOut(world, person) && (
          <button
            type="button"
            className={`btn ${open.offer === 'askOut' ? 'btn--primary' : ''}`}
            disabled={busy}
            onClick={() => runTimed(`Asking ${name} out`, 10, { type: 'askOut', personId: person.id })}
          >
            Ask {name} out
          </button>
        )}
        {canPropose && (
          <button
            type="button"
            className="btn btn--primary"
            disabled={busy || !affordWedding}
            onClick={() => gameStore.dispatch({ type: 'marry', personId: person.id })}
          >
            {affordWedding ? `Propose · ${money(RELATIONSHIP_BALANCE.weddingCost)} wedding` : 'Propose (cannot afford the wedding)'}
          </button>
        )}
        <button type="button" className="btn btn--quiet" disabled={busy} onClick={closeTalk}>
          {remote ? 'Hang up' : 'Say goodbye'}
        </button>
      </div>
    </>
  );
}

/** Someone in the street: a couple of lines before they decide about you. */
function StrangerTalk({ world, open, look }: { world: WorldState; open: OpenTalk; look: number }): React.JSX.Element {
  const busy = useProgress() !== null;
  const topic = findTopic('stranger')!;
  const node = open.nodeId ? topic.nodes[open.nodeId] : undefined;
  const blocker = greetBlocker(world);
  const fill = (text: string): string => text.replaceAll('{name}', 'They');

  const answer = (index: number): void => {
    if (!node) return;
    const reply = node.replies[index]!;
    const verdict = strangerTrait(look).likes[reply.style];
    const good = (open.good ?? 0) + (verdict === 'good' ? 1 : 0);
    const text = fill(reactionText(reply.style, verdict, `stranger:${look}:${world.clockDay}:${index}`, false));
    if (reply.next) {
      updateTalk({ reaction: { text, verdict }, nodeId: reply.next, good });
      return;
    }
    closeTalk();
    runTimed('Saying hello', BALANCE.relationships.greet.minutes, { type: 'greetStranger', look, goodReplies: good });
  };

  return (
    <>
      <header className="talk__head">
        <Portrait look={look} scale={4} className="person__face" />
        <div className="talk__who">
          <h2 className="talk__name" id="talk-name">
            Someone in the street
          </h2>
          <p className="talk__trait">A couple of lines to make a good impression.</p>
        </div>
      </header>
      <Reaction open={open} />
      {node && (
        <>
          <p className="talk__line">{node.npc}</p>
          <Replies replies={node.replies} disabled={busy || blocker !== null} fill={fill} onPick={answer} />
        </>
      )}
      {blocker && <p className="action__why">{blocker}</p>}
      <div className="talk__actions">
        <button type="button" className="btn btn--quiet" disabled={busy} onClick={closeTalk}>
          Walk on
        </button>
      </div>
    </>
  );
}

export function TalkDialog({ world, open }: { world: WorldState; open: OpenTalk }): React.JSX.Element | null {
  const person = open.personId ? world.people.find((p) => p.id === open.personId) : undefined;
  if (!person && open.strangerLook === undefined) return null;
  return (
    <section className="panel talk" aria-labelledby="talk-name">
      {person ? (
        <PersonTalk world={world} open={open} person={person} />
      ) : (
        <StrangerTalk world={world} open={open} look={open.strangerLook!} />
      )}
    </section>
  );
}
