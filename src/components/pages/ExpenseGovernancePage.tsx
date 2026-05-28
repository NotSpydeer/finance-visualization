/**
 * 费用治理页面
 * Tab切换：待归类处理 / 空值填充 / 异常数据处理
 * - 待归类：点击分类卡片筛选，一键归类前需用户确认
 * - 空值填充：智能推测 + 用户确认
 * - 异常数据：用户选择修正方式后确认
 */

import { useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../../state/store';
import { displayMoney } from '../../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../../utils/constants';
import type { ExpenseRecord, TransactionType } from '../../types/expense';

type PageTab = 'classify' | 'fillEmpty' | 'abnormal';
type ClassifyFilter = 'all' | 'income' | 'intercompany' | 'expense';

const INCOME_KEYWORDS = ['收入', '利息', '分成', '补贴', '版权', '期权'];
const INTERCOMPANY_KEYWORDS = ['借款', '押金', '保证金'];

function classifySuggestion(record: ExpenseRecord): 'income' | 'intercompany' | 'expense' {
  const text = record.categoryL3 || '';
  if (INCOME_KEYWORDS.some((kw) => text.includes(kw))) return 'income';
  if (INTERCOMPANY_KEYWORDS.some((kw) => text.includes(kw))) return 'intercompany';
  return 'expense';
}

function inferDepartment(record: ExpenseRecord, allRecords: ExpenseRecord[]): string {
  const candidates = allRecords.filter(
    (r) => r.department && r.department !== '未分配部门' &&
      (r.categoryL1 === record.categoryL1 || r.categoryL3 === record.categoryL3)
  );
  if (candidates.length === 0) return '未分配部门';
  const deptCount = new Map<string, number>();
  for (const c of candidates) deptCount.set(c.department, (deptCount.get(c.department) ?? 0) + 1);
  let best = ''; let bestCount = 0;
  for (const [dept, count] of deptCount) { if (count > bestCount) { best = dept; bestCount = count; } }
  return best || '未分配部门';
}

function detectAbnormality(record: ExpenseRecord): string[] {
  const issues: string[] = [];
  if (!record.date || record.date === '1900-01-01') issues.push('日期异常');
  if (record.amountCNY <= 0) issues.push('金额为零或负数');
  if (record.amountCNY > 10000000) issues.push('金额异常大');
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
  const [classifyFilter, setClassifyFilter] = useState<ClassifyFilter>('all');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    show: boolean;
    title: string;
    message: string;
    count: number;
    onConfirm: () => void;
  }>({ show: false, title: '', message: '', count: 0, onConfirm: () => {} });

  // Abnormal edit state: which record is being edited, what field, what value
  const [editingAbnormal, setEditingAbnormal] = useState<string | null>(null);
  const [abnormalAction, setAbnormalAction] = useState<'markNormal' | 'delete'>('markNormal');

  // Empty fill state
  const [deptSuggestions, setDeptSuggestions] = useState<Map<string, string>>(new Map());

  // === Data ===
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

  const suggestions = useMemo(() => {
    const income: ExpenseRecord[] = [];
    const intercompany: ExpenseRecord[] = [];
    const expense: ExpenseRecord[] = [];
    for (const r of unclassifiedRecords) {
      const s = classifySuggestion(r);
      if (s === 'income') income.push(r);
      else if (s === 'intercompany') intercompany.push(r);
      else expense.push(r);
    }
    return { income, intercompany, expense };
  }, [unclassifiedRecords]);

  // Filtered table based on card selection
  const classifyTableRecords = useMemo(() => {
    if (classifyFilter === 'income') return suggestions.income;
    if (classifyFilter === 'intercompany') return suggestions.intercompany;
    if (classifyFilter === 'expense') return suggestions.expense;
    return unclassifiedRecords;
  }, [classifyFilter, suggestions, unclassifiedRecords]);

  // === Handlers ===
  const showConfirm = useCallback((title: string, message: string, count: number, onConfirm: () => void) => {
    setConfirmDialog({ show: true, title, message, count, onConfirm });
  }, []);

  const handleConfirmClose = useCallback(() => {
    setConfirmDialog({ show: false, title: '', message: '', count: 0, onConfirm: () => {} });
  }, []);

  const handleConfirmOk = useCallback(() => {
    confirmDialog.onConfirm();
    handleConfirmClose();
  }, [confirmDialog, handleConfirmClose]);

  // One-click classify with confirmation
  const handleBatchClassifyConfirm = useCallback((list: ExpenseRecord[], type: TransactionType, typeName: string) => {
    if (list.length === 0) return;
    showConfirm(
      `确认一键归类为"${typeName}"`,
      `将以下 ${list.length} 条记录归类为"${typeName}"，包括：${list.slice(0, 3).map(r => r.categoryL3 || r.date).join('、')}${list.length > 3 ? '...' : ''}`,
      list.length,
      () => updateRecordType(list.map(r => r.id), type)
    );
  }, [showConfirm, updateRecordType]);

  // Batch selected with confirmation
  const handleBatchSelectedConfirm = useCallback((type: TransactionType, typeName: string) => {
    if (selectedIds.size === 0) return;
    showConfirm(
      `确认批量标记为"${typeName}"`,
      `将选中的 ${selectedIds.size} 条记录标记为"${typeName}"`,
      selectedIds.size,
      () => { updateRecordType(Array.from(selectedIds), type); setSelectedIds(new Set()); }
    );
  }, [selectedIds, showConfirm, updateRecordType]);

  // Abnormal: confirm fix
  const handleFixAbnormalConfirm = useCallback((id: string) => {
    showConfirm(
      '确认修正异常记录',
      abnormalAction === 'markNormal'
        ? '将此记录标记为正常，重新计入报表统计。'
        : '将此记录标记为正常（数据已人工核实）。',
      1,
      () => { updateRecordFields([id], { importStatus: 'normal' }); setEditingAbnormal(null); }
    );
  }, [abnormalAction, showConfirm, updateRecordFields]);

  // Empty fill
  const handleAutoSuggestDept = useCallback(() => {
    const newMap = new Map<string, string>();
    for (const r of deptEmptyRecords) newMap.set(r.id, inferDepartment(r, records));
    setDeptSuggestions(newMap);
  }, [deptEmptyRecords, records]);

  const handleConfirmDeptFill = useCallback(() => {
    const entries = Array.from(deptSuggestions.entries());
    if (entries.length === 0) return;
    showConfirm(
      '确认批量填充部门',
      `将为 ${entries.length} 条记录填充推测的部门值`,
      entries.length,
      () => { for (const [id, dept] of entries) updateRecordFields([id], { department: dept }); setDeptSuggestions(new Map()); }
    );
  }, [deptSuggestions, showConfirm, updateRecordFields]);

  const handleConfirmSingleDept = useCallback((id: string) => {
    const dept = deptSuggestions.get(id);
    if (!dept) return;
    updateRecordFields([id], { department: dept });
    setDeptSuggestions((prev) => { const next = new Map(prev); next.delete(id); return next; });
  }, [deptSuggestions, updateRecordFields]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  };
  const toggleSelectAll = (list: ExpenseRecord[]) => {
    if (selectedIds.size === list.length && list.length > 0) setSelectedIds(new Set());
    else setSelectedIds(new Set(list.map((r) => r.id)));
  };

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>费用治理</h2>

      {/* Confirmation Dialog */}
      {confirmDialog.show && (
        <div style={styles.dialogBackdrop}>
          <div style={styles.dialog}>
            <h3 style={styles.dialogTitle}>{confirmDialog.title}</h3>
            <p style={styles.dialogMsg}>{confirmDialog.message}</p>
            <p style={styles.dialogCount}>影响记录数：<b>{confirmDialog.count}</b></p>
            <div style={styles.dialogActions}>
              <button style={styles.dialogCancel} onClick={handleConfirmClose}>取消</button>
              <button style={styles.dialogOk} onClick={handleConfirmOk}>确认执行</button>
            </div>
          </div>
        </div>
      )}

      {/* Quality overview */}
      <div style={styles.qualityGrid}>
        <div style={{ ...styles.qualityCard, ...(pageTab === 'classify' ? styles.qualityCardActive : {}) }} onClick={() => setPageTab('classify')}>
          <div style={styles.qualityValue}>{unclassifiedRecords.length}</div>
          <div style={styles.qualityLabel}>待归类</div>
        </div>
        <div style={{ ...styles.qualityCard, ...(pageTab === 'fillEmpty' ? styles.qualityCardActive : {}) }} onClick={() => setPageTab('fillEmpty')}>
          <div style={{ ...styles.qualityValue, color: 'var(--orange)' }}>{deptEmptyRecords.length}</div>
          <div style={styles.qualityLabel}>空值待填充</div>
        </div>
        <div style={{ ...styles.qualityCard, ...(pageTab === 'abnormal' ? styles.qualityCardActive : {}) }} onClick={() => setPageTab('abnormal')}>
          <div style={{ ...styles.qualityValue, color: 'var(--pink)' }}>{abnormalRecords.length}</div>
          <div style={styles.qualityLabel}>异常数据</div>
        </div>
      </div>

      {/* === TAB: 待归类 === */}
      {pageTab === 'classify' && (
        <div>
          {/* Category cards - clickable to filter table */}
          <div style={styles.suggestionGrid}>
            <div style={{ ...styles.suggestionCard, ...(classifyFilter === 'income' ? styles.cardSelected : {}) }} onClick={() => setClassifyFilter(classifyFilter === 'income' ? 'all' : 'income')}>
              <div style={styles.suggestionHeader}><span>💰</span><span style={styles.suggestionName}>收入类</span><span style={styles.suggestionCount}>{suggestions.income.length}</span></div>
              <div style={styles.suggestionDesc}>含"收入/利息/分成/补贴/版权/期权"</div>
              <button style={styles.classifyBtn} onClick={(e) => { e.stopPropagation(); handleBatchClassifyConfirm(suggestions.income, 'income', '收入'); }} disabled={suggestions.income.length === 0}>一键归类为收入</button>
            </div>
            <div style={{ ...styles.suggestionCard, ...(classifyFilter === 'intercompany' ? styles.cardSelected : {}) }} onClick={() => setClassifyFilter(classifyFilter === 'intercompany' ? 'all' : 'intercompany')}>
              <div style={styles.suggestionHeader}><span>🔄</span><span style={styles.suggestionName}>往来类</span><span style={styles.suggestionCount}>{suggestions.intercompany.length}</span></div>
              <div style={styles.suggestionDesc}>含"借款/押金/保证金"</div>
              <button style={styles.classifyBtn} onClick={(e) => { e.stopPropagation(); handleBatchClassifyConfirm(suggestions.intercompany, 'intercompany', '往来'); }} disabled={suggestions.intercompany.length === 0}>一键归类为往来</button>
            </div>
            <div style={{ ...styles.suggestionCard, ...(classifyFilter === 'expense' ? styles.cardSelected : {}) }} onClick={() => setClassifyFilter(classifyFilter === 'expense' ? 'all' : 'expense')}>
              <div style={styles.suggestionHeader}><span>📋</span><span style={styles.suggestionName}>费用类</span><span style={styles.suggestionCount}>{suggestions.expense.length}</span></div>
              <div style={styles.suggestionDesc}>未匹配关键词，默认费用</div>
              <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: 600, marginTop: '4px' }}>✓ 已自动归类</div>
            </div>
          </div>

          {/* Batch actions */}
          <div style={styles.tableToolbar}>
            <span style={styles.sectionHint}>{classifyFilter === 'all' ? '全部' : classifyFilter === 'income' ? '收入类' : classifyFilter === 'intercompany' ? '往来类' : '费用类'}：{classifyTableRecords.length} 条</span>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button style={styles.batchBtn} onClick={() => handleBatchSelectedConfirm('income', '收入')} disabled={selectedIds.size === 0}>→收入 ({selectedIds.size})</button>
              <button style={styles.batchBtn} onClick={() => handleBatchSelectedConfirm('intercompany', '往来')} disabled={selectedIds.size === 0}>→往来 ({selectedIds.size})</button>
              <button style={styles.batchBtn} onClick={() => handleBatchSelectedConfirm('expense', '费用')} disabled={selectedIds.size === 0}>→费用 ({selectedIds.size})</button>
            </div>
          </div>

          {/* Table */}
          <div style={styles.tableCard}>
            {classifyTableRecords.length === 0 ? (
              <div style={styles.empty}>没有待归类记录 🎉</div>
            ) : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr>
                    <th style={styles.th}><input type="checkbox" checked={selectedIds.size === classifyTableRecords.length && classifyTableRecords.length > 0} onChange={() => toggleSelectAll(classifyTableRecords)} /></th>
                    <th style={styles.th}>日期</th><th style={styles.th}>三级分类</th><th style={styles.th}>部门</th>
                    <th style={{ ...styles.th, textAlign: 'right' }}>金额</th><th style={styles.th}>类别</th><th style={styles.th}>建议</th>
                  </tr></thead>
                  <tbody>
                    {classifyTableRecords.slice(0, 50).map((r, i) => (
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
                {classifyTableRecords.length > 50 && <div style={styles.moreHint}>共 {classifyTableRecords.length} 条，显示前 50 条</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TAB: 空值填充 === */}
      {pageTab === 'fillEmpty' && (
        <div>
          <div style={styles.fillHeader}>
            <div><b style={{ fontSize: '14px' }}>部门空值：{deptEmptyRecords.length} 条</b><span style={styles.fillHint}>根据分类和历史数据智能推测所属部门，请审核后确认</span></div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button style={styles.classifyBtn} onClick={handleAutoSuggestDept} disabled={deptEmptyRecords.length === 0}>🔍 智能推测部门</button>
              {deptSuggestions.size > 0 && <button style={{ ...styles.classifyBtn, border: '1px solid var(--green)', background: 'var(--green)', color: '#fff' }} onClick={handleConfirmDeptFill}>✓ 批量确认 ({deptSuggestions.size})</button>}
            </div>
          </div>
          <div style={styles.tableCard}>
            {deptEmptyRecords.length === 0 ? <div style={styles.empty}>没有部门空值记录 🎉</div> : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>日期</th><th style={styles.th}>主体</th><th style={styles.th}>分类</th><th style={{ ...styles.th, textAlign: 'right' }}>金额</th><th style={styles.th}>推测部门</th><th style={styles.th}>操作</th></tr></thead>
                  <tbody>
                    {deptEmptyRecords.slice(0, 50).map((r, i) => {
                      const suggested = deptSuggestions.get(r.id) || '';
                      return (
                        <tr key={r.id} style={{ ...styles.tr, backgroundColor: i % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}>
                          <td style={styles.td}>{r.date}</td><td style={styles.td}>{r.person || '—'}</td>
                          <td style={styles.td}>{r.categoryL1}{r.categoryL3 ? `/${r.categoryL3}` : ''}</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{displayMoney(r.amountCNY, filter.currencyMode, DEFAULT_USD_RATE)}</td>
                          <td style={styles.td}>{suggested ? <input type="text" value={suggested} onChange={(e) => setDeptSuggestions((prev) => { const next = new Map(prev); next.set(r.id, e.target.value); return next; })} style={styles.editInput} /> : <span style={{ color: 'var(--muted)', fontSize: '11px' }}>点击"智能推测"</span>}</td>
                          <td style={styles.td}>{suggested && <button style={styles.confirmRowBtn} onClick={() => handleConfirmSingleDept(r.id)}>确认</button>}</td>
                        </tr>);
                    })}
                  </tbody>
                </table>
                {deptEmptyRecords.length > 50 && <div style={styles.moreHint}>共 {deptEmptyRecords.length} 条</div>}
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TAB: 异常数据 === */}
      {pageTab === 'abnormal' && (
        <div>
          <div style={styles.fillHeader}>
            <div><b style={{ fontSize: '14px' }}>异常数据：{abnormalRecords.length} 条</b><span style={styles.fillHint}>请逐条核查并选择修正方式，确认后方可计入报表</span></div>
          </div>
          <div style={styles.tableCard}>
            {abnormalRecords.length === 0 ? <div style={styles.empty}>没有异常数据 🎉</div> : (
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead><tr><th style={styles.th}>日期</th><th style={styles.th}>主体</th><th style={styles.th}>部门</th><th style={styles.th}>分类</th><th style={{ ...styles.th, textAlign: 'right' }}>金额</th><th style={styles.th}>汇率</th><th style={styles.th}>异常原因</th><th style={styles.th}>操作</th></tr></thead>
                  <tbody>
                    {abnormalRecords.slice(0, 50).map((r, i) => {
                      const issues = detectAbnormality(r);
                      const isEditing = editingAbnormal === r.id;
                      return (
                        <tr key={r.id} style={{ ...styles.tr, backgroundColor: isEditing ? 'var(--green-3)' : i % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}>
                          <td style={{ ...styles.td, color: issues.includes('日期异常') ? 'var(--pink)' : 'var(--text)' }}>{r.date || '—'}</td>
                          <td style={styles.td}>{r.person || '—'}</td>
                          <td style={styles.td}>{r.department || '—'}</td>
                          <td style={styles.td}>{r.categoryL1 || '—'}</td>
                          <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: issues.some(x => x.includes('金额')) ? 'var(--pink)' : 'var(--green)' }}>{displayMoney(r.amountCNY, filter.currencyMode, DEFAULT_USD_RATE)}</td>
                          <td style={{ ...styles.td, color: issues.includes('汇率异常') ? 'var(--pink)' : 'var(--text)' }}>{r.exchangeRate}</td>
                          <td style={styles.td}>{issues.map((issue, idx) => <span key={idx} style={styles.issueBadge}>{issue}</span>)}</td>
                          <td style={styles.td}>
                            {isEditing ? (
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <select value={abnormalAction} onChange={(e) => setAbnormalAction(e.target.value as 'markNormal' | 'delete')} style={styles.typeSelect}>
                                  <option value="markNormal">标记正常</option>
                                </select>
                                <button style={styles.confirmRowBtn} onClick={() => handleFixAbnormalConfirm(r.id)}>确认</button>
                                <button style={{ ...styles.confirmRowBtn, background: 'var(--surface)', color: 'var(--muted)', border: '1px solid var(--line)' }} onClick={() => setEditingAbnormal(null)}>取消</button>
                              </div>
                            ) : (
                              <button style={styles.fixBtn} onClick={() => setEditingAbnormal(r.id)}>修正</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {abnormalRecords.length > 50 && <div style={styles.moreHint}>共 {abnormalRecords.length} 条</div>}
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
  qualityCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '16px 18px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s' },
  qualityCardActive: { border: '1px solid var(--green-2)', background: 'var(--green-3)' },
  qualityValue: { fontSize: '28px', fontWeight: 700, color: 'var(--text)' },
  qualityLabel: { fontSize: '12px', color: 'var(--muted)', marginTop: '4px' },
  suggestionGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '12px' },
  suggestionCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--line)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px', cursor: 'pointer', transition: 'all .15s' },
  cardSelected: { border: '1px solid var(--green-2)', background: 'var(--green-3)' },
  suggestionHeader: { display: 'flex', alignItems: 'center', gap: '8px' },
  suggestionName: { fontSize: '14px', fontWeight: 600, color: 'var(--text)', flex: 1 },
  suggestionCount: { fontSize: '12px', fontWeight: 700, color: 'var(--green)', background: 'var(--green-3)', padding: '2px 8px', borderRadius: '10px' },
  suggestionDesc: { fontSize: '11px', color: 'var(--muted)', lineHeight: '1.4' },
  classifyBtn: { padding: '7px 12px', fontSize: '12px', fontWeight: 700, border: '1px solid var(--green)', borderRadius: '5px', background: 'var(--green-3)', color: 'var(--green)', cursor: 'pointer', textAlign: 'center', transition: 'all .15s' },
  tableToolbar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' },
  sectionHint: { fontSize: '12px', color: 'var(--muted)' },
  batchBtn: { padding: '6px 12px', borderRadius: 'var(--radius)', border: '1px solid var(--line)', background: 'var(--surface)', color: 'var(--text)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' },
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
  // Confirmation dialog
  dialogBackdrop: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(16, 24, 20, .3)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dialog: { background: 'var(--surface)', borderRadius: '12px', padding: '24px 28px', boxShadow: '0 20px 60px rgba(0,0,0,.18)', maxWidth: '420px', width: '90%' },
  dialogTitle: { margin: '0 0 8px', fontSize: '16px', fontWeight: 700, color: 'var(--text)' },
  dialogMsg: { margin: '0 0 8px', fontSize: '13px', color: 'var(--muted)', lineHeight: '1.5' },
  dialogCount: { margin: '0 0 16px', fontSize: '13px', color: 'var(--text)' },
  dialogActions: { display: 'flex', gap: '10px', justifyContent: 'flex-end' },
  dialogCancel: { padding: '8px 18px', fontSize: '13px', border: '1px solid var(--line)', borderRadius: '6px', background: 'var(--surface)', color: 'var(--muted)', cursor: 'pointer', fontWeight: 600 },
  dialogOk: { padding: '8px 18px', fontSize: '13px', border: '1px solid var(--green)', borderRadius: '6px', background: 'var(--green)', color: '#fff', cursor: 'pointer', fontWeight: 700 },
};

export default ExpenseGovernancePage;
