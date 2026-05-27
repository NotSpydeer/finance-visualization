/**
 * 费用热力图组件
 * Prototype: grid-template-columns: 42px repeat(7, 1fr), time labels on left
 * 7列网格 (S-M-T-W-T-F-S)，4色阶
 * Requirements: 21.1-21.3
 */

import React, { useMemo, useCallback } from 'react';
import { useAppStore } from '../state/store';
import { filterRecords } from '../data/selectors';

/** 星期标签 */
const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Time labels for left column */
const TIME_LABELS = ['6pm', '4pm', '2pm', '12pm', '10am', '8am', '6am', ''];

/** 4色阶 */
const LEVEL_COLORS = ['#dcece6', '#a8d6c5', '#5faf91', '#20785c'];

/** 将日期字符串转为星期索引 0=Sunday */
function getDayOfWeek(dateStr: string): number {
  const d = new Date(dateStr);
  return d.getDay();
}

/** 获取日期对应的周数 */
function getWeekOffset(dateStr: string, startDate: string): number {
  const d = new Date(dateStr).getTime();
  const s = new Date(startDate).getTime();
  return Math.floor((d - s) / (7 * 24 * 60 * 60 * 1000));
}

export function Heatmap() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);

  const filtered = useMemo(() => filterRecords(records, filter), [records, filter]);

  const { grid, maxWeeks, maxValue } = useMemo(() => {
    if (filtered.length === 0) return { grid: [] as { date: string; dow: number; week: number; amount: number }[], maxWeeks: 0, maxValue: 0 };

    const dateMap = new Map<string, number>();
    for (const r of filtered) {
      dateMap.set(r.date, (dateMap.get(r.date) ?? 0) + r.amountCNY);
    }

    const dates = Array.from(dateMap.keys()).sort();
    if (dates.length === 0) return { grid: [], maxWeeks: 0, maxValue: 0 };

    const startDate = dates[0];
    let maxW = 0;
    let maxV = 0;

    const cells = dates.map((date) => {
      const amount = dateMap.get(date) ?? 0;
      const dow = getDayOfWeek(date);
      const week = getWeekOffset(date, startDate);
      if (week > maxW) maxW = week;
      if (amount > maxV) maxV = amount;
      return { date, dow, week, amount };
    });

    return { grid: cells, maxWeeks: maxW, maxValue: maxV };
  }, [filtered]);

  const getLevel = useCallback((amount: number): number => {
    if (amount <= 0 || maxValue <= 0) return 0;
    const ratio = amount / maxValue;
    if (ratio <= 0.25) return 0;
    if (ratio <= 0.5) return 1;
    if (ratio <= 0.75) return 2;
    return 3;
  }, [maxValue]);

  const handleCellClick = useCallback((date: string) => {
    updateFilter({ date, period: '', dateStart: '', dateEnd: '' });
  }, [updateFilter]);

  const displayWeeks = Math.min(maxWeeks + 1, 8);

  if (grid.length === 0) {
    return (
      <div style={styles.card} role="region" aria-label="费用热力">
        <h2 className="card-title-bar orange" style={{ marginBottom: '12px' }}>费用热力</h2>
        <div style={styles.empty}>当前筛选条件下暂无数据</div>
      </div>
    );
  }

  return (
    <div style={styles.card} role="region" aria-label="费用热力">
      <h2 className="card-title-bar orange" style={{ marginBottom: '12px' }}>费用热力</h2>

      {/* 热力网格 with time labels */}
      <div style={styles.heatGrid}>
        {/* Header row: empty + 7 weekday labels */}
        <span style={styles.timeLabel} />
        {WEEKDAY_LABELS.map((label, i) => (
          <span key={i} style={styles.weekLabel}>{label}</span>
        ))}

        {/* Data rows: time label + 7 cells per row */}
        {Array.from({ length: displayWeeks }, (_, week) => (
          <React.Fragment key={week}>
            <span style={styles.timeLabel}>{TIME_LABELS[week] || ''}</span>
            {Array.from({ length: 7 }, (_, dow) => {
              const cell = grid.find((c) => c.week === week && c.dow === dow);
              const level = cell ? getLevel(cell.amount) : -1;
              const bgColor = level >= 0 ? LEVEL_COLORS[level] : '#d7ebe3';
              const textColor = level >= 2 ? '#fff' : '#3a5a4a';
              const cellText = cell && cell.amount > 0
                ? (cell.amount >= 10000 ? `${(cell.amount / 10000).toFixed(1)}万` : `${Math.round(cell.amount)}`)
                : '';

              return (
                <div
                  key={dow}
                  style={{ ...styles.cell, backgroundColor: bgColor }}
                  onClick={() => cell && handleCellClick(cell.date)}
                  title={cell ? `${cell.date}: ${(cell.amount / 10000).toFixed(1)}万` : ''}
                  role={cell ? 'button' : undefined}
                  tabIndex={cell ? 0 : undefined}
                >
                  <span style={{ fontSize: '9px', color: textColor, fontWeight: 600 }}>{cellText}</span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>

      {/* 色阶图例 */}
      <div style={styles.legendRow}>
        <span style={styles.legendLabel}>少</span>
        {LEVEL_COLORS.map((color, i) => (
          <div key={i} style={{ ...styles.legendBox, backgroundColor: color }} />
        ))}
        <span style={styles.legendLabel}>多</span>
      </div>
    </div>
  );
}

// Need React import for Fragment - already imported at top

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--line)',
    padding: '18px 20px',
  },
  heatGrid: {
    display: 'grid',
    gridTemplateColumns: '42px repeat(7, 1fr)',
    gap: '6px',
    fontSize: '11px',
    color: 'var(--muted)',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: '11px',
    color: 'var(--muted)',
    textAlign: 'right' as const,
    paddingRight: '4px',
  },
  weekLabel: {
    fontSize: '10px',
    color: 'var(--muted)',
    textAlign: 'center' as const,
  },
  cell: {
    height: '23px',
    borderRadius: '5px',
    cursor: 'pointer',
    transition: 'opacity .15s',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '10px',
    justifyContent: 'flex-end',
  },
  legendLabel: {
    fontSize: '10px',
    color: 'var(--muted)',
  },
  legendBox: {
    width: '12px',
    height: '12px',
    borderRadius: '3px',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '13px',
    padding: '24px 0',
  },
};

export default Heatmap;
