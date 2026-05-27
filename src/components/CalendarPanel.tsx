/**
 * 日历筛选组件（完全重写）
 * 右侧面板：状态文本 + 年/月/日/区间 按钮 + 年行 + 月网格 + 日网格 + 区间模式
 * Requirements: 16.1-16.6, 6.1, 6.2, 19.1, 19.2
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAppStore } from '../state/store';
import { getDaysInMonth, getDay } from 'date-fns';

// ─── Helpers ───────────────────────────────────────────────

function getStatusText(
  filter: { period: string; date: string; dateStart: string; dateEnd: string },
  isSettingRange: boolean
): string {
  if (isSettingRange) return '正在设置日期区间';
  if (filter.date) return `当前：按日筛选 ${filter.date}`;
  if (filter.dateStart && filter.dateEnd) return `当前：按日期区间 ${filter.dateStart} 至 ${filter.dateEnd}`;
  if (/^\d{4}-\d{2}$/.test(filter.period)) return `当前：按月筛选 ${filter.period}`;
  if (/^\d{4}$/.test(filter.period)) return `当前：按年筛选 ${filter.period}`;
  return '当前：全部时间';
}

function getAvailableYears(records: { date: string }[]): number[] {
  const yearSet = new Set<number>();
  for (const r of records) {
    if (r.date && r.date.length >= 4) {
      const y = parseInt(r.date.substring(0, 4), 10);
      if (!isNaN(y)) yearSet.add(y);
    }
  }
  const years = Array.from(yearSet).sort((a, b) => a - b);
  // Always include current year if no records
  if (years.length === 0) years.push(new Date().getFullYear());
  return years;
}

function getFirstDayOfWeek(year: number, month: number): number {
  return getDay(new Date(year, month - 1, 1));
}

function getDaysCount(year: number, month: number): number {
  return getDaysInMonth(new Date(year, month - 1, 1));
}

function formatDate(year: number, month: number, day: number): string {
  return `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
}

const WEEKDAY_LABELS = ['日', '一', '二', '三', '四', '五', '六'];
const MONTH_LABELS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];

// ─── Component ─────────────────────────────────────────────

export function CalendarPanel() {
  const { records, filter, updateFilter, clearTimeFilter } = useAppStore();

  const [rangeMode, setRangeMode] = useState(false);
  const [rangeStartInput, setRangeStartInput] = useState('');
  const [rangeEndInput, setRangeEndInput] = useState('');

  const [displayYear, setDisplayYear] = useState<number>(() => {
    if (filter.date) return parseInt(filter.date.substring(0, 4), 10);
    if (filter.dateStart) return parseInt(filter.dateStart.substring(0, 4), 10);
    if (/^\d{4}-\d{2}$/.test(filter.period)) return parseInt(filter.period.substring(0, 4), 10);
    if (/^\d{4}$/.test(filter.period)) return parseInt(filter.period, 10);
    return new Date().getFullYear();
  });

  const [displayMonth, setDisplayMonth] = useState<number>(() => {
    if (filter.date) return parseInt(filter.date.substring(5, 7), 10);
    if (filter.dateStart) return parseInt(filter.dateStart.substring(5, 7), 10);
    if (/^\d{4}-\d{2}$/.test(filter.period)) return parseInt(filter.period.substring(5, 7), 10);
    return new Date().getMonth() + 1;
  });

  // Sync displayYear/displayMonth when filter changes externally
  useEffect(() => {
    if (filter.date) {
      setDisplayYear(parseInt(filter.date.substring(0, 4), 10));
      setDisplayMonth(parseInt(filter.date.substring(5, 7), 10));
    } else if (/^\d{4}-\d{2}$/.test(filter.period)) {
      setDisplayYear(parseInt(filter.period.substring(0, 4), 10));
      setDisplayMonth(parseInt(filter.period.substring(5, 7), 10));
    } else if (/^\d{4}$/.test(filter.period)) {
      setDisplayYear(parseInt(filter.period, 10));
    }
  }, [filter.period, filter.date]);

  const availableYears = useMemo(() => getAvailableYears(records), [records]);

  const statusText = getStatusText(filter, rangeMode);

  // Determine what is currently active (strict matching for highlight)
  const isYearFilterActive = /^\d{4}$/.test(filter.period) && !filter.date && !filter.dateStart && !filter.dateEnd;
  const isMonthFilterActive = /^\d{4}-\d{2}$/.test(filter.period) && !filter.date && !filter.dateStart && !filter.dateEnd;
  const isDayFilterActive = !!filter.date;
  const isRangeFilterActive = !!(filter.dateStart && filter.dateEnd);
  const hasAnyTimeFilter = !!(filter.period || filter.date || filter.dateStart || filter.dateEnd);

  // ─── Granularity button handlers ───

  const handleGranYear = useCallback(() => {
    setRangeMode(false);
    if (isYearFilterActive) {
      // Toggle off: clear time filter
      clearTimeFilter();
    } else {
      updateFilter({ period: String(displayYear), date: '', dateStart: '', dateEnd: '' });
    }
  }, [updateFilter, clearTimeFilter, displayYear, isYearFilterActive]);

  const handleGranMonth = useCallback(() => {
    setRangeMode(false);
    if (isMonthFilterActive) {
      // Toggle off: go back to year only
      updateFilter({ period: String(displayYear), date: '', dateStart: '', dateEnd: '' });
    } else {
      const periodStr = `${displayYear}-${displayMonth.toString().padStart(2, '0')}`;
      updateFilter({ period: periodStr, date: '', dateStart: '', dateEnd: '' });
    }
  }, [updateFilter, displayYear, displayMonth, isMonthFilterActive]);

  const handleGranDay = useCallback(() => {
    setRangeMode(false);
    if (isDayFilterActive) {
      // Toggle off: go back to month filter
      const monthPeriod = filter.date.slice(0, 7);
      updateFilter({ period: monthPeriod, date: '', dateStart: '', dateEnd: '' });
    }
    // Otherwise: user must click a day in the grid
  }, [isDayFilterActive, filter.date, updateFilter]);

  const handleGranRange = useCallback(() => {
    if (rangeMode) {
      // Toggle off
      setRangeMode(false);
      setRangeStartInput('');
      setRangeEndInput('');
    } else {
      setRangeMode(true);
      // Pre-fill from current filter if range is active
      setRangeStartInput(filter.dateStart || '');
      setRangeEndInput(filter.dateEnd || '');
    }
  }, [rangeMode, filter.dateStart, filter.dateEnd]);

  // ─── Year row click ───

  const handleYearSelect = useCallback((year: number) => {
    setDisplayYear(year);
    setRangeMode(false);
    // Toggle off: if clicking the already-selected year, clear time filter
    if (isYearFilterActive && filter.period === String(year)) {
      clearTimeFilter();
      return;
    }
    updateFilter({ period: String(year), date: '', dateStart: '', dateEnd: '' });
  }, [updateFilter, clearTimeFilter, isYearFilterActive, filter.period]);

  // ─── Month grid click ───

  const handleMonthSelect = useCallback((monthIdx: number) => {
    const month = monthIdx + 1;
    setDisplayMonth(month);
    setRangeMode(false);
    const periodStr = `${displayYear}-${month.toString().padStart(2, '0')}`;
    // Toggle off: if clicking the already-selected month, go back to year
    if (isMonthFilterActive && filter.period === periodStr) {
      updateFilter({ period: String(displayYear), date: '', dateStart: '', dateEnd: '' });
      return;
    }
    updateFilter({ period: periodStr, date: '', dateStart: '', dateEnd: '' });
  }, [updateFilter, displayYear, isMonthFilterActive, filter.period]);

  // ─── Day grid click ───

  const handleDayClick = useCallback((day: number) => {
    const dateStr = formatDate(displayYear, displayMonth, day);
    setRangeMode(false);
    // Toggle off: if clicking the already-selected day, go back to month filter
    if (filter.date === dateStr) {
      const monthPeriod = dateStr.slice(0, 7);
      updateFilter({ period: monthPeriod, date: '', dateStart: '', dateEnd: '' });
      return;
    }
    updateFilter({ date: dateStr, period: '', dateStart: '', dateEnd: '' });
  }, [updateFilter, displayYear, displayMonth, filter.date]);

  // ─── Range apply ───

  const handleRangeApply = useCallback(() => {
    if (rangeStartInput && rangeEndInput) {
      let start = rangeStartInput;
      let end = rangeEndInput;
      if (start > end) [start, end] = [end, start];
      updateFilter({ dateStart: start, dateEnd: end, date: '', period: '' });
      setRangeMode(false);
    }
  }, [updateFilter, rangeStartInput, rangeEndInput]);

  const handleRangeCancel = useCallback(() => {
    setRangeMode(false);
    setRangeStartInput('');
    setRangeEndInput('');
  }, []);

  // ─── Clear time ───

  const handleClearTime = useCallback(() => {
    clearTimeFilter();
    setRangeMode(false);
    setRangeStartInput('');
    setRangeEndInput('');
  }, [clearTimeFilter]);

  // ─── Calendar day grid computation ───

  const calendarDays = useMemo(() => {
    const firstDow = getFirstDayOfWeek(displayYear, displayMonth);
    const totalDays = getDaysCount(displayYear, displayMonth);
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDow; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) cells.push(d);
    while (cells.length < 35) cells.push(null);
    if (cells.length > 35) while (cells.length < 42) cells.push(null);
    return cells;
  }, [displayYear, displayMonth]);

  // Day highlight logic
  const isSelectedDay = (day: number): boolean => {
    if (!isDayFilterActive) return false;
    return filter.date === formatDate(displayYear, displayMonth, day);
  };

  const isInDateRange = (day: number): boolean => {
    if (!filter.dateStart || !filter.dateEnd) return false;
    const dateStr = formatDate(displayYear, displayMonth, day);
    return dateStr >= filter.dateStart && dateStr <= filter.dateEnd;
  };

  // ─── Render ───

  return (
    <div style={styles.container}>
      {/* Status display */}
      <div style={styles.statusCard}>
        <div style={styles.statusText}>{statusText}</div>
      </div>

      {/* Granularity buttons: 年 / 月 / 日 / 区间 */}
      <div style={styles.granRow}>
        <button
          style={{ ...styles.granBtn, ...(isYearFilterActive ? styles.granBtnActive : {}) }}
          onClick={handleGranYear}
        >
          年
        </button>
        <button
          style={{ ...styles.granBtn, ...(isMonthFilterActive ? styles.granBtnActive : {}) }}
          onClick={handleGranMonth}
        >
          月
        </button>
        <button
          style={{ ...styles.granBtn, ...(isDayFilterActive ? styles.granBtnActive : {}) }}
          onClick={handleGranDay}
        >
          日
        </button>
        <button
          style={{ ...styles.granBtn, ...((isRangeFilterActive || rangeMode) ? styles.granBtnActive : {}) }}
          onClick={handleGranRange}
        >
          区间
        </button>
      </div>

      {/* Year selection row */}
      <div style={styles.yearRow}>
        {availableYears.map((y) => {
          const isActive = isYearFilterActive && filter.period === String(y);
          return (
            <button
              key={y}
              style={{ ...styles.yearBtn, ...(isActive ? styles.yearBtnActive : displayYear === y ? styles.yearBtnCurrent : {}) }}
              onClick={() => handleYearSelect(y)}
            >
              {y}
            </button>
          );
        })}
      </div>

      {/* Month grid (4x3) */}
      <div style={styles.monthGrid}>
        {MONTH_LABELS.map((label, idx) => {
          const month = idx + 1;
          const monthPeriod = `${displayYear}-${label}`;
          // Only highlight if filter.period is exactly YYYY-MM matching this month
          const isActive = isMonthFilterActive && filter.period === monthPeriod;
          return (
            <button
              key={label}
              style={{ ...styles.monthBtn, ...(isActive ? styles.monthBtnActive : displayMonth === month && !isYearFilterActive ? styles.monthBtnCurrent : {}) }}
              onClick={() => handleMonthSelect(idx)}
            >
              {label}月
            </button>
          );
        })}
      </div>

      {/* Day grid navigation */}
      <div style={styles.navRow}>
        <button style={styles.navBtn} onClick={() => {
          if (displayMonth === 1) { setDisplayYear(displayYear - 1); setDisplayMonth(12); }
          else setDisplayMonth(displayMonth - 1);
        }}>◀</button>
        <span style={styles.navTitle}>{displayYear}年{displayMonth.toString().padStart(2, '0')}月</span>
        <button style={styles.navBtn} onClick={() => {
          if (displayMonth === 12) { setDisplayYear(displayYear + 1); setDisplayMonth(1); }
          else setDisplayMonth(displayMonth + 1);
        }}>▶</button>
      </div>

      {/* Weekday header */}
      <div style={styles.weekRow}>
        {WEEKDAY_LABELS.map((l) => <span key={l} style={styles.weekCell}>{l}</span>)}
      </div>

      {/* Day grid */}
      <div style={styles.dayGrid}>
        {calendarDays.map((day, idx) => {
          if (day === null) return <div key={`e-${idx}`} style={styles.dayCell} />;
          const selected = isSelectedDay(day);
          const inRange = isInDateRange(day);

          let cellStyle: React.CSSProperties = { ...styles.dayCell, ...styles.dayCellClickable };
          if (selected) cellStyle = { ...cellStyle, ...styles.dayCellSelected };
          else if (inRange) cellStyle = { ...cellStyle, ...styles.dayCellRange };

          return (
            <div
              key={`d-${day}`}
              style={cellStyle}
              onClick={() => handleDayClick(day)}
              role="button"
              tabIndex={0}
            >
              {day}
            </div>
          );
        })}
      </div>

      {/* Range mode inputs - only visible when 区间 button is clicked */}
      {rangeMode && (
        <div style={styles.rangeSection}>
          <div style={styles.rangeLabel}>日期区间选择</div>
          <div style={styles.rangeInputRow}>
            <input
              type="date"
              value={rangeStartInput}
              onChange={(e) => setRangeStartInput(e.target.value)}
              style={styles.rangeInput}
              placeholder="开始日期"
            />
            <span style={styles.rangeSep}>至</span>
            <input
              type="date"
              value={rangeEndInput}
              onChange={(e) => setRangeEndInput(e.target.value)}
              style={styles.rangeInput}
              placeholder="结束日期"
            />
          </div>
          <div style={styles.rangeActions}>
            <button
              style={styles.rangeApplyBtn}
              onClick={handleRangeApply}
              disabled={!rangeStartInput || !rangeEndInput}
            >
              应用日期区间
            </button>
            <button style={styles.rangeCancelBtn} onClick={handleRangeCancel}>
              取消
            </button>
          </div>
        </div>
      )}

      {/* Clear time filter button */}
      {hasAnyTimeFilter && (
        <button style={styles.clearBtn} onClick={handleClearTime}>
          清除时间筛选
        </button>
      )}
    </div>
  );
}

