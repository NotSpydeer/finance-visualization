/**
 * 拖拽/点击上传区域组件
 * 接受 .xlsx / .xls 文件，调用 parseExcel + normalizeRecords，进入预览阶段
 * Requirements: 1.1-1.6, 22.1-22.3, 19.4, 20.5
 */

import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '../state/store';
import { parseExcel } from '../data/parser';
import { normalizeRecords } from '../data/normalizer';
import type { ExpenseRecord, ImportSummary } from '../types/expense';

const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls'];
const ACCEPTED_MIME = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '16px',
  } as React.CSSProperties,

  dropzone: {
    border: '2px dashed #d0d0cc',
    borderRadius: '8px',
    padding: '64px',
    textAlign: 'center',
    cursor: 'pointer',
    color: '#666',
    transition: 'border-color 0.2s, background-color 0.2s',
  } as React.CSSProperties,

  dropzoneActive: {
    border: '2px dashed #4a90d9',
    backgroundColor: '#f0f7ff',
  } as React.CSSProperties,

  title: {
    fontSize: '18px',
    margin: '0 0 8px',
  } as React.CSSProperties,

  hint: {
    fontSize: '14px',
    color: '#999',
    margin: 0,
  } as React.CSSProperties,

  privacy: {
    fontSize: '12px',
    color: '#999',
  } as React.CSSProperties,

  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    fontSize: '18px',
    color: '#666',
  } as React.CSSProperties,

  error: {
    marginTop: '12px',
    padding: '12px 16px',
    backgroundColor: '#fff2f0',
    border: '1px solid #ffccc7',
    borderRadius: '6px',
    color: '#cf1322',
    fontSize: '14px',
    maxWidth: '400px',
    textAlign: 'left',
  } as React.CSSProperties,
};

/** 临时存储解析结果供 ImportPreview 使用 */
let pendingRecords: ExpenseRecord[] = [];
let pendingSummary: ImportSummary | null = null;

export function getPendingImportData() {
  return { records: pendingRecords, summary: pendingSummary };
}

export function UploadDropzone() {
  const setImportPhase = useAppStore((s) => s.setImportPhase);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(async (file: File) => {
    setErrors([]);
    setLoading(true);
    setImportPhase('parsing');

    try {
      const parseResult = await parseExcel(file);

      if (!parseResult.success) {
        const messages = parseResult.errors.map((e) => e.message);
        setErrors(messages);
        setLoading(false);
        setImportPhase('idle');
        return;
      }

      // 标准化数据
      const { records, summary } = normalizeRecords(
        parseResult.rows,
        parseResult.fieldMapping,
        {
          defaultUsdRate: 7.2,
          importBatchId: `batch-${Date.now()}`,
        }
      );

      // 存储解析结果供预览使用
      pendingRecords = records;
      pendingSummary = summary;

      setLoading(false);
      setImportPhase('preview');
    } catch {
      setErrors(['文件解析失败，请确认文件未损坏']);
      setLoading(false);
      setImportPhase('idle');
    }
  }, [setImportPhase]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      setDragOver(false);

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFile(files[0]);
      }
    },
    [handleFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
      // 重置 input 以允许重复选择同一文件
      e.target.value = '';
    },
    [handleFile]
  );

  if (loading) {
    return (
      <div style={styles.loading}>
        正在解析表格...
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div
        style={{
          ...styles.dropzone,
          ...(dragOver ? styles.dropzoneActive : {}),
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        aria-label="上传 Excel 文件"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            handleClick();
          }
        }}
      >
        <p style={styles.title}>
          将 Excel 文件拖到这里，或点击选择文件
        </p>
        <p style={styles.hint}>
          支持 .xlsx / .xls
        </p>
      </div>

      <p style={styles.privacy}>
        文件仅在当前浏览器本地解析，不会上传服务器
      </p>

      {errors.length > 0 && (
        <div style={styles.error as React.CSSProperties}>
          {errors.map((msg, idx) => (
            <p key={idx} style={{ margin: idx > 0 ? '4px 0 0' : '0' }}>
              {msg}
            </p>
          ))}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept={[...ACCEPTED_EXTENSIONS, ...ACCEPTED_MIME].join(',')}
        style={{ display: 'none' }}
        onChange={handleInputChange}
        aria-hidden="true"
      />
    </div>
  );
}

export default UploadDropzone;
