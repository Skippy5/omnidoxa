interface ScoreBannerProps {
  score: number;
  streak: number;
}

export default function ScoreBanner({ score, streak }: ScoreBannerProps) {
  return (
    <div
      className="flex justify-between items-center mb-6 p-4 rounded-xl"
      style={{
        background: 'linear-gradient(135deg, var(--vp-left-bg), #2d1b4e)',
        border: '1px solid var(--vp-left-border)',
      }}
    >
      <div className="text-xl font-bold" style={{ color: 'var(--text)' }}>
        VIEWPOINT BATTLE
      </div>
      <div className="flex gap-6 items-center">
        {streak > 0 && (
          <div className="flex items-center gap-1">
            <span className="text-lg">🔥</span>
            <span className="font-semibold" style={{ color: 'var(--text)' }}>
              Streak: {streak}
            </span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <span className="text-lg">⭐</span>
          <span className="font-semibold" style={{ color: 'var(--text)' }}>
            Score: {score}
          </span>
        </div>
      </div>
    </div>
  );
}
