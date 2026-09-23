import { useCallback, useState } from 'react';

import { salaryPerDay } from '../../core/careers/job';
import {
  applyBlocker,
  emailBlocker,
  gigBlocker,
  gigPay,
  hireChance,
  offerBlocker,
} from '../../core/laptop';
import { firstName } from '../../core/talk';
import type { Email, WorldState } from '../../core/types';
import { BALANCE } from '../../data/balance';
import { GIGS, findGig } from '../../data/gigs';
import { JOBS } from '../../data/jobs';
import { money } from '../format';
import { MINI_GAMES } from '../minigames/MiniGames';
import { runTimed, useProgress } from '../progress';
import { gameStore } from '../useGame';

/** The laptop-only apps (GDD §12): job hunting, email and side work. */

const L = BALANCE.laptop;

export function Jobs({ world }: { world: WorldState }): React.JSX.Element {
  const pending = new Set(world.applications.map((a) => a.jobId));
  return (
    <>
      <p className="panel__hint">
        Apply today, hear back by email tomorrow morning. The more you clear a job&rsquo;s bar, the likelier the
        yes. The board at Work still hires on the spot.
      </p>
      <div className="device__list">
        {JOBS.map((job) => {
          const why = applyBlocker(world, job.id);
          const needs = Object.entries(job.requirements)
            .map(([attribute, minimum]) => `${attribute.slice(0, 3)} ${minimum}`)
            .join(', ');
          return (
            <div key={job.id} className="asset">
              <div className="asset__head">
                <strong>{job.title}</strong>
                <span className="asset__price">{money(salaryPerDay(job, 0))}/day</span>
              </div>
              <span className="choice__text">
                {needs ? `Needs ${needs}` : 'No experience needed'}
                {why === null && ` · about ${Math.round(hireChance(world.character.attributes, job) * 100)}% chance`}
              </span>
              <div className="person__actions">
                <button
                  type="button"
                  className="btn btn--small"
                  disabled={why !== null}
                  title={why ?? undefined}
                  onClick={() => gameStore.dispatch({ type: 'applyJob', jobId: job.id })}
                >
                  {pending.has(job.id) ? 'Applied' : 'Apply'}
                </button>
                {why && !pending.has(job.id) && <span className="action__why">{why}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function EmailRow({ world, email }: { world: WorldState; email: Email }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const why = email.offer ? offerBlocker(world, email) : null;
  return (
    <li className={`mail ${email.read ? '' : 'mail--new'}`}>
      <button
        type="button"
        className="mail__head"
        onClick={() => {
          setOpen(!open);
          if (!email.read) gameStore.dispatch({ type: 'readEmail', emailId: email.id });
        }}
      >
        <strong>{email.subject}</strong>
        <span className="mail__from">
          {email.from} &middot; week {Math.floor(email.day / 7) + 1}
        </span>
      </button>
      {open && (
        <div className="mail__body">
          <p>{email.body}</p>
          {email.offer && (
            <button
              type="button"
              className="btn btn--small btn--primary"
              disabled={why !== null}
              title={why ?? undefined}
              onClick={() => gameStore.dispatch({ type: 'acceptOffer', emailId: email.id })}
            >
              {why ?? 'Accept the offer'}
            </button>
          )}
        </div>
      )}
    </li>
  );
}

export function Mail({ world }: { world: WorldState }): React.JSX.Element {
  const busy = useProgress() !== null;
  return (
    <>
      <h3 className="panel__subtitle">Inbox</h3>
      {world.inbox.length === 0 && <p className="panel__hint">Nothing yet.</p>}
      <ul className="news">
        {world.inbox.map((email) => (
          <EmailRow key={email.id} world={world} email={email} />
        ))}
      </ul>

      <h3 className="panel__subtitle">Write to someone</h3>
      <p className="panel__hint">A proper note: {L.emailMinutes} minutes, and a little closer. Once a day each.</p>
      <div className="person__actions">
        {world.people.map((person) => {
          const why = emailBlocker(world, person.id);
          return (
            <button
              key={person.id}
              type="button"
              className="btn btn--small"
              disabled={busy || why !== null}
              title={why ?? undefined}
              onClick={() =>
                runTimed(`Writing to ${firstName(person)}`, L.emailMinutes, { type: 'emailPerson', personId: person.id })
              }
            >
              {firstName(person)}
            </button>
          );
        })}
      </div>
    </>
  );
}

export function Freelance({ world }: { world: WorldState }): React.JSX.Element {
  const busy = useProgress() !== null;
  const [playing, setPlaying] = useState<string | null>(null);
  const [result, setResult] = useState<{ gigId: string; score: number } | null>(null);
  const done = useCallback((score: number) => {
    setPlaying((gigId) => {
      if (gigId) setResult({ gigId, score });
      return null;
    });
  }, []);
  const why = gigBlocker(world);

  if (playing) {
    const Game = MINI_GAMES[findGig(playing).game];
    return <Game onDone={done} />;
  }

  if (result) {
    const gig = findGig(result.gigId);
    return (
      <div className="mini">
        <p className="mini__big">{Math.round(result.score * 100)}%</p>
        <p className="panel__hint">
          {gig.label}: {money(gigPay(world, gig.id, result.score))} for the hour.
        </p>
        <button
          type="button"
          className="btn btn--primary"
          disabled={busy || why !== null}
          onClick={() => {
            runTimed(gig.label, L.gigMinutes, { type: 'freelance', gigId: gig.id, score: result.score });
            setResult(null);
          }}
        >
          Hand it in
        </button>
        {why && <p className="action__why">{why}</p>}
      </div>
    );
  }

  return (
    <>
      <p className="panel__hint">
        An hour&rsquo;s work each, {L.gigsPerDay} a day. Pay depends on how well you do, and on the attribute the
        work leans on.
      </p>
      <div className="device__list">
        {GIGS.map((gig) => (
          <div key={gig.id} className="asset">
            <div className="asset__head">
              <strong>{gig.label}</strong>
              <span className="asset__price">up to {money(gigPay(world, gig.id, 1))}</span>
            </div>
            <span className="choice__text">
              {gig.description} Leans on {gig.attribute}.
            </span>
            <div className="person__actions">
              <button
                type="button"
                className="btn btn--small"
                disabled={busy || why !== null}
                title={why ?? undefined}
                onClick={() => setPlaying(gig.id)}
              >
                Start
              </button>
              {why && <span className="action__why">{why}</span>}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
