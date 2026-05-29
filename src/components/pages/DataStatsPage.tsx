/**
 * 数据统计页面
 * - 查询1：任一月份各项费用支出金额（横向表格，支持L1/L2/L3）
 * - 查询2：任一费用各月支出金额（横向表格，支持L1/L2/L3）
 * - 柱状图1：各项费用累计支出对比（支持L1/L2/L3切换）
 * - 柱状图2：各月费用累计支出对比
 * - 明细表：各月各费用支出明细（支持L1/L2/L3切换）
 */

import { useMemo, useState } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAppStore } from '../../state/store';
import { displayMoney } from '../../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../../utils/constants';

type CatLevel = 'L1' | 'L2' | 'L3';

function getCategoryField(level: CatLevel): 'categoryL1' | 'categoryL2' | 'categoryL3' {
  if (level === 'L1') return 'categoryL1';
  if (level === 'L2') return 'categoryL2';
  return 'categoryL3';
}

function getLevelLabel(level: CatLevel): string {
  if (level === 'L1') return '一级分类';
  if (level === 'L2') return '二级分类';
  return '三级分类';
}

export function DataStatsPage() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const currencyMode = filter.currencyMode;

  // Available months
  const months = useMemo(() => {
    const mSet = new Set<string>();
    for (const r of records) if (r.periodMonth) mSet.add(r.periodMonth);
    return Array.from(mSet).sort();
  }, [records]);

  // State
  const [q1Month, setQ1Month] = useState('');
  const [q1Level, setQ1Level] = useState<CatLevel>('L1');
  const [q2Category, setQ2Category] = useState('');
  const [q2Level, setQ2Level] = useState<CatLevel>('L1');
  const [chart1Level, setChart1Level] = useState<CatLevel>('L1');
  const [detailLevel, setDetailLevel] = useState<CatLevel>('L1');
  const [detailStart, setDetailStart] = useState('');
  const [detailEnd, setDetailEnd] = useState('');

  // Categories for query 2 dropdown (based on q2Level)
  const q2Categories = useMemo(() => {
    const field = getCategoryField(q2Level);
    const set = new Set<string>();
    for (const r of records) { const v = r[field]; if (v) set.add(v); }
    return Array.from(set).sort();
  }, [records, q2Level]);

  // Query 1: selected month → category breakdown (show all categories including zero)
  const q1Data = useMemo(() => {
    const m = q1Month || (months.length > 0 ? months[months.length - 1] : '');
    if (!m) return [];
    const field = getCategoryField(q1Level);
    // Get all categories from all records
    const allCats = new Set<string>();
    for (const r of records) { const v = r[field] || '未分类'; allCats.add(v); }
    // Sum for selected month
    const map = new Map<string, number>();
    for (const cat of allCats) map.set(cat, 0);
    for (const r of records) {
      if (r.periodMonth === m) {
        const key = r[field] || '未分类';
        map.set(key, (map.get(key) ?? 0) + r.amountCNY);
      }
    }
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [records, q1Month, q1Level, months]);

  // Query 2: selected category → monthly breakdown (show all months including zero)
  const q2Data = useMemo(() => {
    const c = q2Category || (q2Categories.length > 0 ? q2Categories[0] : '');
    if (!c) return [];
    const field = getCategoryField(q2Level);
    // Include all months, even if zero
    const map = new Map<string, number>();
    for (const m of months) map.set(m, 0);
    for (const r of records) {
      if (r[field] === c) {
        map.set(r.periodMonth, (map.get(r.periodMonth) ?? 0) + r.amountCNY);
      }
    }
    return Array.from(map.entries()).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
  }, [records, q2Category, q2Level, q2Categories, months]);

  // Chart 1: category cumulative (by selected level)
  const chart1Data = useMemo(() => {
    const field = getCategoryField(chart1Level);
    const map = new Map<string, number>();
    for (const r of records) { const k = r[field] || '未分类'; map.set(k, (map.get(k) ?? 0) + r.amountCNY); }
    return Array.from(map.entries()).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [records, chart1Level]);

  // Chart 2: monthly cumulative
  const chart2Data = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) map.set(r.periodMonth, (map.get(r.periodMonth) ?? 0) + r.amountCNY);
    return Array.from(map.entries()).map(([month, amount]) => ({ month, amount })).sort((a, b) => a.month.localeCompare(b.month));
  }, [records]);

  // Detail table: month × category matrix
  const detailData = useMemo(() => {
    const filteredMonths = months.filter((m) => {
      if (detailStart && m < detailStart) return false;
      if (detailEnd && m > detailEnd) return false;
      return true;
    });
    const field = getCategoryField(detailLevel);
    const catSet = new Set<string>();
    const matrix = new Map<string, Map<string, number>>();
    for (const r of records) {
      if (!filteredMonths.includes(r.periodMonth)) continue;
      const cat = r[field] || '未分类';
      catSet.add(cat);
      if (!matrix.has(r.periodMonth)) matrix.set(r.periodMonth, new Map());
      const row = matrix.get(r.periodMonth)!;
      row.set(cat, (row.get(cat) ?? 0) + r.amountCNY);
    }
    return { months: filteredMonths, categories: Array.from(catSet).sort(), matrix };
  }, [records, months, detailStart, detailEnd, detailLevel]);

  // Department × month matrix
  const [deptStart, setDeptStart] = useState('');
  const [deptEnd, setDeptEnd] = useState('');
  const deptMonthData = useMemo(() => {
    const filteredMonths = months.filter((m) => {
      if (deptStart && m < deptStart) return false;
      if (deptEnd && m > deptEnd) return false;
      return true;
    });
    const deptSet = new Set<string>();
    const matrix = new Map<string, Map<string, number>>(); // month -> dept -> amount
    for (const r of records) {
      if (!filteredMonths.includes(r.periodMonth)) continue;
      const dept = r.department || '未分配';
      deptSet.add(dept);
      if (!matrix.has(r.periodMonth)) matrix.set(r.periodMonth, new Map());
      const row = matrix.get(r.periodMonth)!;
      row.set(dept, (row.get(dept) ?? 0) + r.amountCNY);
    }
    // Sort departments by total amount descending
    const deptTotals = new Map<string, number>();
    for (const dept of deptSet) {
      let total = 0;
      for (const m of filteredMonths) total += matrix.get(m)?.get(dept) ?? 0;
      deptTotals.set(dept, total);
    }
    const departments = Array.from(deptSet).sort((a, b) => (deptTotals.get(b) ?? 0) - (deptTotals.get(a) ?? 0));
    return { months: filteredMonths, departments, matrix, deptTotals };
  }, [records, months, deptStart, deptEnd]);

  // Chart options
  const chart1Option = useMemo(() => ({
    grid: { top: 20, right: 20, bottom: 50, left: 80 },
    tooltip: { trigger: 'axis' as const },
    xAxis: { type: 'category' as const, data: chart1Data.map((d) => d.name), axisLabel: { fontSize: 10, rotate: chart1Data.length > 8 ? 35 : 0, interval: 0 } },
    yAxis: { type: 'value' as const, axisLabel: { fontSize: 10, formatter: (v: number) => `${(v / 10000).toFixed(0)}万` } },
    series: [{ type: 'bar', data: chart1Data.map((d) => d.amount), itemStyle: { color: '#257d60', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28, label: { show: chart1Data.length <= 12, position: 'top', fontSize: 9, formatter: (p: { value: number }) => p.value >= 10000 ? `${(p.value / 10000).toFixed(1)}万` : '' } }],
  }), [chart1Data]);

  const chart2Option = useMemo(() => ({
    grid: { top: 20, right: 20, bottom: 30, left: 60 },
    tooltip: { trigger: 'axis' as const },
    xAxis: { type: 'category' as const, data: chart2Data.map((d) => d.month), axisLabel: { fontSize: 10 } },
    yAxis: { type: 'value' as const, axisLabel: { fontSize: 10, formatter: (v: number) => `${(v / 10000).toFixed(0)}万` } },
    series: [{ type: 'bar', data: chart2Data.map((d) => d.amount), itemStyle: { color: '#3449d8', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 28, label: { show: true, position: 'top', fontSize: 9, formatter: (p: { value: number }) => p.value >= 10000 ? `${(p.value / 10000).toFixed(1)}万` : '' } }],
  }), [chart2Data]);

  const effectiveQ1Month = q1Month || (months.length > 0 ? months[months.length - 1] : '—');
  const effectiveQ2Cat = q2Category || (q2Categories.length > 0 ? q2Categories[0] : '—');

  // Level switcher component
  const LevelSwitch = ({ value, onChange }: { value: CatLevel; onChange: (v: CatLevel) => void }) => (
    <div style={styles.levelSwitch}>
      {(['L1', 'L2', 'L3'] as CatLevel[]).map((lv) => (
        <button key={lv} style={{ ...styles.lvBtn, ...(value === lv ? styles.lvBtnActive : {}) }} onClick={() => onChange(lv)}>
          {getLevelLabel(lv)}
        </button>
      ))}
    </div>
  );

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>数据统计</h2>

      {/* Query 1: Horizontal table */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <b>查询1：{effectiveQ1Month} {getLevelLabel(q1Level)}费用分布</b>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <LevelSwitch value={q1Level} onChange={setQ1Level} />
            <select value={q1Month} onChange={(e) => setQ1Month(e.target.value)} style={styles.select}>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={styles.hTableWrap}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>{getLevelLabel(q1Level)}</th>{q1Data.map((d) => <th key={d.name} style={{ ...styles.th, textAlign: 'right' }}>{d.name}</th>)}</tr></thead>
            <tbody><tr>{<td style={{ ...styles.td, fontWeight: 700 }}>金额</td>}{q1Data.map((d) => <td key={d.name} style={{ ...styles.td, textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{displayMoney(d.amount, currencyMode, DEFAULT_USD_RATE)}</td>)}</tr></tbody>
          </table>
        </div>
      </div>

      {/* Query 2: Horizontal table */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <b>查询2：{effectiveQ2Cat} 各月支出</b>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <LevelSwitch value={q2Level} onChange={setQ2Level} />
            <select value={q2Category} onChange={(e) => setQ2Category(e.target.value)} style={styles.select}>
              {q2Categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div style={styles.hTableWrap}>
          <table style={styles.table}>
            <thead><tr><th style={styles.th}>月份</th>{q2Data.map((d) => <th key={d.month} style={{ ...styles.th, textAlign: 'right' }}>{d.month.slice(5)}月</th>)}</tr></thead>
            <tbody><tr><td style={{ ...styles.td, fontWeight: 700 }}>金额</td>{q2Data.map((d) => <td key={d.month} style={{ ...styles.td, textAlign: 'right', color: 'var(--green)', fontWeight: 600 }}>{displayMoney(d.amount, currencyMode, DEFAULT_USD_RATE)}</td>)}</tr></tbody>
          </table>
        </div>
      </div>

      {/* Charts */}
      <div style={styles.chartGrid}>
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <span style={styles.chartTitle}>各项费用累计支出对比</span>
            <LevelSwitch value={chart1Level} onChange={setChart1Level} />
          </div>
          {chart1Data.length > 0 ? <ReactECharts option={chart1Option} style={{ height: 240 }} notMerge /> : <div style={styles.empty}>暂无数据</div>}
        </div>
        <div style={styles.chartCard}>
          <div style={styles.chartHeader}>
            <span style={styles.chartTitle}>各月费用累计支出对比</span>
          </div>
          {chart2Data.length > 0 ? <ReactECharts option={chart2Option} style={{ height: 240 }} notMerge /> : <div style={styles.empty}>暂无数据</div>}
        </div>
      </div>

      {/* Detail matrix table */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <b>各月各费用支出明细</b>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <LevelSwitch value={detailLevel} onChange={setDetailLevel} />
            <select value={detailStart} onChange={(e) => setDetailStart(e.target.value)} style={styles.select}>
              <option value="">起始月</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ color: 'var(--muted)', fontSize: '11px' }}>至</span>
            <select value={detailEnd} onChange={(e) => setDetailEnd(e.target.value)} style={styles.select}>
              <option value="">结束月</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={styles.detailTableWrap}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>{getLevelLabel(detailLevel)}</th>
                {detailData.months.map((m) => <th key={m} style={{ ...styles.th, textAlign: 'right' }}>{m.slice(5)}月</th>)}
                <th style={{ ...styles.th, textAlign: 'right', color: 'var(--green)' }}>合计</th>
                <th style={{ ...styles.th, textAlign: 'right', color: 'var(--blue)' }}>月均</th>
              </tr>
            </thead>
            <tbody>
              {detailData.categories.map((cat, i) => {
                let rowTotal = 0;
                const cells = detailData.months.map((m) => {
                  const amt = detailData.matrix.get(m)?.get(cat) ?? 0;
                  rowTotal += amt;
                  return amt;
                });
                const avg = detailData.months.length > 0 ? rowTotal / detailData.months.length : 0;
                return (
                  <tr key={cat} style={{ backgroundColor: i % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}>
                    <td style={{ ...styles.td, fontWeight: 600, position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--surface)' : '#f8faf8', zIndex: 1 }}>{cat}</td>
                    {cells.map((amt, ci) => <td key={ci} style={{ ...styles.td, textAlign: 'right' }}>{displayMoney(amt, currencyMode, DEFAULT_USD_RATE)}</td>)}
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{displayMoney(rowTotal, currencyMode, DEFAULT_USD_RATE)}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: 'var(--blue)' }}>{displayMoney(avg, currencyMode, DEFAULT_USD_RATE)}</td>
                  </tr>
                );
              })}
              {/* Total row */}
              <tr style={{ backgroundColor: '#f0f5f2' }}>
                <td style={{ ...styles.td, fontWeight: 800, position: 'sticky', left: 0, background: '#f0f5f2', zIndex: 1 }}>合计</td>
                {detailData.months.map((m) => {
                  let colTotal = 0;
                  const mData = detailData.matrix.get(m);
                  if (mData) for (const amt of mData.values()) colTotal += amt;
                  return <td key={m} style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>{displayMoney(colTotal, currencyMode, DEFAULT_USD_RATE)}</td>;
                })}
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>
                  {displayMoney(detailData.categories.reduce((s, cat) => {
                    let t = 0; for (const m of detailData.months) t += detailData.matrix.get(m)?.get(cat) ?? 0;
                    return s + t;
                  }, 0), currencyMode, DEFAULT_USD_RATE)}
                </td>
                <td style={styles.td}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
      {/* Department × month detail table */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <b>各部门各月费用支出明细</b>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select value={deptStart} onChange={(e) => setDeptStart(e.target.value)} style={styles.select}>
              <option value="">起始月</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <span style={{ color: 'var(--muted)', fontSize: '11px' }}>至</span>
            <select value={deptEnd} onChange={(e) => setDeptEnd(e.target.value)} style={styles.select}>
              <option value="">结束月</option>
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={{ ...styles.th, position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>部门</th>
                {deptMonthData.months.map((m) => <th key={m} style={{ ...styles.th, textAlign: 'right' }}>{m.slice(5)}月</th>)}
                <th style={{ ...styles.th, textAlign: 'right', color: 'var(--green)' }}>合计</th>
                <th style={{ ...styles.th, textAlign: 'right', color: 'var(--blue)' }}>月均</th>
              </tr>
            </thead>
            <tbody>
              {deptMonthData.departments.map((dept, i) => {
                const total = deptMonthData.deptTotals.get(dept) ?? 0;
                const avg = deptMonthData.months.length > 0 ? total / deptMonthData.months.length : 0;
                return (
                  <tr key={dept} style={{ backgroundColor: i % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}>
                    <td style={{ ...styles.td, fontWeight: 600, position: 'sticky', left: 0, background: i % 2 === 0 ? 'var(--surface)' : '#f8faf8', zIndex: 1 }}>{dept}</td>
                    {deptMonthData.months.map((m) => {
                      const amt = deptMonthData.matrix.get(m)?.get(dept) ?? 0;
                      return <td key={m} style={{ ...styles.td, textAlign: 'right' }}>{displayMoney(amt, currencyMode, DEFAULT_USD_RATE)}</td>;
                    })}
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 700, color: 'var(--green)' }}>{displayMoney(total, currencyMode, DEFAULT_USD_RATE)}</td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600, color: 'var(--blue)' }}>{displayMoney(avg, currencyMode, DEFAULT_USD_RATE)}</td>
                  </tr>
                );
              })}
              <tr style={{ backgroundColor: '#f0f5f2' }}>
                <td style={{ ...styles.td, fontWeight: 800, position: 'sticky', left: 0, background: '#f0f5f2', zIndex: 1 }}>合计</td>
                {deptMonthData.months.map((m) => {
                  let colTotal = 0;
                  const mData = deptMonthData.matrix.get(m);
                  if (mData) for (const amt of mData.values()) colTotal += amt;
                  return <td key={m} style={{ ...styles.td, textAlign: 'right', fontWeight: 700 }}>{displayMoney(colTotal, currencyMode, DEFAULT_USD_RATE)}</td>;
                })}
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800, color: 'var(--green)' }}>
                  {displayMoney(Array.from(deptMonthData.deptTotals.values()).reduce((s, v) => s + v, 0), currencyMode, DEFAULT_USD_RATE)}
                </td>
                <td style={styles.td}></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: { padding: 0 },
  pageTitle: { fontSize: '20px', fontWeight: 600, color: 'var(--text)', margin: '0 0 16px' },
  section: { background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', border: '1px solid var(--line)', padding: '14px 16px', marginBottom: '12px' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' },
  select: { height: '28px', padding: '0 8px', border: '1px solid var(--line)', borderRadius: '5px', background: '#fbfcfb', color: 'var(--text)', fontSize: '11px', fontWeight: 700 },
  levelSwitch: { display: 'flex', gap: '4px' },
  lvBtn: { padding: '4px 8px', fontSize: '10px', fontWeight: 700, border: '1px solid var(--line)', borderRadius: '4px', background: '#fbfcfb', color: 'var(--muted)', cursor: 'pointer' },
  lvBtnActive: { border: '1px solid var(--green)', background: 'var(--green-3)', color: 'var(--green)' },
  hTableWrap: { overflowX: 'auto' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: '12px' },
  th: { padding: '7px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--muted)', borderBottom: '2px solid var(--line)', fontSize: '11px', whiteSpace: 'nowrap' },
  td: { padding: '6px 10px', color: 'var(--text)', borderBottom: '1px solid var(--line)', whiteSpace: 'nowrap' },
  chartGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' },
  chartCard: { background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', border: '1px solid var(--line)', padding: '14px 16px' },
  chartHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  chartTitle: { fontSize: '13px', fontWeight: 700, color: 'var(--text)' },
  empty: { textAlign: 'center', color: 'var(--muted)', fontSize: '13px', padding: '40px 0' },
  detailTableWrap: { overflowX: 'auto', maxHeight: '420px', overflowY: 'auto' },
};

export default DataStatsPage;
