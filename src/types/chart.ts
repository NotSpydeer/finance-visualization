/**
 * 图表数据类型定义
 */

import type { ExpenseRecord } from './expense';

/** KPI 总览卡片数据 */
export interface KpiResult {
  /** 确认费用支出 */
  confirmedExpense: number;
  /** 原始交易金额 */
  rawAmount: number;
  /** 待确认金额 */
  pendingAmount: number;
  /** 峰值金额 */
  peakAmount: number;
  /** 峰值月份 */
  peakMonth: string;
}

/** 趋势数据点 */
export interface TrendPoint {
  /** 显示标签 */
  label: string;
  /** 金额 */
  amount: number;
  /** 时间桶标识 */
  bucket: string;
}

/** 累计分析数据点 */
export interface CumulativePoint {
  /** 显示标签 */
  label: string;
  /** 当期金额 */
  amount: number;
  /** 累计金额 */
  cumulative: number;
}

/** 分类分布项 */
export interface CategoryDistributionItem {
  /** 一级分类名 */
  categoryL1: string;
  /** 金额 */
  amount: number;
  /** 占比 (0-1) */
  share: number;
}

/** 部门金额 */
export interface DepartmentAmount {
  /** 部门名 */
  department: string;
  /** 金额 */
  amount: number;
}

/** 部门费用详情 */
export interface DepartmentDetail {
  /** 部门名 */
  department: string;
  /** 金额总计 */
  totalAmount: number;
  /** 命中记录条数 */
  recordCount: number;
  /** 近期趋势 */
  trend: TrendPoint[];
  /** 金额最高的记录 */
  topRecords: ExpenseRecord[];
}

/** 热力图单元格 */
export interface HeatmapCell {
  /** 行标识（分类或部门） */
  row: string;
  /** 列标识（时间） */
  col: string;
  /** 金额值 */
  value: number;
  /** 颜色等级 0-3 */
  level: 0 | 1 | 2 | 3;
}

/** 抽屉上下文 */
export interface DrawerContext {
  /** 来源类型 */
  type: 'kpi' | 'trend' | 'category' | 'department' | 'detail' | 'heatmap';
  /** 标题 */
  title: string;
  /** 当前口径金额 */
  amount: number;
  /** 命中笔数 */
  recordCount: number;
  /** 最大单笔金额 */
  maxSingle: number;
  /** Top 分类构成 */
  topCategories: { name: string; amount: number }[];
  /** Top 部门构成 */
  topDepartments: { name: string; amount: number }[];
  /** 金额最高的明细记录 */
  topRecords: ExpenseRecord[];
}

/** 季度时间桶 */
export interface QuarterBucket {
  /** 显示标签（如 "2026Q1"） */
  label: string;
  /** 季度开始日期 YYYY-MM-DD */
  start: string;
  /** 季度结束日期 YYYY-MM-DD */
  end: string;
}
