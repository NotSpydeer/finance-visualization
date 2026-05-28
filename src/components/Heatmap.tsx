/**
 * 费用热力图组件
 * 横轴=部门，纵轴=月份，受全局筛选联动
 * 选中部门时高亮该列
 * Requirements: 21.1-21.3
 */

import React, { useMemo, useCallback } from 'react';
import { useAppStore } from '../state/store';
import { filterRecords } from '../data/selectors';

/** 4色阶 */
const LEVEL_COLORS = ['#dcece6', '#a8d6c5', '#5faf91', '#20785c'];

export function Heatmap() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);

  const filtered = useMemo(() => filterRecords(records, filter), [records, filter]);

  // Build matrix: rows=months, cols=departments
  const { months, departments, matrix, maxValue } = useMemo(() => {
    if (filtered.length === 0) {
      return { months: [] as string[], departments: [] as string[], matrix: new Map<string, number>(), maxValue: 0 };
    }

    const monthSet = new Set<string>();
    const deptSet = new Set<string>();
    const cellMap = new Map<string, number>(); // key = "month|dept"

    for (const r of filtered) {
      const month = r.periodMonth;
      const dept = r.department || '未分配';
      monthSet.add(month);
      deptSet.add(dept);
      const key = `${month}|${dept}`;
      cellMap.set(key, (cellMap.get(key) ?? 0) + r.amountCNY);
    }

    const sortedMonths = Array.from(monthSet).sort();
    // Sort departments by total amount descending, take top 8
    const deptTotals = new Map<string, number>();
    for (const dept of deptSet) {
      let total = 0;
      for (const month of sortedMonths) {
        total += cellMap.get(`${month}|${dept}`) ?? 0;
      }
      deptTotals.set(dept, total);
    }
    const sortedDepts = Array.from(deptSet)
      .sort((a, b) => (deptTotals.get(b) ?? 0) - (deptTotals.get(a) ?? 0));

    let maxV = 0;
    for (const v of cellMap.values()) {
      if (v > maxV) maxV = v;
    }

    return { months: sortedMonths, departments: sortedDepts, matrix: cellMap, maxValue: maxV };
  }, [filtered]);

  const getLevel = useCallback((amount: number): number => {
    if (amount <= 0 || maxValue <= 0) return -1;
    const ratio = amount / maxValue;
    if (ratio <= 0.25) return 0;
    if (ratio <= 0.5) return 1;
    if (ratio <= 0.75) return 2;
    return 3;
  }, [maxValue]);

  const handleDeptClick = useCallback((dept: string) => {
    // Toggle department filter (header click: only dept)
    if (filter.department === dept && !filter.period) {
      updateFilter({ department: '' });
    } else {
      updateFilter({ department: dept, period: '', date: '', dateStart: '', dateEnd: '' });
    }
  }, [filter.department, filter.period, updateFilter]);

  const handleCellClick = useCallback((dept: string, month: string) => {
    // Toggle: if same cell is already selected, deselect
    if (filter.department === dept && filter.period === month) {
      updateFilter({ department: '', period: '', date: '', dateStart: '', dateEnd: '' });
    } else {
      // Lock both department and month
      updateFilter({ department: dept, period: month, date: '', dateStart: '', dateEnd: '' });
    }
  }, [filter.department, filter.period, updateFilter]);

  const handleMonthClick = useCallback((month: string) => {
    if (filter.period === month && !filter.department) {
      updateFilter({ period: '', date: '', dateStart: '', dateEnd: '' });
    } else {
      updateFilter({ period: month, date: '', dateStart: '', dateEnd: '' });
    }
  }, [filter.period, filter.department, updateFilter]);

  const selectedDept = filter.department;
  const selectedMonth = filter.period;

  if (months.length === 0 || departments.length === 0) {
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
      <div style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '8px' }}>
        横轴：部门 ｜ 纵轴：月份 ｜ 颜色深浅代表费用金额{departments.length > 6 ? ' ｜ ← 左右滑动查看全部 →' : ''}
      </div>

      <div style={styles.scrollContainer}>
        <div style={{ ...styles.heatGrid, gridTemplateColumns: `52px repeat(${departments.length}, 64px)`, minWidth: `${52 + departments.length * 68}px` }}>
          {/* Header row: empty corner + department names */}
          <span style={styles.cornerLabel} />
          {departments.map((dept) => {
            const isHighlighted = selectedDept === dept;
            return (
              <span
                key={dept}
                style={{ ...styles.deptLabel, ...(isHighlighted ? styles.deptLabelActive : {}) }}
                onClick={() => handleDeptClick(dept)}
              >
                {dept.length > 4 ? dept.slice(0, 4) + '…' : dept}
              </span>
            );
          })}

          {/* Data rows: month label + cells */}
          {months.map((month) => (
            <React.Fragment key={month}>
              <span
                style={{ ...styles.monthLabel, ...(selectedMonth === month ? styles.monthLabelActive : {}) }}
                onClick={() => handleMonthClick(month)}
              >
                {month.slice(5)}月
              </span>
              {departments.map((dept) => {
                const key = `${month}|${dept}`;
                const amount = matrix.get(key) ?? 0;
                const level = getLevel(amount);
                const bgColor = level >= 0 ? LEVEL_COLORS[level] : '#edf3f0';
                // Highlight: exact cell match (both dept and month selected)
                const isCellHighlighted = selectedDept === dept && selectedMonth === month;
                // Dim: if a cell is selected, dim all others
                const hasCellSelection = !!(selectedDept && selectedMonth);
                const isDimmed = hasCellSelection && !isCellHighlighted;
                const textColor = level >= 2 ? '#fff' : '#3a5a4a';
                const cellText = amount >= 10000 ? `${(amount / 10000).toFixed(0)}万` : amount > 0 ? `${Math.round(amount / 1000)}k` : '';

                return (
                  <div
                    key={dept}
                    style={{
                      ...styles.cell,
                      backgroundColor: bgColor,
                      ...(isCellHighlighted ? styles.cellHighlight : {}),
                      ...(isDimmed ? { opacity: 0.4 } : {}),
                    }}
                    onClick={() => handleCellClick(dept, month)}
                    title={`${dept} · ${month}: ${(amount / 10000).toFixed(1)}万`}
                  >
                    <span style={{ fontSize: '9px', color: textColor, fontWeight: 600 }}>{cellText}</span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div style={styles.legendRow}>
        <span style={styles.legendLabel}>少</span>
        {LEVEL_COLORS.map((color, i) => (
          <div key={i} style={{ ...styles.legendBox, backgroundColor: color }} />
        ))}
        <span style={styles.legendLabel}>多</span>
        {selectedDept && selectedMonth && (
          <span style={styles.selectedHint}>已选中：{selectedDept} · {selectedMonth}</span>
        )}
        {selectedDept && !selectedMonth && (
          <span style={styles.selectedHint}>已选中：{selectedDept}</span>
        )}
        {!selectedDept && selectedMonth && /^\d{4}-\d{2}$/.test(selectedMonth) && (
          <span style={styles.selectedHint}>已选中：{selectedMonth}</span>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--line)',
    padding: '18px 20px',
    minWidth: 0,
    overflow: 'hidden',
  },
  scrollContainer: {
    overflowX: 'auto',
    overflowY: 'hidden',
    paddingBottom: '6px',
    maxWidth: '100%',
  },
  heatGrid: {
    display: 'grid',
    gap: '4px',
    fontSize: '11px',
    color: 'var(--muted)',
    alignItems: 'center',
  },
  cornerLabel: {
    fontSize: '10px',
    color: 'var(--muted)',
  },
  deptLabel: {
    fontSize: '10px',
    fontWeight: 800,
    color: 'var(--muted)',
    textAlign: 'center',
    cursor: 'pointer',
    padding: '2px 0',
    borderRadius: '3px',
    transition: 'all .15s',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  deptLabelActive: {
    color: 'var(--green)',
    background: 'var(--green-3)',
    fontWeight: 900,
  },
  monthLabel: {
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--muted)',
    textAlign: 'right',
    paddingRight: '4px',
    cursor: 'pointer',
  },
  monthLabelActive: {
    color: 'var(--green)',
    fontWeight: 900,
  },
  cell: {
    height: '24px',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'all .15s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  cellHighlight: {
    outline: '2px solid var(--green)',
    outlineOffset: '-1px',
    transform: 'scale(1.05)',
    zIndex: 1,
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
  selectedHint: {
    marginLeft: '8px',
    fontSize: '10px',
    fontWeight: 700,
    color: 'var(--green)',
    background: 'var(--green-3)',
    padding: '2px 6px',
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
