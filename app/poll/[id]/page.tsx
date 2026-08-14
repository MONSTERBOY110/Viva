import { PollRoom } from "@/components/poll-room";

export default async function PollPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <PollRoom id={id} />;
}
