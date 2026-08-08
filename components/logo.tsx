import { cn } from "@/lib/utils";

/**
 * The mark is the product's own notation: an examiner's tally, one stroke per
 * attempt, stacked on a ruled line. It is the same language as the Ledger and
 * the Spine, so the logo is not a decoration bolted on top of the design, it
 * is the smallest possible instance of it.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={cn("shrink-0", className)}
      aria-hidden
      focusable="false"
    >
      <g fill="currentColor">
        <rect x="7" y="8" width="11" height="2.6" />
        <rect x="7" y="13" width="15" height="2.6" />
        <rect x="7" y="18" width="8" height="2.6" />
      </g>
      <rect x="6" y="24" width="20" height="1.6" className="fill-rule" />
    </svg>
  );
}

export function Wordmark({
  className,
  subtitle = true,
}: {
  className?: string;
  subtitle?: boolean;
}) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <LogoMark className="h-6 w-6 text-quill" />
      <span className="font-voice text-[1.375rem] leading-none tracking-[-0.01em] text-ink">
        Viva
      </span>
      {subtitle && (
        <span className="font-sans text-data uppercase tracking-[0.16em] text-faint">
          viva voce
        </span>
      )}
    </span>
  );
}
