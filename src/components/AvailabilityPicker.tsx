import type { AvailabilityStatus } from "../types";
import { AVAILABILITY_LABELS } from "../lib/format";

interface Props {
  value: AvailabilityStatus | null | undefined;
  onChange: (status: AvailabilityStatus) => void;
  disabled?: boolean;
  label?: string;
}

const ORDER: AvailabilityStatus[] = ["yes", "unsure", "no"];

/** In / Maybe / Out segmented control. */
export default function AvailabilityPicker({ value, onChange, disabled, label = "Can you make it?" }: Props) {
  return (
    <div className="availability-picker" role="radiogroup" aria-label={label}>
      {ORDER.map((status) => (
        <button
          key={status}
          type="button"
          role="radio"
          aria-checked={value === status}
          className={`availability-option availability-${status}`}
          disabled={disabled}
          onClick={() => onChange(status)}
        >
          {AVAILABILITY_LABELS[status]}
        </button>
      ))}
    </div>
  );
}

export function AvailabilityChip({ status }: { status: AvailabilityStatus | null | undefined }) {
  if (!status) return <span className="chip chip-none">No answer</span>;
  return <span className={`chip chip-${status}`}>{AVAILABILITY_LABELS[status]}</span>;
}
