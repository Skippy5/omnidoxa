import { NextRequest, NextResponse } from 'next/server';
import { turso } from '@/lib/db-turso';

function shuffle<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const count = parseInt(searchParams.get('count') || '10');

    // Query for stories that have exactly 3 viewpoints (one for each lean)
    const storiesResult = await turso.execute({
      sql: `
        SELECT DISTINCT s.id, s.title, s.image_url
        FROM stories s
        WHERE s.id IN (
          SELECT story_id
          FROM viewpoints
          GROUP BY story_id
          HAVING COUNT(DISTINCT lean) = 3
        )
        ORDER BY RANDOM()
        LIMIT ?
      `,
      args: [count]
    });

    const stories = [];

    for (const storyRow of storiesResult.rows) {
      const tweetsResult = await turso.execute({
        sql: `
          SELECT v.lean, sp.text, sp.url
          FROM viewpoints v
          JOIN social_posts sp ON sp.viewpoint_id = v.id
          WHERE v.story_id = ?
          ORDER BY RANDOM()
        `,
        args: [storyRow.id]
      });

      // Pick one tweet per lean (first occurrence after random ordering)
      const seenLeans = new Set<string>();
      const tweets: Array<{ lean: string; text: string; url: string }> = [];
      for (const row of tweetsResult.rows) {
        const lean = (row.lean as string).toUpperCase();
        if (!seenLeans.has(lean)) {
          seenLeans.add(lean);
          tweets.push({
            lean,
            text: row.text as string,
            url: (row.url as string) || '',
          });
        }
        if (tweets.length === 3) break;
      }

      if (tweets.length < 3) continue;

      const summaries = tweets.map((tw, idx) => ({
        id: String.fromCharCode(97 + idx),
        text: tw.text,
        url: tw.url,
        actualLean: tw.lean,
      }));

      stories.push({
        id: `story-${storyRow.id}`,
        headline: storyRow.title,
        image: storyRow.image_url || '',
        summaries: shuffle(summaries),
      });
    }

    return NextResponse.json({ stories });
  } catch (error) {
    console.error('Error fetching game stories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stories' },
      { status: 500 }
    );
  }
}
