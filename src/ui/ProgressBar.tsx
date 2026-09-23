import { duration } from './format';
import { useProgress } from './progress';

/** The bar that fills while something takes time (GDD §11.1). Nothing when idle. */
export function ProgressBar(): React.JSX.Element | null {
  const progress = useProgress();
  if (!progress) return null;
  return (
    <div className="progress" role="status" aria-live="polite">
      <span className="progress__label">
        {progress.label} &middot; {duration(progress.minutes)}
      </span>
      <span className="progress__track">
        <span className="progress__fill" style={{ animationDuration: `${progress.durationMs}ms` }} />
      </span>
    </div>
  );
}
