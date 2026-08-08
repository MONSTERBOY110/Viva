import { Wordmark } from "@/components/logo";
import { Bar, VoiceLines } from "@/components/skeleton-bits";

export default function Loading() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[820px] px-5 pb-24 sm:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-rule py-6">
        <Wordmark subtitle={false} />
        <Bar w="7rem" h="0.7rem" />
      </header>

      <section className="py-10">
        <Bar w="8rem" h="0.6rem" />
        <div className="mt-3">
          <Bar w="14rem" h="2rem" />
        </div>
        <div className="mt-2">
          <Bar w="18rem" h="0.9rem" />
        </div>

        <div className="mt-6 flex flex-wrap gap-x-10 gap-y-3 border-y border-rule py-4">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="block space-y-1.5">
              <Bar w="5rem" h="0.65rem" />
              <Bar w="2rem" h="1.1rem" />
            </span>
          ))}
        </div>

        <div className="mt-8 max-w-[62ch]">
          <VoiceLines lines={4} />
        </div>
      </section>

      <section className="border-t border-rule py-8">
        <Bar w="12rem" h="0.6rem" />
        <div className="mt-4">
          <Bar w="100%" h="5.5rem" />
        </div>
      </section>
    </main>
  );
}