// ─── Styles ────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  statusCard: {
    display: 'grid',
    gap: '4px',
    padding: '9px 10px',
    borderRadius: '7px',
    border: '1px solid rgba(37, 125, 96, .16)',
    background: '#f7fbf8',
  },
  statusText: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text)',
    lineHeight: '1.2',
  },
  granRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
  },
  granBtn: {
    height: '28px',
    fontSize: '11px',
    borderRadius: '5px',
    border: '1px solid var(--line)',
    backgroundColor: '#fbfcfb',
    color: 'var(--muted)',
    cursor: 'pointer',
    textAlign: 'center',
    fontWeight: 800,
    transition: 'all .15s',
    padding: 0,
  },
  granBtnActive: {
    backgroundColor: 'var(--green)',
    borderColor: 'var(--green)',
    color: '#ffffff',
  },
  yearRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  yearBtn: {
    padding: '5px 12px',
    fontSize: '12px',
    border: '1px solid var(--line)',
    borderRadius: '5px',
    backgroundColor: '#fbfcfb',
    cursor: 'pointer',
    color: 'var(--text)',
    fontWeight: 800,
    transition: 'all .12s',
  },
  yearBtnActive: {
    backgroundColor: 'var(--green)',
    borderColor: 'var(--green)',
    color: '#ffffff',
  },
  yearBtnCurrent: {
    borderColor: 'var(--green-2)',
    backgroundColor: 'var(--green-3)',
  },
  monthGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '6px',
  },
  monthBtn: {
    height: '30px',
    fontSize: '11px',
    borderRadius: '5px',
    border: '1px solid var(--line)',
    backgroundColor: '#fbfcfb',
    color: 'var(--muted)',
    cursor: 'pointer',
    textAlign: 'center',
    fontWeight: 800,
    transition: 'all .12s',
    padding: 0,
  },
  monthBtnActive: {
    backgroundColor: 'var(--green)',
    borderColor: 'var(--green)',
    color: '#ffffff',
  },
  monthBtnCurrent: {
    borderColor: 'var(--green-2)',
    backgroundColor: 'var(--green-3)',
  },
  navRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: '4px',
  },
  navBtn: {
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'var(--muted)',
    padding: '4px 8px',
    borderRadius: '4px',
  },
  navTitle: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  weekRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '2px',
  },
  weekCell: {
    textAlign: 'center',
    fontSize: '11px',
    color: 'var(--muted)',
    padding: '2px 0',
  },
  dayGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(7, 1fr)',
    gap: '3px',
  },
  dayCell: {
    textAlign: 'center',
    fontSize: '12px',
    borderRadius: '50%',
    height: '28px',
    width: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto',
  },
  dayCellClickable: {
    cursor: 'pointer',
    transition: 'all .18s',
    color: 'var(--text)',
  },
  dayCellSelected: {
    backgroundColor: 'var(--green)',
    color: '#ffffff',
    fontWeight: 600,
  },
  dayCellRange: {
    borderRadius: '8px',
    backgroundColor: '#e4f2eb',
    color: 'var(--green)',
    fontWeight: 900,
  },
  rangeSection: {
    padding: '10px 12px',
    backgroundColor: 'var(--surface)',
    borderRadius: '6px',
    border: '1px solid var(--line)',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  rangeLabel: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  rangeInputRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  rangeInput: {
    flex: 1,
    height: '30px',
    padding: '0 8px',
    fontSize: '11px',
    fontWeight: 800,
    border: '1px solid var(--line)',
    borderRadius: '5px',
    backgroundColor: '#fbfcfb',
    color: 'var(--text)',
    outline: 'none',
  },
  rangeSep: {
    fontSize: '12px',
    color: 'var(--muted)',
    flexShrink: 0,
  },
  rangeActions: {
    display: 'flex',
    gap: '8px',
  },
  rangeApplyBtn: {
    flex: 1,
    height: '30px',
    fontSize: '11px',
    borderRadius: '5px',
    border: '1px solid var(--text)',
    backgroundColor: 'var(--text)',
    color: '#ffffff',
    cursor: 'pointer',
    fontWeight: 800,
    padding: 0,
  },
  rangeCancelBtn: {
    flex: 1,
    height: '30px',
    fontSize: '11px',
    borderRadius: '5px',
    border: '1px solid var(--line)',
    backgroundColor: '#fbfcfb',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontWeight: 800,
    padding: 0,
  },
  clearBtn: {
    width: '100%',
    padding: '7px 0',
    fontSize: '12px',
    border: '1px solid var(--pink)',
    borderRadius: '6px',
    backgroundColor: 'var(--pink-2)',
    cursor: 'pointer',
    color: 'var(--pink)',
    textAlign: 'center',
    fontWeight: 500,
  },
};

export default CalendarPanel;
