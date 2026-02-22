import { NextRequest, NextResponse } from 'next/server';

interface GuessRequest {
  storyId: string;
  guesses: Record<string, string>;
  summaries: Array<{ id: string; actualLean: string }>;
}

const BIAS_TIPS: Record<string, string> = {
  'LEFT': 'Look for words like "corporate greed", "working families", "inequality"',
  'CENTER': 'Notice neutral tone, passive voice, "both sides" framing',
  'RIGHT': 'Watch for "freedom", "individual liberty", "government overreach"',
};

export async function POST(request: NextRequest) {
  try {
    const body: GuessRequest = await request.json();
    const { guesses, summaries } = body;

    if (!guesses || !summaries) {
      return NextResponse.json(
        { error: 'Missing guesses or summaries' },
        { status: 400 }
      );
    }

    const results = summaries.map(summary => {
      const guess = guesses[summary.id];
      const actual = summary.actualLean;
      const correct = guess === actual;

      return {
        id: summary.id,
        guess,
        actual,
        correct,
        tip: correct ? '' : (BIAS_TIPS[actual] || 'Try looking for emotionally charged words and framing'),
      };
    });

    const correctCount = results.filter(r => r.correct).length;
    const total = results.length;
    const points = correctCount * 10;

    return NextResponse.json({ correct: correctCount, total, points, results });
  } catch (error) {
    console.error('Error validating submission:', error);
    return NextResponse.json(
      { error: 'Failed to validate submission' },
      { status: 500 }
    );
  }
}
