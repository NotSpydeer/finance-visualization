/**
 * 费用结构分布组件
 * 全环饼图 + 中心文字（最大费用分类）+ 2列图例网格（带进度条和百分比）
 * 设计参考：finance-game-dashboard-sample3.html .dist-legend 区域
 * Requirements: 11.1-11.6
 */

import { useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '../state/store';
import { getCategoryDistribution, filterRecords } from '../data/selectors';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';
import type { ECElementEvent } from 'echarts';

const COLOR_PALETTE = [
  '#eb4b86', // pink
  '#98bd29', // lime
  '#3449d8', // blue
  '#f5bc38', // yellow
  '#df8733', // orange
  '#257d60', // green
  '#94c6b4', // green-2
  '#5f8fd8', // lighter blue
];

export function CategoryDistribution() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);
  const openDrawer = useAppStore((s) => s.openDrawer);

  const currencyMode = filter.currencyMode;
  const selectedCategory = filter.categoryL1;

  const distribution = useMemo(
    () => getCategoryDistribution(records, filter),
    [records, filter]
  );

  const hasData = distribution.length > 0;

  // Find top category for center display
  const topCategory = useMemo(() => {
    if (!hasData) return { name: '', amount: 0, share: 0 };
    return { name: distribution[0].categoryL1, amount: distribution[0].amount, share: distribution[0].share };
  }, [distribution, hasData]);

  const handleCategoryClick = useCallback(
    (categoryL1: string) => {
      if (selectedCategory === categoryL1) {
        updateFilter({ categoryL1: '', categoryL2: '', categoryL3: '' });
        return;
      }
      updateFilter({ categoryL1, categoryL2: '', categoryL3: '' });

      const categoryRecords = filterRecords(records, {
        ...filter,
        categoryL1,
        categoryL2: '',
        categoryL3: '',
      });

      const totalAmount = categoryRecords.reduce((s, r) => s + r.amountCNY, 0);
      const maxSingle = categoryRecords.reduce((max, r) => Math.max(max, r.amountCNY), 0);

      const deptMap = new Map<string, number>();
      for (const r of categoryRecords) {
        deptMap.set(r.department, (deptMap.get(r.department) ?? 0) + r.amountCNY);
      }
      const topDepartments = Array.from(deptMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([name, amount]) => ({ name, amount }));

      const topRecords = [...categoryRecords].sort((a, b) => b.amountCNY - a.amountCNY).slice(0, 6);

      openDrawer({
        type: 'category',
        title: `分类：${categoryL1}`,
        amount: totalAmount,
        recordCount: categoryRecords.length,
        maxSingle,
        topCategories: [],
        topDepartments,
        topRecords,
      });
    },
    [records, filter, updateFilter, openDrawer, selectedCategory]
  );

  const handleChartClick = useCallback(
    (params: ECElementEvent) => {
      const name = params.name as string;
      if (name) handleCategoryClick(name);
    },
    [handleCategoryClick]
  );

  const option = useMemo(() => {
    if (!hasData) {
      return {
        series: [{
          type: 'pie' as const,
          radius: ['45%', '72%'],
          center: ['50%', '50%'],
          silent: true,
          label: { show: false },
          data: [{ value: 1, name: '', itemStyle: { color: '#e6e9e6' } }],
        }],
      };
    }

    const seriesData = distribution.map((item, index) => ({
      value: item.amount,
      name: item.categoryL1,
      itemStyle: {
        color: COLOR_PALETTE[index % COLOR_PALETTE.length],
        opacity: selectedCategory && selectedCategory !== item.categoryL1 ? 0.35 : 1,
      },
    }));

    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: { name: string; value: number; percent: number }) => {
          return `${params.name}｜${(params.value / 10000).toFixed(1)}万｜${params.percent.toFixed(1)}%`;
        },
      },
      series: [{
        type: 'pie' as const,
        radius: ['45%', '72%'],
        center: ['50%', '50%'],
        label: { show: false },
        emphasis: { scale: true, scaleSize: 4 },
        padAngle: 2,
        data: seriesData,
      }],
    };
  }, [distribution, hasData, selectedCategory]);

  const onEvents = useMemo(() => ({ click: handleChartClick }), [handleChartClick]);

  return (
    <div style={styles.card} role="region" aria-label="费用结构分布">
      <h2 className="card-title-bar pink" style={{ marginBottom: '8px' }}>费用结构分布</h2>

      {/* Full-ring pie chart with center text */}
      <div style={styles.chartWrapper}>
        <ReactECharts
          option={option}
          style={{ height: 200, width: '100%' }}
          onEvents={hasData ? onEvents : undefined}
          notMerge
        />
        {/* Center overlay text */}
        {hasData && (
          <div style={styles.centerText}>
            <span style={styles.centerLabel}>最大费用 · {(topCategory.share * 100).toFixed(1)}%</span>
            <b style={styles.centerName}>{topCategory.name}</b>
            <strong style={styles.centerAmount}>{displayMoney(topCategory.amount, currencyMode, DEFAULT_USD_RATE)}</strong>
          </div>
        )}
      </div>

      {!hasData && <div style={styles.empty}>当前口径无数据</div>}

      {/* 2-column legend grid matching prototype */}
      {hasData && (
        <div style={styles.legend}>
          {distribution.map((item, index) => {
            const isSelected = selectedCategory === item.categoryL1;
            const color = COLOR_PALETTE[index % COLOR_PALETTE.length];
            return (
              <div
                key={item.categoryL1}
                style={{ ...styles.legendItem, ...(isSelected ? styles.legendItemActive : {}) }}
                onClick={() => handleCategoryClick(item.categoryL1)}
                role="button"
                tabIndex={0}
                aria-pressed={isSelected}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCategoryClick(item.categoryL1); } }}
              >
                {/* Top row: dot + name + amount */}
                <div style={styles.legendHead}>
                  <span style={styles.legendName}>
                    <span style={{ ...styles.dot, backgroundColor: color }} />
                    {item.categoryL1}
                  </span>
                  <b style={styles.legendAmount}>{displayMoney(item.amount, currencyMode, DEFAULT_USD_RATE)}</b>
                </div>
                {/* Bottom row: progress bar + percentage */}
                <div style={styles.legendShare}>
                  <i style={styles.legendBarTrack}>
                    <span style={{ ...styles.legendBarFill, width: `${(item.share * 100).toFixed(1)}%`, backgroundColor: color }} />
                  </i>
                  <span style={styles.legendPercent}>{(item.share * 100).toFixed(1)}%</span>
                </div>
              </div>
            );
          })}
        </div>
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
  },
  chartWrapper: {
    position: 'relative',
  },
  centerText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  centerLabel: {
    display: 'block',
    fontSize: '10px',
    color: 'var(--muted)',
  },
  centerName: {
    display: 'block',
    fontSize: '16px',
    fontWeight: 800,
    color: 'var(--text)',
    marginTop: '2px',
  },
  centerAmount: {
    display: 'block',
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--green)',
    marginTop: '2px',
  },
  legend: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gap: '8px',
    marginTop: '8px',
  },
  legendItem: {
    display: 'grid',
    gap: '5px',
    padding: '8px',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    background: '#fbfcfb',
    cursor: 'pointer',
    transition: 'all .15s',
    minWidth: 0,
  },
  legendItemActive: {
    borderColor: 'var(--green-2)',
    background: 'var(--green-3)',
    outline: '2px solid rgba(37,125,96,.38)',
    outlineOffset: '2px',
  },
  legendHead: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    gap: '8px',
    minWidth: 0,
  },
  legendName: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    fontSize: '12px',
    fontWeight: 900,
    color: 'var(--text)',
  },
  dot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    flexShrink: 0,
    display: 'inline-block',
  },
  legendAmount: {
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text)',
  },
  legendShare: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '8px',
    alignItems: 'center',
  },
  legendBarTrack: {
    display: 'block',
    height: '5px',
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
