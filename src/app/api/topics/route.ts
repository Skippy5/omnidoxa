import { listPublishedTopics } from "@/lib/public-topics";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") ?? undefined;
  const placementParam = searchParams.get("placement");
  const placement =
    placementParam === "main" ||
    placementParam === "category" ||
    placementParam === "all"
      ? placementParam
      : category
        ? "category"
        : "main";

  return Response.json({
    topics: await listPublishedTopics({ category, placement }),
  });
}
