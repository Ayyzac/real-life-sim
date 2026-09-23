import { useEffect } from 'react';

import type { WorldState } from '../../core/types';
import { useHoldClock } from '../clock';
import { clockTime } from '../format';
import { ProgressBar } from '../ProgressBar';
import { APPS } from './apps';
import { closeDevice, openApp, useDevice } from './device';

/**
 * The phone, and later the laptop (GDD §12): a home screen of apps and one
 * app at a time. The clock waits while it is open; what the apps do costs
 * game time through their own intents.
 */
export function DeviceShell({ world }: { world: WorldState }): React.JSX.Element | null {
  const device = useDevice();
  useHoldClock('device', device !== null);

  useEffect(() => {
    if (!device) return;
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') closeDevice();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [device]);

  if (!device) return null;
  const apps = APPS.filter((app) => app.on === 'both' || app.on === device.kind);
  const app = apps.find((a) => a.id === device.app) ?? null;

  return (
    <div className="device__backdrop" onClick={closeDevice}>
      <section
        className={`device device--${device.kind}`}
        role="dialog"
        aria-label={device.kind === 'phone' ? 'Phone' : 'Laptop'}
        onClick={(event) => event.stopPropagation()}
      >
        <header className="device__bar">
          {app ? (
            <button type="button" className="device__back" onClick={() => openApp(null)}>
              &lsaquo; Apps
            </button>
          ) : (
            <span className="device__time">{clockTime(world.minuteOfDay)}</span>
          )}
          <strong className="device__title">{app?.label ?? (device.kind === 'phone' ? 'Phone' : 'Laptop')}</strong>
          <button type="button" className="device__close" onClick={closeDevice} aria-label="Put it away">
            &times;
          </button>
        </header>

        <div className="device__screen">
          <ProgressBar />
          {app ? (
            <app.Component world={world} />
          ) : (
            <div className="device__grid">
              {apps.map((a) => (
                <button key={a.id} type="button" className="device__app" onClick={() => openApp(a.id)}>
                  <span className="device__icon" aria-hidden="true">
                    {a.icon}
                  </span>
                  <span>{a.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
