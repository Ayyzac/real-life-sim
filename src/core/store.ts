import { findFocus } from '../data/focuses';
import { EventBus } from './bus';
import { meetsRequirements } from './careers/job';
import {
  findBusiness,
  meetsRequirements as meetsBusinessRequirements,
  upgradeCost,
} from './careers/business';
import { findSport, meetsRequirements as meetsSportRequirements } from './careers/sports';
import { findPossession, replacedBy, withPurchase } from './belongings';
import { findLifestyle } from '../data/lifestyles';
import { marriageCandidates, RELATIONSHIP_BALANCE } from './relationships';
import { findJob } from '../data/jobs';
import { advanceDay, advanceWeek, resolveEvent } from './clock';
import { createWorld, type NewGameOptions } from './character';
import { LocalStorageSaveProvider } from './save/LocalStorageSaveProvider';
import type { SaveProvider } from './save/SaveProvider';
import type { FocusId, LocationId, WorldState } from './types';

/**
 * The single seam between the simulation and everything that draws it.
 *
 * CLAUDE.md rule 5 says layers may only talk through one explicit message bus.
 * So the React UI (and, from Phase 2, the Phaser world) never calls the engine
 * directly: it sends an intent through `dispatch` and hears about the result by
 * subscribing. Neither side reaches into the other's internals.
 *
 * State is replaced, never mutated, so React can detect a change by identity.
 */

export type GameIntent =
  | { type: 'newGame'; name: string; backgroundId: string; appearanceRow?: number; seed?: number }
  | { type: 'advanceDay' }
  | { type: 'advanceWeek' }
  | { type: 'setFocus'; focusId: FocusId }
  | { type: 'enterLocation'; locationId: LocationId }
  | { type: 'chooseEventOption'; choiceId: string }
  | { type: 'takeJob'; jobId: string }
  | { type: 'quitJob' }
  | { type: 'openBusiness'; businessId: string }
  | { type: 'upgradeBusiness' }
  | { type: 'closeBusiness' }
  | { type: 'joinSport'; sportId: string }
  | { type: 'leaveSport' }
  | { type: 'buyPossession'; possessionId: string }
  | { type: 'setLifestyle'; lifestyleId: string }
  | { type: 'marry'; personId: string }
  | { type: 'reset' };

interface StoreEvents {
  changed: WorldState | null;
}

export class GameStore {
  private readonly bus = new EventBus<StoreEvents>();
  private state: WorldState | null;

  constructor(private readonly saves: SaveProvider = new LocalStorageSaveProvider()) {
    this.state = saves.load();
  }

  /** Current world, or null when no character exists yet. */
  getState = (): WorldState | null => this.state;

  /** Returns an unsubscribe function, as useSyncExternalStore expects. */
  subscribe = (listener: () => void): (() => void) => this.bus.on('changed', listener);

  dispatch = (intent: GameIntent): void => {
    const next = this.reduce(intent);
    if (next === this.state) return;

    this.state = next;
    // Autosave on every change (ARCHITECTURE §7). One write per player action
    // rather than one per simulated day - a week is 7 days but still one click.
    if (next) this.saves.save(next);
    else this.saves.clear();

    this.bus.emit('changed', next);
  };

