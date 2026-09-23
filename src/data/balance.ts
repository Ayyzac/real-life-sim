/**
 * Every tunable number in one place.
 *
 * Tone chosen by the user on 2026-09-22: "seimbang" - a routine job covers
 * living costs and leaves a little to save, health punishes neglect without
 * ambushing the player. Tuning the game means editing this file, not the engine.
 *
 * All rates are PER DAY. One click of "Advance Week" applies them seven times.
 */
export const BALANCE = {
  startAgeYears: 18,
  startMoney: 400,
  startStats: { health: 80, energy: 80, mood: 65 },
  startAttributes: { intelligence: 12, physical: 12, charisma: 12 },

  /** Rent, food, transport. Charged every day, working or not. */
  livingCostPerDay: 22,

  /**
   * Being in debt (GDD §9.4).
   *
   * Phase 1 allowed money to go negative with no consequence and recorded it
   * as a deliberate simplification to be settled in Phase 5 balancing. This is
   * that settlement. Debt is still allowed - bills do not stop because you
   * cannot pay them - but it wears on you, which gives the player a reason to
   * do something about it and a signal that something is wrong.
   *
   * Small on purpose: it should press, not kill. The exhaustion floor already
   * guarantees that only visible decline ends a life (§6).
   */
  debt: {
    moodPerDay: -0.55,
    healthPerDay: -0.07,
    /** Debt never pushes health below this on its own. */
    healthFloor: 30,
  },

  /** Stats other than money are clamped to this range. */
  statMin: 0,
  statMax: 100,

  /** Running on empty costs health. */
  lowEnergyThreshold: 20,
  lowEnergyHealthPenaltyPerDay: 0.4,
  /**
   * Exhaustion wears a body down but does not kill it on its own: the penalty
   * stops here. Without this floor, a character who only ever worked died
   * inside eight months - far too fast to count as the "visible decline"
   * death the user asked for. Below this line only ageing and illness bite.
   */
  exhaustionHealthFloor: 25,

  /** Boredom: mood sags a little unless something lifts it. */
  moodDriftPerDay: -0.15,

  /** Ageing: no effect while young, compounding after this age. */
  healthDecayStartAgeYears: 45,
  healthDecayPerDayPerYearOver: 0.04,

  /** The Recent panel reads this log; trimmed so saves stay small. */
  eventLogLimit: 80,
  /** Milestones must survive decades, so they are trimmed far more slowly. */
  milestoneLimit: 60,

  /**
   * Chance that SOMETHING happens on a given day. One roll per day picks at
   * most one event, rather than each event rolling separately - that keeps the
   * pace controllable from this one number.
   *
   * 0.045/day is roughly one event every three weeks.
   */
  eventChancePerDay: 0.045,

  /**
   * An event may bring a healthy character to the brink but never kill them
   * outright: death is always preceded by visible decline (user decision,
   * 22 Sep 2026). So event damage normally stops here.
   */
  eventHealthFloor: 1,
  /**
   * ...except for someone already this ill, who an event CAN finish off.
   *
   * Without this exception nothing could kill a character under 45 at all:
   * exhaustion stops at its own floor and ageing has not started, so they
   * were literally immortal. Dying here still counts as a visible decline -
   * the player has been staring at a red health warning for a long time.
   */
  criticalHealth: 15,

  /**
   * Running a business (GDD §4.2, user decisions 22 Sep 2026).
   *
   * The whole point of a business over a job is that it earns while you are
   * doing something else - but only part of it does. Costs are charged in
   * full every day regardless, so a big business left alone LOSES money.
   * That is deliberate: it is what makes attention worth something.
   */
  business: {
    /**
     * Cost of reaching each level. Index 0 is the level you open at.
     *
     * Chosen so the first one is a real decision early on rather than loose
     * change. How much they matter against a whole lifetime of income is a
     * Phase 5 balancing question, not this phase's.
     */
    upgradeCost: [0, 5_000, 20_000, 60_000],
    /** Takings multiplier per level: level 2 earns 1 + 2 * 0.3 = 1.6x. */
    revenueBonusPerLevel: 0.3,
  },

  /**
   * Being an athlete (GDD §4.3, user decisions 22 Sep 2026).
   *
   * Prize money only: win big, lose almost nothing. That makes sport the
   * risky career next to a steady job and a passive business, which is the
   * whole reason for it to exist as a third option.
   */
  sports: {
    /** Skill gained per day of training. Slow, like an attribute. */
    skillPerTrainingDay: 0.06,
    /** Skill ceiling, so training cannot run away forever. */
    maxSkill: 100,
    /** How much the sport's key attribute counts alongside raw skill. */
    attributeWeight: 0.5,
    /**
     * Age is the athlete's real opponent. Nothing happens before this age;
     * after it, match strength falls away and so do the prizes. Nobody is
     * forced to retire (user decision) - the numbers simply stop working,
     * and the player decides when to walk.
     */
    peakAgeYears: 32,
    declinePerYearOver: 0.05,
    /** Never quite zero: a veteran is worse, not absent. */
    minAgeFactor: 0.15,
    /** Reputation moves this much per result, and is clamped 0-100. */
    reputationPerWin: 4,
    reputationPerLoss: -2,
    /** Full reputation doubles the purse. */
    prizeBonusAtFullReputation: 1,
  },

  /**
   * The people around the player (GDD §10, user decisions 22 Sep 2026).
   *
   * They live their own lives: they age, work, marry, have children and die
   * whether the player is paying attention or not. The caps are not a style
   * choice - the save sits in localStorage under a size test, and an unpruned
   * 70 years of acquaintances would break saving silently mid-game.
   */
  relationships: {
    /** Living people the player knows at once. New faces wait for a gap. */
    maxLivingPeople: 12,
    /** Condensed one-line memories kept for the Life Summary. */
    memoryLimit: 40,

    /** Closeness fades unless something keeps it up. */
    closenessDriftPerDay: -0.05,
    /** What a day of Socialising adds to everyone you know. */
    closenessPerSocialDay: 0.9,
    /** Below this for long enough and they drift out of your life. */
    driftAwayBelow: 5,
    driftAwayAfterDays: 420,

    /** Chance per day that you meet somebody new, when there is room. */
    meetChancePerDay: 0.0018,
    /** Chance per day that a person's own life moves on in some way. */
    npcLifeChancePerDay: 0.003,

    /** Old age for the people around you, on the same curve idea as §6. */
    npcDeathStartAgeYears: 62,
    npcDeathChancePerDayPerYearOver: 0.00003,

    /** Marrying: a lump sum, a closeness bar, and being old enough. */
    weddingCost: 18_000,
    marriageClosenessRequired: 70,
    marriageMinAgeYears: 20,

    /**
     * Each child, every day, for as long as they are dependent.
     *
     * Four children to eighteen comes to about $184,000: the same order as a
     * house, so a big family and a good home are comparable decisions
     * (GDD §9.4), with just enough left over for something smaller.
     *
     * Found by simulation, not by guessing. At 16/day a family cost $420,000
     * and bankrupted every career; at 10/day it still left an ordinary earner
     * permanently under water.
     */
    childCostPerDay: 7,
    childMoodPerDay: 0.35,
    childDependentUntilAgeYears: 18,
    /** Chance per day of a child arriving, once married. */
    childChancePerDay: 0.0016,
    maxChildren: 4,

    /** A partner is worth having around. */
    partnerMoodPerDay: 0.6,

    /**
     * Talking to someone (GDD §11.6). A reply that suits them moves closeness
     * a lot, one that does not a little, and one that grates takes some back.
     * Charisma scales the good side; being unwashed halves it.
     */
    talk: { minutes: 30, good: 5, neutral: 2, bad: -2, mood: 1, revealAfter: 2 },
    /** Dating: close enough to ask, and close enough (with their nature) to say yes. */
    askOutCloseness: 60,
    acceptCloseness: 70,
    /** Someone you are seeing and have let go cold for this long ends it. */
    breakupBelow: 25,
    breakupAfterDays: 60,
    breakupMood: -6,
    /** An outing by phone: dinner at the Cafe or a film at the Mall, paid for two. */
    invite: { minutes: 120, cost: 30, closeness: 8, mood: 4, minCloseness: 25 },
    /** Saying hello to strangers in the street. */
    greet: { minutes: 10, perDay: 3, baseChance: 0.25, charismaPerPoint: 0.005, maxChance: 0.75, closeness: 20 },
    /** Losing someone hurts in proportion to how close you were. */
    griefMoodPerCloseness: 0.45,
  },

  /**
   * One day, hour by hour (GDD §11, user decisions 23 Sep 2026).
   *
   * Times are minutes after midnight; after midnight keeps counting past
   * 1440, so 01:00 is 1500. Needs only move while the clock is actually
   * played - a day skipped with Advance is lived sensibly by assumption, which
   * is what keeps every lifetime balance test above valid.
   */
  day: {
    wake: 7 * 60,
    blockStart: 9 * 60,
    blockEnd: 17 * 60,
    midnight: 24 * 60,
    /** Staying up is allowed until 02:00; then the character falls asleep. */
    latest: 26 * 60,

    /** Where hunger, thirst and hygiene stand every morning. */
    morningNeeds: { hunger: 60, thirst: 60, hygiene: 55 },
    /** Lost per hour of played time. */
    needsPerHour: { hunger: -4, thirst: -6, hygiene: -3 },
    /** At work or training, lunch and water are part of the day. */
    blockNeedsRate: 0.5,

    /** Below this a need starts to cost mood and energy. */
    lowNeed: 20,
    lowNeedPerHour: { mood: -1.5, energy: -1 },
    /** Going to bed hungry or thirsty: the next day starts behind. */
    hungryBedtime: { energy: -8, mood: -3 },
    /** Each hour awake past midnight, taken off tomorrow's energy. */
    lateNightEnergyPerHour: -6,
  },

  /**
   * Weekends and missed days (GDD §11.3, user decisions 23 Sep 2026).
   *
   * Employees get Saturday and Sunday off, lived as rest days, and are paid
   * for the days they work. Paying the weekend too (7/5 on weekdays) was
   * tried first and doubled a clerk's lifetime money: with weekends to rest
   * on, careful players almost never need a week off any more. Measured over
   * three lives, 23 Sep 2026: peak $450k before weekends, $945k at 7/5,
   * $490k paying weekdays only - back inside GDD §9.4.
   */
  work: {
    /** A mark for skipping work fades completely in about a month. */
    strikeFadePerDay: 1 / 30,
    /** A warning at this many marks, the sack at this many. */
    warnAtStrikes: 3,
    fireAtStrikes: 5,
    /** Turning up unwashed counts for half a missed day. */
    unwashedStrike: 0.5,
  },

  /**
   * Gym membership (GDD §12). Paid a month ahead, renewed automatically.
   * About $1.50 a day: a real line on the budget, not a wall.
   */
  gym: { fee: 45, days: 30 },

  /** Promotion gates: index = level being reached. */
  promotion: {
    tenureDaysRequired: [0, 180, 540, 1260],
    /** Extra attribute points needed per level, on top of the job's entry bar. */
    attributeBonusPerLevel: 10,
    /** Salary multiplier per level: level 2 earns 1 + 2 * 0.25 = 1.5x. */
    salaryBonusPerLevel: 0.25,
  },
} as const;
