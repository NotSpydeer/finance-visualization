/**
 * 部门费用排行组件
 * 列表卡片，第一名橙色高亮，其余绿色金额
 * Requirements: 13.1-13.4
 */

import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { getDepartmentRanking, filterRecords } from '../data/selectors';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';
import type { DrawerContext } from '../types/chart';

export default function DepartmentRanking() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);
  const openDrawer = useAppStore((s) => s.openDrawer);

  const ranking = useMemo(() => getDepartmentRanking(records, filter), [records, filter]);
  const selectedDepartment = filter.department;

  const buildDrawerContext = (department: string, amount: number): DrawerContext => {
    const deptFilter = { ...filter, department };
    const filtered = filterRecords(records, deptFilter);
    const recordCount = filtered.length;
    const maxSingle = filtered.reduce((max, r) => Math.max(max, r.amountCNY), 0);

    const categoryMap = new Map<string, number>();
    for (const r of filtered) {
      categoryMap.set(r.categoryL1, (categoryMap.get(r.categoryL1) ?? 0) + r.amountCNY);
    }
    const topCategories = Array.from(categoryMap.entries())
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([name, amt]) => ({ name, amount: amt }));

    const topDepartments = [{ name: department, amount }];
    const topRecords = [...filtered].sort((a, b) => b.amountCNY - a.amountCNY).slice(0, 6);

    return { type: 'department', title: `部门: ${department}`, amount, recordCount, maxSingle, topCategories, topDepartments, topRecords };
  };

  const handleDepartmentClick = (department: string, amount: number) => {
    // If clicking the already-selected department, deselect it (clear filter)
    if (filter.department === department) {
      updateFilter({ department: '' });
      return;
    }
    updateFilter({ department });
    openDrawer(buildDrawerContext(department, amount));
  };

  return (
    <div style={styles.card} role="region" aria-label="部门费用排行">
      <h2 className="card-title-bar" style={{ marginBottom: '12px' }}>项目排行</h2>

      {ranking.length === 0 ? (
        <div style={styles.empty}>当前筛选条件下暂无数据</div>
      ) : (
        <>
          <ul style={styles.list}>
            {ranking.map((item, idx) => {
              const isSelected = selectedDepartment === item.department;
              const isFirst = idx === 0;
              return (
                <li
                  key={item.department}
                  style={{ ...styles.item, ...(isSelected ? styles.itemSelected : {}) }}
                  onClick={() => handleDepartmentClick(item.department, item.amount)}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.department}: ${displayMoney(item.amount, filter.currencyMode, DEFAULT_USD_RATE)}`}
                  aria-pressed={isSelected}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleDepartmentClick(item.department, item.amount); }}
                >
                  <span style={styles.deptName}>{item.department}</span>
                  <span style={{ ...styles.changeBadge, ...(isFirst ? styles.changeBadgeDown : {}) }}>
                    {displayMoney(item.amount, filter.currencyMode, DEFAULT_USD_RATE)}
                  </span>
                </li>
              );
            })}
          </ul>
          <div style={styles.countText}>共 {ranking.length} 个部门/项目</div>
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
    padding: '18px 20px',
  },
  title: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    maxHeight: '360px',
    overflowY: 'auto',
    display: 'grid',
    gap: '11px',
  },
  item: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    alignItems: 'center',
    cursor: 'pointer',
    transition: 'background-color .15s',
    fontSize: '13px',
  },
  itemSelected: {
    backgroundColor: 'var(--green-3)',
    padding: '4px 8px',
    borderRadius: '6px',
    outline: '1px solid var(--green-2)',
  },
  deptName: {
    fontSize: '13px',
    color: 'var(--text)',
    fontWeight: 500,
  },
  changeBadge: {
    padding: '4px 7px',
    borderRadius: '4px',
    color: 'var(--green)',
    background: 'var(--green-3)',
    fontSize: '11px',
    fontWeight: 800,
  },
  changeBadgeDown: {
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
    fontSize: '11px',
    padding: '8px 0 0',
    borderTop: '1px solid var(--line)',
    marginTop: '8px',
  },
};
