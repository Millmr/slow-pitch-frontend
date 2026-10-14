interface Props {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
}

/** Big +/- buttons for entering counts with a thumb. */
export default function Stepper({ label, value, onChange, min = 0, max = 99 }: Props) {
  const set = (next: number) => onChange(Math.min(max, Math.max(min, next)));
  return (
    <div className="stepper">
      <span className="stepper-label">{label}</span>
      <div className="stepper-controls">
        <button type="button" aria-label={`Fewer ${label}`} onClick={() => set(value - 1)} disabled={value <= min}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          value={value}
          min={min}
          max={max}
          onChange={(event) => set(Number(event.target.value) || 0)}
        />
        <button type="button" aria-label={`More ${label}`} onClick={() => set(value + 1)} disabled={value >= max}>
          +
        </button>
      </div>
    </div>
  );
}
