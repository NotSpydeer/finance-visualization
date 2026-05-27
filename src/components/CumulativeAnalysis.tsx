/**
 * 累计分析组件
 * 顶部3个摘要统计 + 柱状图(当期)+折线(累计)
 * 标题和数据根据筛选粒度联动：
 *   选年 → "月度累计分析"，按月累计
 *   选月 → "日度累计分析"，按日累计
 *   选日 → "日度累计分析"，显示当月日度数据并高亮选中日
 *   其他 → "月度累计分析"
 * Requirements: 10.1-10.7
 */

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '../state/store';
import { getCumulativeData } from '../data/selectors';
import { getCumulativeGrain } from '../utils/dateUtils';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';
import type { CumulativePoint } from '../types/chart';
import type { FilterState } from '../types/expense';

function calcVolatility(points: CumulativePoint[]): string {
  if (points.length === 0) return '0.0';
  const amounts = points.map((p) => p.amount);
  const max = Math.max(...amounts);
  const min = Math.min(...amounts);
  if (max === 0) return '0.0';
  return ((max - min) / max * 100).toFixed(1);
}

function findPeak(points: CumulativePoint[]): { label: string; amount: number } {
  if (points.length === 0) return { label: '-', amount: 0 };
  let peakIdx = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].amount > points[peakIdx].amount) peakIdx = i;
  }
  return { label: points[peakIdx].label, amount: points[peakIdx].amount };
}

/**
 * 根据筛选状态确定标题
 */
function getTitle(filter: FilterState): string {
  if (filter.date) return '日度累计分析';
  if (/^\d{4}-\d{2}$/.test(filter.period)) return '日度累计分析';
  if (/^\d{4}$/.test(filter.period)) return '月度累计分析';
  // Date range: check cumulative grain
  const grain = getCumulativeGrain(filter);
  if (grain === 'day') return '日度累计分析';
  if (grain === 'week') return '周度累计分析';
  return '月度累计分析';
}

export default function CumulativeAnalysis() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);

  // When a specific day is selected, use the full month's data (like TrendOverview)
  const effectiveFilter: FilterState = useMemo(() => {
    if (filter.date) {
      const monthPeriod = filter.date.slice(0, 7); // YYYY-MM
      return {
        ...filter,
        date: '',          // clear exact date so we get full month data
        period: monthPeriod, // use month period instead
      };
    }
    return filter;
  }, [filter]);

  const data = useMemo(() => getCumulativeData(records, effectiveFilter), [records, effectiveFilter]);
  const currencyMode = filter.currencyMode;
  const title = getTitle(filter);

  const peak = findPeak(data);
  const cumulativeTotal = data.length > 0 ? data[data.length - 1].cumulative : 0;
  const volatility = calcVolatility(data);

  const labels = data.map((d) => d.label);
  const amounts = data.map((d) => d.amount);
  const cumulatives = data.map((d) => d.cumulative);

  // Highlight the selected day's bar in orange (like TrendOverview)
  const barData = useMemo(() => {
    if (!filter.date) return amounts;
    return amounts.map((val, idx) => {
      // When day is selected, label equals the date string for 'day' grain
      if (data[idx].label === filter.date) {
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
  }, [amounts, data, filter.date]);

  const peakLabelText = useMemo(() => {
    // Adjust the peak stat label based on granularity
    const grain = getCumulativeGrain(effectiveFilter);
    if (grain === 'day') return '峰值日';
    if (grain === 'week') return '峰值周';
    return '峰值月份';
  }, [effectiveFilter]);

  const option = {
    tooltip: {
      trigger: 'axis' as const,
      axisPointer: { type: 'cross' as const },
      formatter(params: { seriesName: string; value: number; axisValueLabel: string }[]) {
        if (!Array.isArray(params) || params.length === 0) return '';
        const header = params[0].axisValueLabel;
        const lines = params.map((p) => {
          const formatted = displayMoney(p.value, currencyMode, DEFAULT_USD_RATE);
          return `${p.seriesName}：${formatted}`;
        });
        return `${header}<br/>${lines.join('<br/>')}`;
      },
    },
    grid: { top: 30, right: 40, bottom: 30, left: 50, containLabel: true },
    xAxis: {
      type: 'category' as const,
      data: labels,
      axisLabel: { fontSize: 11, color: '#737b73' },
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#e6e9e6' } },
    },
    yAxis: [
      {
        type: 'value' as const,
        name: '当期',
        nameTextStyle: { fontSize: 11, color: '#737b73' },
        axisLabel: { fontSize: 11, color: '#737b73', formatter: (val: number) => `${(val / 10000).toFixed(0)}万` },
        splitLine: { lineStyle: { type: 'dashed' as const, color: '#f0f2f0' } },
      },
      {
        type: 'value' as const,
        name: '累计',
        nameTextStyle: { fontSize: 11, color: '#737b73' },
        axisLabel: { fontSize: 11, color: '#737b73', formatter: (val: number) => `${(val / 10000).toFixed(0)}万` },
        splitLine: { show: false },
      },
    ],
    series: [
      {
        name: '当期金额',
        type: 'bar',
        data: barData,
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
              { offset: 0, color: 'rgba(37,125,96,.32)' },
              { offset: 1, color: 'rgba(37,125,96,.13)' },
            ],
          } as unknown as string,
          borderRadius: [7, 7, 0, 0],
        },
        barMaxWidth: 24,
      },
      {
        name: '累计金额',
        type: 'line',
        yAxisIndex: 1,
        data: cumulatives,
        smooth: true,
        symbol: 'circle',
        symbolSize: 4,
        lineStyle: { color: '#257d60', width: 2.5 },
        itemStyle: { color: '#257d60' },
      },
    ],
  };

  return (
    <div style={styles.card} role="region" aria-label={title}>
      <div style={styles.header}>
        <h2 className="card-title-bar">{title}</h2>
      </div>

      {/* 摘要指标 */}
      <div style={styles.statsRow}>
        <div style={styles.statBlock}>
          <b style={styles.statValue}>{displayMoney(peak.amount, currencyMode, DEFAULT_USD_RATE)}</b>
          <span style={styles.statLabel}>{peakLabelText}</span>
        </div>
        <div style={styles.statBlock}>
          <b style={styles.statValue}>{displayMoney(cumulativeTotal, currencyMode, DEFAULT_USD_RATE)}</b>
          <span style={styles.statLabel}>累计费用</span>
        </div>
        <div style={styles.statBlock}>
          <b style={styles.statValue}>{volatility}%</b>
          <span style={styles.statLabel}>最大波动</span>
        </div>
      </div>

      {data.length > 0 ? (
        <ReactECharts option={option} style={{ height: 220 }} notMerge />
      ) : (
        <div style={styles.empty}>当前筛选条件下暂无数据</div>
      )}
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
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
  },
  header: {
    marginBottom: '12px',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '6px',
    marginBottom: '8px',
  },
  statBlock: {
    display: 'grid',
    gap: '2px',
    padding: '7px',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    background: '#fbfcfb',
    fontSize: '11px',
    color: 'var(--muted)',
  },
  statLabel: {
    fontSize: '11px',
    color: 'var(--muted)',
  },
  statValue: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  empty: {
    height: 220,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--muted)',
    fontSize: '13px',
  },
};
