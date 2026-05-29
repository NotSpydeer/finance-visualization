/**
 * 应用入口组件
 * 根据 importPhase 和 currentPage 渲染不同视图
 * 集成数据缓存恢复、全页仪表盘组件、多页导航
 * Requirements: 1.5, 5.2, 6.1-6.5, 19.1, 19.2, 19.3, 20.1, 20.5, 23.2-23.4
 */

import { useEffect, useState } from 'react';
import { useAppStore } from './state/store';
import { Layout } from './components/Layout';
import { UploadDropzone } from './components/UploadDropzone';
import { ImportPreview } from './components/ImportPreview';
import { FilterPanel } from './components/FilterPanel';
import { KpiCards } from './components/KpiCards';
import { TrendOverview } from './components/TrendOverview';
import CumulativeAnalysis from './components/CumulativeAnalysis';
import { ExpenseScopeCard } from './components/ExpenseScopeCard';
import { CategoryDistribution } from './components/CategoryDistribution';
import { CategoryDrill } from './components/CategoryDrill';
import DepartmentRanking from './components/DepartmentRanking';
import DepartmentDetail from './components/DepartmentDetail';
import ExpenseTable from './components/ExpenseTable';
import { Heatmap } from './components/Heatmap';

import { SavedViews } from './components/SavedViews';
import { CalendarPanel } from './components/CalendarPanel';
import { TimelinePanel } from './components/TimelinePanel';
import { DataImportPage } from './components/pages/DataImportPage';
import { ExpenseGovernancePage } from './components/pages/ExpenseGovernancePage';
import { DataSearchPage } from './components/pages/DataSearchPage';
import { DataStatsPage } from './components/pages/DataStatsPage';
import { registerFinanceTheme } from './theme/echarts';
import { hasCachedData, loadCachedData, clearCachedData } from './state/persistence';
import './index.css';

type CacheState = 'checking' | 'prompt' | 'none';

