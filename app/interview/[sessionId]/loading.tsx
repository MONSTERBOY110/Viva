import { Wordmark } from "@/components/logo";
import { PlanningState } from "@/components/planning-state";

/**
 * Covers the navigation itself. It hands over to the interview room's own
 * planning state, which looks identical, so the wait reads as one continuous
 * moment rather than three different loading screens.
 */
export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-rule py-4">
        <Wordmark subtitle={false} />
      </header>
      <PlanningState />
    </div>
  );
}
