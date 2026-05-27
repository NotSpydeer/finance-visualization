/**
 * 费用治理页面
 * Tab切换：待归类处理 / 空值填充 / 异常数据处理
 * - 待归类处理：智能归类建议 + 批量操作
 * - 空值填充：分类空值/部门空值，智能推测 + 批量确认
 * - 异常数据处理：查看异常记录，修正后重新计入
 */

import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../state/store';
import { displayMoney } from '../../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../../utils/constants';
import type { ExpenseRecord, TransactionType } from '../../types/expense';

type PageTab = 'classify' | 'fillEmpty' | 'abnormal';

/** Keywords for income-like records */
const INCOME_KEYWORDS = ['收入', '利息', '分成', '补贴', '版权', '期权'];
const INTERCOMPANY_KEYWORDS = ['借款', '押金', '保证金'];

function matchesKeywords(text: string, keywords: string[]): boolean {
  return keywords.some((kw) => text.includes(kw));
}

function classifySuggestion(record: ExpenseRecord): 'income' | 'intercompany' | 'expense' {
  const text = record.categoryL3 || '';
  if (matchesKeywords(text, INCOME_KEYWORDS)) return 'income';
  if (matchesKeywords(text, INTERCOMPANY_KEYWORDS)) return 'intercompany';
  return 'expense';
}

/** Infer department from similar records */
function inferDepartment(record: ExpenseRecord, allRecords: ExpenseRecord[]): string {
  // Strategy: find records with same categoryL1 or categoryL3 that have a department
  const candidates = allRecords.filter(
    (r) => r.department && r.department !== '未分配部门' &&
      (r.categoryL1 === record.categoryL1 || r.categoryL3 === record.categoryL3)
  );
  if (candidates.length === 0) return '未分配部门';
  // Most common department among similar records
  const deptCount = new Map<string, number>();
  for (const c of candidates) {
    deptCount.set(c.department, (deptCount.get(c.department) ?? 0) + 1);
  }
  let best = '';
  let bestCount = 0;
  for (const [dept, count] of deptCount) {
    if (count > bestCount) { best = dept; bestCount = count; }
  }
  return best || '未分配部门';
}

/** Detect what's abnormal about a record */
function detectAbnormality(record: ExpenseRecord): string[] {
  const issues: string[] = [];
  if (!record.date || record.date === '1900-01-01') issues.push('日期异常');
  if (record.amountCNY <= 0) issues.push('金额为零或负数');
  if (record.amountCNY > 10000000) issues.push('金额异常大(>1000万)');
  if (record.exchangeRate <= 0 || record.exchangeRate > 100) issues.push('汇率异常');
  if (!record.categoryL1 && !record.categoryL2 && !record.categoryL3) issues.push('分类全空');
  if (!record.person) issues.push('主体缺失');
  if (issues.length === 0) issues.push('待核实');
  return issues;
}

