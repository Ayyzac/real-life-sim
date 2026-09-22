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

  /** Promotion gates: index = level being reached. */
  promotion: {
    tenureDaysRequired: [0, 180, 540, 1260],
    /** Extra attribute points needed per level, on top of the job's entry bar. */
    attributeBonusPerLevel: 10,
    /** Salary multiplier per level: level 2 earns 1 + 2 * 0.25 = 1.5x. */
    salaryBonusPerLevel: 0.25,
  },
} as const;
