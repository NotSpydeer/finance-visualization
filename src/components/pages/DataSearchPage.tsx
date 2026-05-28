/**
 * 明细查询页面
 * 与总览页面全局筛选联动：以全局 filter 为基础
 * 在此基础上支持本页额外的筛选条件和关键词搜索
 * 展示总览筛选条件下的完整明细表
 */

import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../state/store';
import { filterRecords } from '../../data/selectors';
import { displayMoney } from '../../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../../utils/constants';
import type { FilterState } from '../../types/expense';

type SortBy = 'date' | 'amount';

export function DataSearchPage() {
  const records = useAppStore((s) => s.records);
  const globalFilter = useAppStore((s) => s.filter);

  // Local additional filters (layered on top of global filter)
  const [localOverrides, setLocalOverrides] = useState<Partial<FilterState>>({});
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');

  // Merge: global filter + local overrides (local overrides only apply non-empty values)
  const effectiveFilter = useMemo((): FilterState => {
    const merged = { ...globalFilter };
    for (const [key, value] of Object.entries(localOverrides)) {
      if (value !== undefined && value !== '') {
        (merged as Record<string, unknown>)[key] = value;
      }
    }
    return merged;
  }, [globalFilter, localOverrides]);

  // Extract unique values for filter dropdowns (from all records, not filtered)
  const options = useMemo(() => {
    const persons = new Set<string>();
    const departments = new Set<string>();
    const categoriesL1 = new Set<string>();
    const bankAccounts = new Set<string>();
    for (const r of records) {
      if (r.person) persons.add(r.person);
      if (r.department) departments.add(r.department);
      if (r.categoryL1) categoriesL1.add(r.categoryL1);
      if (r.bankAccount) bankAccounts.add(r.bankAccount);
    }
    return {
      persons: Array.from(persons).sort(),
      departments: Array.from(departments).sort(),
      categoriesL1: Array.from(categoriesL1).sort(),
      bankAccounts: Array.from(bankAccounts).sort(),
    };
  }, [records]);

  // Apply effective filter, then keyword search
  const searchResults = useMemo(() => {
    let result = filterRecords(records, effectiveFilter);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((r) => (
        r.date.toLowerCase().includes(kw) ||
        r.department.toLowerCase().includes(kw) ||
        r.categoryL1.toLowerCase().includes(kw) ||
        r.categoryL2.toLowerCase().includes(kw) ||
        r.categoryL3.toLowerCase().includes(kw) ||
        r.person.toLowerCase().includes(kw) ||
        r.bankAccount.toLowerCase().includes(kw) ||
        r.periodMonth.toLowerCase().includes(kw) ||
        r.currency.toLowerCase().includes(kw) ||
        String(r.amountCNY).includes(kw) ||
        String(r.sourceRowNo).includes(kw)
      ));
    }
    if (sortBy === 'amount') {
      result = [...result].sort((a, b) => b.amountCNY - a.amountCNY);
    } else {
      result = [...result].sort((a, b) => b.date.localeCompare(a.date));
    }
    return result.slice(0, 200);
  }, [records, effectiveFilter, keyword, sortBy]);

  const handleLocalChange = useCallback((field: string, value: string) => {
    setLocalOverrides((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleResetLocal = useCallback(() => {
    setLocalOverrides({});
    setKeyword('');
  }, []);

  // Show active global filters as context
  const globalFilterSummary = useMemo(() => {
    const parts: string[] = [];
    if (globalFilter.period) parts.push(`时间: ${globalFilter.period}`);
    if (globalFilter.date) parts.push(`日期: ${globalFilter.date}`);
    if (globalFilter.dateStart && globalFilter.dateEnd) parts.push(`区间: ${globalFilter.dateStart}~${globalFilter.dateEnd}`);
    if (globalFilter.department) parts.push(`部门: ${globalFilter.department}`);
    if (globalFilter.categoryL1) parts.push(`分类: ${globalFilter.categoryL1}`);
    if (globalFilter.person) parts.push(`主体: ${globalFilter.person}`);
    return parts;
  }, [globalFilter]);

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>明细查询</h2>

      {/* Global filter context display */}
      {globalFilterSummary.length > 0 && (
        <div style={styles.globalContext}>
          <span style={styles.contextLabel}>当前总览筛选：</span>
          {globalFilterSummary.map((part, i) => (
            <span key={i} style={styles.contextChip}>{part}</span>
          ))}
        </div>
      )}

      {/* Local filter bar (additional refinement) */}
      <div style={styles.filterBar}>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>部门</label>
          <select value={localOverrides.department ?? ''} onChange={(e) => handleLocalChange('department', e.target.value)} style={styles.filterSelect}>
            <option value="">{globalFilter.department || '全部'}</option>
            {options.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>主体</label>
          <select value={localOverrides.person ?? ''} onChange={(e) => handleLocalChange('person', e.target.value)} style={styles.filterSelect}>
            <option value="">{globalFilter.person || '全部'}</option>
            {options.persons.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>一级分类</label>
          <select value={localOverrides.categoryL1 ?? ''} onChange={(e) => handleLocalChange('categoryL1', e.target.value)} style={styles.filterSelect}>
            <option value="">{globalFilter.categoryL1 || '全部'}</option>
            {options.categoriesL1.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>银行账户</label>
          <select value={localOverrides.bankAccount ?? ''} onChange={(e) => handleLocalChange('bankAccount', e.target.value)} style={styles.filterSelect}>
            <option value="">{globalFilter.bankAccount || '全部'}</option>
            {options.bankAccounts.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>状态</label>
          <select value={localOverrides.importStatus ?? ''} onChange={(e) => handleLocalChange('importStatus', e.target.value)} style={styles.filterSelect}>
            <option value="">{globalFilter.importStatus ? (globalFilter.importStatus === 'normal' ? '正常' : globalFilter.importStatus === 'pending_classify' ? '待分类' : '异常') : '全部'}</option>
            <option value="normal">正常</option>
            <option value="pending_classify">待分类</option>
            <option value="abnormal">异常</option>
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>币种</label>
          <select value={localOverrides.currency ?? ''} onChange={(e) => handleLocalChange('currency', e.target.value)} style={styles.filterSelect}>
            <option value="">{globalFilter.currency ? (globalFilter.currency === 'RMB' ? '人民币' : '美元') : '全部'}</option>
            <option value="RMB">人民币</option>
            <option value="USD">美元</option>
          </select>
        </div>
        <div style={styles.filterActions}>
          <button style={styles.resetBtn} onClick={handleResetLocal}>重置本页</button>
        </div>
      </div>

      {/* Search + sort */}
      <div style={styles.searchRow}>
        <input
          type="text"
          placeholder="输入关键词搜索（日期、部门、分类、主体、账户等）"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          style={styles.searchInput}
          aria-label="搜索关键词"
        />
        <span style={styles.resultCount}>
          共 {searchResults.length} 条{keyword.trim() ? '（已搜索）' : ''}
        </span>
      </div>
      <div style={styles.sortRow}>
        <span style={styles.sortLabel}>排序:</span>
        <button style={{ ...styles.sortBtn, ...(sortBy === 'date' ? styles.sortBtnActive : {}) }} onClick={() => setSortBy('date')}>按日期</button>
        <button style={{ ...styles.sortBtn, ...(sortBy === 'amount' ? styles.sortBtnActive : {}) }} onClick={() => setSortBy('amount')}>按金额</button>
      </div>

      {/* Table */}
      {searchResults.length === 0 ? (
        <div style={styles.hint}>没有找到匹配的记录</div>
      ) : (
        <div style={styles.tableCard}>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>日期</th>
                  <th style={styles.th}>主体</th>
                  <th style={styles.th}>部门/项目</th>
                  <th style={styles.th}>分类</th>
                  <th style={styles.th}>银行账户</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>金额</th>
                  <th style={styles.th}>状态</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>行号</th>
                </tr>
              </thead>
              <tbody>
                {searchResults.map((record, index) => (
                  <tr key={record.id} style={{ ...styles.tr, backgroundColor: index % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}>
                    <td style={styles.td}>{record.date}</td>
                    <td style={styles.td}>{record.person}</td>
                    <td style={styles.td}>{record.department}</td>
                    <td style={styles.td}>{record.categoryL1}{record.categoryL3 ? ` / ${record.categoryL3}` : ''}</td>
                    <td style={styles.td}>{record.bankAccount}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>
                      {displayMoney(record.amountCNY, effectiveFilter.currencyMode, DEFAULT_USD_RATE)}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '11px', fontWeight: 700, color: record.importStatus === 'normal' ? 'var(--green)' : record.importStatus === 'abnormal' ? 'var(--pink)' : 'var(--orange)' }}>
                        {record.importStatus === 'normal' ? '正常' : record.importStatus === 'pending_classify' ? '待分类' : '异常'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--muted)' }}>#{record.sourceRowNo}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {searchResults.length >= 200 && (
            <div style={styles.truncated}>仅显示前 200 条，请使用筛选缩小范围</div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '0' },
  pageTitle: { fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px 0' },
  globalContext: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px', marginBottom: '12px', padding: '10px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--green-2)', background: 'var(--green-3)' },
  contextLabel: { fontSize: '12px', fontWeight: 700, color: 'var(--green)' },
  contextChip: { fontSize: '11px', fontWeight: 600, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: '10px', padding: '2px 8px' },
  filterBar: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) auto', gap: '10px', alignItems: 'end', padding: '14px 16px', marginBottom: '14px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', background: 'var(--surface)', boxShadow: 'var(--shadow)' },
  filterControl: { display: 'grid', gap: '4px' },
  filterLabel: { fontSize: '11px', fontWeight: 800, color: 'var(--muted)' },
  filterSelect: { width: '100%', height: '32px', border: '1px solid var(--line)', borderRadius: '5px', background: '#fbfcfb', color: 'var(--text)', fontSize: '12px', fontWeight: 700, padding: '0 8px' },
  filterActions: { display: 'flex', alignItems: 'flex-end' },
  resetBtn: { height: '32px', padding: '0 14px', border: '1px solid var(--pink)', borderRadius: '5px', background: 'var(--pink-2)', color: 'var(--pink)', fontSize: '12px', fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' },
  searchRow: { display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' },
  searchInput: { flex: 1, padding: '10px 16px', fontSize: '14px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', outline: 'none', backgroundColor: 'var(--surface)', color: 'var(--text)' },
  resultCount: { fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' },
  sortRow: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' },
  sortLabel: { fontSize: '12px', color: 'var(--muted)' },
  sortBtn: { padding: '5px 12px', fontSize: '12px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontWeight: 500 },
  sortBtnActive: { backgroundColor: 'var(--green-3)', color: 'var(--green)', border: '1px solid var(--green-2)', fontWeight: 700 },
  hint: { textAlign: 'center', color: 'var(--muted)', fontSize: '14px', padding: '60px 0' },
  tableCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', border: '1px solid var(--line)', padding: '18px 20px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' },
  th: { padding: '8px 10px', textAlign: 'left', fontWeight: 500, color: 'var(--muted)', borderBottom: '2px solid var(--line)', whiteSpace: 'nowrap', fontSize: '12px' },
  tr: { transition: 'background-color .12s' },
  td: { padding: '8px 10px', color: 'var(--text)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' },
  truncated: { textAlign: 'center', color: 'var(--muted)', fontSize: '12px', padding: '12px 0 0' },
};

export default DataSearchPage;
