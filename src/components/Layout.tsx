/**
 * 整体布局组件
 * Design Spec: Section 3.2, 4.2
 * 三栏 grid 布局：左侧导航 200px / 中间内容 / 右侧面板 292px
 * 顶部栏 54px：Tabs (underline active) + round buttons
 */

import { type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { FilterTags } from './FilterTags';
import DetailDrawer from './DetailDrawer';
import { useAppStore } from '../state/store';

interface LayoutProps {
  children: ReactNode;
  rightPanel?: ReactNode;
}

const topTabs = ['总览', '明细查询'];

export function Layout({ children, rightPanel }: LayoutProps) {
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);
  const filterHistory = useAppStore((s) => s.filterHistory);
  const filterFuture = useAppStore((s) => s.filterFuture);
  const undoFilter = useAppStore((s) => s.undoFilter);
  const redoFilter = useAppStore((s) => s.redoFilter);
  const canUndo = filterHistory.length > 0;
  const canRedo = filterFuture.length > 0;

  // Map top tab to active state
  const activeTab = currentPage === '明细查询' ? '明细查询' : '总览';

  const handleTabClick = (tab: string) => {
    if (tab === '明细查询') {
      setCurrentPage('明细查询');
    } else {
      setCurrentPage('总览');
    }
  };

  const gridStyle = {
    ...styles.grid,
    gridTemplateColumns: rightPanel ? '200px minmax(0, 1fr) 292px' : '200px minmax(0, 1fr)',
  };

  return (
    <div style={gridStyle}>
      {/* 左侧导航栏 200px */}
      <Sidebar />

      {/* 中间主内容区 */}
      <div style={styles.centerColumn}>
        {/* 顶部栏 */}
        <header style={styles.topBar}>
          <div style={styles.tabGroup}>
            {topTabs.map((tab) => (
              <div
                key={tab}
                style={{
                  ...styles.tab,
                  ...(tab === activeTab ? styles.tabActive : {}),
                }}
                onClick={() => handleTabClick(tab)}
              >
                {tab}
              </div>
            ))}
          </div>
          <div style={styles.topRight}>
            <div style={styles.undoRedoGroup}>
              <button
                style={{ ...styles.undoBtn, ...(canUndo ? {} : styles.undoBtnDisabled) }}
                onClick={undoFilter}
                disabled={!canUndo}
                title="回退上一步"
              >
                ← 回退
              </button>
              <button
                style={{ ...styles.undoBtn, ...(canRedo ? {} : styles.undoBtnDisabled) }}
                onClick={redoFilter}
                disabled={!canRedo}
                title="前进一步"
              >
                前进 →
              </button>
            </div>
            <button style={styles.roundBtn} aria-label="通知" title="通知">
              ●
            </button>
            <button style={styles.roundBtn} aria-label="设置" title="设置">
              ⚙
            </button>
          </div>
        </header>

        {/* 主内容滚动区 */}
        <main style={styles.main}>
          {children}
        </main>
      </div>

      {/* 右侧面板 292px */}
      {rightPanel && (
        <aside style={styles.rightPanel} aria-label="日历面板">
          {rightPanel}
        </aside>
      )}

      {/* Floating filter tags + undo button */}
      <div style={styles.floatingArea}>
        <FilterTags />
        <button
          onClick={undoFilter}
          style={{ ...styles.floatingUndo, ...(canUndo ? {} : { opacity: 0.3, cursor: 'default' }) }}
          title="回退上一步 (Ctrl+Z)"
          disabled={!canUndo}
        >
          ◀
        </button>
      </div>

      {/* Detail Drawer (global) */}
      <DetailDrawer />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: 'grid',
    gridTemplateColumns: '200px minmax(0, 1fr) 292px',
    minHeight: '100vh',
    width: '100%',
  },
  centerColumn: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    overflow: 'hidden',
    minWidth: 0,
  },
  topBar: {
    height: '54px',
    minHeight: '54px',
    backgroundColor: 'var(--surface)',
    borderBottom: '1px solid var(--line)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 18px',
  },
  tabGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    height: '100%',
  },
  tab: {
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    borderBottom: '2px solid transparent',
    color: 'var(--muted)',
    fontWeight: 700,
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'color .15s ease, border-color .15s ease',
  },
  tabActive: {
    color: 'var(--text)',
    borderBottom: '2px solid var(--text)',
  },
  topRight: {
    display: 'flex',
    gap: '9px',
    alignItems: 'center',
  },
  undoRedoGroup: {
    display: 'flex',
    gap: '6px',
    alignItems: 'center',
    marginRight: '4px',
  },
  undoBtn: {
    height: '28px',
    padding: '0 10px',
    fontSize: '11px',
    fontWeight: 800,
    border: '1px solid var(--line)',
    borderRadius: '5px',
    background: '#fbfcfb',
    color: 'var(--text)',
    cursor: 'pointer',
    transition: 'border-color .15s ease, color .15s ease',
  } as React.CSSProperties,
  undoBtnDisabled: {
    opacity: 0.4,
    cursor: 'not-allowed',
  },
  roundBtn: {
    width: '28px',
    height: '28px',
    display: 'grid',
    placeItems: 'center',
    border: '1px solid var(--line)',
    borderRadius: '50%',
    background: 'var(--surface)',
    color: 'var(--muted)',
    fontWeight: 800,
    fontSize: '12px',
    cursor: 'pointer',
  },
  main: {
    flex: 1,
    overflow: 'auto',
    padding: '20px 18px 28px',
    backgroundColor: 'var(--bg)',
  },
  rightPanel: {
    minHeight: '100vh',
    backgroundColor: '#fafbfa',
    borderLeft: '1px solid var(--line)',
    overflow: 'auto',
    padding: '14px',
  },
  floatingArea: {
    position: 'fixed',
    left: '14px',
    top: '50%',
    transform: 'translateY(-50%)',
    zIndex: 99,
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8px',
    maxWidth: '200px',
    pointerEvents: 'auto',
  },
  floatingUndo: {
    width: '34px',
    height: '34px',
    minWidth: '34px',
    borderRadius: '50%',
    border: '2px solid var(--green-2)',
    background: 'var(--green-3)',
    boxShadow: '0 4px 12px rgba(37, 125, 96, .2)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    color: 'var(--green)',
    fontWeight: 900,
    padding: 0,
    flexShrink: 0,
  },
};

export default Layout;
