import { useState } from 'react';

export interface DailySeriesPoint {
  date: string; // YYYY-MM-DD
  label: string;
  signups: number;
  groups: number;
  bookings: number;
}

interface AdminChartsProps {
  data: DailySeriesPoint[];
}

/**
 * Clean, zero-gradient 30-day SVG trend chart with hover/focus point readouts
 * and accessible summary metrics for Signups, Groups, and Bookings.
 */
export function AdminCharts({ data }: AdminChartsProps) {
  const [activeMetric, setActiveMetric] = useState<'all' | 'signups' | 'groups' | 'bookings'>('all');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const width = 680;
  const height = 210;
  const padLeft = 36;
  const padRight = 16;
  const padTop = 18;
  const padBottom = 28;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;

  const maxVal = Math.max(
    4,
    ...data.map((d) =>
      activeMetric === 'all'
        ? Math.max(d.signups, d.groups, d.bookings)
        : d[activeMetric]
    )
  );

  const xPos = (idx: number) =>
    data.length <= 1 ? padLeft + innerW / 2 : padLeft + (idx / (data.length - 1)) * innerW;

  const yPos = (val: number) => padTop + innerH - (val / maxVal) * innerH;

  const buildPath = (extractor: (d: DailySeriesPoint) => number) =>
    data
      .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xPos(i).toFixed(1)} ${yPos(extractor(pt)).toFixed(1)}`)
      .join(' ');

  const totalSignups = data.reduce((s, d) => s + d.signups, 0);
  const totalGroups = data.reduce((s, d) => s + d.groups, 0);
  const totalBookings = data.reduce((s, d) => s + d.bookings, 0);

  const focusedPoint = hoveredIdx !== null ? data[hoveredIdx] : data[data.length - 1];

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-subtle">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900">30-Day Activity Trend</h2>
          <p className="text-[11px] text-slate-500">
            Daily signups, newly formed groups, and paid bookings over the last 30 days
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          {(
            [
              { id: 'all', label: 'All Metrics' },
              { id: 'signups', label: `Signups (${totalSignups})` },
              { id: 'groups', label: `Groups (${totalGroups})` },
              { id: 'bookings', label: `Bookings (${totalBookings})` },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMetric(tab.id)}
              className={`px-2.5 py-1 rounded-lg font-semibold border transition-colors ${
                activeMetric === tab.id
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Focused day readout */}
      {focusedPoint && (
        <div className="flex flex-wrap items-center gap-4 px-3 py-2 bg-slate-50 border border-slate-200/80 rounded-lg text-xs tabular-nums">
          <span className="font-semibold text-slate-700">{focusedPoint.label}:</span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-brand-600 inline-block" aria-hidden="true" />
            Signups: <strong>{focusedPoint.signups}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-600 inline-block" aria-hidden="true" />
            Groups: <strong>{focusedPoint.groups}</strong>
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-600 inline-block" aria-hidden="true" />
            Bookings: <strong>{focusedPoint.bookings}</strong>
          </span>
        </div>
      )}

      <div className="w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="w-full min-w-[460px] h-52"
          role="img"
          aria-label="30-day trend line chart for signups, groups, and bookings"
        >
          {/* Horizontal gridlines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const val = Math.round(maxVal * ratio);
            const y = yPos(val);
            return (
              <g key={ratio}>
                <line
                  x1={padLeft}
                  y1={y}
                  x2={width - padRight}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray="3 3"
                />
                <text
                  x={padLeft - 6}
                  y={y + 3}
                  textAnchor="end"
                  className="fill-slate-400 text-[10px] font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          {/* Lines */}
          {(activeMetric === 'all' || activeMetric === 'signups') && data.length > 0 && (
            <path
              d={buildPath((d) => d.signups)}
              fill="none"
              stroke="#2563EB"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}
          {(activeMetric === 'all' || activeMetric === 'groups') && data.length > 0 && (
            <path
              d={buildPath((d) => d.groups)}
              fill="none"
              stroke="#059669"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}
          {(activeMetric === 'all' || activeMetric === 'bookings') && data.length > 0 && (
            <path
              d={buildPath((d) => d.bookings)}
              fill="none"
              stroke="#D97706"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          )}

          {/* X-axis tick labels every 5 days */}
          {data.map((pt, i) => {
            const showTick = i === 0 || i === data.length - 1 || i % 5 === 0;
            const cx = xPos(i);
            return (
              <g key={pt.date}>
                {showTick && (
                  <text
                    x={cx}
                    y={height - 8}
                    textAnchor="middle"
                    className="fill-slate-400 text-[10px]"
                  >
                    {pt.label}
                  </text>
                )}
                {/* Interactive vertical hit zone */}
                <rect
                  x={cx - innerW / Math.max(1, data.length) / 2}
                  y={padTop}
                  width={Math.max(8, innerW / Math.max(1, data.length))}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() => setHoveredIdx(i)}
                  onFocus={() => setHoveredIdx(i)}
                  tabIndex={0}
                  aria-label={`${pt.label}: ${pt.signups} signups, ${pt.groups} groups, ${pt.bookings} bookings`}
                />
                {hoveredIdx === i && (
                  <line
                    x1={cx}
                    y1={padTop}
                    x2={cx}
                    y2={height - padBottom}
                    stroke="#94A3B8"
                    strokeWidth="1"
                  />
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
