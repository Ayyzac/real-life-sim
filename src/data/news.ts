/**
 * The town's news, as data (GDD §12). Written in advance and picked by day,
 * never generated while playing (CLAUDE.md: no AI at runtime).
 *
 * `{name}` and `{job}` are filled with someone the player knows.
 */

export const TOWN_HEADLINES: readonly string[] = [
  'Council votes to fix the potholes on the main road. Again.',
  'Eastside bakery sells out of croissants before 8am for the third day running.',
  'Stadium announces a new season of fixtures. Tickets are "reasonably priced", says nobody.',
  'Local cat elected honorary mayor in a landslide. The real mayor declines to comment.',
  'Bus timetable changes next month. Everybody is confused already.',
  'Hospital opens a new wing for check-ups. Waiting times "slightly less long".',
  'Mall to stay open late on Fridays. Bubble tea queues expected to grow.',
  'Gym reports record memberships. Record attendance, less so.',
  'Pigeons near the Stadium have "become bolder", residents say.',
  'Cafe introduces oat milk. Regulars pretend not to notice.',
  'Street lights on Downtown\'s north side finally repaired.',
  'Survey: three in four residents "would like more sleep".',
  'Supermarket trials self-checkouts. Early reviews: "unexpected item in bagging area".',
  'Charity run this weekend raises money for the hospital.',
  'New office tower planned near Work. Neighbours worried about the shade.',
  'Power cut in Eastside lasts four minutes. Some claim it was five.',
];

/** Short lines about people the player knows. */
export const PEOPLE_LINES: readonly string[] = [
  '{name} posted a photo from a long lunch. It looked good.',
  '{name} says being a {job} is "fine, mostly".',
  '{name} was spotted at the Cafe, laughing at their own joke.',
  '{name} has taken up running. Allegedly.',
  '{name} is asking if anyone has a spare charger.',
  '{name} shared a recipe nobody asked for.',
];
