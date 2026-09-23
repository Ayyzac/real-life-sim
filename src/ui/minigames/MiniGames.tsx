import { useEffect, useMemo, useRef, useState } from 'react';

import { createRng, type Rng } from '../../core/rng';
import type { MiniGame } from '../../data/gigs';

/**
 * The side-work mini-games (GDD §12). Each runs for a short stretch of real
 * time and hands back a score from 0 to 1; the pay is worked out in the core.
 *
 * The puzzles are shuffled with the project's own RNG, seeded fresh each
 * time - not the saved one: what word comes up next must not shift the dice
 * for the rest of the life.
 */

interface GameProps {
  onDone: (score: number) => void;
}

/** Seconds left, counting down in real time; calls `onEnd` once at zero. */
function useCountdown(seconds: number, onEnd: () => void): number {
  const [left, setLeft] = useState(seconds);
  const ended = useRef(false);
  const end = useRef(onEnd);
  end.current = onEnd;

  useEffect(() => {
    const started = performance.now();
    const id = window.setInterval(() => {
      const remaining = Math.max(0, seconds - Math.floor((performance.now() - started) / 1000));
      setLeft(remaining);
      if (remaining === 0 && !ended.current) {
        ended.current = true;
        window.clearInterval(id);
        end.current();
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [seconds]);

  return left;
}

function useFreshRng(): Rng {
  return useMemo(() => createRng(Date.now() >>> 0), []);
}

function Timer({ left }: { left: number }): React.JSX.Element {
  return <span className={`mini__timer ${left <= 5 ? 'mini__timer--low' : ''}`}>{left}s</span>;
}

const WORDS = [
  'invoice', 'ledger', 'account', 'receipt', 'balance', 'payment', 'customer', 'order', 'stock', 'supply',
  'report', 'budget', 'meeting', 'deadline', 'office', 'coffee', 'number', 'column', 'record', 'address',
  'station', 'market', 'harbor', 'window', 'garden', 'letter', 'parcel', 'bottle', 'ticket', 'weather',
  'salary', 'contract', 'manager', 'service', 'total', 'margin', 'profit', 'refund', 'delivery', 'shelf',
];

function Typing({ onDone }: GameProps): React.JSX.Element {
  const rng = useFreshRng();
  const [word, setWord] = useState(() => rng.pick(WORDS));
  const [typed, setTyped] = useState('');
  const [right, setRight] = useState(0);
  const score = useRef(0);
  score.current = Math.min(1, right / 12);
  const left = useCountdown(30, () => onDone(score.current));

  const submit = (): void => {
    if (typed.trim().toLowerCase() === word) setRight((n) => n + 1);
    setTyped('');
    setWord(rng.pick(WORDS));
  };

  return (
    <div className="mini">
      <p className="mini__head">
        Type each word and press Enter. <Timer left={left} /> &middot; {right} right
      </p>
      <p className="mini__big">{word}</p>
      <input
        className="mini__input"
        autoFocus
        value={typed}
        onChange={(event) => setTyped(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            submit();
          }
        }}
        aria-label="Type the word"
      />
    </div>
  );
}

function sum(rng: Rng): { text: string; answer: number } {
  const a = rng.int(2, 40);
  const b = rng.int(2, 30);
  switch (rng.int(0, 2)) {
    case 0:
      return { text: `${a} + ${b}`, answer: a + b };
    case 1:
      return { text: `${a + b} - ${b}`, answer: a };
    default: {
      const c = rng.int(2, 9);
      return { text: `${b} × ${c}`, answer: b * c };
    }
  }
}

function Maths({ onDone }: GameProps): React.JSX.Element {
  const rng = useFreshRng();
  const [question, setQuestion] = useState(() => sum(rng));
  const [typed, setTyped] = useState('');
  const [tally, setTally] = useState({ right: 0, wrong: 0 });
  const score = useRef(0);
  score.current = Math.min(1, Math.max(0, (tally.right - tally.wrong * 0.5) / 10));
  const left = useCountdown(30, () => onDone(score.current));

  const submit = (): void => {
    if (typed.trim() === '') return;
    const correct = Number(typed) === question.answer;
    setTally((t) => ({ right: t.right + (correct ? 1 : 0), wrong: t.wrong + (correct ? 0 : 1) }));
    setTyped('');
    setQuestion(sum(rng));
  };

  return (
    <div className="mini">
      <p className="mini__head">
        Answer and press Enter. Wrong answers cost. <Timer left={left} /> &middot; {tally.right} right, {tally.wrong}{' '}
        wrong
      </p>
      <p className="mini__big">{question.text} = ?</p>
      <input
        className="mini__input"
        autoFocus
        inputMode="numeric"
        value={typed}
        onChange={(event) => setTyped(event.target.value.replace(/[^0-9-]/g, ''))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit();
        }}
        aria-label="Your answer"
      />
    </div>
  );
}

const SYMBOLS = ['★', '♥', '♫', '☂', '☺', '✈'];

function Memory({ onDone }: GameProps): React.JSX.Element {
  const rng = useFreshRng();
  const cards = useMemo(() => {
    const deck = [...SYMBOLS, ...SYMBOLS];
    for (let i = deck.length - 1; i > 0; i -= 1) {
      const j = rng.int(0, i);
      [deck[i], deck[j]] = [deck[j]!, deck[i]!];
    }
    return deck;
  }, [rng]);
  const [open, setOpen] = useState<number[]>([]);
  const [found, setFound] = useState<Set<number>>(new Set());
  const [tries, setTries] = useState(0);
  const finished = useRef(false);
  const score = useRef(0);
  const pairs = found.size / 2;
  score.current = (pairs / SYMBOLS.length) * (tries <= 10 ? 1 : Math.max(0.5, 10 / tries));
  const left = useCountdown(45, () => {
    if (!finished.current) onDone(score.current);
  });

  useEffect(() => {
    if (pairs === SYMBOLS.length && !finished.current) {
      finished.current = true;
      onDone(score.current);
    }
  }, [pairs, onDone]);

  const flip = (index: number): void => {
    if (open.length === 2 || open.includes(index) || found.has(index)) return;
    const next = [...open, index];
    setOpen(next);
    if (next.length < 2) return;
    setTries((t) => t + 1);
    const [a, b] = next as [number, number];
    window.setTimeout(() => {
      if (cards[a] === cards[b]) setFound((f) => new Set([...f, a, b]));
      setOpen([]);
    }, 450);
  };

  return (
    <div className="mini">
      <p className="mini__head">
        Find the pairs in as few tries as you can. <Timer left={left} /> &middot; {pairs}/{SYMBOLS.length} pairs
      </p>
      <div className="mini__cards">
        {cards.map((symbol, index) => {
          const shown = open.includes(index) || found.has(index);
          return (
            <button
              key={index}
              type="button"
              className={`mini__card ${found.has(index) ? 'mini__card--found' : ''}`}
              onClick={() => flip(index)}
              aria-label={shown ? symbol : 'Hidden card'}
            >
              {shown ? symbol : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const SHELVES = [
  { id: 'red', label: 'Red', colour: '#e05d5d' },
  { id: 'blue', label: 'Blue', colour: '#4f8fe0' },
  { id: 'green', label: 'Green', colour: '#6cc070' },
] as const;

function Sort({ onDone }: GameProps): React.JSX.Element {
  const rng = useFreshRng();
  const [parcel, setParcel] = useState(() => rng.pick(SHELVES));
  const [tally, setTally] = useState({ right: 0, wrong: 0 });
  const score = useRef(0);
  score.current = Math.min(1, Math.max(0, (tally.right - tally.wrong) / 15));
  const left = useCountdown(30, () => onDone(score.current));

  const send = (shelf: string): void => {
    const correct = shelf === parcel.id;
    setTally((t) => ({ right: t.right + (correct ? 1 : 0), wrong: t.wrong + (correct ? 0 : 1) }));
    setParcel(rng.pick(SHELVES));
  };

  return (
    <div className="mini">
      <p className="mini__head">
        Send each parcel to its shelf. <Timer left={left} /> &middot; {tally.right} right, {tally.wrong} wrong
      </p>
      <div className="mini__parcel" style={{ borderColor: parcel.colour }}>
        <span style={{ color: parcel.colour }}>{'■'}</span> {parcel.label} parcel
      </div>
      <div className="person__actions">
        {SHELVES.map((shelf) => (
          <button key={shelf.id} type="button" className="btn" style={{ borderColor: shelf.colour }} onClick={() => send(shelf.id)}>
            {shelf.label} shelf
          </button>
        ))}
      </div>
    </div>
  );
}

export const MINI_GAMES: Record<MiniGame, (props: GameProps) => React.JSX.Element> = {
  typing: Typing,
  math: Maths,
  memory: Memory,
  sort: Sort,
};
