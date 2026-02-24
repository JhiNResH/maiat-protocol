'use client'

interface TrustGaugeProps {
  score: number
  max?: number
}

export function TrustGauge({ score, max = 10 }: TrustGaugeProps) {
  const pct = Math.min(score / max, 1)
  const radius = 82
  const stroke = 8
  const cx = 90
  const cy = 90
  const circumference = 2 * Math.PI * radius

  const scoreColor = score >= 7.0 ? 'var(--primary-gold)' : score >= 4.0 ? 'var(--warning-amber)' : 'var(--danger-crimson)'

  return (
    <div className="relative w-[180px] h-[180px]">
      <svg width="180" height="180" viewBox="0 0 180 180">
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke="#1e2035"
          strokeWidth={stroke}
        />
        <circle
          cx={cx} cy={cy} r={radius}
          fill="none"
          stroke={scoreColor}
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
        <span className="font-mono text-[42px] font-bold text-gold">{score.toFixed(1)}</span>
        <span className="font-mono text-sm text-txt-muted">/10</span>
      </div>
    </div>
  )
}
