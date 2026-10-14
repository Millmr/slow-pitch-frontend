/** A batting-order number drawn as a softball. */
export default function BattingSlot({ order }: { order: number }) {
  return (
    <span className="batting-slot" aria-label={`Batting ${order}`}>
      <span aria-hidden="true">{order}</span>
    </span>
  );
}
