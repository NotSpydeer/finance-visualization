/**
 * 筛选标签组件
 * 绿色主题 chip 样式，显示当前激活的筛选条件
 * Requirements: 5.6, 6.3, 7.5
 */

import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import type { FilterState } from '../types/expense';

/** 筛选字段中文标签映射 */
const FILTER_LABELS: Record<string, string> = {
  period: '时间',
  date: '时间',
  dateRange: '日期区间',
  person: '主体',
  department: '部门',
  categoryL1: '一级',
  categoryL2: '二级',
  categoryL3: '三级',
  bankAccount: '银行',
  currency: '币种',
  importStatus: '状态',
};

/** 导入状态中文显示 */
const IMPORT_STATUS_LABELS: Record<string, string> = {
  normal: '正常',
  pending_classify: '待归类',
  abnormal: '异常',
};

interface TagInfo {
  key: string;
  label: string;
  value: string;
  clearAction: Partial<FilterState>;
}

export function FilterTags() {
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);
  const resetFilter = useAppStore((s) => s.resetFilter);

  const tags: TagInfo[] = useMemo(() => {
    const result: TagInfo[] = [];

    if (filter.date) {
      result.push({
        key: 'date',
        label: FILTER_LABELS.date,
        value: filter.date,
        clearAction: { date: '', dateStart: '', dateEnd: '', period: '' },
      });
    } else if (filter.dateStart && filter.dateEnd) {
      result.push({
        key: 'dateRange',
        label: FILTER_LABELS.dateRange,
        value: `${filter.dateStart} 至 ${filter.dateEnd}`,
        clearAction: { dateStart: '', dateEnd: '', date: '', period: '' },
      });
    } else if (filter.period) {
      result.push({
        key: 'period',
        label: FILTER_LABELS.period,
        value: filter.period,
        clearAction: { period: '', date: '', dateStart: '', dateEnd: '' },
      });
    }

    if (filter.person) {
      result.push({ key: 'person', label: FILTER_LABELS.person, value: filter.person, clearAction: { person: '' } });
    }
    if (filter.department) {
      result.push({ key: 'department', label: FILTER_LABELS.department, value: filter.department, clearAction: { department: '' } });
    }
    if (filter.categoryL1) {
      result.push({ key: 'categoryL1', label: FILTER_LABELS.categoryL1, value: filter.categoryL1, clearAction: { categoryL1: '', categoryL2: '', categoryL3: '' } });
    }
    if (filter.categoryL2) {
      result.push({ key: 'categoryL2', label: FILTER_LABELS.categoryL2, value: filter.categoryL2, clearAction: { categoryL2: '', categoryL3: '' } });
    }
    if (filter.categoryL3) {
      result.push({ key: 'categoryL3', label: FILTER_LABELS.categoryL3, value: filter.categoryL3, clearAction: { categoryL3: '' } });
    }
    if (filter.bankAccount) {
      result.push({ key: 'bankAccount', label: FILTER_LABELS.bankAccount, value: filter.bankAccount, clearAction: { bankAccount: '' } });
    }
    if (filter.currency) {
      result.push({ key: 'currency', label: FILTER_LABELS.currency, value: filter.currency === 'RMB' ? '人民币' : '美元', clearAction: { currency: '' } });
    }
    if (filter.importStatus) {
      result.push({ key: 'importStatus', label: FILTER_LABELS.importStatus, value: IMPORT_STATUS_LABELS[filter.importStatus] || filter.importStatus, clearAction: { importStatus: '' } });
    }

    return result;
  }, [filter]);

  if (tags.length === 0) return null;

  return (
    <div style={styles.container} role="region" aria-label="筛选标签">
      {tags.map((tag) => (
        <span key={tag.key} style={styles.chip}>
          <span style={styles.chipLabel}>{tag.label}:</span>
          <span style={styles.chipValue}>{tag.value}</span>
          <button
            type="button"
            style={styles.chipClose}
            onClick={() => updateFilter(tag.clearAction)}
            aria-label={`清除${tag.label}筛选`}
          >
            ×
          </button>
        </span>
      ))}
      <button
        type="button"
        style={styles.clearAll}
        onClick={resetFilter}
        aria-label="清除全部筛选"
      >
        清除全部
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    alignItems: 'flex-start',
    padding: '0',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '14px',
    backgroundColor: 'var(--green-3)',
    border: '1px solid var(--green-2)',
    color: 'var(--green)',
    whiteSpace: 'nowrap',
  },
  chipLabel: {
    fontWeight: 500,
  },
  chipValue: {
    color: 'var(--text)',
  },
  chipClose: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--green)',
    fontSize: '14px',
    cursor: 'pointer',
    lineHeight: 1,
    padding: 0,
    fontWeight: 600,
  },
  clearAll: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '14px',
    backgroundColor: 'var(--pink-2)',
    border: '1px solid var(--pink)',
    color: 'var(--pink)',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontWeight: 500,
  },
};

export default FilterTags;
