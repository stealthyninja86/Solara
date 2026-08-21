interface Props {
  color: string;
  pulseClass?: string;
  title?: string;
}

export function StatusDot({ color, pulseClass = "", title }: Props) {
  return (
    <span className="relative flex h-1.5 w-1.5 shrink-0" title={title}>
      {pulseClass && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full motion-reduce:animate-none ${pulseClass}`}
          style={{ background: color, opacity: 0.75 }}
          aria-hidden
        />
      )}
      <span
        className="relative inline-flex h-full w-full rounded-full"
        style={{ background: color }}
        aria-hidden
      />
    </span>
  );
}