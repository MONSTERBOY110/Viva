/**
 * House punctuation rule: no em dashes, no en dashes, anywhere the candidate
 * or a judge can see. The prompts instruct the model not to emit them; this is
 * the guarantee, because a model instruction is a preference, not a contract.
 */

const EM = "—";
const EN = "–";

export function noDashes(text: string): string {
  return (
    text
      // A dash that runs straight into other punctuation just goes away.
      .replace(/[ \t]*[–—][ \t]*([.;:!?,])/g, "$1")
      // Ranges stay readable as hyphens: 8-14 questions, L1-L2.
      .replace(/(\w)[ \t]*[–—][ \t]*(\w)/g, (_m, a: string, b: string) =>
        /\d/.test(a) && /\d/.test(b) ? `${a}-${b}` : `${a}, ${b}`,
      )
      // A spaced dash joining clauses becomes a comma.
      .replace(/[ \t]+[–—][ \t]+/g, ", ")
      .replace(/[–—]/g, "-")
      // A dash swapped for a comma can leave doubled punctuation behind.
      .replace(/,\s*,/g, ",")
      .replace(/,\s*([.;:!?])/g, "$1")
  );
}

export function hasDash(text: string): boolean {
  return text.includes(EM) || text.includes(EN);
}

/** Apply noDashes to every string in a shallow object or array of strings. */
export function scrubStrings<T>(value: T): T {
  if (typeof value === "string") return noDashes(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => scrubStrings(v)) as unknown as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = scrubStrings(v);
    }
    return out as T;
  }
  return value;
}
