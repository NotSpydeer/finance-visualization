/**
 * 部门费用详情组件
 * 设计参考：finance-game-dashboard-sample3.html .dept-summary + .dept-trend + .drill-list
 * 3个统计块 + 带月份标签的CSS柱图 + Top明细列表
 * Requirements: 14.1-14.4
 */

import { useMemo, useCallback } from 'react';
import { useAppStore } from '../state/store';
import { getDepartmentDetail } from '../data/selectors';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';
import type { ExpenseRecord } from '../types/expense';

export default function DepartmentDetail() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  const detail = useMemo(() => getDepartmentDetail(records, filter), [records, filter]);
  const currencyMode = filter.currencyMode;

  // Compute max for trend bar heights
  const trendMax = useMemo(() => {
    if (detail.trend.length === 0) return 1;
    return Math.max(...detail.trend.map((t) => t.amount), 1);
  }, [detail.trend]);

  const handleOpenDrawer = useCallback(() => {
    // Removed - no drawer from this button
  }, []);

  const handleRecordCountClick = useCallback(() => {
    setCurrentPage('明细查询');
  }, [setCurrentPage]);

  const handleRecordClick = useCallback((record: ExpenseRecord) => {
    openDrawer({
      type: 'detail',
      title: '明细详情',
      amount: record.amountCNY,
      recordCount: 1,
      maxSingle: record.amountCNY,
      topCategories: [{ name: record.categoryL1, amount: record.amountCNY }],
      topDepartments: [{ name: record.department, amount: record.amountCNY }],
      topRecords: [record],
    });
  }, [openDrawer]);

  if (detail.recordCount === 0) {
    return (
      <div style={styles.card} role="region" aria-label="部门费用详情">
        <div style={styles.header}>
          <h2 className="card-title-bar blue">费用详情</h2>
        </div>
        <div style={styles.empty}>当前筛选条件下暂无数据</div>
      </div>
    );
  }

  // Build summary title: department + category path
  const summaryTitle = `${detail.department}${filter.categoryL1 ? ` / ${filter.categoryL1}` : ''}${filter.categoryL2 ? ` / ${filter.categoryL2}` : ''}`;

  return (
    <div style={styles.card} role="region" aria-label="部门费用详情">
      <div style={styles.header}>
        <h2 className="card-title-bar blue">{filter.department ? '部门费用详情' : '费用详情'}</h2>
        <button style={styles.drawerBtn} onClick={handleOpenDrawer}>查看原因</button>
      </div>

      {/* 3 bordered stat blocks like prototype .dept-summary */}
      <div style={styles.statsRow}>
        <span style={styles.statBlock}>
          <b style={styles.statValue}>{displayMoney(detail.totalAmount, currencyMode, DEFAULT_USD_RATE)}</b>
          <span style={styles.statLabel}>{summaryTitle}</span>
        </span>
        <span style={styles.statBlock}>
          <b style={{ ...styles.statValue, cursor: 'pointer', color: 'var(--green)' }} onClick={handleRecordCountClick}>{detail.recordCount} 笔</b>
          <span style={styles.statLabel}>当前筛选命中 <span style={{ color: 'var(--green)', fontSize: '10px' }}>→查看</span></span>
        </span>
        <span style={styles.statBlock}>
          <b style={styles.statValue}>{currencyMode === 'CNY' ? 'RMB' : 'USD'}</b>
          <span style={styles.statLabel}>金额口径</span>
        </span>
      </div>

      {/* Trend bars with month labels - shows what data each bar represents */}
      {detail.trend.length > 0 && (
        <div style={styles.trendSection}>
          <div style={styles.trendTitle}>近 {detail.trend.length} 期月度费用趋势</div>
          <div style={styles.trendRow}>
            {detail.trend.map((t, i) => {
              const heightPct = Math.max(8, (t.amount / trendMax) * 100);
              return (
                <div key={i} style={styles.trendCol}>
                  {/* Amount label on top */}
                  <span style={styles.trendAmount}>
                    {t.amount >= 10000 ? `${(t.amount / 10000).toFixed(1)}万` : t.amount > 0 ? `${Math.round(t.amount)}` : ''}
                  </span>
                  {/* Bar */}
                  <div
                    style={{
                      ...styles.trendBar,
                      height: `${heightPct}%`,
                    }}
                    title={`${t.label}: ${displayMoney(t.amount, currencyMode, DEFAULT_USD_RATE)}`}
                  />
                  {/* Month label below */}
                  <span style={styles.trendMonthLabel}>{t.label.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Top4 records like prototype .drill-list */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>金额最高明细</div>
        {detail.topRecords.length === 0 ? (
          <div style={styles.emptySmall}>暂无明细</div>
        ) : (
          <div style={styles.recordList}>
            {detail.topRecords.map((r) => (
              <div key={r.id} style={styles.drillItem} onClick={() => handleRecordClick(r)}>
                <div style={styles.drillLeft}>
                  <span style={styles.drillName}>{r.categoryL2 || r.categoryL1}{r.categoryL3 ? ` / ${r.categoryL3}` : ''}</span>
                  <small style={styles.drillSub}>{r.date}｜{r.bankAccount}</small>
                </div>
                <b style={styles.drillAmount}>
                  {displayMoney(r.amountCNY, currencyMode, DEFAULT_USD_RATE)}
                </b>
              </div>
            ))}
          </div>
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
    marginBottom: '12px',
  },
  drawerBtn: {
    height: '28px',
    padding: '0 10px',
    border: '1px solid var(--line)',
    borderRadius: '4px',
    background: 'var(--surface)',
    color: 'var(--muted)',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
    gap: '8px',
    marginBottom: '12px',
  },
  statBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '8px',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    background: '#fbfcfb',
  },
  statValue: {
    display: 'block',
    color: 'var(--text)',
    fontSize: '15px',
    fontWeight: 700,
  },
  statLabel: {
    color: 'var(--muted)',
    fontSize: '11px',
  },
  trendSection: {
    marginBottom: '14px',
  },
  trendTitle: {
    fontSize: '12px',
    color: 'var(--muted)',
    fontWeight: 500,
    marginBottom: '6px',
  },
  trendRow: {
    height: '100px',
    display: 'flex',
    alignItems: 'flex-end',
    gap: '6px',
    paddingBottom: '0',
  },
  trendCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
    height: '100%',
    minWidth: 0,
  },
  trendAmount: {
    fontSize: '9px',
    fontWeight: 700,
    color: 'var(--green)',
    marginBottom: '2px',
    whiteSpace: 'nowrap',
  },
  trendBar: {
    width: '100%',
    maxWidth: '28px',
    minHeight: '4px',
    borderRadius: '4px 4px 0 0',
    background: 'rgba(37, 125, 96, .24)',
    transition: 'height .3s',
  },
  trendMonthLabel: {
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '4px',
    fontWeight: 800,
  },
  section: {
    marginTop: '4px',
  },
  sectionTitle: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginBottom: '8px',
    fontWeight: 500,
  },
  recordList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  drillItem: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '10px',
    alignItems: 'center',
    padding: '9px 10px',
    border: '1px solid var(--line)',
    borderRadius: '6px',
    background: '#fbfcfb',
    cursor: 'pointer',
    transition: 'all .18s',
  },
  drillLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  drillName: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  drillSub: {
    fontSize: '11px',
    color: 'var(--muted)',
  },
  drillAmount: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--green)',
    flexShrink: 0,
  },
  empty: {
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '13px',
    padding: '24px 0',
  },
  emptySmall: {
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '12px',
    padding: '14px 0',
  },
};
