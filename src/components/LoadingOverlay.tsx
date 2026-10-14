import { useSlow } from "../lib/useApi";

/** Full-screen wait with a spinning softball, for actions that block the whole app. */
export default function LoadingOverlay({ label }: { label: string }) {
  const slow = useSlow(true);
  return (
    <div className="overlay" role="status" aria-live="polite">
      <div className="overlay-body">
        <img src="/softball.svg" alt="" className="softball-spin" width={84} height={84} />
        <p className="overlay-label">{label}</p>
        {slow && <p className="overlay-hint">The server is waking up after being idle. This can take up to a minute; you only wait once.</p>}
      </div>
    </div>
  );
}
