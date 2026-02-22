interface FinalScoreProps {
  score: number;
  totalCorrect: number;
  totalAnswers: number;
  bestStreak: number;
  onPlayAgain: () => void;
}

export default function FinalScore({
  score,
  totalCorrect,
  totalAnswers,
  bestStreak,
  onPlayAgain,
}: FinalScoreProps) {
  const accuracy = Math.round((totalCorrect / totalAnswers) * 100);
  const maxScore = totalAnswers * 10;

  let message = '';
  let emoji = '';
  if (accuracy >= 80) {
    message = "Outstanding! You're a bias detection expert!";
    emoji = '🏆';
  } else if (accuracy >= 60) {
    message = "Great job! You're getting the hang of it!";
    emoji = '🎯';
  } else if (accuracy >= 40) {
    message = 'Good start! Keep practicing to improve!';
    emoji = '📈';
  } else {
    message = 'Keep learning! Most people score 40-60% on first try.';
    emoji = '💪';
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="text-6xl mb-4">{emoji}</div>
        <h1 className="text-4xl font-bold mb-2" style={{ color: 'var(--text)' }}>
          GAME COMPLETE!
        </h1>
        <p className="text-xl" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>
      </div>

      {/* Score card */}
      <div
        className="p-8 rounded-xl mb-8"
        style={{
          background: 'linear-gradient(135deg, var(--vp-left-bg), #2d1b4e)',
          border: '1px solid var(--vp-left-border)',
        }}
      >
        <div className="text-center mb-6">
          <div className="text-5xl font-bold mb-2" style={{ color: 'var(--text)' }}>
            {score} / {maxScore}
          </div>
          <div className="text-xl" style={{ color: 'var(--text-secondary)' }}>
            Final Score
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div
            className="rounded-lg p-4"
            style={{ background: 'rgba(255, 255, 255, 0.08)' }}
          >
            <div className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
              {accuracy}%
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Accuracy
            </div>
          </div>
          <div
            className="rounded-lg p-4"
            style={{ background: 'rgba(255, 255, 255, 0.08)' }}
          >
            <div className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
              {totalCorrect}/{totalAnswers}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Correct
            </div>
          </div>
          <div
            className="rounded-lg p-4"
            style={{ background: 'rgba(255, 255, 255, 0.08)' }}
          >
            <div className="text-3xl font-bold" style={{ color: 'var(--text)' }}>
              {bestStreak}
            </div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Best Streak
            </div>
          </div>
        </div>
      </div>

      {/* Results breakdown */}
      <div
        className="rounded-xl p-6 mb-6"
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
        }}
      >
        <h3 className="text-xl font-bold mb-4" style={{ color: 'var(--text)' }}>
          Your Results
        </h3>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span style={{ color: 'var(--text-secondary)' }}>Correctly identified:</span>
            <span className="font-bold" style={{ color: '#4ade80' }}>
              {totalCorrect} tweets
            </span>
          </div>
          <div className="flex justify-between items-center">
            <span style={{ color: 'var(--text-secondary)' }}>Missed:</span>
            <span className="font-bold" style={{ color: '#f87171' }}>
              {totalAnswers - totalCorrect} tweets
            </span>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={onPlayAgain}
          className="flex-1 py-4 font-bold text-lg rounded-xl transition-all hover:opacity-90 cursor-pointer"
          style={{
            background: 'linear-gradient(135deg, var(--vp-left-border), #7c3aed)',
            color: 'white',
          }}
        >
          PLAY AGAIN
        </button>
        <button
          onClick={() => (window.location.href = '/')}
          className="flex-1 py-4 font-bold text-lg rounded-xl transition-all hover:opacity-90 cursor-pointer"
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
        >
          ← BACK HOME
        </button>
      </div>
    </div>
  );
}
