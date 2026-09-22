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

  /** Boredom: mood sags a little unless something lifts it. */
  moodDriftPerDay: -0.15,

  /** Ageing: no effect while young, compounding after this age. */
  healthDecayStartAgeYears: 45,
  healthDecayPerDayPerYearOver: 0.03,

  /** The Life Summary reads this log; trimmed so saves stay small. */
  eventLogLimit: 80,

  /** Promotion gates: index = level being reached. */
  promotion: {
    tenureDaysRequired: [0, 180, 540, 1260],
    /** Extra attribute points needed per level, on top of the job's entry bar. */
    attributeBonusPerLevel: 10,
    /** Salary multiplier per level: level 2 earns 1 + 2 * 0.25 = 1.5x. */
    salaryBonusPerLevel: 0.25,
  },
} as const;
