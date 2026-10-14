import { useSlow } from "../lib/useApi";

/** Spinning softball while something loads: centered on the page, or smaller inside a section. */
export default function LoadingState({ label = "Loading…", inline = false }: { label?: string; inline?: boolean }) {
  const slow = useSlow(true);
  const size = inline ? 32 : 56;
  return (
    <div className={`loading${inline ? " loading-inline" : ""}`} role="status" aria-live="polite">
      <img src="/softball.svg" alt="" className="softball-spin" width={size} height={size} />
      <p className="loading-label">{label}</p>
      {slow && <p className="loading-slow">The server may be waking up after being idle. This can take up to a minute.</p>}
    </div>
  );
}
