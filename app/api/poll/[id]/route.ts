import { NextResponse } from "next/server";
import { readPoll, savePoll, toView } from "@/lib/store/poll";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const poll = await readPoll(id);
    if (!poll) {
      return NextResponse.json({ error: "No such poll." }, { status: 404 });
    }
    return NextResponse.json({ poll: toView(poll) });
  } catch {
    return NextResponse.json({ error: "Unavailable." }, { status: 200 });
  }
}

/**
 * Vote or close, one defensive route. Double votes are rejected server side
 * by voter token, closed polls reject votes, and a bad option index is a 400.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
    }
    const { action, option, voter, creatorToken } = (body ?? {}) as {
      action?: unknown;
      option?: unknown;
      voter?: unknown;
      creatorToken?: unknown;
    };

    const poll = await readPoll(id);
    if (!poll) {
      return NextResponse.json({ error: "No such poll." }, { status: 404 });
    }

    if (action === "close") {
      if (typeof creatorToken !== "string" || creatorToken !== poll.creatorToken) {
        return NextResponse.json(
          { error: "Only the poll creator can close it." },
          { status: 403 },
        );
      }
      poll.closed = true;
      await savePoll(poll);
      return NextResponse.json({ poll: toView(poll) });
    }

    // Default action: cast a vote.
    if (poll.closed) {
      return NextResponse.json(
        { error: "This poll is closed.", poll: toView(poll) },
        { status: 200 },
      );
    }
    if (
      typeof option !== "number" ||
      !Number.isInteger(option) ||
      option < 0 ||
      option >= poll.options.length
    ) {
      return NextResponse.json({ error: "Invalid option." }, { status: 400 });
    }
    if (typeof voter !== "string" || voter.length < 8) {
      return NextResponse.json({ error: "Missing voter token." }, { status: 400 });
    }
    if (poll.voters.includes(voter)) {
      return NextResponse.json(
        { error: "You have already voted in this poll.", poll: toView(poll) },
        { status: 200 },
      );
    }

    poll.votes[option] += 1;
    poll.voters.push(voter);
    await savePoll(poll);
    return NextResponse.json({ poll: toView(poll) });
  } catch {
    return NextResponse.json({ error: "Unavailable." }, { status: 200 });
  }
}
