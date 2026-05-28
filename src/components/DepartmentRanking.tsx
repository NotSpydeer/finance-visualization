/**
 * 部门费用排行组件
 * 小饼图（部门分布）+ 排行列表（Top 6）
 * Requirements: 13.1-13.4
 */

import { useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '../state/store';
import { getDepartmentRanking } from '../data/selectors';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';
import type { ECElementEvent } from 'echarts';

const DEPT_COLORS = [
  '#eb4b86', '#257d60', '#3449d8', '#df8733',
  '#98bd29', '#f5bc38', '#94c6b4', '#5f8fd8',
];

export default function DepartmentRanking() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);

  const ranking = useMemo(() => getDepartmentRanking(records, filter), [records, filter]);
  const selectedDepartment = filter.department;

  const totalAmount = useMemo(() => ranking.reduce((s, r) => s + r.amount, 0), [ranking]);

  const handleDepartmentClick = useCallback((department: string) => {
    if (filter.department === department) {
      updateFilter({ department: '' });
    } else {
      updateFilter({ department });
    }
  }, [filter.department, updateFilter]);

  const handlePieClick = useCallback((params: ECElementEvent) => {
    const name = params.name as string;
    if (name) handleDepartmentClick(name);
  }, [handleDepartmentClick]);

  const pieOption = useMemo(() => {
    if (ranking.length === 0) return null;
    const data = ranking.slice(0, 8).map((item, i) => ({
      value: item.amount,
      name: item.department,
      itemStyle: {
        color: DEPT_COLORS[i % DEPT_COLORS.length],
        opacity: selectedDepartment && selectedDepartment !== item.department ? 0.3 : 1,
      },
    }));
    return {
      tooltip: {
        trigger: 'item' as const,
        formatter: (params: { name: string; percent: number }) => `${params.name} ${params.percent.toFixed(1)}%`,
      },
      series: [{
        type: 'pie' as const,
        radius: ['42%', '70%'],
        center: ['50%', '50%'],
        label: { show: false },
        padAngle: 2,
        data,
      }],
    };
  }, [ranking, selectedDepartment]);

  const onEvents = useMemo(() => ({ click: handlePieClick }), [handlePieClick]);

  return (
    <div style={styles.card} role="region" aria-label="部门费用排行">
      <h2 className="card-title-bar" style={{ marginBottom: '8px' }}>项目排行</h2>

      {ranking.length === 0 ? (
        <div style={styles.empty}>当前筛选条件下暂无数据</div>
      ) : (
        <>
          {/* Mini pie chart */}
          <div style={styles.pieWrap}>
            <ReactECharts option={pieOption!} style={{ height: 180, width: '100%' }} onEvents={onEvents} notMerge />
            <div style={styles.pieCenterText}>
              {selectedDepartment ? (() => {
                const selected = ranking.find((r) => r.department === selectedDepartment);
                const amt = selected?.amount ?? 0;
                const pct = totalAmount > 0 ? (amt / totalAmount * 100).toFixed(1) : '0.0';
                return (
                  <>
                    <span style={styles.pieCenterName}>{selectedDepartment.length > 5 ? selectedDepartment.slice(0, 5) + '…' : selectedDepartment}</span>
                    <span style={styles.pieCenterAmt}>{amt >= 10000 ? `${(amt / 10000).toFixed(1)}万` : `${Math.round(amt)}`}</span>
                    <span style={styles.pieCenterLabel}>{pct}%</span>
                  </>
                );
              })() : (
                <>
                  <span style={styles.pieCenterAmt}>{totalAmount >= 10000 ? `${(totalAmount / 10000).toFixed(0)}万` : `${Math.round(totalAmount)}`}</span>
                  <span style={styles.pieCenterLabel}>总费用</span>
                </>
              )}
            </div>
          </div>

          {/* Ranking list (all departments, scrollable) */}
          <ul style={styles.list}>
            {ranking.map((item, idx) => {
              const isSelected = selectedDepartment === item.department;
              return (
                <li
                  key={item.department}
                  style={{ ...styles.item, ...(isSelected ? styles.itemSelected : {}) }}
                  onClick={() => handleDepartmentClick(item.department)}
                >
                  <span style={styles.rank}>{idx + 1}</span>
                  <span style={styles.deptName}>{item.department}</span>
                  <span style={{ ...styles.changeBadge, ...(idx === 0 ? styles.changeBadgeFirst : {}) }}>
                    {displayMoney(item.amount, filter.currencyMode, DEFAULT_USD_RATE)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div style={styles.countText}>共 {ranking.length} 个部门</div>
        </>
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
  },
  pieWrap: {
    position: 'relative',
    marginBottom: '6px',
  },
  pieCenterText: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    textAlign: 'center',
    pointerEvents: 'none',
  },
  pieCenterAmt: {
    display: 'block',
    fontSize: '16px',
    fontWeight: 900,
    color: 'var(--text)',
  },
  pieCenterName: {
    display: 'block',
    fontSize: '11px',
    fontWeight: 800,
    color: 'var(--green)',
    marginBottom: '1px',
  },
  pieCenterLabel: {
    display: 'block',
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    display: 'grid',
    gap: '6px',
    maxHeight: '180px',
    overflowY: 'auto',
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '18px 1fr auto',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    transition: 'all .15s',
    fontSize: '12px',
    padding: '4px 6px',
    borderRadius: '5px',
  },
  itemSelected: {
    backgroundColor: 'var(--green-3)',
    outline: '1px solid var(--green-2)',
  },
  rank: {
    fontSize: '11px',
    fontWeight: 800,
    color: 'var(--muted)',
    textAlign: 'center',
  },
  deptName: {
    fontSize: '12px',
    color: 'var(--text)',
    fontWeight: 500,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  changeBadge: {
    padding: '3px 6px',
    borderRadius: '4px',
    color: 'var(--green)',
    background: 'var(--green-3)',
    fontSize: '10px',
    fontWeight: 800,
  },
  changeBadgeFirst: {
    color: 'var(--pink)',
    background: 'var(--pink-2)',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '13px',
    padding: '24px 0',
  },
  countText: {
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '10px',
    padding: '6px 0 0',
    marginTop: '4px',
  },
};
