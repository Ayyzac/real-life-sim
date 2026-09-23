import { decodeLook, encodeLook, LOOK_COUNT, type LookParts } from '../core/look';
import { BODIES, HAIR_COLOURS, SKIN_TONES, TOP_COLOURS } from '../data/looks';
import { Portrait } from './Portrait';

/**
 * Build-your-own look (GDD §3.2, decided 23 Sep 2026): one of six bodies, then
 * hair, top and skin colours. Purely cosmetic.
 */

const SWATCHES: { part: Exclude<keyof LookParts, 'body'>; label: string; ramps: readonly (readonly string[] | null)[] }[] = [
  { part: 'hair', label: 'Hair', ramps: HAIR_COLOURS },
  { part: 'top', label: 'Top', ramps: TOP_COLOURS },
  { part: 'skin', label: 'Skin', ramps: SKIN_TONES },
];

export function LookPicker({
  look,
  onChange,
}: {
  look: number;
  onChange: (look: number) => void;
}): React.JSX.Element {
  const parts = decodeLook(look);
  const set = (change: Partial<LookParts>): void => onChange(encodeLook({ ...parts, ...change }));

  return (
    <div className="look">
      <div className="look__preview">
        <Portrait look={look} scale={6} />
        <button
          type="button"
          className="btn btn--quiet"
          onClick={() => onChange(Math.floor(Math.random() * LOOK_COUNT))}
        >
          Random
        </button>
      </div>

      <div className="look__controls">
        <div className="look__row" role="group" aria-label="Body">
          <span className="look__label">Body</span>
          {BODIES.map((_, body) => (
            <button
              type="button"
              key={body}
              className={`face ${parts.body === body ? 'face--on' : ''}`}
              onClick={() => set({ body })}
              aria-label={`Body ${body + 1}`}
              aria-pressed={parts.body === body}
            >
              <Portrait look={encodeLook({ ...parts, body })} scale={2} />
            </button>
          ))}
        </div>

        {SWATCHES.map(({ part, label, ramps }) => (
          <div className="look__row" role="group" aria-label={label} key={part}>
            <span className="look__label">{label}</span>
            {ramps.map((ramp, index) => (
              <button
                type="button"
                key={index}
                className={`swatch ${parts[part] === index ? 'swatch--on' : ''} ${ramp ? '' : 'swatch--own'}`}
                style={ramp ? { background: ramp[ramp.length - 2] } : undefined}
                onClick={() => set({ [part]: index })}
                aria-label={ramp ? `${label} colour ${index}` : `${label} as drawn`}
                aria-pressed={parts[part] === index}
                title={ramp ? undefined : 'As drawn'}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
