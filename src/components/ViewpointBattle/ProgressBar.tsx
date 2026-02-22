interface ProgressBarProps {
  current: number;
  total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = (current / total) * 100;

  return (
    <div className="mt-6">
      <div className="flex justify-between text-sm mb-2" style={{ color: 'var(--text-muted)' }}>
        <span>Progress</span>
        <span className="font-semibold">{current}/{total}</span>
      </div>
      <div
        className="w-full h-3 rounded-full overflow-hidden"
        style={{ background: 'var(--border)' }}
      >
        <div
          className="h-full transition-all duration-500"
          style={{
            width: `${percentage}%`,
            background: 'linear-gradient(to right, var(--vp-left-border), #7c3aed)',
          }}
        />
      </div>
    </div>
  );
}
