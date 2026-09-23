import type { ChangeReport as Report } from './changes';
import { duration, signed, signedMoney } from './format';
import { lastTimedLabel } from './progress';

/** "This week: +$120 · energy -12 · Cinta +6" (GDD §11.7). */
export function ChangeReport({ report }: { report: Report }): React.JSX.Element {
  const period =
    report.days === 0
      ? `${lastTimedLabel() ?? 'Just now'} · ${duration(report.minutes)}`
      : report.days === 1
        ? 'Yesterday'
        : report.days === 7
          ? 'Last week'
          : `Last ${report.days} days`;

  return (
    <section className="report" aria-live="polite">
      <strong className="report__title">{period}</strong>
      {report.changes.length === 0 && report.met.length === 0 && report.lost.length === 0 ? (
        <span className="report__quiet">Nothing much changed.</span>
      ) : (
        <span className="choice__effects">
          {report.changes.map((change) => (
            <span key={change.label} className={change.amount >= 0 ? 'eff eff--up' : 'eff eff--down'}>
              {change.label} {change.money ? signedMoney(change.amount) : signed(change.amount)}
            </span>
          ))}
          {report.met.map((name) => (
            <span key={`met-${name}`} className="eff eff--up">
              met {name}
            </span>
          ))}
          {report.lost.map((name) => (
            <span key={`lost-${name}`} className="eff eff--down">
              lost {name}
            </span>
          ))}
        </span>
      )}
    </section>
  );
}