function App() {
  const importPhase = useAppStore((state) => state.importPhase);
  const importData = useAppStore((state) => state.importData);
  const currentPage = useAppStore((state) => state.currentPage);
  const undoFilter = useAppStore((state) => state.undoFilter);
  const redoFilter = useAppStore((state) => state.redoFilter);
  const filter = useAppStore((state) => state.filter);

  const [cacheState, setCacheState] = useState<CacheState>('checking');

  // 注册 ECharts 自定义主题（仅初始化一次）
  useEffect(() => {
    registerFinanceTheme();
  }, []);

  // 全局键盘快捷键: Ctrl+Z = 回退, Ctrl+Shift+Z / Ctrl+Y = 前进
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undoFilter();
        } else if ((e.key === 'z' && e.shiftKey) || e.key === 'y') {
          e.preventDefault();
          redoFilter();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoFilter, redoFilter]);

  // 检测是否存在缓存数据
  useEffect(() => {
    let cancelled = false;
    async function check() {
      try {
        const exists = await hasCachedData();
        if (!cancelled) {
          setCacheState(exists ? 'prompt' : 'none');
        }
      } catch {
        if (!cancelled) {
          setCacheState('none');
        }
      }
    }
    check();
    return () => { cancelled = true; };
  }, []);

  // 恢复缓存数据
  const handleRestore = async () => {
    const records = await loadCachedData();
    if (records && records.length > 0) {
      const summary = {
        totalRows: records.length,
        normalRows: records.filter((r) => r.importStatus === 'normal').length,
        pendingClassifyRows: records.filter((r) => r.importStatus === 'pending_classify').length,
        abnormalRows: records.filter((r) => r.importStatus === 'abnormal').length,
        fieldMapping: {},
      };
      importData(records, summary);
    }
    setCacheState('none');
  };

  // 清除缓存，重新导入
  const handleReimport = async () => {
    await clearCachedData();
    setCacheState('none');
  };

  // 正在检查缓存状态
  if (cacheState === 'checking') {
    return (
      <Layout>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--muted)' }}>
          正在加载...
        </div>
      </Layout>
    );
  }

  // 显示缓存恢复提示
  if (cacheState === 'prompt' && importPhase === 'idle') {
    return (
      <Layout>
        <div style={cachePromptStyles.wrapper}>
          <p style={cachePromptStyles.message}>是否恢复上次导入的数据?</p>
          <div style={cachePromptStyles.actions}>
            <button style={cachePromptStyles.btnPrimary} onClick={handleRestore}>
              恢复
            </button>
            <button style={cachePromptStyles.btnSecondary} onClick={handleReimport}>
              重新导入
            </button>
          </div>
        </div>
      </Layout>
    );
  }

  // Before data is imported and not on 数据导入 page: show upload
  if (importPhase === 'idle' || importPhase === 'parsing') {
    // If on 数据导入 page, show that page (which has its own upload)
    if (currentPage === '数据导入') {
      return (
        <Layout>
          <DataImportPage />
        </Layout>
      );
    }
    return (
      <Layout>
        <UploadDropzone />
      </Layout>
    );
  }

  // preview: 导入预览
  if (importPhase === 'preview') {
    return (
      <Layout>
        <ImportPreview />
      </Layout>
    );
  }

  // dashboard phase: render based on currentPage
  // 数据导入 page
  if (currentPage === '数据导入') {
    return (
      <Layout>
        <DataImportPage />
      </Layout>
    );
  }

  // 费用治理 page
  if (currentPage === '费用治理') {
    return (
      <Layout>
        <ExpenseGovernancePage />
      </Layout>
    );
  }

  // 数据搜索 page → now 明细查询
  if (currentPage === '明细查询') {
    return (
      <Layout>
        <DataSearchPage />
      </Layout>
    );
  }

  // 数据统计 page
  if (currentPage === '数据统计') {
    return (
      <Layout>
        <DataStatsPage />
      </Layout>
    );
  }

  // 总览: 仪表盘主视图
  const rightPanel = (
    <>
      <CalendarPanel />
      <div style={{ marginTop: '16px' }}>
        <SavedViews />
      </div>
      <div style={{ marginTop: '16px' }}>
        <TimelinePanel />
      </div>
    </>
  );

  return (
    <Layout rightPanel={rightPanel}>
      {/* Head row: section heading + status display */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <h2 className="card-title-bar pink" style={{ fontSize: '18px' }}>总览</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ height: '34px', padding: '0 12px', border: '1px solid var(--line)', borderRadius: '4px', background: 'var(--surface)', color: '#333', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center' }}>
            📅 {filter.date || filter.period || (filter.dateStart ? `${filter.dateStart} ~ ${filter.dateEnd}` : '全部日期')}
          </span>
          <span style={{ height: '34px', padding: '0 12px', border: '1px solid var(--line)', borderRadius: '4px', background: 'var(--surface)', color: '#333', fontWeight: 700, fontSize: '12px', display: 'flex', alignItems: 'center' }}>
            👤 {filter.person || '全部主体'}
          </span>
          <button style={{ height: '34px', padding: '0 12px', border: '1px solid var(--line)', borderRadius: '4px', background: 'var(--surface)', color: '#333', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>导出 ↗</button>
        </div>
      </div>

      {/* 筛选面板 */}
      <FilterPanel />

      {/* KPI 卡片 */}
      <div style={{ marginTop: '12px' }}>
        <KpiCards />
      </div>

      {/* dashboard-grid: 费用趋势总览 + (费用口径 + 月度累计分析) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.08fr .92fr', gap: '12px', marginTop: '12px', minHeight: '386px' }}>
        <TrendOverview />
        <div style={{ display: 'grid', gridTemplateRows: '148px minmax(0, 1fr)', gap: '12px' }}>
          <ExpenseScopeCard />
          <CumulativeAnalysis />
        </div>
      </div>

      {/* bottom-grid: 费用结构分布 + 分类钻取 + 项目排行 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr .48fr .48fr', gap: '12px', marginTop: '12px' }}>
        <CategoryDistribution />
        <CategoryDrill />
        <DepartmentRanking />
      </div>

      {/* drill-grid: 费用热力 + 部门费用详情 */}
      <div style={{ display: 'grid', gridTemplateColumns: '.9fr 1.1fr', gap: '12px', marginTop: '12px' }}>
        <Heatmap />
        <DepartmentDetail />
      </div>

      {/* 明细追溯 full width */}
      <div style={{ marginTop: '12px' }}>
        <ExpenseTable />
      </div>


    </Layout>
  );
}

/** 缓存恢复提示样式 */
const cachePromptStyles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
    gap: '24px',
  } as React.CSSProperties,

  message: {
    fontSize: '18px',
    color: 'var(--text)',
    fontWeight: 500,
    margin: 0,
  } as React.CSSProperties,

  actions: {
    display: 'flex',
    gap: '16px',
  } as React.CSSProperties,

  btnPrimary: {
    padding: '10px 28px',
    backgroundColor: 'var(--green)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,

  btnSecondary: {
    padding: '10px 28px',
    backgroundColor: 'var(--surface)',
    color: 'var(--muted)',
    border: '1px solid var(--line)',
    borderRadius: 'var(--radius)',
    fontSize: '14px',
    cursor: 'pointer',
  } as React.CSSProperties,
};

export default App;
