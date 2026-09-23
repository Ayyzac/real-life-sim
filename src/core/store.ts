import { DEFAULT_FOCUS_ID, findFocus } from '../data/focuses';
import { EventBus } from './bus';
import { meetsRequirements } from './careers/job';
import {
  findBusiness,
  meetsRequirements as meetsBusinessRequirements,
  upgradeCost,
} from './careers/business';
import { findSport, meetsRequirements as meetsSportRequirements } from './careers/sports';
import { findPossession, replacedBy, withPurchase } from './belongings';
import { isGymMember } from './gym';
import { buyItem, consumeItem } from './bag';
import { caughtInRain } from './weather';
import { deliverDue, orderFood, takeTaxi } from './phone';
import { advanceMarket, bankMove, buyAsset, sellAsset, type BankMove } from './finance';
import { applyForJob, doGig, emailPerson, offerBlocker } from './laptop';
import { dealBlackjack, hitBlackjack, spinRoulette, spinSlot, standBlackjack, type RouletteBet } from './gamble';
import type { Venue } from '../data/gambling';
import { findLifestyle } from '../data/lifestyles';
import { marriageCandidates, RELATIONSHIP_BALANCE } from './relationships';
import { findJob } from '../data/jobs';
import { advanceDay, advanceWeek, resolveEvent } from './clock';
import { performAction, skipWork, startBlock, tick } from './day';
import { withLogEntry, withMilestone } from './log';
import { createWorld, type NewGameOptions } from './character';
import { BALANCE } from '../data/balance';
import { characterLook, decodeLook, encodeLook } from './look';
import { dollars } from './money';
import { askOut, greetStranger, invite, talk, type Outing } from './talk';
import type { ReplyStyle } from '../data/dialogue';
import { LocalStorageSaveProvider } from './save/LocalStorageSaveProvider';
import type { SaveProvider } from './save/SaveProvider';
import type { Character, FocusId, LocationId, WorldState } from './types';

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
  | { type: 'newGame'; name: string; backgroundId: string; appearanceRow?: number; look?: number; seed?: number }
  | { type: 'advanceDay' }
  | { type: 'tick'; minutes: number }
  | { type: 'advanceWeek' }
  | { type: 'doAction'; actionId: string }
  | { type: 'startBlock' }
  | { type: 'skipWork' }
  | { type: 'buyClothes'; top: number }
  | { type: 'talk'; personId: string; style: ReplyStyle; remote?: boolean }
  | { type: 'taxi'; locationId: LocationId }
  | { type: 'orderFood'; itemId: string }
  | { type: 'buyAsset'; assetId: string; dollars: number }
  | { type: 'sellAsset'; assetId: string; share: number }
  | { type: 'bank'; move: BankMove; amount: number }
  | { type: 'applyJob'; jobId: string }
  | { type: 'acceptOffer'; emailId: string }
  | { type: 'readEmail'; emailId: string }
  | { type: 'emailPerson'; personId: string }
  | { type: 'freelance'; gigId: string; score: number }
  | { type: 'spinSlot'; bet: number; venue: Venue }
  | { type: 'spinRoulette'; bet: number; on: RouletteBet }
  | { type: 'dealBlackjack'; bet: number }
  | { type: 'hitBlackjack' }
  | { type: 'standBlackjack' }
  | { type: 'askOut'; personId: string }
  | { type: 'invite'; personId: string; outing: Outing }
  | { type: 'greetStranger'; look: number }
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
  | { type: 'joinGym' }
  | { type: 'buyItem'; itemId: string }
  | { type: 'useItem'; itemId: string }
  | { type: 'leaveGym' }
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
    const before = this.state;
    const reduced = this.reduce(intent);
    // Food ordered by phone arrives whenever the clock passes its time,
    // whatever moved the clock.
    // Markets move by the hour in the same way.
    // Only after a real change: a refused click must leave the world untouched.
    const next = reduced && reduced !== before ? advanceMarket(deliverDue(reduced)) : reduced;
    if (next === before) return;

    this.state = next;
    if (next) this.causes.set(next, intent.type);
    // Autosave on every change (ARCHITECTURE §7). One write per player action
    // rather than one per simulated day - a week is 7 days but still one click.
    // The running clock is the exception: it changes the world every second,
    // so it is written once per game hour, plus whenever the page goes away.
    if (!next) this.saves.clear();
    else if (intent.type !== 'tick' || !before || hourOf(before) !== hourOf(next)) this.saves.save(next);
    this.unsaved = next !== null && intent.type === 'tick' && before !== null && hourOf(before) === hourOf(next);

    this.bus.emit('changed', next);
  };

  /**
   * Writes the minutes the clock ran since the last save - for when the page
   * is closing. Only if there are any: a second tab left open in the
   * background has nothing unsaved, and must not overwrite the save the
   * player is actually using with its own stale copy.
   */
  flush = (): void => {
    if (!this.state || !this.unsaved) return;
    this.saves.save(this.state);
    this.unsaved = false;
  };

  private unsaved = false;

  /**
   * Which intent produced this world, if it came from here. Lets a screen
   * tell the clock ticking over from something the player did.
   */
  causeOf = (world: WorldState): GameIntent['type'] | undefined => this.causes.get(world);

  private readonly causes = new WeakMap<WorldState, GameIntent['type']>();

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
            ? `Traded the ${replaced.name} for ${possession.name}, ${dollars(possession.price)}.`
            : `Bought ${possession.name} for ${dollars(possession.price)}.`,
        };
        return {
          ...state,
          eventLog: withLogEntry(state.eventLog, bought),
          milestones: withMilestone(state.milestones, bought),
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
          eventLog: withLogEntry(state.eventLog, {
            day: state.clockDay,
            tone: 'neutral',
            text: `Lifestyle changed to ${lifestyle.label}.`,
          }),
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
          eventLog: withLogEntry(state.eventLog, married),
          milestones: withMilestone(state.milestones, married),
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

      case 'joinGym': {
        if (!state || state.deceased || state.pendingEvent) return state;
        if (isGymMember(state.character)) return state;
        // The first month is paid up front, and like any purchase it cannot
        // be paid with money you do not have. Renewals are bills, and can.
        if (state.character.stats.money < BALANCE.gym.fee) return state;
        return {
          ...state,
          eventLog: withLogEntry(state.eventLog, {
            day: state.clockDay,
            tone: 'good',
            text: `Joined the gym, ${dollars(BALANCE.gym.fee)} a month.`,
          }),
          character: {
            ...state.character,
            stats: { ...state.character.stats, money: state.character.stats.money - BALANCE.gym.fee },
            gymPaidUntil: state.clockDay + BALANCE.gym.days,
          },
        };
      }

      case 'leaveGym': {
        if (!state || state.deceased || state.pendingEvent) return state;
        if (!isGymMember(state.character)) return state;
        // Nothing back for the rest of the month. Training at the gym stops
        // with the membership, the same way minding a shop stops with the shop.
        const focus = findFocus(state.character.focusId);
        return {
          ...state,
          eventLog: withLogEntry(state.eventLog, {
            day: state.clockDay,
            tone: 'neutral',
            text: 'Cancelled the gym membership.',
          }),
          character: {
            ...state.character,
            gymPaidUntil: null,
            focusId: focus.membersOnly ? DEFAULT_FOCUS_ID : focus.id,
          },
        };
      }

      case 'buyItem':
        return state ? buyItem(state, intent.itemId) : state;

      case 'useItem': {
        if (!state) return state;
        const next = consumeItem(state, intent.itemId);
        return next.minuteOfDay >= BALANCE.day.latest ? advanceDay(next) : next;
      }

      case 'reset':
        return null;

      case 'advanceDay':
        return state ? advanceDay(state) : state;

      case 'advanceWeek':
        return state ? advanceWeek(state) : state;

      case 'tick': {
        if (!state) return state;
        const next = tick(state, intent.minutes);
        // 02:00 is as late as it goes, the same as for an action.
        return next.minuteOfDay >= BALANCE.day.latest ? advanceDay(next) : next;
      }

      case 'doAction': {
        if (!state) return state;
        const next = performAction(state, intent.actionId);
        // 02:00 is as late as it goes: the character falls asleep where they stand.
        return next.minuteOfDay >= BALANCE.day.latest ? advanceDay(next) : next;
      }

      case 'startBlock':
        return state ? startBlock(state) : state;

      case 'skipWork':
        return state ? skipWork(state) : state;

      case 'talk':
        return state ? talk(state, intent.personId, intent.style, intent.remote ?? false) : state;

      case 'taxi':
        return state ? takeTaxi(state, intent.locationId) : state;

      case 'orderFood':
        return state ? orderFood(state, intent.itemId) : state;

      case 'buyAsset':
        return state ? buyAsset(state, intent.assetId, intent.dollars) : state;

      case 'sellAsset':
        return state ? sellAsset(state, intent.assetId, intent.share) : state;

      case 'bank':
        return state ? bankMove(state, intent.move, intent.amount) : state;

      case 'applyJob':
        return state ? applyForJob(state, intent.jobId) : state;

      case 'readEmail': {
        if (!state) return state;
        const email = state.inbox.find((e) => e.id === intent.emailId);
        if (!email || email.read) return state;
        return { ...state, inbox: state.inbox.map((e) => (e === email ? { ...e, read: true } : e)) };
      }

      case 'acceptOffer': {
        if (!state) return state;
        const email = state.inbox.find((e) => e.id === intent.emailId);
        if (!email?.offer || offerBlocker(state, email) !== null) return state;
        // The same door as the job board, with every guard it has - a
        // business owner still cannot walk away from their shop by email.
        const hired = this.reduce({ type: 'takeJob', jobId: email.offer.jobId });
        if (!hired || hired === state) return state;
        return {
          ...hired,
          inbox: hired.inbox.map((e) => (e.id === email.id ? { ...e, read: true, offer: undefined } : e)),
        };
      }

      case 'emailPerson':
        return state ? emailPerson(state, intent.personId) : state;

      case 'freelance': {
        if (!state) return state;
        const next = doGig(state, intent.gigId, intent.score);
        return next.minuteOfDay >= BALANCE.day.latest ? advanceDay(next) : next;
      }

      case 'spinSlot':
      case 'spinRoulette':
      case 'dealBlackjack':
      case 'hitBlackjack':
      case 'standBlackjack': {
        if (!state) return state;
        const next = gamble(state, intent);
        // The last hand can run into 02:00 like anything else.
        return next.minuteOfDay >= BALANCE.day.latest ? advanceDay(next) : next;
      }

      case 'askOut':
        return state ? askOut(state, intent.personId) : state;

      case 'invite':
        return state ? invite(state, intent.personId, intent.outing) : state;

      case 'greetStranger':
        return state ? greetStranger(state, intent.look) : state;

      case 'buyClothes': {
        // A new top from the Mall (GDD §11.5): the time, price and mood of an
        // ordinary action, and then the look changes.
        if (!state) return state;
        const parts = decodeLook(characterLook(state.character));
        if (parts.top === intent.top) return state;
        const shopped = performAction(state, 'buy_clothes');
        if (shopped === state) return state;
        return {
          ...shopped,
          eventLog: withLogEntry(shopped.eventLog, {
            day: shopped.clockDay,
            tone: 'good',
            text: 'Bought some new clothes.',
          }),
          character: { ...shopped.character, look: encodeLook({ ...parts, top: intent.top }) },
        };
      }

      case 'chooseEventOption':
        return state ? resolveEvent(state, intent.choiceId) : state;

      case 'setFocus': {
        // A waiting event blocks everything else: the player has to answer it
        // before the week can carry on.
        if (!state || state.deceased || state.pendingEvent) return state;
        const focus = findFocus(intent.focusId);
        if (state.character.focusId === focus.id) return state;
        if (focus.membersOnly && !isGymMember(state.character)) return state;
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
        // Moving is not choosing: the focus stays exactly where it was. The
        // walk is outdoors, so the weather has its say (GDD §12).
        return caughtInRain({
          ...state,
          character: { ...state.character, location: intent.locationId },
        });
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
          eventLog: withLogEntry(state.eventLog, hired),
          milestones: withMilestone(state.milestones, hired),
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
          text: `Opened ${business.name} for ${dollars(business.startupCost)}.`,
        };
        return {
          ...state,
          eventLog: withLogEntry(state.eventLog, opened),
          milestones: withMilestone(state.milestones, opened),
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
          text: `Put ${dollars(cost)} into ${business.name}. Now level ${level}.`,
        };
        return {
          ...state,
          eventLog: withLogEntry(state.eventLog, grown),
          milestones: withMilestone(state.milestones, grown),
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
          eventLog: withLogEntry(state.eventLog, closed),
          milestones: withMilestone(state.milestones, closed),
          character: leaveCareer(state.character),
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
          eventLog: withLogEntry(state.eventLog, joined),
          milestones: withMilestone(state.milestones, joined),
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
          eventLog: withLogEntry(state.eventLog, left),
          milestones: withMilestone(state.milestones, left),
          character: leaveCareer(state.character),
        };
      }

      case 'quitJob': {
        if (!state || state.deceased || state.pendingEvent) return state;
        if (state.character.career.type !== 'job') return state;
        const job = findJob(state.character.career.jobId);
        return {
          ...state,
          eventLog: withLogEntry(state.eventLog, {
            day: state.clockDay,
            tone: 'neutral',
            text: `Quit the ${job.title} job.`,
          }),
          character: leaveCareer(state.character),
        };
      }
    }
  }
}

