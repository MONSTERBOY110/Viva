import { candidateById } from "@/lib/journey";
import { InterviewRoom } from "@/components/interview-room";

/**
 * A known cohort candidate arrives as ?c=CAND-004 so a reload resumes cleanly.
 * A pasted custom candidate arrives via sessionStorage, which the room reads
 * on mount.
 */
export default async function InterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ sessionId: string }>;
  searchParams: Promise<{ c?: string; custom?: string }>;
}) {
  const { sessionId } = await params;
  const { c } = await searchParams;
  const candidate = c ? (candidateById(c) ?? null) : null;

  return (
    <main className="min-h-dvh">
      <InterviewRoom sessionId={sessionId} candidate={candidate} />
    </main>
  );
}
