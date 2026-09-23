/**
 * What can be bought on the phone's markets (GDD §12), as data. All made up.
 *
 * Prices move by chance each step: `drift` is the average move and
 * `volatility` how wild it is. Stocks step once a trading day and creep up
 * over the years on average; crypto steps every game hour with no drift at
 * all, so on average it goes nowhere while swinging hard enough to feel like
 * it might go everywhere.
 *
 * Adding something to trade = adding an entry here.
 */
export interface AssetDefinition {
  id: string;
  name: string;
  ticker: string;
  kind: 'stock' | 'crypto';
  startPrice: number;
  /** Average log-return per step: a trading day for stocks, a game hour for crypto. */
  drift: number;
  volatility: number;
  blurb: string;
}

export const ASSETS: readonly AssetDefinition[] = [
  // About 6% a year on average, 250 trading days.
  { id: 'hrbr', name: 'Harbor Foods', ticker: 'HRBR', kind: 'stock', startPrice: 42, drift: 0.00024, volatility: 0.011, blurb: 'Supermarkets and tinned fish. Dull, steady.' },
  { id: 'dtbk', name: 'Downtown Bank', ticker: 'DTBK', kind: 'stock', startPrice: 68, drift: 0.00026, volatility: 0.014, blurb: 'The bank on the corner, and everyone\'s mortgage.' },
  { id: 'esen', name: 'Eastside Energy', ticker: 'ESEN', kind: 'stock', startPrice: 31, drift: 0.00022, volatility: 0.018, blurb: 'Keeps the lights on. Mostly.' },
  { id: 'glph', name: 'Greenleaf Pharma', ticker: 'GLPH', kind: 'stock', startPrice: 120, drift: 0.0003, volatility: 0.022, blurb: 'One good trial away from doubling, or halving.' },
  { id: 'pxlm', name: 'Pixel Motors', ticker: 'PXLM', kind: 'stock', startPrice: 18, drift: 0.00028, volatility: 0.028, blurb: 'Electric scooters and big promises.' },
  { id: 'nimb', name: 'Nimbus Tech', ticker: 'NIMB', kind: 'stock', startPrice: 210, drift: 0.00034, volatility: 0.024, blurb: 'Apps, clouds, and a founder who posts a lot.' },
  // Per game hour. 0.01 an hour is roughly 5% a day either way.
  { id: 'bcrn', name: 'Bitcorn', ticker: 'BCRN', kind: 'crypto', startPrice: 3200, drift: 0, volatility: 0.008, blurb: 'The original. Everyone\'s uncle owns some.' },
  { id: 'meow', name: 'Meowcoin', ticker: 'MEOW', kind: 'crypto', startPrice: 0.42, drift: 0, volatility: 0.02, blurb: 'Started as a joke. Still is.' },
  { id: 'rkt', name: 'Rocketchain', ticker: 'RKT', kind: 'crypto', startPrice: 14, drift: 0, volatility: 0.014, blurb: '"To the moon." Some days.' },
  { id: 'stb', name: 'Stablish', ticker: 'STB', kind: 'crypto', startPrice: 1, drift: 0, volatility: 0.001, blurb: 'Meant to stay at a dollar. Usually does.' },
];

export function findAsset(id: string): AssetDefinition {
  const asset = ASSETS.find((a) => a.id === id);
  if (!asset) throw new Error(`Unknown asset: ${id}`);
  return asset;
}
