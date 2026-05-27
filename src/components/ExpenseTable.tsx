/**
 * 关键明细追溯组件
 * 总览页面底部表格：展示当前筛选下"最需要关注"的 Top 10 明细
 * 排序规则：异常 > 待归类 > 金额降序
 * 点击行：右侧抽屉看单笔详情
 * 点击状态标签：跳转到对应处理页面
 * 右上角快捷按钮：查看全部 / 待归类 / 异常处理
 * Requirements: 15.1-15.3
 */

import { useMemo, useCallback } from 'react';
import { useAppStore } from '../state/store';
import { filterRecords } from '../data/selectors';
import { displayMoney } from '../utils/currencyUtils';
import { DEFAULT_USD_RATE } from '../utils/constants';
import type { ExpenseRecord } from '../types/expense';

/** 状态排序权重：异常最高，待归类其次，正常最低 */
function statusWeight(record: ExpenseRecord): number {
  if (record.importStatus === 'abnormal') return 3;
  if (record.importStatus === 'pending_classify') return 2;
  return 0;
}

/** 状态中文标签 */
function statusLabel(record: ExpenseRecord): string {
  if (record.importStatus === 'abnormal') return '异常';
  if (record.importStatus === 'pending_classify') return '待归类';
  return '正常';
}

/** 操作按钮文案 */
function actionLabel(record: ExpenseRecord): string {
  if (record.importStatus === 'abnormal') return '修正';
  if (record.importStatus === 'pending_classify') return '归类';
  return '查看';
}

