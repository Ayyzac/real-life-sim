import { useState } from 'react';

import { BACKGROUNDS } from '../data/backgrounds';
import { gameStore } from './useGame';

/** GDD §3.2: a name and a background. Deliberately not a wizard. */
export function CharacterCreation(): React.JSX.Element {
  const [name, setName] = useState('');
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0]!.id);

  const start = (event: React.FormEvent): void => {
    event.preventDefault();
    gameStore.dispatch({ type: 'newGame', name, backgroundId });
  };

  return (
    <form className="panel creation" onSubmit={start}>
      <h2 className="panel__title">New life</h2>
      <p className="panel__hint">You start at 18. Everything after that is up to you.</p>

      <label className="field">
        <span className="field__label">Name</span>
        <input
          className="field__input"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your character's name"
          maxLength={24}
          autoFocus
        />
      </label>

      <fieldset className="field">
        <legend className="field__label">Background</legend>
        <div className="choices">
          {BACKGROUNDS.map((background) => (
            <button
              type="button"
              key={background.id}
              className={`choice ${backgroundId === background.id ? 'choice--on' : ''}`}
              onClick={() => setBackgroundId(background.id)}
              aria-pressed={backgroundId === background.id}
            >
              <strong className="choice__title">{background.label}</strong>
              <span className="choice__text">{background.description}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <button type="submit" className="btn btn--primary btn--wide">
        Start living
      </button>
    </form>
  );
}
