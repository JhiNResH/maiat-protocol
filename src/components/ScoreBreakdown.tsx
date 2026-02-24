interface BreakdownItem {
  label: string
  value: number
  max: number
  color: string
}

interface ScoreBreakdownProps {
  items: BreakdownItem[]
}

export function ScoreBreakdown({ items }: ScoreBreakdownProps) {
  return (
    <div className="flex flex-col gap-5 bg-surface rounded-2xl border border-border-subtle p-6">
      <h3 className="text-base font-bold text-txt-primary">Score Breakdown</h3>
      {items.map((item) => (
        <div key={item.label} className="flex flex-col gap-1.5">
          <div className="flex justify-between">
            <span className="text-[13px] text-txt-secondary">{item.label}</span>
            <span className="font-mono text-[13px] font-semibold text-txt-primary">
              {item.value}/{item.max}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[#1e2035]">
            <div
              className="h-1.5 rounded-full transition-all duration-500"
              style={{
                width: `${(item.value / item.max) * 100}%`,
                backgroundColor: item.color,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
