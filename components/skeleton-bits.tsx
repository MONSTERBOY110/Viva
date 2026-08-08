import { cn } from "@/lib/utils";

/**
 * Skeletons mirror the shape of what is arriving, so the page does not jump
 * when real content replaces them. A centred spinner would tell the user
 * nothing about what is coming.
 */

export function Bar({
  w = "100%",
  h = "0.75rem",
  className,
}: {
  w?: string;
  h?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("block animate-pulse rounded-[2px] bg-raised", className)}
      style={{ width: w, height: h }}
    />
  );
}

/** A paragraph of the interviewer's voice, at voice line height. */
export function VoiceLines({ lines = 4 }: { lines?: number }) {
  const widths = ["96%", "88%", "92%", "64%", "80%", "70%"];
  return (
    <span className="block space-y-3" aria-hidden>
      {Array.from({ length: lines }, (_, i) => (
        <Bar key={i} w={widths[i % widths.length]} h="1.15rem" />
      ))}
    </span>
  );
}

export function MindPanelSkeleton() {
  return (
    <aside className="border border-rule bg-panel" aria-hidden>
      <div className="flex items-center justify-between border-b border-rule px-4 py-3">
        <Bar w="8.5rem" h="1rem" />
        <Bar w="4rem" h="0.7rem" />
      </div>
      <div className="space-y-2.5 border-b border-rule-soft p-4">
        <Bar w="5rem" h="0.6rem" />
        <Bar w="9rem" h="0.8rem" />
        <Bar w="100%" h="0.8rem" />
        <Bar w="82%" h="0.8rem" />
      </div>
      <div className="space-y-2.5 border-b border-rule-soft p-4">
        <Bar w="4.5rem" h="0.6rem" />
        <Bar w="100%" h="1.2rem" />
        <Bar w="7rem" h="0.6rem" />
      </div>
      <div className="space-y-3 p-4">
        <Bar w="3rem" h="0.6rem" />
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="block space-y-1.5">
            <Bar w="6rem" h="0.7rem" />
            <Bar w={`${88 - i * 9}%`} h="0.7rem" />
          </span>
        ))}
      </div>
    </aside>
  );
}