  private reduce(intent: GameIntent): WorldState | null {
    const state = this.state;

    switch (intent.type) {
      case 'newGame':
        return createWorld(intent satisfies NewGameOptions);

      case 'buyPossession': {
        if (!state || state.deceased || state.pendingEvent) return state;

        const possession = findPossession(intent.possessionId);
        // Unlike living costs, a purchase cannot be made on money you do not
        // have. Debt is a consequence of living; it is not a way to shop.
        if (state.character.stats.money < possession.price) return state;
        if (state.character.owned.includes(possession.id)) return state;

        const replaced = replacedBy(state.character.owned, possession.id);
        const bought = {
          day: state.clockDay,
          tone: 'good' as const,
          text: replaced
            ? `Traded the ${replaced.name} for ${possession.name}, ${possession.price}.`
            : `Bought ${possession.name} for ${possession.price}.`,
        };
        return {
          ...state,
          eventLog: [bought, ...state.eventLog],
          milestones: [bought, ...state.milestones],
          character: {
            ...state.character,
            stats: {
              ...state.character.stats,
              money: state.character.stats.money - possession.price,
            },
            owned: withPurchase(state.character.owned, possession.id),
          },
        };
      }

      case 'setLifestyle': {
        if (!state || state.deceased || state.pendingEvent) return state;
        const lifestyle = findLifestyle(intent.lifestyleId);
        if (state.character.lifestyleId === lifestyle.id) return state;

        return {
          ...state,
          eventLog: [
            {
              day: state.clockDay,
              tone: 'neutral',
              text: `Started living ${lifestyle.label.toLowerCase()}.`,
            },
            ...state.eventLog,
          ],
          character: { ...state.character, lifestyleId: lifestyle.id },
        };
      }

      case 'marry': {
        if (!state || state.deceased || state.pendingEvent) return state;

        // The guard list is the same one the UI shows, so a button and the
        // store can never disagree about who you are allowed to marry.
        const candidate = marriageCandidates(state.people).find((p) => p.id === intent.personId);
        if (!candidate) return state;
        if (state.character.stats.money < RELATIONSHIP_BALANCE.weddingCost) return state;

        const married = {
          day: state.clockDay,
          tone: 'good' as const,
          text: `Married ${candidate.name}.`,
        };
        return {
          ...state,
          eventLog: [married, ...state.eventLog],
          milestones: [married, ...state.milestones],
          people: state.people.map((p) =>
            p.id === candidate.id ? { ...p, kind: 'partner' as const, closeness: 100 } : p,
          ),
          character: {
            ...state.character,
            stats: {
              ...state.character.stats,
              money: state.character.stats.money - RELATIONSHIP_BALANCE.weddingCost,
            },
          },
        };
      }

      case 'reset':
        return null;

      case 'advanceDay':
        return state ? advanceDay(state) : state;

      case 'advanceWeek':
        return state ? advanceWeek(state) : state;

      case 'chooseEventOption':
        return state ? resolveEvent(state, intent.choiceId) : state;

      case 'setFocus': {
        // A waiting event blocks everything else: the player has to answer it
        // before the week can carry on.
        if (!state || state.deceased || state.pendingEvent) return state;
        const focus = findFocus(intent.focusId);
        if (state.character.focusId === focus.id) return state;
        return {
          ...state,
          character: { ...state.character, focusId: focus.id, location: focus.locationId },
        };
      }

      case 'enterLocation': {
        // Same guard as every other action: while an event waits, nothing
        // else may happen, or the player could walk away from a stopped week.
        if (!state || state.deceased || state.pendingEvent) return state;
        if (state.character.location === intent.locationId) return state;
        // Moving is not choosing: the focus stays exactly where it was.
        return {
          ...state,
          character: { ...state.character, location: intent.locationId },
        };
      }

      case 'takeJob': {
        if (!state || state.deceased || state.pendingEvent) return state;
        const job = findJob(intent.jobId);
        // Guard here too: the UI hides jobs you cannot get, but the store is
        // the thing that has to be right.
        if (!meetsRequirements(state.character.attributes, job)) return state;

        // One career slot (ARCHITECTURE §5). Without this guard, taking a job
        // would silently delete a business the player paid to open, or a
        // sporting career they spent years building.
        const held = state.character.career.type;
        if (held === 'business' || held === 'sports') return state;

        const hired = { day: state.clockDay, tone: 'good' as const, text: `Hired as ${job.title}.` };
        return {
          ...state,
          eventLog: [hired, ...state.eventLog],
          milestones: [hired, ...state.milestones],
          character: {
            ...state.character,
            career: { type: 'job', jobId: job.id, tenureDays: 0, level: 0 },
          },
        };
      }

      case 'openBusiness': {
        if (!state || state.deceased || state.pendingEvent) return state;
        // One career slot: the old one has to be given up first, deliberately
        // as a separate decision rather than a silent swap.
        if (state.character.career.type !== 'none') return state;

        const business = findBusiness(intent.businessId);
        if (!meetsBusinessRequirements(state.character.attributes, business)) return state;
        // Capital is real (user decision, 22 Sep 2026): no opening a business
        // you cannot pay for. This is what finally gives saving a purpose.
        if (state.character.stats.money < business.startupCost) return state;

        const opened = {
          day: state.clockDay,
          tone: 'good' as const,
          text: `Opened ${business.name} for ${business.startupCost}.`,
        };
        return {
          ...state,
          eventLog: [opened, ...state.eventLog],
          milestones: [opened, ...state.milestones],
          character: {
            ...state.character,
            stats: {
              ...state.character.stats,
              money: state.character.stats.money - business.startupCost,
            },
            career: { type: 'business', businessId: business.id, daysOpen: 0, level: 0 },
          },
        };
      }

      case 'upgradeBusiness': {
        if (!state || state.deceased || state.pendingEvent) return state;
        const career = state.character.career;
        if (career.type !== 'business') return state;

        const cost = upgradeCost(career.level);
        if (cost === null || state.character.stats.money < cost) return state;

        const business = findBusiness(career.businessId);
        const level = career.level + 1;
        const grown = {
          day: state.clockDay,
          tone: 'good' as const,
          text: `Put ${cost} into ${business.name}. Now level ${level}.`,
        };
        return {
          ...state,
          eventLog: [grown, ...state.eventLog],
          milestones: [grown, ...state.milestones],
          character: {
            ...state.character,
            stats: { ...state.character.stats, money: state.character.stats.money - cost },
            career: { ...career, level },
          },
        };
      }

      case 'closeBusiness': {
        if (!state || state.deceased || state.pendingEvent) return state;
        const career = state.character.career;
        if (career.type !== 'business') return state;

        const business = findBusiness(career.businessId);
        // Nothing comes back. Walking away is a loss, which is what makes the
        // decision to open one carry weight.
        const closed = {
          day: state.clockDay,
          tone: 'neutral' as const,
          text: `Closed ${business.name} after ${Math.floor(career.daysOpen / 7)} weeks.`,
        };
        return {
          ...state,
          eventLog: [closed, ...state.eventLog],
          milestones: [closed, ...state.milestones],
          character: { ...state.character, career: { type: 'none' } },
        };
      }

      case 'joinSport': {
        if (!state || state.deceased || state.pendingEvent) return state;
        // One career slot: the old one has to be given up first, deliberately
        // as its own decision rather than a silent swap.
        if (state.character.career.type !== 'none') return state;

        const sport = findSport(intent.sportId);
        if (!meetsSportRequirements(state.character.attributes, sport)) return state;

        const joined = {
          day: state.clockDay,
          tone: 'good' as const,
          text: `Took up ${sport.name}.`,
        };
        return {
          ...state,
          eventLog: [joined, ...state.eventLog],
          milestones: [joined, ...state.milestones],
          character: {
            ...state.character,
            career: {
              type: 'sports',
              sportId: sport.id,
              skill: 0,
              reputation: 0,
              daysSinceMatch: 0,
              wins: 0,
              losses: 0,
            },
          },
        };
      }

      case 'leaveSport': {
        if (!state || state.deceased || state.pendingEvent) return state;
        const career = state.character.career;
        if (career.type !== 'sports') return state;

        const sport = findSport(career.sportId);
        const record = `${career.wins}-${career.losses}`;
        const left = {
          day: state.clockDay,
          tone: 'neutral' as const,
          text: `Retired from ${sport.name} with a record of ${record}.`,
        };
        return {
          ...state,
          eventLog: [left, ...state.eventLog],
          milestones: [left, ...state.milestones],
          character: { ...state.character, career: { type: 'none' } },
        };
      }

      case 'quitJob': {
        if (!state || state.deceased || state.pendingEvent) return state;
        if (state.character.career.type !== 'job') return state;
        const job = findJob(state.character.career.jobId);
        return {
          ...state,
          eventLog: [
            { day: state.clockDay, tone: 'neutral', text: `Quit the ${job.title} job.` },
            ...state.eventLog,
          ],
          character: { ...state.character, career: { type: 'none' } },
        };
      }
    }
  }
}
