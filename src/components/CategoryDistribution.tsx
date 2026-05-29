/**
 * 费用结构分布组件
 * 与分类钻取联动：
 * - 无选中 L1 → 1个饼图（L1 分布）
 * - 选中 L1 → 2个饼图（L1 + 该L1下的L2分布）
 * - 选中 L1+L2 → 3个饼图（L1 + L2 + 该L2下的L3分布）
 * 饼图横向排列，居中对称
 * Requirements: 11.1-11.6
 */

import { useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '../state/store';
import { filterRecords } from '../data/selectors';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';
import type { ECElementEvent } from 'echarts';

const COLOR_PALETTE = [
  '#eb4b86', '#98bd29', '#3449d8', '#f5bc38',
  '#df8733', '#257d60', '#94c6b4', '#5f8fd8',
];

interface PieData {
  title: string;
  items: { name: string; amount: number; share: number }[];
  level: 1 | 2 | 3;
}

export function CategoryDistribution() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);
  const currencyMode = filter.currencyMode;

  // Build pie data arrays based on current drill level
  const pieCharts = useMemo((): PieData[] => {
    const pies: PieData[] = [];

    // L1 pie: always show (ignoring categoryL1/L2/L3 in filter for this chart)
    const l1Filter = { ...filter, categoryL1: '', categoryL2: '', categoryL3: '' };
    const l1Records = filterRecords(records, l1Filter);
    const l1Map = new Map<string, number>();
    let l1Total = 0;
    for (const r of l1Records) {
      l1Map.set(r.categoryL1, (l1Map.get(r.categoryL1) ?? 0) + r.amountCNY);
      l1Total += r.amountCNY;
    }
    const l1Items = Array.from(l1Map.entries())
      .map(([name, amount]) => ({ name, amount, share: l1Total > 0 ? amount / l1Total : 0 }))
      .sort((a, b) => b.amount - a.amount);
    pies.push({ title: '一级分类', items: l1Items, level: 1 });

    // L2 pie: only if L1 is selected
    if (filter.categoryL1) {
      const l2Filter = { ...filter, categoryL2: '', categoryL3: '' };
      const l2Records = filterRecords(records, l2Filter);
      const l2Map = new Map<string, number>();
      let l2Total = 0;
      for (const r of l2Records) {
        if (r.categoryL2) {
          l2Map.set(r.categoryL2, (l2Map.get(r.categoryL2) ?? 0) + r.amountCNY);
          l2Total += r.amountCNY;
        }
      }
      const l2Items = Array.from(l2Map.entries())
        .map(([name, amount]) => ({ name, amount, share: l2Total > 0 ? amount / l2Total : 0 }))
        .sort((a, b) => b.amount - a.amount);
      if (l2Items.length > 0) {
        pies.push({ title: `${filter.categoryL1} › 二级`, items: l2Items, level: 2 });
      }
    }

    // L3 pie: only if L1 and L2 are selected
    if (filter.categoryL1 && filter.categoryL2) {
      const l3Filter = { ...filter, categoryL3: '' };
      const l3Records = filterRecords(records, l3Filter);
      const l3Map = new Map<string, number>();
      let l3Total = 0;
      for (const r of l3Records) {
        if (r.categoryL3) {
          l3Map.set(r.categoryL3, (l3Map.get(r.categoryL3) ?? 0) + r.amountCNY);
          l3Total += r.amountCNY;
        }
      }
      const l3Items = Array.from(l3Map.entries())
        .map(([name, amount]) => ({ name, amount, share: l3Total > 0 ? amount / l3Total : 0 }))
        .sort((a, b) => b.amount - a.amount);
      if (l3Items.length > 0) {
        pies.push({ title: `${filter.categoryL2} › 三级`, items: l3Items, level: 3 });
      }
    }

    return pies;
  }, [records, filter]);

  const handlePieClick = useCallback((level: 1 | 2 | 3, params: ECElementEvent) => {
    const name = params.name as string;
    if (!name) return;
    if (level === 1) {
      if (filter.categoryL1 === name) updateFilter({ categoryL1: '', categoryL2: '', categoryL3: '' });
      else updateFilter({ categoryL1: name, categoryL2: '', categoryL3: '' });
    } else if (level === 2) {
      if (filter.categoryL2 === name) updateFilter({ categoryL2: '', categoryL3: '' });
      else updateFilter({ categoryL2: name, categoryL3: '' });
    } else {
      if (filter.categoryL3 === name) updateFilter({ categoryL3: '' });
      else updateFilter({ categoryL3: name });
    }
  }, [filter, updateFilter]);

  const hasData = pieCharts[0]?.items.length > 0;

  if (!hasData) {
    return (
      <div style={styles.card} role="region" aria-label="费用结构分布">
        <h2 className="card-title-bar pink" style={{ marginBottom: '8px' }}>费用结构分布</h2>
        <div style={styles.empty}>当前口径无数据</div>
      </div>
    );
  }

  return (
    <div style={styles.card} role="region" aria-label="费用结构分布">
      <h2 className="card-title-bar pink" style={{ marginBottom: '8px' }}>费用结构分布</h2>

      {/* Pie charts row - centered */}
      <div style={{ ...styles.pieRow, gridTemplateColumns: `repeat(${pieCharts.length}, 1fr)` }}>
        {pieCharts.map((pie, pieIdx) => {
          const selectedName = pie.level === 1 ? filter.categoryL1 : pie.level === 2 ? filter.categoryL2 : filter.categoryL3;

          const seriesData = pie.items.map((item, i) => ({
            value: item.amount,
            name: item.name,
            itemStyle: {
              color: COLOR_PALETTE[i % COLOR_PALETTE.length],
              opacity: selectedName && selectedName !== item.name ? 0.35 : 1,
              borderWidth: selectedName === item.name ? 3 : 0,
              borderColor: '#fff',
            },
          }));

          const baseRadius: [string, string] = pieCharts.length === 1 ? ['42%', '70%'] : pieCharts.length === 2 ? ['38%', '68%'] : ['35%', '65%'];

          const option = {
            tooltip: {
              trigger: 'item' as const,
              formatter: (params: { name: string; value: number; percent: number }) =>
                `${params.name}｜${(params.value / 10000).toFixed(1)}万｜${params.percent.toFixed(1)}%`,
            },
            series: [{
              type: 'pie' as const,
              radius: baseRadius,
              center: ['50%', '50%'],
              label: { show: true, fontSize: 10, color: '#555', formatter: (p: { name: string; percent: number }) => `${p.name} ${p.percent.toFixed(0)}%`, overflow: 'truncate', width: 70 },
              labelLine: { show: true, length: 12, length2: 8, lineStyle: { color: '#bbb' } },
              labelLayout: { hideOverlap: true },
              emphasis: { scale: false },
              avoidLabelOverlap: false,
              padAngle: 2,
              data: seriesData,
            }],
            // Force ECharts to fully re-render on each update
            animation: true,
            animationDuration: 200,
          };

          const onEvents = { click: (params: ECElementEvent) => handlePieClick(pie.level, params) };

          return (
            <div key={pieIdx} style={styles.pieCol}>
              <div style={styles.pieTitle}>{pie.title}</div>
              <div style={styles.pieChartWrap}>
                <ReactECharts option={option} style={{ height: pieCharts.length === 1 ? 180 : 150, width: '100%' }} onEvents={onEvents} notMerge />
                {(() => {
                  const selectedItem = selectedName ? pie.items.find((i) => i.name === selectedName) : null;
                  if (selectedItem) {
                    const displayAmt = selectedItem.amount >= 10000 ? `${(selectedItem.amount / 10000).toFixed(1)}万` : `${Math.round(selectedItem.amount)}`;
                    return (
                      <div style={styles.pieCenterText}>
                        <span style={{ ...styles.pieCenterName, color: 'var(--green)' }}>
                          {selectedItem.name.length > 5 ? selectedItem.name.slice(0, 5) + '…' : selectedItem.name}
                        </span>
                        <span style={styles.pieCenterPct}>{displayAmt}</span>
                        <span style={{ fontSize: '9px', color: 'var(--muted)' }}>{(selectedItem.share * 100).toFixed(1)}%</span>
                      </div>
                    );
                  }
                  // No selection: show total
                  const pieTotal = pie.items.reduce((s, i) => s + i.amount, 0);
                  const totalDisplay = pieTotal >= 10000 ? `${(pieTotal / 10000).toFixed(1)}万` : `${Math.round(pieTotal)}`;
                  return (
                    <div style={styles.pieCenterText}>
                      <span style={styles.pieCenterPct}>{totalDisplay}</span>
                      <span style={{ fontSize: '9px', color: 'var(--muted)' }}>总费用</span>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend for the first (L1) pie */}
      <div style={styles.legend}>
        {pieCharts[0].items.slice(0, 6).map((item, index) => {
          const isSelected = filter.categoryL1 === item.name;
          const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
          return (
            <div
              key={item.name}
              style={{ ...styles.legendItem, ...(isSelected ? styles.legendItemActive : {}) }}
              onClick={() => {
                if (filter.categoryL1 === item.name) updateFilter({ categoryL1: '', categoryL2: '', categoryL3: '' });
                else updateFilter({ categoryL1: item.name, categoryL2: '', categoryL3: '' });
              }}
            >
              <div style={styles.legendHead}>
                <span style={styles.legendName}><span style={{ ...styles.dot, backgroundColor: color }} />{item.name}</span>
                <b style={styles.legendAmount}>{displayMoney(item.amount, currencyMode, DEFAULT_USD_RATE)}</b>
              </div>
              <div style={styles.legendShare}>
                <i style={styles.legendBarTrack}><span style={{ ...styles.legendBarFill, width: `${(item.share * 100).toFixed(1)}%`, backgroundColor: color }} /></i>
                <span style={styles.legendPercent}>{(item.share * 100).toFixed(1)}%</span>
              </div>
            </div>
          );
        })}
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
    padding: '14px 16px',
  },
  pieRow: {
    display: 'grid',
    gap: '8px',
    alignItems: 'start',
    marginBottom: '8px',
  },
  pieCol: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  pieTitle: {
    fontSize: '11px',
    fontWeight: 700,
    color: 'var(--muted)',
    marginBottom: '2px',
    textAlign: 'center',
  },
  pieChartWrap: {
    position: 'relative',
    width: '100%',
  },
  pieCenterText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  pieCenterName: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 800,
    color: 'var(--text)',
  },
  pieCenterPct: {
    display: 'block',
    fontSize: '16px',
    fontWeight: 900,
    color: 'var(--text)',
    marginTop: '1px',
  },
  legend: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '6px',
    marginTop: '4px',
  },
  legendItem: {
    display: 'grid',
    gap: '4px',
    padding: '6px 8px',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    background: '#fbfcfb',
    cursor: 'pointer',
    transition: 'all .15s',
    minWidth: 0,
    outline: 'none',
  },
  legendItemActive: {
    border: '1px solid var(--green-2)',
    background: 'var(--green-3)',
  },
  legendHead: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    gap: '6px',
    minWidth: 0,
  },
  legendName: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '11px',
    fontWeight: 800,
    color: 'var(--text)',
  },
  dot: {
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  },
  legendAmount: {
    fontSize: '12px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  legendShare: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '6px',
    alignItems: 'center',
  },
  legendBarTrack: {
    display: 'block',
    height: '4px',
    borderRadius: '99px',
    background: '#edf3f0',
    overflow: 'hidden',
    fontStyle: 'normal',
  },
  legendBarFill: {
    display: 'block',
    height: '100%',
    borderRadius: '99px',
    transition: 'width .3s',
  },
  legendPercent: {
    fontSize: '10px',
    fontWeight: 800,
    color: 'var(--muted)',
  },
  empty: {
    fontSize: '13px',
    color: 'var(--muted)',
    textAlign: 'center',
    marginTop: '12px',
  },
};

export default CategoryDistribution;
