/**
 * 累计分析组件 — 瀑布图（Waterfall Chart）
 * 展示每个月/日费用如何逐步累计到总合计
 * 使用双堆叠柱实现：透明辅助柱 + 真实金额柱
 * Requirements: 10.1-10.7
 */

import { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '../state/store';
import { getCumulativeData } from '../data/selectors';
import { getCumulativeGrain } from '../utils/dateUtils';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';
import type { FilterState } from '../types/expense';

// Low-saturation waterfall colors for each bar
const BAR_COLORS = [
  '#6b9dab', '#7ba3b8', '#8eadb0', '#a3b8a8',
  '#b8c4a0', '#c9bf8e', '#d4b07a', '#c9a07a',
  '#b89090', '#a88ea0', '#9a90b0', '#8a98b8',
];

function getTitle(filter: FilterState): string {
  if (filter.date) return '日度累计分析';
  if (/^\d{4}-\d{2}$/.test(filter.period)) return '日度累计分析';
  if (/^\d{4}$/.test(filter.period)) return '月度累计分析';
  const grain = getCumulativeGrain(filter);
  if (grain === 'day') return '日度累计分析';
  if (grain === 'week') return '周度累计分析';
  return '月度累计分析';
}

export default function CumulativeAnalysis() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);

  const effectiveFilter: FilterState = useMemo(() => {
    if (filter.date) {
      return { ...filter, date: '', period: filter.date.slice(0, 7) };
    }
    return filter;
  }, [filter]);

  const data = useMemo(() => getCumulativeData(records, effectiveFilter), [records, effectiveFilter]);
  const currencyMode = filter.currencyMode;
  const title = getTitle(filter);

  const cumulativeTotal = data.length > 0 ? data[data.length - 1].cumulative : 0;

  // Build waterfall data: labels, helper (transparent), values
  const waterfallOption = useMemo(() => {
    if (data.length === 0) return null;

    // X axis: each period + "合计"
    const xLabels = [...data.map((d) => d.label), '合计'];

    // Helper series (transparent spacer): previous cumulative
    const helperData: (number | { value: number; itemStyle: { color: string } })[] = [];
    // Value series (actual amount bars)
    const valueData: { value: number; itemStyle: { color: string }; label?: object }[] = [];

    let prevCumulative = 0;
    for (let i = 0; i < data.length; i++) {
      const amount = data[i].amount;
      helperData.push({ value: prevCumulative, itemStyle: { color: 'transparent' } });
      valueData.push({
        value: amount,
        itemStyle: { color: BAR_COLORS[i % BAR_COLORS.length] },
      });
      prevCumulative += amount;
    }

    // "合计" bar: helper = 0, value = total (deep blue)
    helperData.push({ value: 0, itemStyle: { color: 'transparent' } });
    valueData.push({
      value: cumulativeTotal,
      itemStyle: { color: '#2c4a7c' },
      label: { show: true, position: 'inside', color: '#fff', fontSize: 11, fontWeight: 700, formatter: () => displayMoney(cumulativeTotal, currencyMode, DEFAULT_USD_RATE) },
    });

    // Y axis max: round up
    const yMax = Math.ceil(cumulativeTotal / 5000) * 5000 || 1000;

    return {
      tooltip: {
        trigger: 'axis' as const,
        axisPointer: { type: 'shadow' as const },
        formatter: (params: { name: string; seriesName: string; value: number }[]) => {
          if (!Array.isArray(params)) return '';
          const name = params[0]?.name || '';
          if (name === '合计') {
            return `合计<br/>累计总额：${displayMoney(cumulativeTotal, currencyMode, DEFAULT_USD_RATE)}`;
          }
          const idx = xLabels.indexOf(name);
          if (idx < 0 || idx >= data.length) return '';
          const d = data[idx];
          return `${name}<br/>当期金额：${displayMoney(d.amount, currencyMode, DEFAULT_USD_RATE)}<br/>累计金额：${displayMoney(d.cumulative, currencyMode, DEFAULT_USD_RATE)}`;
        },
      },
      grid: { top: 24, right: 12, bottom: 28, left: 48, containLabel: false },
      xAxis: {
        type: 'category' as const,
        data: xLabels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: '#ddd' } },
        axisLabel: { fontSize: 10, color: '#666' },
      },
      yAxis: {
        type: 'value' as const,
        max: yMax,
        axisLabel: { fontSize: 10, color: '#999', formatter: (v: number) => v >= 10000 ? `${(v / 10000).toFixed(0)}万` : `${v}` },
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' as const } },
        axisLine: { show: false },
        axisTick: { show: false },
      },
      series: [
        {
          name: '辅助',
          type: 'bar',
          stack: 'waterfall',
          data: helperData,
          barMaxWidth: 22,
          emphasis: { disabled: true },
        },
        {
          name: '金额',
          type: 'bar',
          stack: 'waterfall',
          data: valueData,
          barMaxWidth: 22,
          label: {
            show: true,
            position: 'top' as const,
            fontSize: 9,
            color: '#555',
            formatter: (p: { dataIndex: number; value: number }) => {
              if (p.dataIndex === data.length) return ''; // 合计 has inside label
              const v = p.value;
              return v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v > 0 ? `${Math.round(v)}` : '';
            },
          },
          itemStyle: { borderRadius: [3, 3, 0, 0] },
        },
      ],
      animation: true,
      animationDuration: 600,
    };
  }, [data, cumulativeTotal, currencyMode]);

  // Stats
  const peakLabelText = useMemo(() => {
    const grain = getCumulativeGrain(effectiveFilter);
    if (grain === 'day') return '峰值日';
    if (grain === 'week') return '峰值周';
    return '峰值月';
  }, [effectiveFilter]);

  const peak = useMemo(() => {
    if (data.length === 0) return { label: '-', amount: 0 };
    let idx = 0;
    for (let i = 1; i < data.length; i++) { if (data[i].amount > data[idx].amount) idx = i; }
    return { label: data[idx].label, amount: data[idx].amount };
  }, [data]);

  return (
    <div style={styles.card} role="region" aria-label={title}>
      <div style={styles.header}>
        <h2 className="card-title-bar">{title}</h2>
      </div>

      {/* Stats row */}
      <div style={styles.statsRow}>
        <div style={styles.statBlock}>
          <b style={styles.statValue}>{displayMoney(peak.amount, currencyMode, DEFAULT_USD_RATE)}</b>
          <span style={styles.statLabel}>{peakLabelText}</span>
        </div>
        <div style={styles.statBlock}>
          <b style={styles.statValue}>{displayMoney(cumulativeTotal, currencyMode, DEFAULT_USD_RATE)}</b>
          <span style={styles.statLabel}>累计总额</span>
        </div>
        <div style={styles.statBlock}>
          <b style={styles.statValue}>{data.length}</b>
          <span style={styles.statLabel}>期数</span>
        </div>
      </div>

      {waterfallOption ? (
        <ReactECharts option={waterfallOption} style={{ height: 200, flex: 1 }} notMerge />
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
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
    height: '100%',
  },
  header: { marginBottom: '8px' },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '6px',
    marginBottom: '6px',
  },
  statBlock: {
    display: 'grid',
    gap: '2px',
    padding: '6px',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    background: '#fbfcfb',
    fontSize: '10px',
    color: 'var(--muted)',
  },
  statLabel: { fontSize: '10px', color: 'var(--muted)' },
  statValue: { fontSize: '13px', fontWeight: 700, color: 'var(--text)' },
  empty: {
    height: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--muted)',
    fontSize: '13px',
  },
};
