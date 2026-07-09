interface Props {
  label?: string;
  className?: string;
}

// Reused pulsing-bars indicator for "work in progress" states (dashboard loading, an active scan
// row, the ProgressBar HUD icon). Decorative by default; pass `label` to make it meaningful to
// screen readers instead.
export function EqualizerLoader({ label, className }: Props) {
  return (
    <span className={className ? `eq ${className}` : 'eq'} aria-hidden={label ? undefined : true} aria-label={label}>
      <i />
      <i />
      <i />
      <i />
      <i />
    </span>
  );
}
