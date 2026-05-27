/**
 * 数据导入页面
 * 包含上传区域 + 导入历史记录
 */

import { useMemo } from 'react';
import { useAppStore } from '../../state/store';
import { UploadDropzone } from '../UploadDropzone';
import { ImportPreview } from '../ImportPreview';

export function DataImportPage() {
  const records = useAppStore((s) => s.records);
  const importPhase = useAppStore((s) => s.importPhase);

  // 从 records 中提取导入批次时间戳
  const importHistory = useMemo(() => {
    const batchMap = new Map<string, { count: number; earliest: string; latest: string }>();
    for (const r of records) {
      const batchId = r.id.split('-').slice(0, -1).join('-'); // extract batch prefix
      const existing = batchMap.get(batchId);
      if (existing) {
        existing.count++;
        if (r.date < existing.earliest) existing.earliest = r.date;
        if (r.date > existing.latest) existing.latest = r.date;
      } else {
        batchMap.set(batchId, { count: 1, earliest: r.date, latest: r.date });
      }
    }
    return Array.from(batchMap.entries()).map(([batchId, info]) => ({
      batchId,
      ...info,
    }));
  }, [records]);

  // If in preview phase, show preview
  if (importPhase === 'preview') {
    return <ImportPreview />;
  }

  return (
    <div style={styles.page}>
      <h2 style={styles.pageTitle}>数据导入</h2>

      {/* Upload area */}
      <UploadDropzone />

      {/* Import history */}
      <div style={styles.historyCard}>
        <h3 style={styles.cardTitle}>导入历史</h3>
        {importHistory.length === 0 ? (
          <p style={styles.empty}>暂无导入记录</p>
        ) : (
          <div style={styles.historyList}>
            {importHistory.map((batch) => (
              <div key={batch.batchId} style={styles.historyItem}>
                <div style={styles.historyLeft}>
                  <span style={styles.batchLabel}>📋 批次</span>
                  <span style={styles.batchId}>{batch.batchId}</span>
                </div>
                <div style={styles.historyRight}>
                  <span style={styles.historyCount}>{batch.count} 条记录</span>
                  <span style={styles.historyDate}>
                    {batch.earliest} ~ {batch.latest}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
    margin: '0 0 24px 0',
  },
  historyCard: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--line)',
    padding: '18px 20px',
    marginTop: '24px',
  },
  cardTitle: {
    margin: '0 0 12px 0',
    fontSize: '15px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  empty: {
    color: 'var(--muted)',
    fontSize: '13px',
    textAlign: 'center',
    padding: '24px 0',
    margin: 0,
  },
  historyList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  historyItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '6px',
    backgroundColor: '#f8faf8',
    border: '1px solid var(--line)',
  },
  historyLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  batchLabel: {
    fontSize: '13px',
  },
  batchId: {
    fontSize: '12px',
    color: 'var(--muted)',
    fontFamily: 'monospace',
  },
  historyRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  historyCount: {
    fontSize: '13px',
    fontWeight: 500,
    color: 'var(--green)',
  },
  historyDate: {
    fontSize: '12px',
    color: 'var(--muted)',
  },
};

export default DataImportPage;
