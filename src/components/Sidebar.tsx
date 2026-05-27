/**
 * 左侧导航栏
 * Design Spec: Section 4.1
 * 水平 profile 行（avatar + text + dots），方形/圆形 icon 导航
 */

import { useAppStore, type PageKey } from '../state/store';

const navItems: { label: PageKey; iconType: 'square' | 'circle' | 'bolt' }[] = [
  { label: '总览', iconType: 'square' },
  { label: '数据导入', iconType: 'circle' },
  { label: '费用治理', iconType: 'bolt' },
  { label: '数据搜索', iconType: 'circle' },
];

const toolItems: { label: string; iconType: 'square' | 'circle' }[] = [
  { label: '帮助中心', iconType: 'circle' },
  { label: '退出', iconType: 'square' },
];

export function Sidebar() {
  const currentPage = useAppStore((s) => s.currentPage);
  const setCurrentPage = useAppStore((s) => s.setCurrentPage);

  return (
    <aside style={styles.sidebar} aria-label="主导航">
      {/* 顶部 profile 行: avatar + name/sub + dots */}
      <div style={styles.profile}>
        <div style={styles.avatar}>GF</div>
        <div style={styles.brandText}>
          <b style={styles.brandName}>游戏财务分析</b>
          <span style={styles.brandSub}>本地表格可视化</span>
        </div>
        <div style={styles.dots}>⋮</div>
      </div>

      {/* 导航列表 */}
      <nav style={styles.nav}>
        {navItems.map((item) => {
          const isActive = item.label === currentPage;
          return (
            <button
              key={item.label}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
              }}
              onClick={() => setCurrentPage(item.label)}
              aria-current={isActive ? 'page' : undefined}
            >
              <span style={{
                ...styles.icon,
                ...(item.iconType === 'circle' ? styles.iconCircle : {}),
                ...(item.iconType === 'bolt' ? styles.iconBolt : {}),
              }} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* spacer between nav and utility */}
      <div style={{ flex: 1 }} />

      {/* 底部工具区 */}
      <div style={styles.utility}>
        <div style={styles.modeRow}>
          <span>浅色模式</span>
          <span style={styles.toggle}><i style={styles.toggleDot} /></span>
        </div>
        {toolItems.map((item) => (
          <button
            key={item.label}
            style={styles.navItem}
          >
            <span style={{
              ...styles.icon,
              ...(item.iconType === 'circle' ? styles.iconCircle : {}),
            }} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    backgroundColor: 'var(--sidebar)',
    borderRight: '1px solid var(--line)',
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    overflow: 'hidden',
    padding: '14px',
  },
  profile: {
    display: 'grid',
    gridTemplateColumns: '34px 1fr 22px',
    gap: '10px',
    alignItems: 'center',
    marginBottom: '22px',
  },
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    backgroundColor: 'var(--text)',
    color: '#ffffff',
    display: 'grid',
    placeItems: 'center',
    fontSize: '12px',
    fontWeight: 800,
  },
  brandText: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandName: {
    fontSize: '13px',
    fontWeight: 700,
    color: 'var(--text)',
    display: 'block',
  },
  brandSub: {
    fontSize: '11px',
    color: 'var(--muted)',
  },
  dots: {
    color: 'var(--muted)',
    textAlign: 'right' as const,
    fontWeight: 800,
  },
  nav: {
    display: 'grid',
    gap: '4px',
  },
  navItem: {
    display: 'grid',
    gridTemplateColumns: '22px 1fr',
    alignItems: 'center',
    gap: '8px',
    minHeight: '34px',
    border: 'none',
    borderRadius: '4px',
    background: 'transparent',
    color: '#39423c',
    textAlign: 'left' as const,
    fontSize: '13px',
    cursor: 'pointer',
    transition: '.18s ease',
    padding: '0 4px',
  },
  navItemActive: {
    color: 'var(--green)',
    backgroundColor: 'var(--green-3)',
  },
  icon: {
    width: '15px',
    height: '15px',
    marginLeft: '4px',
    border: '1.8px solid currentColor',
    borderRadius: '4px',
  },
  iconCircle: {
    borderRadius: '50%',
  },
  iconBolt: {
    borderRadius: '2px',
    transform: 'skewX(-10deg)',
  },
  utility: {
    marginTop: 'auto',
    display: 'grid',
    gap: '4px',
  },
  modeRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: '0 4px 10px',
    color: 'var(--muted)',
    fontSize: '12px',
  },
  toggle: {
    display: 'inline-block',
    width: '34px',
    height: '18px',
    padding: '2px',
    borderRadius: '999px',
    background: '#dde5df',
  },
  toggleDot: {
    display: 'block',
    width: '14px',
    height: '14px',
    marginLeft: '14px',
    borderRadius: '50%',
    background: 'var(--green)',
  },
};

export default Sidebar;
