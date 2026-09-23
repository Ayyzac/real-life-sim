import { useState } from 'react';

import { getVolume, play, setVolume } from './sound';
import { gameStore } from './useGame';

/**
 * The simple settings screen promised in GDD §8: volume and reset save.
 *
 * Kept as a disclosure rather than a screen of its own. It is two controls,
 * and one of them is dangerous - it does not need a page.
 */
export function Settings(): React.JSX.Element {
  const [volume, setVolumeState] = useState(getVolume);

  const change = (next: number): void => {
    setVolume(next);
    setVolumeState(next);
    if (next > 0) play('good');
  };

  return (
    <details className="panel settings">
      <summary className="settings__summary">Settings</summary>

      <label className="field">
        <span className="field__label">Sound {Math.round(volume * 100)}%</span>
        <input
          className="settings__slider"
          type="range"
          min={0}
          max={100}
          value={Math.round(volume * 100)}
          onChange={(event) => change(Number(event.target.value) / 100)}
        />
      </label>
      <p className="panel__hint">Drag to zero to turn sound off. Saved on this device only.</p>

      <button
        type="button"
        className="btn btn--quiet"
        onClick={() => {
          if (confirm('Delete this character and start over? This cannot be undone.')) {
            gameStore.dispatch({ type: 'reset' });
          }
        }}
      >
        Abandon this life
      </button>
      <p className="panel__hint">
        Wipes the save and starts a new character. There is no way back, by design
        &mdash; nothing carries over between lives.
      </p>
    </details>
  );
}
