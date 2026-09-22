/**
 * Names for the people around the player (GDD §10).
 *
 * Data, like everything else. They are drawn with the simulation's own seeded
 * RNG, so the same seed always produces the same cast - which is what makes a
 * whole life reproducible in a test.
 */

export const FIRST_NAMES: readonly string[] = [
  'Ada', 'Bram', 'Cahya', 'Dita', 'Elias', 'Farah', 'Gilang', 'Hana',
  'Indra', 'Jamal', 'Kirana', 'Lukas', 'Maya', 'Nadia', 'Omar', 'Putri',
  'Rafi', 'Sinta', 'Tomas', 'Utari', 'Vera', 'Wira', 'Yusuf', 'Zahra',
  'Arif', 'Bella', 'Cinta', 'Dewi', 'Eko', 'Fitri', 'Galih', 'Hesti',
];

export const SURNAMES: readonly string[] = [
  'Abbott', 'Baros', 'Cahill', 'Dalimunthe', 'Enders', 'Fields', 'Gunawan',
  'Hartono', 'Iqbal', 'Jansen', 'Kusuma', 'Larsen', 'Mahendra', 'Novak',
  'Oktaviani', 'Pratama', 'Quinn', 'Rahardjo', 'Suryadi', 'Tanaka',
];

/** Jobs the people around the player hold. Flavour only - just a label. */
export const NPC_JOBS: readonly string[] = [
  'teacher',
  'nurse',
  'driver',
  'shopkeeper',
  'mechanic',
  'clerk',
  'cook',
  'builder',
  'accountant',
  'musician',
  'farmer',
  'librarian',
];
