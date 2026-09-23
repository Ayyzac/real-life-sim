import { describe, expect, it } from 'vitest';

import { createWorld } from '../../src/core/character';
import { advanceDay } from '../../src/core/clock';
import {
  applyBlocker,
  applyForJob,
  doGig,
  emailPerson,
  gigBlocker,
  gigPay,
  hireChance,
  laptopBlocker,
} from '../../src/core/laptop';
import type { SaveProvider } from '../../src/core/save/SaveProvider';
import { GameStore } from '../../src/core/store';
import type { Character, WorldState } from '../../src/core/types';
import { BALANCE } from '../../src/data/balance';
import { findJob, JOBS } from '../../src/data/jobs';

const L = BALANCE.laptop;

function world(patch: Partial<Character> = {}, state: Partial<WorldState> = {}): WorldState {
  const base = createWorld({ name: 'Typist', backgroundId: 'scholarship', seed: 29 });
  return {
    ...base,
    minuteOfDay: 19 * 60,
    ...state,
    character: { ...base.character, focusId: 'rest', owned: ['laptop'], location: 'home', ...patch },
  };
}

function storeWith(state: WorldState): GameStore {
  const saves: SaveProvider = { save() {}, load: () => state, clear() {} };
  return new GameStore(saves);
}

/** Applies for the cashier job on successive days until one is a yes. */
function anOffer(): { store: GameStore; emailId: string } {
  for (let day = 0; day < 60; day += 1) {
    const store = storeWith(world({}, { clockDay: day }));
    store.dispatch({ type: 'applyJob', jobId: 'cashier' });
    store.dispatch({ type: 'advanceDay' });
    const offer = store.getState()!.inbox.find((email) => email.offer);
    if (offer) return { store, emailId: offer.id };
  }
  throw new Error('no offer in 60 tries');
}

describe('the laptop (GDD §12)', () => {
  it('has to be owned, and is used at home', () => {
    expect(laptopBlocker(world())).toBeNull();
    expect(laptopBlocker(world({ owned: [] }))).toBe('You do not own a laptop');
    expect(laptopBlocker(world({ location: 'cafe' }))).toBe('The laptop is at home');
  });

  it('only sends applications for jobs you could do, one per job', () => {
    const surgeon = JOBS.find((job) => Object.keys(job.requirements).length > 0 && job.id === 'surgeon')!;
    expect(applyBlocker(world(), surgeon.id)).toBe('Not qualified yet');
    const applied = applyForJob(world(), 'cashier');
    expect(applied.applications).toEqual([{ jobId: 'cashier', day: 0 }]);
    expect(applyBlocker(applied, 'cashier')).toMatch(/Applied/);
  });

  it('gives better odds to someone who clears the bar by more', () => {
    const job = findJob('office_clerk');
    const barely = { intelligence: 25, physical: 0, charisma: 25 };
    const easily = { intelligence: 60, physical: 60, charisma: 60 };
    expect(hireChance(easily, job)).toBeGreaterThan(hireChance(barely, job));
    expect(hireChance(easily, job)).toBeLessThanOrEqual(L.maxHireChance);
  });

  it('answers every application by email overnight', () => {
    const next = advanceDay(applyForJob(world(), 'cashier'));
    expect(next.applications).toEqual([]);
    expect(next.inbox).toHaveLength(1);
    expect(next.inbox[0]!.read).toBe(false);
  });

  it('hires through an accepted offer, the same way as the job board', () => {
    const { store, emailId } = anOffer();
    store.dispatch({ type: 'acceptOffer', emailId });
    const hired = store.getState()!;
    expect(hired.character.career).toMatchObject({ type: 'job', jobId: 'cashier' });
    expect(hired.inbox.find((e) => e.id === emailId)!.offer).toBeUndefined();
  });

  it('lets an offer lapse, and never lets a business owner walk out by email', () => {
    const { store, emailId } = anOffer();
    const offered = store.getState()!;

    const late = storeWith({ ...offered, clockDay: offered.clockDay + L.offerDays + 1 });
    late.dispatch({ type: 'acceptOffer', emailId });
    expect(late.getState()!.character.career.type).toBe('none');

    const owner = storeWith({
      ...offered,
      character: { ...offered.character, career: { type: 'business', businessId: 'market_stall', daysOpen: 3, level: 0 } },
    });
    owner.dispatch({ type: 'acceptOffer', emailId });
    expect(owner.getState()!.character.career.type).toBe('business');
  });

  it('writes to someone once a day, for a little closeness', () => {
    const start = world();
    const person = start.people[0]!;
    const wrote = emailPerson(start, person.id);
    expect(wrote.minuteOfDay).toBe(start.minuteOfDay + L.emailMinutes);
    expect(wrote.people[0]!.closeness).toBeGreaterThan(person.closeness);
    expect(emailPerson(wrote, person.id)).toBe(wrote);
  });

  it('pays side work by score and attribute, two gigs a day at most', () => {
    const start = world();
    expect(gigPay(start, 'data_entry', 0)).toBe(0);
    expect(gigPay(start, 'data_entry', 5)).toBe(gigPay(start, 'data_entry', 1));
    expect(gigPay(start, 'data_entry', 1)).toBeLessThan(20);

    const one = doGig(start, 'data_entry', 1);
    expect(one.character.stats.money).toBe(start.character.stats.money + gigPay(start, 'data_entry', 1));
    expect(one.minuteOfDay).toBe(start.minuteOfDay + L.gigMinutes);
    const two = doGig(one, 'bookkeeping', 0.5);
    expect(gigBlocker(two)).toMatch(/gigs a day/);
  });
});
