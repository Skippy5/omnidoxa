interface FeedbackResult {
  id: string;
  guess: string;
  actual: string;
  correct: boolean;
  tip?: string;
}

interface FeedbackResponse {
  correct: number;
  total: number;
  points: number;
  results: FeedbackResult[];
}

interface FeedbackViewProps {
  feedback: FeedbackResponse;
  onNext: () => void;
  currentIndex: number;
  totalStories: number;
  summaryLabels: Record<string, string>;
  summaryUrls: Record<string, string>;
}

export default function FeedbackView({
  feedback,
  onNext,
  currentIndex,
  totalStories,
  summaryLabels,
  summaryUrls,
}: FeedbackViewProps) {
  const isLastStory = currentIndex >= totalStories - 1;

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div
        className="mb-6 p-6 rounded-xl"
        style={{
          background: feedback.correct === feedback.total
            ? 'linear-gradient(135deg, #064e3b, #1e3a5f)'
            : 'linear-gradient(135deg, var(--vp-left-bg), #2d1b4e)',
          border: '1px solid var(--vp-left-border)',
        }}
      >
        <div className="text-3xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          {feedback.correct === feedback.total
            ? '🎉 Perfect!'
            : `${feedback.correct}/${feedback.total} Correct!`}
        </div>
        <div className="text-xl" style={{ color: 'var(--text-secondary)' }}>
          +{feedback.points} points
        </div>
      </div>

      {/* Results */}
      <div className="space-y-4 mb-6">
        {feedback.results.map((result) => (
          <div
            key={result.id}
            className="p-4 rounded-xl"
            style={{
              background: 'var(--card-bg)',
              border: `2px solid ${result.correct ? '#166534' : '#991b1b'}`,
            }}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="font-semibold" style={{ color: 'var(--text)' }}>
                {summaryLabels[result.id] || `Summary ${result.id.toUpperCase()}`}
              </div>
              <div className="text-2xl">
                {result.correct ? '✅' : '❌'}
              </div>
            </div>
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <div>
                <span className="font-medium">Actual:</span>{' '}
                <span className="font-bold">{result.actual}</span>
              </div>
              <div>
                <span className="font-medium">You guessed:</span>{' '}
                <span
                  className="font-bold"
                  style={{ color: result.correct ? '#4ade80' : '#f87171' }}
                >
                  {result.guess}
                </span>
              </div>
              {summaryUrls[result.id] && (
                <div className="mt-2">
                  <a
                    href={summaryUrls[result.id]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 underline text-sm"
                  >
                    View original tweet →
                  </a>
                </div>
              )}
              {!result.correct && result.tip && (
                <div
                  className="mt-2 p-2 rounded-lg text-sm"
                  style={{
                    background: 'var(--vp-center-bg)',
                    borderLeft: '4px solid var(--vp-center-border)',
                    color: 'var(--text-secondary)',
                  }}
                >
                  <span className="font-medium">Tip:</span> {result.tip}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Next button */}
      <button
        onClick={onNext}
        className="w-full py-4 font-bold text-lg rounded-xl transition-all hover:opacity-90 cursor-pointer"
        style={{
          background: 'linear-gradient(135deg, var(--vp-left-border), #7c3aed)',
          color: 'white',
        }}
      >
        {isLastStory ? 'SEE FINAL SCORE →' : 'NEXT STORY →'}
      </button>
    </div>
  );
}
