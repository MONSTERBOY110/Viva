import { describe, expect, it } from "vitest";
import { hasDash, noDashes, scrubStrings } from "./text";

describe("noDashes", () => {
  it("turns a clause dash into a comma", () => {
    expect(noDashes("Good answer — now go deeper.")).toBe(
      "Good answer, now go deeper.",
    );
  });

  it("keeps numeric ranges readable as hyphens", () => {
    expect(noDashes("8–14 questions")).toBe("8-14 questions");
    expect(noDashes("150 – 250ms")).toBe("150-250ms");
  });

  it("joins word pairs with a comma rather than gluing them", () => {
    expect(noDashes("embeddings—vectors")).toBe("embeddings, vectors");
  });

  it("does not leave doubled punctuation behind", () => {
    expect(noDashes("Right, — and then?")).toBe("Right, and then?");
    expect(noDashes("Done —. Next.")).toBe("Done. Next.");
  });

  it("leaves ordinary hyphens alone", () => {
    expect(noDashes("first-try pass, well-formed")).toBe(
      "first-try pass, well-formed",
    );
  });

  it("hasDash detects both dash characters", () => {
    expect(hasDash("a — b")).toBe(true);
    expect(hasDash("a – b")).toBe(true);
    expect(hasDash("a - b")).toBe(false);
  });
});

describe("scrubStrings", () => {
  it("cleans every string in a nested structure, leaving other types intact", () => {
    const input = {
      reply: "You said — correctly — that embeddings cluster.",
      evaluation: { score: 0.8, evidence: "clear — confident" },
      next: ["Revisit Day 20 — rebuild it", "Day 8–10"],
      done: false,
    };
    const out = scrubStrings(input);
    expect(out.reply).toBe("You said, correctly, that embeddings cluster.");
    expect(out.evaluation.evidence).toBe("clear, confident");
    expect(out.next).toEqual(["Revisit Day 20, rebuild it", "Day 8-10"]);
    expect(out.evaluation.score).toBe(0.8);
    expect(out.done).toBe(false);
  });
});
