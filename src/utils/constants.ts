/**
 * 全局常量定义
 */

import type { FilterState } from '../types/expense';

/** 默认美元汇率 */
export const DEFAULT_USD_RATE = 7.2;

/** 最大保存视图数量 */
export const MAX_SAVED_VIEWS = 6;

/** 热力图颜色等级 (从低到高) */
export const HEATMAP_COLORS = {
  /** 等级 0: 无数据或极低 */
  level0: '#f0f0f0',
  /** 等级 1: 低 */
  level1: '#bae7ff',
  /** 等级 2: 中 */
  level2: '#1890ff',
  /** 等级 3: 高 */
  level3: '#003a8c',
} as const;

/** 默认空筛选状态 */
export const DEFAULT_FILTER_STATE: FilterState = {
  period: '',
  date: '',
  dateStart: '',
  dateEnd: '',
  person: '',
  department: '',
  categoryL1: '',
  categoryL2: '',
  categoryL3: '',
  bankAccount: '',
  currency: '',
  importStatus: '',
  currencyMode: 'CNY',
  trendGrain: '',
  trendManual: false,
};