function hourOf(world: WorldState): number {
  return world.clockDay * 100 + Math.floor(world.minuteOfDay / 60);
}

function gamble(
  state: WorldState,
  intent: Extract<GameIntent, { type: 'spinSlot' | 'spinRoulette' | 'dealBlackjack' | 'hitBlackjack' | 'standBlackjack' }>,
): WorldState {
  switch (intent.type) {
    case 'spinSlot':
      return spinSlot(state, intent.bet, intent.venue);
    case 'spinRoulette':
      return spinRoulette(state, intent.bet, intent.on);
    case 'dealBlackjack':
      return dealBlackjack(state, intent.bet);
    case 'hitBlackjack':
      return hitBlackjack(state);
    case 'standBlackjack':
      return standBlackjack(state);
  }
}

/**
 * Giving up a career also gives up the focus that only made sense with it.
 * Without this, closing a shop left "Mind the shop" running: a day's energy
 * spent every day on nothing, with its button gone from the menu.
 */
function leaveCareer(character: Character): Character {
  const focus = findFocus(character.focusId);
  const tied = focus.worksJob || focus.runsBusiness || focus.trainsSport;
  return {
    ...character,
    career: { type: 'none' },
    focusId: tied ? DEFAULT_FOCUS_ID : character.focusId,
  };
}
