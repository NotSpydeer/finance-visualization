/**
 * 数据搜索页面
 * 独立筛选条 + 关键词搜索 + 结果表格
 * 使用自己的本地筛选状态，不影响总览页面的全局筛选
 * 支持：时间区间、部门、分类、主体、银行账户、导入状态、币种 筛选
 */

import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../state/store';
import { filterRecords } from '../../data/selectors';
import { displayMoney } from '../../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../../utils/constants';
import { DEFAULT_FILTER_STATE } from '../../utils/constants';
import type { FilterState } from '../../types/expense';

type SortBy = 'date' | 'amount';

export function DataSearchPage() {
  const records = useAppStore((s) => s.records);

  // Local filter state — independent from global filter
  const [localFilter, setLocalFilter] = useState<FilterState>({ ...DEFAULT_FILTER_STATE });
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<SortBy>('date');

  // Extract unique values for filter dropdowns
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

  // Apply local filter first, then keyword search on top
  const searchResults = useMemo(() => {
    let result = filterRecords(records, localFilter);
    if (keyword.trim()) {
      const kw = keyword.trim().toLowerCase();
      result = result.filter((r) => {
        return (
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
        );
      });
    }
    // Sort
    if (sortBy === 'amount') {
      result = [...result].sort((a, b) => b.amountCNY - a.amountCNY);
    } else {
      result = [...result].sort((a, b) => b.date.localeCompare(a.date));
    }
    return result.slice(0, 200);
  }, [records, localFilter, keyword, sortBy]);

  const handleFilterChange = useCallback((field: string, value: string) => {
    setLocalFilter((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setLocalFilter({ ...DEFAULT_FILTER_STATE });
    setKeyword('');
  }, []);

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>数据搜索</h2>

      {/* Filter bar */}
      <div style={styles.filterBar}>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>日期起</label>
          <input
            type="date"
            value={localFilter.dateStart}
            onChange={(e) => handleFilterChange('dateStart', e.target.value)}
            style={styles.filterInput}
          />
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>日期止</label>
          <input
            type="date"
            value={localFilter.dateEnd}
            onChange={(e) => handleFilterChange('dateEnd', e.target.value)}
            style={styles.filterInput}
          />
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>主体</label>
          <select
            value={localFilter.person}
            onChange={(e) => handleFilterChange('person', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">全部</option>
            {options.persons.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>部门/项目</label>
          <select
            value={localFilter.department}
            onChange={(e) => handleFilterChange('department', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">全部</option>
            {options.departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>一级分类</label>
          <select
            value={localFilter.categoryL1}
            onChange={(e) => handleFilterChange('categoryL1', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">全部</option>
            {options.categoriesL1.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>银行账户</label>
          <select
            value={localFilter.bankAccount}
            onChange={(e) => handleFilterChange('bankAccount', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">全部</option>
            {options.bankAccounts.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>状态</label>
          <select
            value={localFilter.importStatus}
            onChange={(e) => handleFilterChange('importStatus', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">全部</option>
            <option value="normal">正常</option>
            <option value="pending_classify">待分类</option>
            <option value="abnormal">异常</option>
          </select>
        </div>
        <div style={styles.filterControl}>
          <label style={styles.filterLabel}>币种</label>
          <select
            value={localFilter.currency}
            onChange={(e) => handleFilterChange('currency', e.target.value)}
            style={styles.filterSelect}
          >
            <option value="">全部</option>
            <option value="RMB">人民币</option>
            <option value="USD">美元</option>
          </select>
        </div>
        <div style={styles.filterActions}>
          <button style={styles.resetBtn} onClick={handleResetFilters}>重置</button>
        </div>
      </div>

      {/* Search input */}
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
          {keyword.trim() ? `找到 ${searchResults.length} 条结果` : `共 ${searchResults.length} 条记录`}
        </span>
      </div>

      {/* Sort buttons */}
      <div style={styles.sortRow}>
        <span style={styles.sortLabel}>排序:</span>
        <button
          style={{ ...styles.sortBtn, ...(sortBy === 'date' ? styles.sortBtnActive : {}) }}
          onClick={() => setSortBy('date')}
        >
          按日期
        </button>
        <button
          style={{ ...styles.sortBtn, ...(sortBy === 'amount' ? styles.sortBtnActive : {}) }}
          onClick={() => setSortBy('amount')}
        >
          按金额
        </button>
      </div>

      {/* Results */}
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
                  <tr
                    key={record.id}
                    style={{ ...styles.tr, backgroundColor: index % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}
                  >
                    <td style={styles.td}>{record.date}</td>
                    <td style={styles.td}>{record.person}</td>
                    <td style={styles.td}>{record.department}</td>
                    <td style={styles.td}>
                      {record.categoryL1}{record.categoryL3 ? ` / ${record.categoryL3}` : ''}
                    </td>
                    <td style={styles.td}>{record.bankAccount}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>
                      {displayMoney(record.amountCNY, localFilter.currencyMode, DEFAULT_USD_RATE)}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: '12px', color: record.importStatus === 'normal' ? 'var(--green)' : 'var(--orange)' }}>
                        {record.importStatus === 'normal' ? '正常' : record.importStatus === 'pending_classify' ? '待分类' : '异常'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', color: 'var(--muted)' }}>
                      #{record.sourceRowNo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {searchResults.length >= 200 && (
            <div style={styles.truncated}>
              仅显示前 200 条记录，请使用筛选条件缩小范围
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    padding: '0',
  },
  pageTitle: {
    fontSize: '20px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 16px 0',
  },
  filterBar: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr)) auto',
    gap: '10px',
    alignItems: 'end',
    padding: '14px 16px',
    marginBottom: '14px',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius)',
    background: 'var(--surface)',
    boxShadow: 'var(--shadow)',
  },
  filterControl: {
    display: 'grid',
    gap: '4px',
  },
  filterLabel: {
    fontSize: '11px',
    fontWeight: 800,
    color: 'var(--muted)',
  },
  filterSelect: {
    width: '100%',
    height: '32px',
    border: '1px solid var(--line)',
    borderRadius: '5px',
    background: '#fbfcfb',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 700,
    padding: '0 8px',
  },
  filterInput: {
    width: '100%',
    height: '32px',
    border: '1px solid var(--line)',
    borderRadius: '5px',
    background: '#fbfcfb',
    color: 'var(--text)',
    fontSize: '12px',
    fontWeight: 700,
    padding: '0 8px',
  },
  filterActions: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
  },
  resetBtn: {
    height: '32px',
    padding: '0 14px',
    border: '1px solid var(--pink)',
    borderRadius: '5px',
    background: 'var(--pink-2)',
    color: 'var(--pink)',
    fontSize: '12px',
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  searchRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '12px',
  },
  searchInput: {
    flex: 1,
    padding: '10px 16px',
    fontSize: '14px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--line)',
    outline: 'none',
    backgroundColor: 'var(--surface)',
    color: 'var(--text)',
    transition: 'border-color .15s',
  },
  resultCount: {
    fontSize: '13px',
    color: 'var(--muted)',
    whiteSpace: 'nowrap',
  },
  sortRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '16px',
  },
  sortLabel: {
    fontSize: '12px',
    color: 'var(--muted)',
  },
  sortBtn: {
    padding: '5px 12px',
    fontSize: '12px',
    borderRadius: 'var(--radius)',
    border: '1px solid var(--line)',
    background: 'var(--surface)',
    color: 'var(--muted)',
    cursor: 'pointer',
    fontWeight: 500,
    transition: 'all .15s',
  },
  sortBtnActive: {
    backgroundColor: 'var(--green-3)',
    color: 'var(--green)',
    borderColor: 'var(--green-2)',
    fontWeight: 700,
  },
  hint: {
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '14px',
    padding: '60px 0',
  },
  tableCard: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--line)',
    padding: '18px 20px',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '13px',
  },
  th: {
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: 500,
    color: 'var(--muted)',
    borderBottom: '2px solid var(--line)',
    whiteSpace: 'nowrap',
    fontSize: '12px',
  },
  tr: {
    transition: 'background-color .12s',
  },
  td: {
    padding: '8px 10px',
    color: 'var(--text)',
    borderBottom: '1px solid var(--line)',
    whiteSpace: 'nowrap',
  },
  truncated: {
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '12px',
    padding: '12px 0 0',
  },
};

export default DataSearchPage;