export function ExpenseGovernancePage() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateRecordType = useAppStore((s) => s.updateRecordType);
  const updateRecordFields = useAppStore((s) => s.updateRecordFields);

  const [pageTab, setPageTab] = useState<PageTab>('classify');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMenuOpen, setBatchMenuOpen] = useState(false);
  // For empty fill: map of record id -> suggested value (editable by user)
  const [deptSuggestions, setDeptSuggestions] = useState<Map<string, string>>(new Map());

  // === Data for each tab ===
  const unclassifiedRecords = useMemo(
    () => records.filter((r) => !r.categoryL1 || r.categoryL1 === '未分类'),
    [records]
  );

  const deptEmptyRecords = useMemo(
    () => records.filter((r) => !r.department || r.department === '未分配部门'),
    [records]
  );

  const abnormalRecords = useMemo(
    () => records.filter((r) => r.importStatus === 'abnormal'),
    [records]
  );

  // Quality metrics
  const qualityMetrics = useMemo(() => {
    const total = records.length;
    return {
      unclassifiedCount: unclassifiedRecords.length,
      deptEmptyCount: deptEmptyRecords.length,
      abnormalCount: abnormalRecords.length,
      total,
    };
  }, [records, unclassifiedRecords, deptEmptyRecords, abnormalRecords]);

  // === Classification suggestions ===
  const suggestions = useMemo(() => {
    const incomeRecords: ExpenseRecord[] = [];
    const intercompanyRecords: ExpenseRecord[] = [];
    const expenseRecords: ExpenseRecord[] = [];
    for (const r of unclassifiedRecords) {
      const s = classifySuggestion(r);
      if (s === 'income') incomeRecords.push(r);
      else if (s === 'intercompany') intercompanyRecords.push(r);
      else expenseRecords.push(r);
    }
    return { incomeRecords, intercompanyRecords, expenseRecords };
  }, [unclassifiedRecords]);

  // === Empty fill: auto-suggest departments ===
  const handleAutoSuggestDept = useCallback(() => {
    const newMap = new Map<string, string>();
    for (const r of deptEmptyRecords) {
      const suggested = inferDepartment(r, records);
      newMap.set(r.id, suggested);
    }
    setDeptSuggestions(newMap);
  }, [deptEmptyRecords, records]);

  const handleConfirmDeptFill = useCallback(() => {
    const entries = Array.from(deptSuggestions.entries());
    if (entries.length === 0) return;
    for (const [id, dept] of entries) {
      updateRecordFields([id], { department: dept });
    }
    setDeptSuggestions(new Map());
  }, [deptSuggestions, updateRecordFields]);

  const handleConfirmSingleDept = useCallback((id: string) => {
    const dept = deptSuggestions.get(id);
    if (!dept) return;
    updateRecordFields([id], { department: dept });
    setDeptSuggestions((prev) => { const next = new Map(prev); next.delete(id); return next; });
  }, [deptSuggestions, updateRecordFields]);

  // === Abnormal: fix record ===
  const handleFixAbnormal = useCallback((id: string) => {
    updateRecordFields([id], { importStatus: 'normal' });
  }, [updateRecordFields]);

  const handleFixAllAbnormal = useCallback(() => {
    const ids = abnormalRecords.map((r) => r.id);
    if (ids.length === 0) return;
    updateRecordFields(ids, { importStatus: 'normal' });
  }, [abnormalRecords, updateRecordFields]);

  // === Classify tab handlers ===
  const handleBatchClassify = (recordList: ExpenseRecord[], type: TransactionType) => {
    const ids = recordList.map((r) => r.id);
    updateRecordType(ids, type);
  };

  const handleBatchAction = (type: TransactionType) => {
    if (selectedIds.size === 0) return;
    updateRecordType(Array.from(selectedIds), type);
    setSelectedIds(new Set());
    setBatchMenuOpen(false);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (list: ExpenseRecord[]) => {
    if (selectedIds.size === list.length && list.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(list.map((r) => r.id)));
    }
  };

  // === RENDER ===
  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>费用治理</h2>

      {/* Quality overview cards */}
      <div style={styles.qualityGrid}>
        <div style={{ ...styles.qualityCard, cursor: 'pointer' }} onClick={() => setPageTab('classify')}>
          <div style={{ ...styles.qualityValue, color: pageTab === 'classify' ? 'var(--green)' : 'var(--text)' }}>
            {qualityMetrics.unclassifiedCount}
          </div>
          <div style={styles.qualityLabel}>待归类</div>
        </div>
        <div style={{ ...styles.qualityCard, cursor: 'pointer' }} onClick={() => setPageTab('fillEmpty')}>
          <div style={{ ...styles.qualityValue, color: pageTab === 'fillEmpty' ? 'var(--orange)' : 'var(--text)' }}>
            {qualityMetrics.deptEmptyCount}
          </div>
          <div style={styles.qualityLabel}>空值待填充</div>
        </div>
        <div style={{ ...styles.qualityCard, cursor: 'pointer' }} onClick={() => setPageTab('abnormal')}>
          <div style={{ ...styles.qualityValue, color: pageTab === 'abnormal' ? 'var(--pink)' : 'var(--text)' }}>
            {qualityMetrics.abnormalCount}
          </div>
          <div style={styles.qualityLabel}>异常数据</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={styles.tabRow}>
        <button style={{ ...styles.tabBtn, ...(pageTab === 'classify' ? styles.tabBtnActive : {}) }} onClick={() => setPageTab('classify')}>待归类处理</button>
        <button style={{ ...styles.tabBtn, ...(pageTab === 'fillEmpty' ? styles.tabBtnActive : {}) }} onClick={() => setPageTab('fillEmpty')}>空值填充</button>
        <button style={{ ...styles.tabBtn, ...(pageTab === 'abnormal' ? styles.tabBtnActive : {}) }} onClick={() => setPageTab('abnormal')}>异常数据</button>
      </div>

      {/* === TAB: 待归类处理 === */}
      {pageTab === 'classify' && (
        <div>
          {/* Suggestion cards */}
          <div style={styles.suggestionGrid}>
            <div style={styles.suggestionCard}>
              <div style={styles.suggestionHeader}>
                <span>💰</span><span style={styles.suggestionName}>收入类</span>
                <span style={styles.suggestionCount}>{suggestions.incomeRecords.length} 条</span>
              </div>
              <div style={styles.suggestionDesc}>含"收入/利息/分成/补贴/版权/期权"</div>
              <button style={styles.classifyBtn} onClick={() => handleBatchClassify(suggestions.incomeRecords, 'income')} disabled={suggestions.incomeRecords.length === 0}>一键归类</button>
            </div>
            <div style={styles.suggestionCard}>
              <div style={styles.suggestionHeader}>
                <span>🔄</span><span style={styles.suggestionName}>往来类</span>
                <span style={styles.suggestionCount}>{suggestions.intercompanyRecords.length} 条</span>
              </div>
              <div style={styles.suggestionDesc}>含"借款/押金/保证金"</div>
              <button style={styles.classifyBtn} onClick={() => handleBatchClassify(suggestions.intercompanyRecords, 'intercompany')} disabled={suggestions.intercompanyRecords.length === 0}>一键归类</button>
            </div>
            <div style={styles.suggestionCard}>
              <div style={styles.suggestionHeader}>
                <span>📋</span><span style={styles.suggestionName}>费用类</span>
                <span style={styles.suggestionCount}>{suggestions.expenseRecords.length} 条</span>
              </div>
              <div style={styles.suggestionDesc}>未匹配关键词，默认归为费用</div>
              <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600, marginTop: '4px' }}>✓ 已自动归类</div>
            </div>
          </div>

          {/* Batch menu + table */}
          <div style={{ ...styles.tableToolbar, marginTop: '16px' }}>
            <span style={styles.sectionHint}>共 {unclassifiedRecords.length} 条待归类</span>
            <div style={styles.batchWrap}>
              <button style={{ ...styles.batchBtn, ...(selectedIds.size === 0 ? { opacity: 0.5 } : {}) }} onClick={() => setBatchMenuOpen(!batchMenuOpen)} disabled={selectedIds.size === 0}>
                批量操作 ({selectedIds.size}) ⌄
              </button>
              {batchMenuOpen && selectedIds.size > 0 && (
                <div style={styles.batchMenu}>
                  <div style={styles.batchMenuItem} onClick={() => handleBatchAction('income')}>标记为收入</div>
                  <div style={styles.batchMenuItem} onClick={() => handleBatchAction('intercompany')}>标记为往来</div>
                  <div style={styles.batchMenuItem} onClick={() => handleBatchAction('expense')}>标记为费用</div>
                </div>
              )}
            </div>
          </div>

          <div style={styles.tableCard}>
            {unclassifiedRecords.length === 0 ? (
              <div style={styles.empty}>没有待归类记录 🎉</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr>
                    <th style={styles.th}><input type="checkbox" checked={selectedIds.size === unclassifiedRecords.length && unclassifiedRecords.length > 0} onChange={() => toggleSelectAll(unclassifiedRecords)} /></th>
                    <th style={styles.th}>日期</th><th style={styles.th}>三级分类</th><th style={styles.th}>部门</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>金额</th><th style={styles.th}>类别</th><th style={styles.th}>建议</th>
                  </tr></thead>
                  <tbody>
                    {unclassifiedRecords.slice(0, 50).map((r, i) => (
                      <tr key={r.id} style={{ ...styles.tr, backgroundColor: i % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}>
                        <td style={styles.td}><input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelect(r.id)} /></td>
                        <td style={styles.td}>{r.date}</td>
                        <td style={styles.td}>{r.categoryL3 || '—'}</td>
                        <td style={styles.td}>{r.department || '—'}</td>
                        <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: 'var(--green)' }}>{displayMoney(r.amountCNY, filter.currencyMode, DEFAULT_USD_RATE)}</td>
                        <td style={styles.td}><select value={r.transactionType} onChange={(e) => updateRecordType([r.id], e.target.value as TransactionType)} style={styles.typeSelect}><option value="expense">费用</option><option value="income">收入</option><option value="intercompany">往来</option></select></td>
                        <td style={styles.td}><span style={styles.suggestionBadge}>{classifySuggestion(r) === 'income' ? '→收入' : classifySuggestion(r) === 'intercompany' ? '→往来' : '→费用'}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {unclassifiedRecords.length > 50 && <div style={styles.moreHint}>共 {unclassifiedRecords.length} 条，显示前 50 条</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TAB: 空值填充 === */}
      {pageTab === 'fillEmpty' && (
        <div>
          <div style={styles.fillHeader}>
            <div>
              <b style={{ fontSize: '14px' }}>部门空值：{deptEmptyRecords.length} 条</b>
              <span style={styles.fillHint}>根据分类和历史数据智能推测所属部门，请审核后确认</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={styles.classifyBtn} onClick={handleAutoSuggestDept} disabled={deptEmptyRecords.length === 0}>
                🔍 智能推测部门
              </button>
              {deptSuggestions.size > 0 && (
                <button style={{ ...styles.classifyBtn, borderColor: 'var(--green)', background: 'var(--green)', color: '#fff' }} onClick={handleConfirmDeptFill}>
                  ✓ 批量确认全部 ({deptSuggestions.size})
                </button>
              )}
            </div>
          </div>

          <div style={styles.tableCard}>
            {deptEmptyRecords.length === 0 ? (
              <div style={styles.empty}>没有部门空值记录 🎉</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr>
                    <th style={styles.th}>日期</th><th style={styles.th}>主体</th><th style={styles.th}>分类</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>金额</th><th style={styles.th}>推测部门</th><th style={styles.th}>操作</th>
                  </tr></thead>
                  <tbody>
                    {deptEmptyRecords.slice(0, 50).map((r, i) => {
                      const suggested = deptSuggestions.get(r.id) || '';
                      return (
                        <tr key={r.id} style={{ ...styles.tr, backgroundColor: i % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}>
                          <td style={styles.td}>{r.date}</td>
                          <td style={styles.td}>{r.person || '—'}</td>
                          <td style={styles.td}>{r.categoryL1}{r.categoryL3 ? `/${r.categoryL3}` : ''}</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{displayMoney(r.amountCNY, filter.currencyMode, DEFAULT_USD_RATE)}</td>
                          <td style={styles.td}>
                            {suggested ? (
                              <input
                                type="text"
                                value={suggested}
                                onChange={(e) => setDeptSuggestions((prev) => { const next = new Map(prev); next.set(r.id, e.target.value); return next; })}
                                style={styles.editInput}
                              />
                            ) : (
                              <span style={{ color: 'var(--muted)', fontSize: '11px' }}>点击"智能推测"</span>
                            )}
                          </td>
                          <td style={styles.td}>
                            {suggested && (
                              <button style={styles.confirmRowBtn} onClick={() => handleConfirmSingleDept(r.id)}>确认</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {deptEmptyRecords.length > 50 && <div style={styles.moreHint}>共 {deptEmptyRecords.length} 条，显示前 50 条</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TAB: 异常数据处理 === */}
      {pageTab === 'abnormal' && (
        <div>
          <div style={styles.fillHeader}>
            <div>
              <b style={{ fontSize: '14px' }}>异常数据：{abnormalRecords.length} 条</b>
              <span style={styles.fillHint}>含日期异常、金额异常、汇率异常、缺失字段等，修正后可重新计入报表</span>
            </div>
            {abnormalRecords.length > 0 && (
              <button style={{ ...styles.classifyBtn, borderColor: 'var(--pink)', background: 'var(--pink-2)', color: 'var(--pink)' }} onClick={handleFixAllAbnormal}>
                全部标记为正常 ({abnormalRecords.length})
              </button>
            )}
          </div>

          <div style={styles.tableCard}>
            {abnormalRecords.length === 0 ? (
              <div style={styles.empty}>没有异常数据 🎉</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr>
                    <th style={styles.th}>日期</th><th style={styles.th}>主体</th><th style={styles.th}>部门</th><th style={styles.th}>分类</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>金额</th><th style={styles.th}>汇率</th><th style={styles.th}>异常原因</th><th style={styles.th}>操作</th>
                  </tr></thead>
                  <tbody>
                    {abnormalRecords.slice(0, 50).map((r, i) => {
                      const issues = detectAbnormality(r);
                      return (
                        <tr key={r.id} style={{ ...styles.tr, backgroundColor: i % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}>
                          <td style={{ ...styles.td, color: issues.includes('日期异常') ? 'var(--pink)' : 'var(--text)' }}>{r.date || '—'}</td>
                          <td style={styles.td}>{r.person || '—'}</td>
                          <td style={styles.td}>{r.department || '—'}</td>
                          <td style={styles.td}>{r.categoryL1 || '—'}</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: issues.some((x) => x.includes('金额')) ? 'var(--pink)' : 'var(--green)' }}>
                            {displayMoney(r.amountCNY, filter.currencyMode, DEFAULT_USD_RATE)}
                          </td>
                          <td style={{ ...styles.td, color: issues.includes('汇率异常') ? 'var(--pink)' : 'var(--text)' }}>{r.exchangeRate}</td>
                          <td style={styles.td}>
                            {issues.map((issue, idx) => (
                              <span key={idx} style={styles.issueBadge}>{issue}</span>
                            ))}
                          </td>
                          <td style={styles.td}>
                            <button style={styles.fixBtn} onClick={() => handleFixAbnormal(r.id)}>修正</button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {abnormalRecords.length > 50 && <div style={styles.moreHint}>共 {abnormalRecords.length} 条，显示前 50 条</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: '0' },
  pageTitle: { fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px 0' },
  qualityGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' },
  qualityCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '16px 18px', textAlign: 'center', transition: 'all .15s' },
  qualityValue: { fontSize: '28px', fontWeight: 700 },
  qualityLabel: { fontSize: '12px', color: 'var(--muted)', marginTop: '4px' },
  tabRow: { display: 'flex', gap: '8px', marginBottom: '16px' },
  tabBtn: { padding: '8px 18px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--muted)', fontSize: '13px', cursor: 'pointer', fontWeight: 600, transition: 'all .15s' },
  tabBtnActive: { backgroundColor: 'var(--green-3)', color: 'var(--green)', borderColor: 'var(--green-2)', fontWeight: 700 },
  suggestionGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' },
  suggestionCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' },
  suggestionHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  suggestionName: { fontSize: '14px', fontWeight: 600, color: 'var(--text)', flex: 1 },
  suggestionCount: { fontSize: '12px', fontWeight: 700, color: 'var(--green)', background: 'var(--green-3)', padding: '2px 8px', borderRadius: '10px' },
  suggestionDesc: { fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' },
  classifyBtn: { padding: '7px 12px', fontSize: '12px', fontWeight: 700, border: '1px solid var(--green)', borderRadius: '5px', background: 'var(--green-3)', color: 'var(--green)', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' },
  tableToolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  sectionHint: { fontSize: '12px', color: 'var(--muted)' },
  batchWrap: { position: 'relative' },
  batchBtn: { padding: '6px 14px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: '12px', fontWeight: 600, cursor: 'pointer' },
  batchMenu: { position: 'absolute', top: '100%', right: 0, marginTop: '4px', background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', zIndex: 20, overflow: 'hidden', minWidth: '120px' },
  batchMenuItem: { padding: '8px 14px', fontSize: '12px', color: 'var(--text)', cursor: 'pointer' },
  tableCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', border: '1px solid var(--line)', padding: '16px 18px' },
  tableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  th: { padding: '8px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', borderBottom: '2px solid var(--line)', whiteSpace: 'nowrap', fontSize: '11px' },
  tr: { transition: 'background-color .12s' },
  td: { padding: '8px 10px', color: 'var(--text)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' },
  typeSelect: { padding: '3px 6px', fontSize: '11px', borderRadius: '4px', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' },
  suggestionBadge: { fontSize: '11px', fontWeight: 600, color: 'var(--green)', background: 'var(--green-3)', padding: '2px 8px', borderRadius: '4px' },
  empty: { textAlign: 'center', color: 'var(--muted)', fontSize: '14px', padding: '40px 0' },
  moreHint: { textAlign: 'center', color: 'var(--muted)', fontSize: '11px', padding: '10px 0 0' },
  fillHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' },
  fillHint: { display: 'block', fontSize: '11px', color: 'var(--muted)', marginTop: '4px' },
  editInput: { width: '120px', height: '26px', padding: '0 8px', fontSize: '12px', border: '1px solid var(--green-2)', borderRadius: '4px', background: 'var(--green-3)', color: 'var(--text)', outline: 'none' },
  confirmRowBtn: { padding: '3px 10px', fontSize: '11px', fontWeight: 700, border: '1px solid var(--green)', borderRadius: '4px', background: 'var(--green)', color: '#fff', cursor: 'pointer' },
  issueBadge: { display: 'inline-block', marginRight: '4px', padding: '2px 6px', fontSize: '10px', fontWeight: 700, borderRadius: '3px', background: 'var(--pink-2)', color: 'var(--pink)' },
  fixBtn: { padding: '3px 10px', fontSize: '11px', fontWeight: 700, border: '1px solid var(--orange)', borderRadius: '4px', background: 'var(--orange-2)', color: 'var(--orange)', cursor: 'pointer' },
};

export default ExpenseGovernancePage;
