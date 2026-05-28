/**
 * KPI 总览卡片组件
 * 4列卡片，108px高，小方块图标 + 大数字 + 标签
 * Requirements: 8.1-8.7
 */

import { useMemo } from 'react';
import { useAppStore } from '../state/store';
import { getKpis } from '../data/selectors';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';

/** 卡片配置项 */
interface KpiCardConfig {
  key: string;
  label: string;
  iconBg: string;
  iconColor: string;
  iconLetter: string;
  delta: string;
  deltaDown?: boolean;
}

const CARD_CONFIGS: KpiCardConfig[] = [
  { key: 'confirmedExpense', label: '确认费用支出', iconBg: 'var(--blue-2)', iconColor: 'var(--blue)', iconLetter: '¥', delta: '主口径' },
  { key: 'rawAmount', label: '原始交易金额', iconBg: 'var(--pink-2)', iconColor: 'var(--pink)', iconLetter: 'Σ', delta: '+22.6%', deltaDown: true },
  { key: 'pendingAmount', label: '待确认金额', iconBg: 'var(--green-3)', iconColor: 'var(--green)', iconLetter: '?', delta: '治理中' },
  { key: 'peakAmount', label: '月度峰值', iconBg: 'var(--orange-2)', iconColor: 'var(--orange)', iconLetter: '!', delta: '' },
];

export function KpiCards() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  const kpis = useMemo(() => getKpis(records, filter), [records, filter]);

  const handleCardClick = (key: string) => {
    switch (key) {
      case 'pendingAmount':
        updateFilter({ importStatus: 'pending_classify', categoryL1: '未分类' });
        setCurrentPage('费用治理');
        break;
      case 'peakAmount':
        if (kpis.peakMonth) {
          updateFilter({ period: kpis.peakMonth });
        }
        break;
      case 'confirmedExpense':
        break;
      case 'rawAmount':
        break;
    }
  };

  const getKpiValue = (key: string): number => {
    switch (key) {
      case 'confirmedExpense': return kpis.confirmedExpense;
      case 'rawAmount': return kpis.rawAmount;
      case 'pendingAmount': return kpis.pendingAmount;
      case 'peakAmount': return kpis.peakAmount;
      default: return 0;
    }
  };

  return (
    <div style={styles.grid}>
      {CARD_CONFIGS.map((card) => {
        const value = getKpiValue(card.key);
        const displayValue = displayMoney(value, filter.currencyMode, DEFAULT_USD_RATE);

        return (
          <div
            key={card.key}
            style={styles.card}
            onClick={() => handleCardClick(card.key)}
            role="button"
            tabIndex={0}
            aria-label={`${card.label}: ${displayValue}`}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') handleCardClick(card.key);
            }}
          >
            <div style={styles.metricTop}>
              <div style={{ ...styles.icon, backgroundColor: card.iconBg, color: card.iconColor }}>
                {card.iconLetter}
              </div>
              <span style={styles.more}>...</span>
            </div>
            <div style={styles.label}>{card.label}</div>
            <div style={styles.valueRow}>
              <span style={styles.value}>{displayValue}</span>
              {(card.key === 'peakAmount' && kpis.peakMonth) ? (
                <span style={styles.delta}>{kpis.peakMonth}</span>
              ) : card.delta ? (
                <span style={{ ...styles.delta, ...(card.deltaDown ? styles.deltaDown : {}) }}>{card.delta}</span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '12px',
  },
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--line)',
    padding: '16px 18px',
    minHeight: '108px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'box-shadow .18s ease, outline .18s ease',
    position: 'relative',
  },
  metricTop: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  icon: {
    width: '22px',
    height: '22px',
    borderRadius: '5px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '11px',
    fontWeight: 900,
  },
  more: {
    color: 'var(--muted)',
    fontWeight: 800,
  },
  label: {
    fontSize: '13px',
    color: 'var(--muted)',
  },
  valueRow: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    marginTop: '6px',
  },
  value: {
    fontSize: '25px',
    fontWeight: 600,
    color: 'var(--text)',
    letterSpacing: 0,
  },
  delta: {
    padding: '3px 6px',
    borderRadius: '4px',
    color: 'var(--green)',
    backgroundColor: 'var(--green-3)',
    fontSize: '11px',
    fontWeight: 800,
  },
  deltaDown: {
    color: 'var(--pink)',
    backgroundColor: 'var(--pink-2)',
  },
};

export default KpiCards;