export default function ExpenseTable() {
  const records = useAppStore((s) => s.records);
  const filter = useAppStore((s) => s.filter);
  const openDrawer = useAppStore((s) => s.openDrawer);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const updateFilter = useAppStore((s) => s.updateFilter);

  // Get top 10 key records sorted by: abnormal > pending_classify > amount desc
  const keyRecords = useMemo(() => {
    const filtered = filterRecords(records, filter);
    return [...filtered]
      .sort((a, b) => {
        const wa = statusWeight(a);
        const wb = statusWeight(b);
        if (wa !== wb) return wb - wa; // Higher weight first
        return b.amountCNY - a.amountCNY; // Then by amount
      })
      .slice(0, 10);
  }, [records, filter]);

  const handleRowClick = useCallback((record: ExpenseRecord) => {
    openDrawer({
      type: 'detail',
      title: '原始流水追溯',
      amount: record.amountCNY,
      recordCount: 1,
      maxSingle: record.amountCNY,
      topCategories: [{ name: record.categoryL1, amount: record.amountCNY }],
      topDepartments: [{ name: record.department, amount: record.amountCNY }],
      topRecords: [record],
    });
  }, [openDrawer]);

  const handleCategoryClick = useCallback((e: React.MouseEvent, categoryL1: string) => {
    e.stopPropagation();
    updateFilter({ categoryL1, categoryL2: '', categoryL3: '' });
  }, [updateFilter]);

  const handleDepartmentClick = useCallback((e: React.MouseEvent, department: string) => {
    e.stopPropagation();
    updateFilter({ department });
  }, [updateFilter]);

  const handleStatusClick = useCallback((e: React.MouseEvent, record: ExpenseRecord) => {
    e.stopPropagation();
    if (record.importStatus === 'pending_classify') {
      setCurrentPage('费用治理');
    } else if (record.importStatus === 'abnormal') {
      setCurrentPage('费用治理');
    }
  }, [setCurrentPage]);

  const handleActionClick = useCallback((e: React.MouseEvent, record: ExpenseRecord) => {
    e.stopPropagation();
    if (record.importStatus === 'pending_classify') {
      setCurrentPage('费用治理');
    } else if (record.importStatus === 'abnormal') {
      setCurrentPage('费用治理');
    } else {
      handleRowClick(record);
    }
  }, [setCurrentPage, handleRowClick]);

  const handleViewAll = useCallback(() => {
    setCurrentPage('数据搜索');
  }, [setCurrentPage]);

  const handleViewPending = useCallback(() => {
    setCurrentPage('费用治理');
  }, [setCurrentPage]);

  const handleViewAbnormal = useCallback(() => {
    setCurrentPage('费用治理');
  }, [setCurrentPage]);

  const currencyMode = filter.currencyMode;

  if (keyRecords.length === 0) {
    return (
      <div style={styles.card} role="region" aria-label="关键明细追溯">
        <div style={styles.header}>
          <div>
            <h2 className="card-title-bar" style={{ marginBottom: '4px' }}>关键明细追溯</h2>
            <span style={styles.subtitle}>展示当前筛选下金额最高、异常或待归类的关键记录</span>
          </div>
        </div>
        <div style={styles.empty}>当前筛选没有匹配明细</div>
      </div>
    );
  }

  return (
    <div style={styles.card} role="region" aria-label="关键明细追溯">
      <div style={styles.header}>
        <div>
          <h2 className="card-title-bar" style={{ marginBottom: '4px' }}>关键明细追溯</h2>
          <span style={styles.subtitle}>展示当前筛选下金额最高、异常或待归类的关键记录</span>
        </div>
        <div style={styles.headerActions}>
          <button style={styles.actionBtn} onClick={handleViewAll}>查看全部</button>
          <button style={{ ...styles.actionBtn, ...styles.actionBtnWarn }} onClick={handleViewPending}>待归类</button>
          <button style={{ ...styles.actionBtn, ...styles.actionBtnDanger }} onClick={handleViewAbnormal}>异常处理</button>
        </div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>日期</th>
              <th style={styles.th}>主体</th>
              <th style={styles.th}>部门/项目</th>
              <th style={styles.th}>分类</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>金额</th>
              <th style={styles.th}>状态</th>
              <th style={{ ...styles.th, textAlign: 'right' }}>原始行号</th>
              <th style={styles.th}>操作</th>
            </tr>
          </thead>
          <tbody>
            {keyRecords.map((record, index) => (
              <tr
                key={record.id}
                style={{ ...styles.tr, backgroundColor: index % 2 === 0 ? 'var(--surface)' : '#f8faf8' }}
                onClick={() => handleRowClick(record)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(record); } }}
              >
                <td style={styles.td}>{record.date}</td>
                <td style={styles.td}>{record.person}</td>
                <td style={styles.td}>
                  <span
                    style={styles.clickableCell}
                    onClick={(e) => handleDepartmentClick(e, record.department)}
                  >
                    {record.department}
                  </span>
                </td>
                <td style={styles.td}>
                  <span
                    style={styles.clickableCell}
                    onClick={(e) => handleCategoryClick(e, record.categoryL1)}
                  >
                    {record.categoryL1}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: 'right', fontWeight: 800, color: 'var(--text)' }}>
                  {displayMoney(record.amountCNY, currencyMode, DEFAULT_USD_RATE)}
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.statusBadge,
                      ...(record.importStatus === 'abnormal' ? styles.statusDanger : {}),
                      ...(record.importStatus === 'pending_classify' ? styles.statusWarn : {}),
                    }}
                    onClick={(e) => handleStatusClick(e, record)}
                  >
                    {statusLabel(record)}
                  </span>
                </td>
                <td style={{ ...styles.td, textAlign: 'right', color: 'var(--muted)' }}>
                  #{record.sourceRowNo}
                </td>
                <td style={styles.td}>
                  <button
                    style={styles.rowActionBtn}
                    onClick={(e) => handleActionClick(e, record)}
                  >
                    {actionLabel(record)}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View more link */}
      <div style={styles.footer}>
        <button style={styles.viewMoreBtn} onClick={handleViewAll}>
          查看更多明细 →
        </button>
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
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: '14px',
    gap: '12px',
  },
  subtitle: {
    fontSize: '11px',
    color: 'var(--muted)',
  },
  headerActions: {
    display: 'flex',
    gap: '6px',
    flexShrink: 0,
  },
  actionBtn: {
    height: '28px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: 700,
    border: '1px solid var(--line)',
    borderRadius: '5px',
    background: '#fbfcfb',
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'all .15s',
    whiteSpace: 'nowrap',
  },
  actionBtnWarn: {
    borderColor: 'var(--orange)',
    color: 'var(--orange)',
    background: 'var(--orange-2)',
  },
  actionBtnDanger: {
    borderColor: 'var(--pink)',
    color: 'var(--pink)',
    background: 'var(--pink-2)',
  },
  tableWrap: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: '12px',
  },
  th: {
    padding: '9px 10px',
    textAlign: 'left',
    fontWeight: 800,
    color: 'var(--muted)',
    borderBottom: '2px solid var(--line)',
    whiteSpace: 'nowrap',
    fontSize: '11px',
  },
  tr: {
    cursor: 'pointer',
    transition: 'background-color .12s',
  },
  td: {
    padding: '9px 10px',
    color: 'var(--text)',
    borderBottom: '1px solid var(--line)',
    whiteSpace: 'nowrap',
  },
  clickableCell: {
    color: 'var(--green)',
    cursor: 'pointer',
    fontWeight: 500,
    borderBottom: '1px dashed var(--green-2)',
  },
  statusBadge: {
    padding: '3px 7px',
    borderRadius: '4px',
    background: 'var(--green-3)',
    color: 'var(--green)',
    fontSize: '11px',
    fontWeight: 800,
    cursor: 'default',
  },
  statusWarn: {
    background: 'var(--orange-2)',
    color: 'var(--orange)',
    cursor: 'pointer',
  },
  statusDanger: {
    background: 'var(--pink-2)',
    color: 'var(--pink)',
    cursor: 'pointer',
  },
  rowActionBtn: {
    padding: '3px 8px',
    fontSize: '11px',
    fontWeight: 700,
    border: '1px solid var(--green-2)',
    borderRadius: '4px',
    background: 'var(--green-3)',
    color: 'var(--green)',
    cursor: 'pointer',
    transition: 'all .15s',
  },
  footer: {
    marginTop: '12px',
    textAlign: 'center',
  },
  viewMoreBtn: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--green)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '6px 16px',
  },
  empty: {
    textAlign: 'center',
    color: 'var(--muted)',
    fontSize: '13px',
    padding: '24px 0',
  },
};
