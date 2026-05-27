/**
 * 导入预览确认组件
 * 展示解析摘要（总行数、正常行、待归类、异常行）和字段映射结果
 * Requirements: 1.1-1.6, 22.1-22.3, 19.4, 20.5
 */

import { useAppStore } from '../state/store';
import { getPendingImportData } from './UploadDropzone';
import { cacheData, clearCachedData } from '../state/persistence';

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '24px',
    padding: '24px',
  } as React.CSSProperties,

  title: {
    fontSize: '20px',
    fontWeight: 500,
    color: '#333',
    margin: 0,
  } as React.CSSProperties,

  summaryCard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '16px',
    width: '100%',
    maxWidth: '600px',
  } as React.CSSProperties,

  statItem: {
    textAlign: 'center',
    padding: '16px',
    backgroundColor: '#f9f9f7',
    borderRadius: '8px',
    border: '1px solid #e8e8e4',
  } as React.CSSProperties,

  statValue: {
    fontSize: '24px',
    fontWeight: 600,
    margin: '0 0 4px',
    color: '#333',
  } as React.CSSProperties,

  statLabel: {
    fontSize: '12px',
    color: '#999',
    margin: 0,
  } as React.CSSProperties,

  mappingSection: {
    width: '100%',
    maxWidth: '600px',
  } as React.CSSProperties,

  mappingSectionTitle: {
    fontSize: '14px',
    fontWeight: 500,
    color: '#666',
    margin: '0 0 8px',
  } as React.CSSProperties,

  mappingList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  } as React.CSSProperties,

  mappingTag: {
    padding: '4px 10px',
    backgroundColor: '#e6f7e6',
    border: '1px solid #b7eb8f',
    borderRadius: '4px',
    fontSize: '12px',
    color: '#389e0d',
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  } as React.CSSProperties,

  btnPrimary: {
    padding: '10px 24px',
    backgroundColor: '#1a1a1a',
    color: '#ffffff',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  } as React.CSSProperties,

  btnPrimaryDisabled: {
    padding: '10px 24px',
    backgroundColor: '#d9d9d9',
    color: '#999',
    border: 'none',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'not-allowed',
  } as React.CSSProperties,

  btnSecondary: {
    padding: '10px 24px',
    backgroundColor: '#ffffff',
    color: '#666',
    border: '1px solid #d0d0cc',
    borderRadius: '6px',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'border-color 0.2s',
  } as React.CSSProperties,

  errorNotice: {
    padding: '12px 16px',
    backgroundColor: '#fff2f0',
    border: '1px solid #ffccc7',
    borderRadius: '6px',
    color: '#cf1322',
    fontSize: '14px',
    maxWidth: '600px',
    textAlign: 'center',
  } as React.CSSProperties,
};

/** 标准字段名到中文显示名 */
const FIELD_LABELS: Record<string, string> = {
  date: '交易日期',
  amount: '金额',
  amountCNY: '本位币金额',
  currency: '币种',
  exchangeRate: '汇率',
  categoryL1: '一级分类',
  categoryL2: '二级分类',
  categoryL3: '三级分类',
  categoryExtra: '辅助分类',
  department: '部门',
  person: '主体',
  bankAccount: '银行账户',
  periodMonth: '期间',
  transactionType: '交易类型',
};

export function ImportPreview() {
  const importData = useAppStore((s) => s.importData);
  const setImportPhase = useAppStore((s) => s.setImportPhase);

  const { records, summary } = getPendingImportData();

  // 如果没有解析数据（异常情况），回到 idle
  if (!summary || !records) {
    return (
      <div style={styles.wrapper}>
        <p style={styles.title}>无数据</p>
        <button
          style={styles.btnSecondary}
          onClick={() => setImportPhase('idle')}
        >
          重新选择文件
        </button>
      </div>
    );
  }

  const allAbnormal = summary.normalRows === 0 && summary.pendingClassifyRows === 0;
  const recognizedFields = Object.keys(summary.fieldMapping);

  const handleConfirm = async () => {
    // 清除旧缓存，然后缓存新数据
    await clearCachedData();
    await cacheData(records);
    importData(records, summary);
  };

  const handleReselect = () => {
    setImportPhase('idle');
  };

  return (
    <div style={styles.wrapper}>
      <p style={styles.title}>导入预览</p>

      {/* 数据摘要 */}
      <div style={styles.summaryCard}>
        <div style={styles.statItem as React.CSSProperties}>
          <p style={styles.statValue}>{summary.totalRows}</p>
          <p style={styles.statLabel}>总行数</p>
        </div>
        <div style={styles.statItem as React.CSSProperties}>
          <p style={{ ...styles.statValue, color: '#389e0d' }}>
            {summary.normalRows}
          </p>
          <p style={styles.statLabel}>正常行</p>
        </div>
        <div style={styles.statItem as React.CSSProperties}>
          <p style={{ ...styles.statValue, color: '#d48806' }}>
            {summary.pendingClassifyRows}
          </p>
          <p style={styles.statLabel}>待归类</p>
        </div>
        <div style={styles.statItem as React.CSSProperties}>
          <p style={{ ...styles.statValue, color: '#cf1322' }}>
            {summary.abnormalRows}
          </p>
          <p style={styles.statLabel}>异常行</p>
        </div>
      </div>

      {/* 字段映射结果 */}
      {recognizedFields.length > 0 && (
        <div style={styles.mappingSection}>
          <p style={styles.mappingSectionTitle}>
            已识别字段（{recognizedFields.length} 个）
          </p>
          <div style={styles.mappingList as React.CSSProperties}>
            {recognizedFields.map((field) => (
              <span key={field} style={styles.mappingTag}>
                {FIELD_LABELS[field] || field} → {summary.fieldMapping[field]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* 全部异常提示 */}
      {allAbnormal && (
        <div style={styles.errorNotice as React.CSSProperties}>
          没有可分析的数据，请检查日期、金额、币种和汇率
        </div>
      )}

      {/* 操作按钮 */}
      <div style={styles.actions}>
        <button
          style={allAbnormal ? styles.btnPrimaryDisabled : styles.btnPrimary}
          onClick={handleConfirm}
          disabled={allAbnormal}
          aria-label="确认导入"
        >
          确认导入
        </button>
        <button
          style={styles.btnSecondary}
          onClick={handleReselect}
          aria-label="重新选择文件"
        >
          重新选择文件
        </button>
      </div>
    </div>
  );
}

export default ImportPreview;
