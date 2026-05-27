/**
 * 保存视图组件
 * 小卡片展示已保存的筛选视图，绿色保存按钮
 * Requirements: 18.1-18.4
 */

import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../state/store';
import { loadViews, saveView, deleteView, generateViewName } from '../state/persistence';
import type { SavedView } from '../types/expense';

export function SavedViews() {
  const filter = useAppStore((s) => s.filter);
  const updateFilter = useAppStore((s) => s.updateFilter);

  const [views, setViews] = useState<SavedView[]>(() => loadViews());

  const refreshViews = useCallback(() => setViews(loadViews()), []);

  const handleSave = useCallback(() => {
    const newView: SavedView = {
      id: Date.now().toString(),
      name: generateViewName(filter),
      state: { ...filter },
      createdAt: new Date().toISOString(),
    };
    saveView(newView);
    refreshViews();
  }, [filter, refreshViews]);

  // Listen for save event from FilterPanel
  useEffect(() => {
    const handler = () => handleSave();
    window.addEventListener('save-filter-view', handler);
    return () => window.removeEventListener('save-filter-view', handler);
  }, [handleSave]);

  const handleRestore = useCallback((view: SavedView) => {
    updateFilter(view.state);
  }, [updateFilter]);

  const handleDelete = useCallback((e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    deleteView(id);
    refreshViews();
  }, [refreshViews]);

  const formatTime = (iso: string): string => {
    try {
      const d = new Date(iso);
      return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    } catch {
      return '';
    }
  };

  return (
    <div style={styles.card} role="region" aria-label="保存视图">
      <div style={styles.header}>
        <span style={styles.title}>保存的视图</span>
        <button type="button" style={styles.saveBtn} onClick={handleSave} aria-label="保存当前视图">
          保存
        </button>
      </div>

      {views.length === 0 ? (
        <div style={styles.empty}>暂无保存的视图</div>
      ) : (
        <div style={styles.list}>
          {views.map((view) => (
            <div
              key={view.id}
              style={styles.viewItem}
              onClick={() => handleRestore(view)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRestore(view); } }}
            >
              <div style={styles.viewInfo}>
                <div style={styles.viewName} title={view.name}>{view.name}</div>
                <div style={styles.viewTime}>{formatTime(view.createdAt)}</div>
              </div>
              <button
                type="button"
                style={styles.deleteBtn}
                onClick={(e) => handleDelete(e, view.id)}
                aria-label={`删除视图: ${view.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--surface)',
    borderRadius: 'var(--radius)',
    boxShadow: 'var(--shadow)',
    border: '1px solid var(--line)',
    padding: '14px 16px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '10px',
  },
  title: {
    fontSize: '13px',
    fontWeight: 600,
    color: 'var(--text)',
  },
  saveBtn: {
    padding: '4px 12px',
    fontSize: '12px',
    borderRadius: '4px',
    border: '1px solid var(--green)',
    backgroundColor: 'var(--green)',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 500,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  viewItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 10px',
    borderRadius: '6px',
    backgroundColor: '#f8faf8',
    border: '1px solid var(--line)',
    cursor: 'pointer',
    transition: 'border-color .15s',
  },
  viewInfo: {
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  viewName: {
    fontSize: '12px',
    color: 'var(--text)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  viewTime: {
    fontSize: '11px',
    color: 'var(--muted)',
    marginTop: '2px',
  },
  deleteBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '20px',
    height: '20px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--muted)',
    fontSize: '14px',
    cursor: 'pointer',
    flexShrink: 0,
    marginLeft: '8px',
  },
  empty: {
    fontSize: '12px',
    color: 'var(--muted)',
    textAlign: 'center',
    padding: '12px 0',
  },
};

export default SavedViews;
