/**
 * 右侧抽屉组件
 * 388px宽，标题+3个KPI块+原因拆解列表+Top明细
 * Requirements: 17.1-17.4
 */

import { useAppStore } from '../state/store';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';

export default function DetailDrawer() {
  const drawerOpen = useAppStore((s) => s.drawerOpen);
  const drawerContext = useAppStore((s) => s.drawerContext);
  const filter = useAppStore((s) => s.filter);
  const closeDrawer = useAppStore((s) => s.closeDrawer);

  const currencyMode = filter.currencyMode;

  return (
    <>
      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(23, 26, 23, 0.25)',
          zIndex: 999,
          opacity: drawerOpen ? 1 : 0,
          pointerEvents: drawerOpen ? 'auto' : 'none',
          transition: 'opacity 0.25s ease',
        }}
        onClick={closeDrawer}
      />

      {/* Drawer */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: 388,
          height: '100%',
          backgroundColor: 'var(--surface)',
          boxShadow: '-8px 0 24px rgba(28, 40, 34, .1)',
          zIndex: 1000,
          transform: drawerOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.25s ease',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderLeft: '1px solid var(--line)',
        }}
      >
        {/* Header */}
        <div style={styles.header}>
          <div>
            <div style={styles.drawerTitle}>{drawerContext?.title ?? '详情'}</div>
            {drawerContext?.type === 'detail' && drawerContext.topRecords[0] && (
              <div style={styles.drawerSubtitle}>sourceRowNo #{drawerContext.topRecords[0].sourceRowNo}</div>
            )}
          </div>
          <button onClick={closeDrawer} style={styles.closeBtn} aria-label="关闭抽屉">×</button>
        </div>

        {/* Content */}
        <div style={styles.body}>
          {drawerContext ? (
            <DrawerContent context={drawerContext} currencyMode={currencyMode} />
          ) : (
            <p style={styles.empty}>暂无详细信息</p>
          )}
        </div>
      </div>
    </>
  );
}

function DrawerContent({
  context,
  currencyMode,
}: {
  context: NonNullable<ReturnType<typeof useAppStore.getState>['drawerContext']>;
  currencyMode: 'CNY' | 'USD';
}) {
  // Single record detail view (from DepartmentDetail top records)
  if (context.type === 'detail' && context.topRecords.length === 1) {
    const record = context.topRecords[0];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={styles.kpiRow}>
          <KpiBlock label="金额(CNY)" value={displayMoney(record.amountCNY, currencyMode, DEFAULT_USD_RATE)} color="var(--green)" />
          <KpiBlock label="原币" value={`${record.currency} ${record.amount.toFixed(2)}`} color="var(--blue)" />
          <KpiBlock label="汇率" value={String(record.exchangeRate)} color="var(--orange)" />
        </div>

        <Section title="基本信息">
          <InfoRow label="交易日期" value={record.date} />
          <InfoRow label="期间" value={record.periodMonth} />
          <InfoRow label="主体/公司" value={record.person || '—'} />
          <InfoRow label="部门/项目" value={record.department || '—'} />
          <InfoRow label="银行账户" value={record.bankAccount || '—'} />
        </Section>

        <Section title="分类信息">
          <InfoRow label="一级分类" value={record.categoryL1 || '—'} />
          <InfoRow label="二级分类" value={record.categoryL2 || '—'} />
          <InfoRow label="三级分类" value={record.categoryL3 || '—'} />
          <InfoRow label="辅助分类" value={record.categoryExtra || '—'} />
        </Section>

        <Section title="状态信息">
          <InfoRow label="交易类型" value={record.transactionType === 'expense' ? '费用' : record.transactionType === 'income' ? '收入' : record.transactionType === 'intercompany' ? '往来' : '未分类'} />
          <InfoRow label="导入状态" value={record.importStatus === 'normal' ? '正常' : record.importStatus === 'pending_classify' ? '待归类' : '异常'} />
          <InfoRow label="原始行号" value={`#${record.sourceRowNo}`} />
        </Section>
      </div>
    );
  }

  // Fallback: generic drawer (shouldn't be used now)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={styles.kpiRow}>
        <KpiBlock label="当前口径金额" value={displayMoney(context.amount, currencyMode, DEFAULT_USD_RATE)} color="var(--green)" />
        <KpiBlock label="命中明细" value={`${context.recordCount} 笔`} color="var(--blue)" />
        <KpiBlock label="最大单笔" value={displayMoney(context.maxSingle, currencyMode, DEFAULT_USD_RATE)} color="var(--orange)" />
      </div>

      {context.topRecords.length > 0 && (
        <Section title="明细记录">
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {context.topRecords.slice(0, 6).map((record) => (
              <div key={record.id} style={styles.recordRow}>
                <span style={styles.recordDate}>{record.date}</span>
                <span style={styles.recordCat}>{record.categoryL1}</span>
                <span style={styles.recordDept}>{record.department}</span>
                <span style={styles.recordAmt}>{displayMoney(record.amountCNY, currencyMode, DEFAULT_USD_RATE)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function KpiBlock({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={styles.kpiBlock}>
      <span style={styles.kpiLabel}>{label}</span>
      <span style={{ ...styles.kpiValue, color }}>{value}</span>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={styles.infoRow}>
      <span style={styles.infoLabel}>{label}</span>
      <span style={styles.infoValue}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: '20px 20px 14px',
    borderBottom: '1px solid var(--line)',
  },
  drawerTitle: {
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  drawerSubtitle: {
    fontSize: '12px',
    color: 'var(--muted)',
    marginTop: '4px',
  },
  closeBtn: {
    border: 'none',
    background: 'none',
    fontSize: '22px',
    cursor: 'pointer',
    color: 'var(--muted)',
    padding: '4px',
    lineHeight: 1,
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '18px 20px',
  },
  empty: {
    color: 'var(--muted)',
    textAlign: 'center',
    marginTop: '60px',
    fontSize: '13px',
  },
  kpiRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '10px',
  },
  kpiBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px 12px',
    backgroundColor: '#f8faf8',
    borderRadius: '6px',
    border: '1px solid var(--line)',
  },
  kpiLabel: {
    fontSize: '11px',
    color: 'var(--muted)',
  },
  kpiValue: {
    fontSize: '14px',
    fontWeight: 600,
  },
  sectionTitle: {
    fontSize: '12px',
    color: 'var(--muted)',
    fontWeight: 500,
    marginBottom: '8px',
    paddingTop: '4px',
    borderTop: '1px solid var(--line)',
  },
  infoRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 0',
    borderBottom: '1px solid #f0f2f0',
  },
  infoLabel: {
    fontSize: '12px',
    color: 'var(--muted)',
    fontWeight: 500,
  },
  infoValue: {
    fontSize: '13px',
    color: 'var(--text)',
    fontWeight: 600,
    textAlign: 'right',
  },
  recordRow: {
    display: 'grid',
    gridTemplateColumns: '72px 1fr 1fr auto',
    gap: '6px',
    fontSize: '12px',
    color: 'var(--text)',
    padding: '4px 0',
    borderBottom: '1px solid var(--line)',
  },
  recordDate: {
    color: 'var(--muted)',
  },
  recordCat: {},
  recordDept: {},
  recordAmt: {
    fontWeight: 600,
    textAlign: 'right',
    color: 'var(--green)',
  },
};
