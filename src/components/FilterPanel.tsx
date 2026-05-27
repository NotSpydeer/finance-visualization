/**
 * 筛选面板组件
 * grid: 6 filter-controls + 2 action buttons
 * Prototype: .filter-panel with labels above selects
 * Requirements: 5.6, 6.3, 7.5
 */

import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import type { CurrencyMode } from '../types/expense';

/** 币种口径选项 */
const CURRENCY_MODE_OPTIONS: { label: string; mode: CurrencyMode; currency: '' | 'RMB' | 'USD' }[] = [
  { label: '全人民币口径', mode: 'CNY', currency: '' },
  { label: '全美金口径', mode: 'USD', currency: '' },
  { label: '仅 RMB 交易', mode: 'CNY', currency: 'RMB' },
  { label: '仅 USD 交易', mode: 'CNY', currency: 'USD' },
];

export function FilterPanel() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);
  const resetFilter = useAppStore((s) => s.resetFilter);

  // 从 records 中提取唯一值作为筛选选项
  const options = useMemo(() => {
    const persons = new Set<string>();
    const departments = new Set<string>();
    const categoryL1s = new Set<string>();
    const bankAccounts = new Set<string>();
    const periods = new Set<string>();

    for (const r of records) {
      if (r.person) persons.add(r.person);
      if (r.department) departments.add(r.department);
      if (r.categoryL1) categoryL1s.add(r.categoryL1);
      if (r.bankAccount) bankAccounts.add(r.bankAccount);
      if (r.periodMonth) periods.add(r.periodMonth);
    }

    return {
      persons: Array.from(persons).sort(),
      departments: Array.from(departments).sort(),
      categoryL1s: Array.from(categoryL1s).sort(),
      bankAccounts: Array.from(bankAccounts).sort(),
      periods: Array.from(periods).sort(),
    };
  }, [records]);

  // 当前选中的币种口径索引
  const currentCurrencyIndex = useMemo(() => {
    for (let i = 0; i < CURRENCY_MODE_OPTIONS.length; i++) {
      const opt = CURRENCY_MODE_OPTIONS[i];
      if (opt.mode === filter.currencyMode && opt.currency === filter.currency) {
        return i;
      }
    }
    return 0;
  }, [filter.currencyMode, filter.currency]);

  const handleCurrencyModeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const idx = Number(e.target.value);
    const opt = CURRENCY_MODE_OPTIONS[idx];
    updateFilter({ currencyMode: opt.mode, currency: opt.currency });
  };

  const handleSaveView = () => {
    window.dispatchEvent(new CustomEvent('save-filter-view'));
  };

  return (
    <div style={styles.card} role="region" aria-label="筛选面板">
      {/* 时间 */}
      <label style={styles.filterControl}>
        <span style={styles.label}>时间</span>
        <select
          style={styles.select}
          value={filter.period}
          onChange={(e) => updateFilter({ period: e.target.value, date: '', dateStart: '', dateEnd: '' })}
          aria-label="时间筛选"
        >
          <option value="">全部期间</option>
          {options.periods.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>

      {/* 主体 */}
      <label style={styles.filterControl}>
        <span style={styles.label}>主体</span>
        <select
          style={styles.select}
          value={filter.person}
          onChange={(e) => updateFilter({ person: e.target.value })}
          aria-label="主体筛选"
        >
          <option value="">全部主体</option>
          {options.persons.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </label>

      {/* 部门/项目 */}
      <label style={styles.filterControl}>
        <span style={styles.label}>部门/项目</span>
        <select
          style={styles.select}
          value={filter.department}
          onChange={(e) => updateFilter({ department: e.target.value })}
          aria-label="部门筛选"
        >
          <option value="">全部部门</option>
          {options.departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </label>

      {/* 一级分类 */}
      <label style={styles.filterControl}>
        <span style={styles.label}>一级分类</span>
        <select
          style={styles.select}
          value={filter.categoryL1}
          onChange={(e) => updateFilter({ categoryL1: e.target.value, categoryL2: '', categoryL3: '' })}
          aria-label="一级分类筛选"
        >
          <option value="">全部分类</option>
          {options.categoryL1s.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </label>

      {/* 银行账户 */}
      <label style={styles.filterControl}>
        <span style={styles.label}>银行账户</span>
        <select
          style={styles.select}
          value={filter.bankAccount}
          onChange={(e) => updateFilter({ bankAccount: e.target.value })}
          aria-label="银行账户筛选"
        >
          <option value="">全部银行</option>
          {options.bankAccounts.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </label>

      {/* 币种口径 */}
      <label style={styles.filterControl}>
        <span style={styles.label}>币种</span>
        <select
          style={styles.select}
          value={currentCurrencyIndex}
          onChange={handleCurrencyModeChange}
          aria-label="币种口径"
        >
          {CURRENCY_MODE_OPTIONS.map((opt, idx) => (
            <option key={idx} value={idx}>{opt.label}</option>
          ))}
        </select>
      </label>

      {/* 保存视图 */}
      <button
        type="button"
        style={styles.primaryBtn}
        onClick={handleSaveView}
        aria-label="保存视图"
      >
        保存视图
      </button>

      {/* 重置 */}
      <button
        type="button"
        style={styles.actionBtn}
        onClick={resetFilter}
        aria-label="重置筛选"
      >
        重置
      </button>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    display: 'grid',
    gridTemplateColumns: 'repeat(6, minmax(0, 1fr)) auto auto',
    gap: '8px',
    alignItems: 'end',
    padding: '12px',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius)',
    background: 'var(--surface)',
    boxShadow: 'var(--shadow)',
  },
  filterControl: {
    display: 'grid',
    gap: '5px',
  },
  label: {
    color: 'var(--muted)',
    fontSize: '11px',
    fontWeight: 800,
  },
  select: {
    width: '100%',
    height: '32px',
    border: '1px solid var(--line)',
    borderRadius: '5px',
    background: '#fbfcfb',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 700,
    padding: '0 8px',
    outline: 'none',
    cursor: 'pointer',
  },
  primaryBtn: {
    height: '32px',
    padding: '0 12px',
    border: '1px solid var(--green)',
    borderRadius: '5px',
    background: 'var(--green)',
    color: '#fff',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: '.18s ease',
    whiteSpace: 'nowrap',
  },
  actionBtn: {
    height: '32px',
    padding: '0 12px',
    border: '1px solid var(--line)',
    borderRadius: '5px',
    background: '#fbfcfb',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    transition: '.18s ease',
    whiteSpace: 'nowrap',
  },
};

export default FilterPanel;
