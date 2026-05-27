/**
 * Zustand Store 定义
 * 全局应用状态管理
 * Requirements: 5.1-5.6, 6.1-6.5
 */

import { create } from 'zustand';
import type { ExpenseRecord, FilterState, ImportSummary } from '../types/expense';
import type { DrawerContext } from '../types/chart';
import { DEFAULT_FILTER_STATE } from '../utils/constants';
import { isTimeFieldChange } from './filterActions';

/** 页面导航类型 */
export type PageKey = '总览' | '数据导入' | '费用治理' | '数据搜索';

/** 应用状态接口 */
export interface AppState {
  /** 费用记录数据 */
  records: ExpenseRecord[];
  /** 导入摘要 */
  importSummary: ImportSummary | null;
  /** 全局筛选状态 */
  filter: FilterState;
  /** 筛选历史栈（用于回退） */
  filterHistory: FilterState[];
  /** 筛选前进栈（用于前进） */
  filterFuture: FilterState[];
  /** 抽屉是否打开 */
  drawerOpen: boolean;
  /** 抽屉上下文 */
  drawerContext: DrawerContext | null;
  /** 导入阶段 */
  importPhase: 'idle' | 'parsing' | 'preview' | 'dashboard';
  /** 当前页面 */
  currentPage: PageKey;

  // Actions
  /** 导入数据，设置 records、summary，进入 dashboard 阶段 */
  importData: (records: ExpenseRecord[], summary: ImportSummary) => void;
  /** 设置导入阶段 */
  setImportPhase: (phase: AppState['importPhase']) => void;
  /** 部分更新筛选状态，时间字段变更时自动重置 trendManual */
  updateFilter: (partial: Partial<FilterState>) => void;
  /** 重置筛选为默认状态 */
  resetFilter: () => void;
  /** 清除时间筛选条件，重置 trendManual */
  clearTimeFilter: () => void;
  /** 回退上一步筛选 */
  undoFilter: () => void;
  /** 前进一步筛选 */
  redoFilter: () => void;
  /** 打开抽屉 */
  openDrawer: (context: DrawerContext) => void;
  /** 关闭抽屉 */
  closeDrawer: () => void;
  /** 设置当前页面 */
  setCurrentPage: (page: PageKey) => void;
  /** 批量更新记录的 transactionType */
  updateRecordType: (recordIds: string[], newType: ExpenseRecord['transactionType']) => void;
  /** 批量更新记录的字段（部门、分类、状态等） */
  updateRecordFields: (recordIds: string[], fields: Partial<Pick<ExpenseRecord, 'department' | 'categoryL1' | 'categoryL2' | 'categoryL3' | 'importStatus'>>) => void;
}

/** 历史栈最大长度 */
const MAX_HISTORY = 50;

/** 全局 Store */
export const useAppStore = create<AppState>((set) => ({
  records: [],
  importSummary: null,
  filter: { ...DEFAULT_FILTER_STATE },
  filterHistory: [],
  filterFuture: [],
  drawerOpen: false,
  drawerContext: null,
  importPhase: 'idle',
  currentPage: '总览',

  importData: (records, summary) => {
    // Auto-classify based on keywords
    const INCOME_KW = ['收入', '利息', '分成', '补贴', '版权', '期权'];
    const INTER_KW = ['借款', '押金', '保证金'];

    const classifiedRecords = records.map((r) => {
      // Only auto-classify if still unclassified
      if (r.transactionType !== 'unclassified') return r;
      const text = r.categoryL3 || '';
      if (INCOME_KW.some((kw) => text.includes(kw))) {
        return { ...r, transactionType: 'income' as const };
      }
      if (INTER_KW.some((kw) => text.includes(kw))) {
        return { ...r, transactionType: 'intercompany' as const };
      }
      // Default unclassified to expense, also mark as normal since it's confirmed
      return { ...r, transactionType: 'expense' as const, importStatus: 'normal' as const };
    });

    set({
      records: classifiedRecords,
      importSummary: summary,
      importPhase: 'dashboard',
    });
  },

  setImportPhase: (phase) =>
    set({ importPhase: phase }),

  updateFilter: (partial) =>
    set((state) => {
      const nextFilter = { ...state.filter, ...partial };
      // 时间字段变更时，自动重置 trendManual
      if (isTimeFieldChange(partial)) {
        nextFilter.trendManual = false;
      }
      // 将当前筛选推入历史栈，清空前进栈
      const history = [...state.filterHistory, state.filter].slice(-MAX_HISTORY);
      return {
        filter: nextFilter,
        filterHistory: history,
        filterFuture: [],
      };
    }),

  resetFilter: () =>
    set((state) => {
      const history = [...state.filterHistory, state.filter].slice(-MAX_HISTORY);
      return {
        filter: { ...DEFAULT_FILTER_STATE },
        filterHistory: history,
        filterFuture: [],
      };
    }),

  clearTimeFilter: () =>
    set((state) => {
      const history = [...state.filterHistory, state.filter].slice(-MAX_HISTORY);
      return {
        filter: {
          ...state.filter,
          period: '',
          date: '',
          dateStart: '',
          dateEnd: '',
          trendManual: false,
        },
        filterHistory: history,
        filterFuture: [],
      };
    }),

  undoFilter: () =>
    set((state) => {
      if (state.filterHistory.length === 0) return state;
      const history = [...state.filterHistory];
      const prevFilter = history.pop()!;
      return {
        filter: prevFilter,
        filterHistory: history,
        filterFuture: [state.filter, ...state.filterFuture].slice(0, MAX_HISTORY),
      };
    }),

  redoFilter: () =>
    set((state) => {
      if (state.filterFuture.length === 0) return state;
      const future = [...state.filterFuture];
      const nextFilter = future.shift()!;
      return {
        filter: nextFilter,
        filterHistory: [...state.filterHistory, state.filter].slice(-MAX_HISTORY),
        filterFuture: future,
      };
    }),

  openDrawer: (context) =>
    set({ drawerOpen: true, drawerContext: context }),

  closeDrawer: () =>
    set({ drawerOpen: false, drawerContext: null }),

  setCurrentPage: (page) =>
    set({ currentPage: page }),

  updateRecordType: (recordIds, newType) =>
    set((state) => {
      const idSet = new Set(recordIds);
      const records = state.records.map((r) =>
        idSet.has(r.id) ? { ...r, transactionType: newType } : r
      );
      return { records };
    }),

  updateRecordFields: (recordIds, fields) =>
    set((state) => {
      const idSet = new Set(recordIds);
      const records = state.records.map((r) =>
        idSet.has(r.id) ? { ...r, ...fields } : r
      );
      return { records };
    }),
}));
