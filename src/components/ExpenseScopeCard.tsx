/**
 * 费用口径卡片组件
 * 显示确认费用与待确认的百分比和金额拆分条
 * 原型: dashboard-side 顶部卡片 (148px)
 */

import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { getKpis } from '../data/selectors';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';

export function ExpenseScopeCard() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);

  const kpis = useMemo(() => getKpis(records, filter), [records, filter]);

  const total = kpis.confirmedExpense + kpis.pendingAmount;
  const confirmedPercent = total > 0 ? Math.round((kpis.confirmedExpense / total) * 100) : 0;
  const pendingPercent = total > 0 ? 100 - confirmedPercent : 0;

  return (
    <div style={styles.card} role="region" aria-label="费用口径">
      <div style={styles.header}>
        <h2 className="card-title-bar blue">费用口径</h2>
        <span style={styles.more}>...</span>
      </div>
      <div style={styles.body}>
        <div style={styles.row}>
          <div>
            <div style={styles.labelBtn}>确认费用</div>
            <div style={styles.percent}>{confirmedPercent}%</div>
            <div style={styles.sub}>{displayMoney(kpis.confirmedExpense, filter.currencyMode, DEFAULT_USD_RATE)}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={styles.labelBtn}>待确认</div>
            <div style={styles.percent}>{pendingPercent}%</div>
            <div style={styles.sub}>{displayMoney(kpis.pendingAmount, filter.currencyMode, DEFAULT_USD_RATE)}</div>
          </div>
        </div>
        <div style={styles.splitBar}>
          <span style={{ ...styles.splitConfirmed, width: `${confirmedPercent}%` }} />
          <span style={{ ...styles.splitPending, width: `${pendingPercent}%` }} />
        </div>
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
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 6px',
  },
  more: {
    color: 'var(--muted)',
    fontWeight: 800,
    cursor: 'pointer',
  },
  body: {
    flex: 1,
    display: 'grid',
    alignContent: 'center',
    padding: '4px 16px 14px',
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr auto',
    gap: '12px',
    alignItems: 'end',
    marginBottom: '12px',
  },
  labelBtn: {
    display: 'inline-block',
    height: '24px',
    padding: '0 8px',
    border: '1px solid var(--line)',
    borderRadius: '4px',
    background: 'var(--surface)',
    color: 'var(--muted)',
    fontSize: '11px',
    fontWeight: 700,
    lineHeight: '24px',
    marginBottom: '4px',
  },
  percent: {
    fontSize: '28px',
    fontWeight: 900,
    color: 'var(--text)',
  },
  sub: {
    color: 'var(--muted)',
    fontSize: '12px',
  },
  splitBar: {
    display: 'flex',
    height: '16px',
    overflow: 'hidden',
    borderRadius: '999px',
    background: '#edf3f0',
    boxShadow: 'inset 0 0 0 1px rgba(37,125,96,.08)',
  },
  splitConfirmed: {
    height: '100%',
    background: 'linear-gradient(90deg, #1f7a5d, #43a382)',
    borderRadius: '999px 0 0 999px',
  },
  splitPending: {
    height: '100%',
    background: 'linear-gradient(90deg, #dc7b31, #eba768)',
    borderRadius: '0 999px 999px 0',
  },
};

export default ExpenseScopeCard;
