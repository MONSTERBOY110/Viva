import { NextResponse } from "next/server";
import { newId, savePoll, toView, type Poll } from "@/lib/store/poll";

export const dynamic = "force-dynamic";

/** Create a poll. Defensive like every other route here: never a 5xx. */
export async function POST(req: Request) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
    }

    const { question, options } = (body ?? {}) as {
      question?: unknown;
      options?: unknown;
    };

    const q = typeof question === "string" ? question.trim() : "";
    if (q.length < 3 || q.length > 200) {
      return NextResponse.json(
        { error: "The question needs between 3 and 200 characters." },
        { status: 400 },
      );
    }

    const opts = Array.isArray(options)
      ? options
          .map((o) => (typeof o === "string" ? o.trim() : ""))
          .filter((o) => o.length > 0)
          .slice(0, 4)
      : [];
    const unique = [...new Set(opts.map((o) => o.toLowerCase()))];
    if (opts.length < 3 || unique.length !== opts.length) {
      return NextResponse.json(
        { error: "Give 3 to 4 answer options, no duplicates, none empty." },
        { status: 400 },
      );
    }

    const creatorToken = crypto.randomUUID();
    const poll: Poll = {
      id: newId(),
      question: q,
      options: opts,
      votes: opts.map(() => 0),
      voters: [],
      closed: false,
      createdAt: new Date().toISOString(),
      creatorToken,
    };
    await savePoll(poll);

    return NextResponse.json({ poll: toView(poll), creatorToken });
  } catch {
    return NextResponse.json(
      { error: "Could not create the poll, try again." },
      { status: 200 },
    );
  }
}
