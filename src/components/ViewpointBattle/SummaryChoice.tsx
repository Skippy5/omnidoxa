interface Summary {
  id: string;
  text: string;
}

interface SummaryChoiceProps {
  summary: Summary;
  label: string;
  onGuess: (id: string, lean: string) => void;
  selectedLean?: string;
}

const LEAN_STYLES: Record<string, { bg: string; border: string }> = {
  LEFT: { bg: 'var(--vp-left-bg)', border: 'var(--vp-left-border)' },
  CENTER: { bg: 'var(--vp-center-bg)', border: 'var(--vp-center-border)' },
  RIGHT: { bg: 'var(--vp-right-bg)', border: 'var(--vp-right-border)' },
};

export default function SummaryChoice({ summary, label, onGuess, selectedLean }: SummaryChoiceProps) {
  return (
    <div
      className="rounded-xl p-4 mb-4 transition-all"
      style={{
        background: 'var(--card-bg)',
        border: '1px solid var(--border)',
      }}
    >
      <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>
        {label}
      </div>
      <p className="mb-4 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {summary.text}
      </p>
      <div className="flex gap-3">
        {(['LEFT', 'CENTER', 'RIGHT'] as const).map(lean => {
          const isSelected = selectedLean === lean;
          const style = LEAN_STYLES[lean];
          return (
            <label
              key={lean}
              className="flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-all"
              style={{
                background: isSelected ? style.bg : 'transparent',
                border: `2px solid ${isSelected ? style.border : 'var(--border)'}`,
              }}
            >
              <input
                type="radio"
                name={`summary-${summary.id}`}
                checked={isSelected}
                onChange={() => onGuess(summary.id, lean)}
                className="w-4 h-4 accent-purple-500"
              />
              <span
                className="text-sm font-medium"
                style={{ color: isSelected ? 'var(--text)' : 'var(--text-muted)' }}
              >
                {lean}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
