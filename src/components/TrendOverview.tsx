/**
 * 费用趋势总览组件
 * 大卡片，标题左侧，粒度按钮右侧，柱状图+折线叠加
 * Requirements: 9.1-9.10
 */

import { useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '../state/store';
import { getTrendData } from '../data/selectors';
import { getDefaultTrendGrain } from '../utils/dateUtils';
import type { TrendGrain, FilterState } from '../types/expense';
import type { ECElementEvent } from 'echarts';

const GRAIN_OPTIONS: { label: string; value: TrendGrain }[] = [
  { label: '年', value: 'year' },
  { label: '季度', value: 'quarter' },
  { label: '月', value: 'month' },
  { label: '日', value: 'day' },
];

function getQuarterRange(bucket: string): { start: string; end: string } {
  const year = bucket.slice(0, 4);
  const q = parseInt(bucket.slice(5), 10);
  const startMonth = (q - 1) * 3 + 1;
  const endMonth = q * 3;
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`;
  const lastMonthDays: Record<number, number> = { 3: 31, 6: 30, 9: 30, 12: 31 };
  const end = `${year}-${String(endMonth).padStart(2, '0')}-${lastMonthDays[endMonth]}`;
  return { start, end };
}

export function TrendOverview() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);

  // Compute grain visibility and available grains based on filter state
  const { showGrainButtons, availableGrains } = useMemo(() => {
    // Specific day selected: hide grain buttons, force 'day'
    if (filter.date) {
      return { showGrainButtons: false, availableGrains: [] as TrendGrain[] };
    }
    // Year selected (YYYY): show year/quarter/month (no day)
    if (/^\d{4}$/.test(filter.period)) {
      return { showGrainButtons: true, availableGrains: ['year', 'quarter', 'month'] as TrendGrain[] };
    }
    // Month selected (YYYY-MM): hide grain buttons, force 'day'
    if (/^\d{4}-\d{2}$/.test(filter.period)) {
      return { showGrainButtons: false, availableGrains: [] as TrendGrain[] };
    }
    // Default: show all grain buttons
    return { showGrainButtons: true, availableGrains: ['year', 'quarter', 'month', 'day'] as TrendGrain[] };
  }, [filter.date, filter.period]);

  const activeGrain: TrendGrain = useMemo(() => {
    // Force day grain when date is set or month period is selected
    if (filter.date || /^\d{4}-\d{2}$/.test(filter.period)) {
      return 'day';
    }
    if (filter.trendManual && filter.trendGrain) {
      // Validate that manual grain is in available list
      if (availableGrains.includes(filter.trendGrain)) return filter.trendGrain;
    }
    return getDefaultTrendGrain(filter);
  }, [filter, availableGrains]);

  const trendData = useMemo(() => {
    // When a specific day is selected, show the full month's daily trend
    if (filter.date) {
      const monthPeriod = filter.date.slice(0, 7); // YYYY-MM
      const monthFilter: FilterState = {
        ...filter,
        date: '', // clear exact date filter for trend calculation
        period: monthPeriod, // use month period instead
        trendGrain: 'day',
        trendManual: true,
      };
      return getTrendData(records, monthFilter);
    }
    return getTrendData(records, filter);
  }, [records, filter]);

  const handleGrainClick = useCallback((grain: TrendGrain) => {
    updateFilter({ trendGrain: grain, trendManual: true });
  }, [updateFilter]);

  const handleBarClick = useCallback((params: ECElementEvent) => {
    const dataIndex = params.dataIndex as number;
    if (dataIndex < 0 || dataIndex >= trendData.length) return;
    const point = trendData[dataIndex];
    const bucket = point.bucket;

    switch (activeGrain) {
      case 'year':
        updateFilter({ period: bucket, date: '', dateStart: '', dateEnd: '' });
        break;
      case 'quarter': {
        const range = getQuarterRange(bucket);
        updateFilter({ dateStart: range.start, dateEnd: range.end, date: '', period: '' });
        break;
      }
      case 'month':
        updateFilter({ period: bucket, date: '', dateStart: '', dateEnd: '' });
        break;
      case 'day':
        updateFilter({ date: bucket, period: '', dateStart: '', dateEnd: '' });
        break;
    }
  }, [activeGrain, trendData, updateFilter]);

  const option = useMemo(() => {
    const xLabels = trendData.map((d) => d.label);
    const values = trendData.map((d) => d.amount);

    // Highlight selected day in orange when filter.date is set
    const barData = values.map((val, idx) => {
      if (filter.date && activeGrain === 'day' && trendData[idx].bucket === filter.date) {
        return {
          value: val,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(215, 123, 50, .85)' },
                { offset: 1, color: 'rgba(215, 123, 50, .35)' },
              ],
            },
          },
        };
      }
      return val;
    });

    return {
      grid: { top: 30, right: 20, bottom: 30, left: 56, containLabel: false },
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: unknown) => {
          const list = params as { name: string; value: number }[];
          if (!Array.isArray(list) || list.length === 0) return '';
          const item = list[0];
          return `${item.name}｜费用 ${(item.value / 10000).toFixed(1)}万`;
        },
      },
      xAxis: {
        type: 'category' as const,
        data: xLabels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: 'var(--line)' } },
        axisLabel: { fontSize: 11, color: '#737b73' },
      },
      yAxis: {
        type: 'value' as const,
        axisLabel: {
          fontSize: 11,
          color: '#737b73',
          formatter: (val: number) => `${(val / 10000).toFixed(0)}万`,
        },
        splitLine: { lineStyle: { color: '#e8eee9', type: 'dashed' as const } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          type: 'bar' as const,
          data: barData,
          barMaxWidth: 28,
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 10,
            color: '#555',
            formatter: (params: { value: number }) => {
              const v = typeof params.value === 'number' ? params.value : 0;
              return v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v > 0 ? `${Math.round(v)}` : '';
            },
          },
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(37,125,96,.34)' },
                { offset: 1, color: 'rgba(37,125,96,.12)' },
              ],
            } as unknown as string,
            borderRadius: [8, 8, 0, 0],
          },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0, y: 0, x2: 0, y2: 1,
                colorStops: [
                  { offset: 0, color: 'rgba(37,125,96,.78)' },
                  { offset: 1, color: 'rgba(37,125,96,.3)' },
                ],
              } as unknown as string,
            },
          },
        },
        {
          type: 'line' as const,
          data: values,
          smooth: true,
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: { color: '#257d60', width: 3.2, shadowColor: 'rgba(37,125,96,.18)', shadowBlur: 8, shadowOffsetY: 7 },
          itemStyle: { color: '#257d60' },
        },
      ],
    };
  }, [trendData, filter.date, activeGrain]);

  const onEvents = useMemo(() => ({ click: handleBarClick }), [handleBarClick]);

  return (
    <div style={styles.card} role="region" aria-label="费用趋势总览">
      <div style={styles.header}>
        <h2 className="card-title-bar">费用趋势总览</h2>
        {showGrainButtons && (
          <div style={styles.grainGroup} role="group" aria-label="时间粒度选择">
            {GRAIN_OPTIONS.filter((opt) => availableGrains.includes(opt.value)).map((opt) => (
              <button
                key={opt.value}
                type="button"
                style={{
                  ...styles.grainBtn,
                  ...(activeGrain === opt.value ? styles.grainBtnActive : {}),
                }}
                onClick={() => handleGrainClick(opt.value)}
                aria-pressed={activeGrain === opt.value}
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <ReactECharts option={option} style={{ flex: 1, minHeight: 260 }} onEvents={onEvents} notMerge />
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
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    minHeight: '386px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  grainGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, auto)',
    gap: '5px',
    alignItems: 'center',
  },
  grainBtn: {
    height: '26px',
    padding: '0 9px',
    fontSize: '10px',
    borderRadius: '5px',
    border: '1px solid var(--line)',
    backgroundColor: '#fbfcfb',
    color: 'var(--muted)',
    cursor: 'pointer',
    transition: 'all .15s ease',
    fontWeight: 900,
  },
  grainBtnActive: {
    backgroundColor: 'var(--green)',
    borderColor: 'var(--green)',
    color: '#ffffff',
  },
};

export default TrendOverview;
