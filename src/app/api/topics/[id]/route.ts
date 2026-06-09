import { getPublicTopicBySlug } from "@/lib/public-topics";

export const runtime = "nodejs";

type RouteProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteProps) {
  const { id } = await params;
  const topic = await getPublicTopicBySlug(id);

  if (!topic) {
    return Response.json({ error: "Topic not found." }, { status: 404 });
  }

  return Response.json({
    topic,
  });
}
