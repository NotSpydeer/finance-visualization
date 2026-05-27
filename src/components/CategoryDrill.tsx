/**
 * 分类钻取组件
 * 面包屑路径 + 列表（分类名 + 金额 + "点击展开下一级"）
 * Requirements: 12.1-12.5
 */

import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { filterRecords } from '../data/selectors';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';
import type { DrawerContext } from '../types/chart';

interface CategoryItem {
  name: string;
  amount: number;
}

export function CategoryDrill() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);
  const openDrawer = useAppStore((s) => s.openDrawer);

  const currentLevel = useMemo(() => {
    if (!filter.categoryL1) return 1;
    if (!filter.categoryL2) return 2;
    return 3;
  }, [filter.categoryL1, filter.categoryL2]);

  const breadcrumb = useMemo(() => {
    const parts = ['全部'];
    if (filter.categoryL1) parts.push(filter.categoryL1);
    if (filter.categoryL2) parts.push(filter.categoryL2);
    return parts;
  }, [filter.categoryL1, filter.categoryL2]);

  const categoryItems = useMemo((): CategoryItem[] => {
    const baseFilter = { ...filter };
    if (currentLevel === 1) {
      baseFilter.categoryL1 = '';
      baseFilter.categoryL2 = '';
      baseFilter.categoryL3 = '';
    } else if (currentLevel === 2) {
      baseFilter.categoryL2 = '';
      baseFilter.categoryL3 = '';
    } else {
      baseFilter.categoryL3 = '';
    }

    const filtered = filterRecords(records, baseFilter);
    const map = new Map<string, number>();
    for (const r of filtered) {
      let key: string;
      if (currentLevel === 1) key = r.categoryL1;
      else if (currentLevel === 2) key = r.categoryL2;
      else key = r.categoryL3;
      if (key) map.set(key, (map.get(key) ?? 0) + r.amountCNY);
    }

    return Array.from(map.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [records, filter, currentLevel]);

  const buildDrawerContext = (categoryName: string, amount: number): DrawerContext => {
    const filtered = filterRecords(records, filter);
    const recordCount = filtered.length;
    const maxSingle = filtered.reduce((max, r) => Math.max(max, r.amountCNY), 0);

    const categoryMap = new Map<string, number>();
    for (const r of filtered) categoryMap.set(r.categoryL1, (categoryMap.get(r.categoryL1) ?? 0) + r.amountCNY);
    const topCategories = Array.from(categoryMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amt]) => ({ name, amount: amt }));

    const deptMap = new Map<string, number>();
    for (const r of filtered) deptMap.set(r.department, (deptMap.get(r.department) ?? 0) + r.amountCNY);
    const topDepartments = Array.from(deptMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, amt]) => ({ name, amount: amt }));

    const topRecords = [...filtered].sort((a, b) => b.amountCNY - a.amountCNY).slice(0, 6);
    return { type: 'category', title: categoryName, amount, recordCount, maxSingle, topCategories, topDepartments, topRecords };
  };

  const handleItemClick = (item: CategoryItem) => {
    if (currentLevel === 1) {
      updateFilter({ categoryL1: item.name, categoryL2: '', categoryL3: '' });
    } else if (currentLevel === 2) {
      updateFilter({ categoryL2: item.name, categoryL3: '' });
    } else {
      // Level 3: if clicking the already-selected L3 item, just deselect it (stay at L3 level)
      if (filter.categoryL3 === item.name) {
        updateFilter({ categoryL3: '' });
        return;
      }
      updateFilter({ categoryL3: item.name });
      openDrawer(buildDrawerContext(item.name, item.amount));
    }
  };

  const handleGoBack = () => {
    if (currentLevel === 3) updateFilter({ categoryL2: '', categoryL3: '' });
    else if (currentLevel === 2) updateFilter({ categoryL1: '', categoryL2: '', categoryL3: '' });
  };

  const getHint = () => {
    if (currentLevel === 3) return '点击锁定三级分类';
    return '点击展开下一级';
  };

  return (
    <div style={styles.card} role="region" aria-label="分类钻取">
      <div style={styles.header}>
        <h2 className="card-title-bar">分类钻取</h2>
        {currentLevel > 1 && (
          <button type="button" style={styles.backBtn} onClick={handleGoBack} aria-label="返回上级">
            ← 返回上级
          </button>
        )}
      </div>

      {/* 面包屑 */}
      <div style={styles.breadcrumb}>
        {breadcrumb.map((part, idx) => (
          <span key={idx}>
            {idx > 0 && <span style={styles.breadSep}> › </span>}
            <span style={idx === breadcrumb.length - 1 ? styles.breadActive : styles.breadNormal}>{part}</span>
          </span>
        ))}
      </div>

      {/* 列表 */}
      <div style={styles.list}>
        {categoryItems.length === 0 ? (
          <div style={styles.empty}>当前口径无数据</div>
        ) : (
          categoryItems.map((item) => {
            const isActive = (currentLevel === 1 && filter.categoryL1 === item.name) ||
                             (currentLevel === 2 && filter.categoryL2 === item.name) ||
                             (currentLevel === 3 && filter.categoryL3 === item.name);
            return (
            <div
              key={item.name}
              style={{ ...styles.listItem, ...(isActive ? styles.listItemActive : {}) }}
              onClick={() => handleItemClick(item)}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleItemClick(item); }}
            >
              <div style={styles.itemLeft}>
                <span style={styles.itemName}>{item.name}</span>
                <span style={styles.itemHint}>{isActive && currentLevel === 3 ? '再次点击取消选中' : getHint()}</span>
              </div>
              <span style={styles.itemAmount}>
                {displayMoney(item.amount, filter.currencyMode, DEFAULT_USD_RATE)}
              </span>
            </div>
          );})
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
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  title: {
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: 0,
  },
  backBtn: {
    fontSize: '12px',
    color: 'var(--green)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '4px',
    fontWeight: 500,
  },
  breadcrumb: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginBottom: '12px',
  },
  breadSep: {
    color: 'var(--line)',
    margin: '0 2px',
  },
  breadActive: {
    color: 'var(--green)',
    fontWeight: 500,
  },
  breadNormal: {
    color: 'var(--muted)',
  },
  list: {
    display: 'grid',
    gap: '8px',
  },
  listItem: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '10px',
    alignItems: 'center',
    padding: '9px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: '.18s ease',
    backgroundColor: '#fbfcfb',
    border: '1px solid var(--line)',
  },
  listItemActive: {
    borderColor: '#c7ded5',
    backgroundColor: 'var(--green-3)',
    color: 'var(--green)',
  },
  itemLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  itemName: {
    fontSize: '13px',
    color: 'var(--text)',
    fontWeight: 500,
  },
  itemHint: {
    fontSize: '11px',
    color: 'var(--muted)',
  },
  itemAmount: {
    fontSize: '13px',
    color: 'var(--green)',
    fontWeight: 600,
  },
  empty: {
    fontSize: '13px',
    color: 'var(--muted)',
    textAlign: 'center',
    padding: '24px 0',
  },
};

export default CategoryDrill;
