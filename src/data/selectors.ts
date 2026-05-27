/**
 * Selector 计算层 — 筛选引擎与 KPI 聚合
 * Requirements: 5.3-5.5, 7.3, 7.4, 8.1-8.4, 9.1-9.10, 10.1-10.7, 11.1-11.3, 13.1, 14.1-14.4, 15.1, 21.1-21.2
 */

import type { ExpenseRecord, FilterState, TrendGrain } from '../types/expense';
import type {
  KpiResult,
  TrendPoint,
  CumulativePoint,
  CategoryDistributionItem,
  DepartmentAmount,
  DepartmentDetail,
  HeatmapCell,
} from '../types/chart';
import {
  getDefaultTrendGrain,
  getCumulativeGrain,
  getDateWindow,
  dateRange,
} from '../utils/dateUtils';
import { parse, format, differenceInDays, addDays, startOfWeek } from 'date-fns';

/**
 * 根据全局筛选状态过滤记录
 * 时间优先级：date > dateStart/dateEnd > period
 * 维度筛选：非空时才启用
 */
export function filterRecords(
  records: ExpenseRecord[],
  state: FilterState
): ExpenseRecord[] {
  let filtered = records;

  // 1. 时间筛选（按优先级）
  if (state.date) {
    // 最高优先级：精确日期匹配
    filtered = filtered.filter((r) => r.date === state.date);
  } else if (state.dateStart && state.dateEnd) {
    // 第二优先级：日期区间
    filtered = filtered.filter(
      (r) => r.date >= state.dateStart && r.date <= state.dateEnd
    );
  } else if (state.period) {
    if (/^\d{4}$/.test(state.period)) {
      // 年度筛选：date 以该年份开头
      const prefix = state.period;
      filtered = filtered.filter((r) => r.date.startsWith(prefix));
    } else if (/^\d{4}-\d{2}$/.test(state.period)) {
      // 月份筛选：periodMonth 匹配
      filtered = filtered.filter((r) => r.periodMonth === state.period);
    }
  }

  // 2. 维度筛选（仅非空时生效）
  if (state.person) {
    filtered = filtered.filter((r) => r.person === state.person);
  }
  if (state.department) {
    filtered = filtered.filter((r) => r.department === state.department);
  }
  if (state.categoryL1) {
    filtered = filtered.filter((r) => r.categoryL1 === state.categoryL1);
  }
  if (state.categoryL2) {
    filtered = filtered.filter((r) => r.categoryL2 === state.categoryL2);
  }
  if (state.categoryL3) {
    filtered = filtered.filter((r) => r.categoryL3 === state.categoryL3);
  }
  if (state.bankAccount) {
    filtered = filtered.filter((r) => r.bankAccount === state.bankAccount);
  }

  // 3. 币种筛选
  if (state.currency === 'RMB' || state.currency === 'USD') {
    filtered = filtered.filter((r) => r.currency === state.currency);
  }

  // 4. 导入状态筛选
  if (state.importStatus) {
    filtered = filtered.filter((r) => r.importStatus === state.importStatus);
  }

  return filtered;
}

/**
 * 计算 KPI 总览指标
 * - confirmedExpense: expense + normal + categoryL1≠'未分类' 的 amountCNY 合计
 * - rawAmount: 全部 amountCNY 合计
 * - pendingAmount: importStatus 非 normal 或 categoryL1='未分类' 的合计
 * - peakAmount/peakMonth: 按月聚合后的最大月度金额及对应月份
 */
export function getKpis(
  records: ExpenseRecord[],
  state: FilterState
): KpiResult {
  const filtered = filterRecords(records, state);

  let confirmedExpense = 0;
  let rawAmount = 0;
  let pendingAmount = 0;

  // 按月聚合
  const monthlyMap = new Map<string, number>();

  for (const r of filtered) {
    rawAmount += r.amountCNY;

    if (r.transactionType === 'expense' && r.importStatus === 'normal' && r.categoryL1 !== '未分类') {
      confirmedExpense += r.amountCNY;
    }

    if (r.importStatus !== 'normal' || r.categoryL1 === '未分类') {
      pendingAmount += r.amountCNY;
    }

    // 月度聚合
    const month = r.periodMonth;
    monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + r.amountCNY);
  }

  // 找峰值月份
  let peakAmount = 0;
  let peakMonth = '';
  for (const [month, amount] of monthlyMap) {
    if (amount > peakAmount) {
      peakAmount = amount;
      peakMonth = month;
    }
  }

  return {
    confirmedExpense,
    rawAmount,
    pendingAmount,
    peakAmount,
    peakMonth,
  };
}

/**
 * 获取时间桶标识
 * 根据粒度将日期归入对应桶
 */
function getBucket(date: string, grain: TrendGrain): string {
  switch (grain) {
    case 'year':
      return date.slice(0, 4);
    case 'quarter': {
      const year = date.slice(0, 4);
      const month = parseInt(date.slice(5, 7), 10);
      const quarter = Math.ceil(month / 3);
      return `${year}Q${quarter}`;
    }
    case 'month':
      return date.slice(0, 7);
    case 'day':
      return date;
  }
}

/**
 * 获取时间桶显示标签
 */
function getBucketLabel(bucket: string, grain: TrendGrain): string {
  switch (grain) {
    case 'year':
      return bucket; // e.g. "2026"
    case 'quarter':
      return bucket; // e.g. "2026Q1"
    case 'month':
      return bucket; // e.g. "2026-03"
    case 'day':
      return bucket; // e.g. "2026-03-15"
  }
}

/**
 * 获取趋势数据
 * - 如果 trendManual && trendGrain 存在，使用手动粒度
 * - 否则使用 getDefaultTrendGrain 自动判断
 * - 按粒度桶分组聚合 amountCNY
 */
export function getTrendData(
  records: ExpenseRecord[],
  state: FilterState
): TrendPoint[] {
  const filtered = filterRecords(records, state);
  const grain: TrendGrain =
    state.trendManual && state.trendGrain
      ? state.trendGrain
      : getDefaultTrendGrain(state);

  // 按桶分组聚合
  const bucketMap = new Map<string, number>();
  for (const r of filtered) {
    const bucket = getBucket(r.date, grain);
    bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + r.amountCNY);
  }

  // 排序后返回
  const entries = Array.from(bucketMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  return entries.map(([bucket, amount]) => ({
    label: getBucketLabel(bucket, grain),
    amount,
    bucket,
  }));
}

/**
 * 获取周桶标识（ISO week start on Monday）
 */
function getWeekBucket(dateStr: string): string {
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  const weekStart = startOfWeek(d, { weekStartsOn: 1 });
  return format(weekStart, 'yyyy-MM-dd');
}

/**
 * 获取累计分析数据
 * - 使用 getCumulativeGrain 决定粒度
 * - 按粒度桶分组聚合后计算累计
 */
export function getCumulativeData(
  records: ExpenseRecord[],
  state: FilterState
): CumulativePoint[] {
  const filtered = filterRecords(records, state);
  const grain = getCumulativeGrain(state);

  // 按桶分组聚合
  const bucketMap = new Map<string, number>();
  for (const r of filtered) {
    let bucket: string;
    switch (grain) {
      case 'day':
        bucket = r.date;
        break;
      case 'week':
        bucket = getWeekBucket(r.date);
        break;
      case 'month':
        bucket = r.periodMonth;
        break;
      default:
        bucket = r.date;
    }
    bucketMap.set(bucket, (bucketMap.get(bucket) ?? 0) + r.amountCNY);
  }

  // 排序
  const entries = Array.from(bucketMap.entries()).sort((a, b) =>
    a[0].localeCompare(b[0])
  );

  // 计算累计
  let cumulative = 0;
  return entries.map(([bucket, amount]) => {
    cumulative += amount;
    const label =
      grain === 'week' ? `周${bucket}` : bucket;
    return { label, amount, cumulative };
  });
}

/**
 * 获取分类分布（基于除 categoryL1/L2/L3 外的筛选条件）
 * - 忽略 category 筛选以展示全部分类的真实分布
 * - 按 categoryL1 分组，计算 amount 和 share
 */
export function getCategoryDistribution(
  records: ExpenseRecord[],
  state: FilterState
): CategoryDistributionItem[] {
  // 创建排除 category 筛选的状态
  const modifiedState: FilterState = {
    ...state,
    categoryL1: '',
    categoryL2: '',
    categoryL3: '',
  };
  const filtered = filterRecords(records, modifiedState);

  // 按 categoryL1 分组
  const categoryMap = new Map<string, number>();
  let totalAmount = 0;
  for (const r of filtered) {
    const amount = r.amountCNY;
    categoryMap.set(r.categoryL1, (categoryMap.get(r.categoryL1) ?? 0) + amount);
    totalAmount += amount;
  }

  // 计算 share
  const result: CategoryDistributionItem[] = [];
  for (const [categoryL1, amount] of categoryMap) {
    result.push({
      categoryL1,
      amount,
      share: totalAmount > 0 ? amount / totalAmount : 0,
    });
  }

  // 按金额降序
  result.sort((a, b) => b.amount - a.amount);
  return result;
}

/**
 * 获取部门排行（基于除 department 外的筛选条件）
 * - 按部门聚合金额，降序排列
 */
export function getDepartmentRanking(
  records: ExpenseRecord[],
  state: FilterState
): DepartmentAmount[] {
  // 创建排除 department 筛选的状态
  const modifiedState: FilterState = {
    ...state,
    department: '',
  };
  const filtered = filterRecords(records, modifiedState);

  // 按部门分组
  const deptMap = new Map<string, number>();
  for (const r of filtered) {
    deptMap.set(r.department, (deptMap.get(r.department) ?? 0) + r.amountCNY);
  }

  // 转换并排序
  const result: DepartmentAmount[] = Array.from(deptMap.entries()).map(
    ([department, amount]) => ({ department, amount })
  );
  result.sort((a, b) => b.amount - a.amount);
  return result;
}

/**
 * 获取部门费用详情
 * - 如果 state.department 为空，使用排行第一名的部门
 * - 获取该部门在当前筛选下的总额、条数
 * - 近 6 个 periodMonth 的趋势
 * - 金额最高的 4 条明细
 */
export function getDepartmentDetail(
  records: ExpenseRecord[],
  state: FilterState
): DepartmentDetail {
  // 确定目标部门
  let targetDepartment = state.department;
  if (!targetDepartment) {
    const ranking = getDepartmentRanking(records, state);
    targetDepartment = ranking.length > 0 ? ranking[0].department : '';
  }

  // 空部门则返回空详情
  if (!targetDepartment) {
    return {
      department: '',
      totalAmount: 0,
      recordCount: 0,
      trend: [],
      topRecords: [],
    };
  }

  // 使用目标部门 + 其他所有筛选条件
  const deptState: FilterState = {
    ...state,
    department: targetDepartment,
  };
  const filtered = filterRecords(records, deptState);

  const totalAmount = filtered.reduce((sum, r) => sum + r.amountCNY, 0);
  const recordCount = filtered.length;

  // 近 6 个 periodMonth 的趋势
  const monthMap = new Map<string, number>();
  for (const r of filtered) {
    monthMap.set(r.periodMonth, (monthMap.get(r.periodMonth) ?? 0) + r.amountCNY);
  }
  const sortedMonths = Array.from(monthMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-6);

  const trend: TrendPoint[] = sortedMonths.map(([month, amount]) => ({
    label: month,
    amount,
    bucket: month,
  }));

  // Top 4 明细（按 amountCNY 降序）
  const topRecords = [...filtered]
    .sort((a, b) => b.amountCNY - a.amountCNY)
    .slice(0, 4);

  return {
    department: targetDepartment,
    totalAmount,
    recordCount,
    trend,
    topRecords,
  };
}

/**
 * 获取明细表行（前 10 条）
 */
export function getTableRows(
  records: ExpenseRecord[],
  state: FilterState
): ExpenseRecord[] {
  return filterRecords(records, state).slice(0, 10);
}

/**
 * 获取热力图数据
 * - 行 = 不同的 categoryL1
 * - 列 = 当前时间窗口内的天或周
 * - 值 = 对应单元格的 amountCNY 总和
 * - 等级 = 基于分位数的 4 级分类 (0-3)
 */
export function getHeatmapData(
  records: ExpenseRecord[],
  state: FilterState
): HeatmapCell[][] {
  const filtered = filterRecords(records, state);
  if (filtered.length === 0) return [];

  // 获取时间窗口
  const window = getDateWindow(state, filtered);
  const startDate = parse(window.start, 'yyyy-MM-dd', new Date());
  const endDate = parse(window.end, 'yyyy-MM-dd', new Date());
  const days = differenceInDays(endDate, startDate) + 1;

  // 决定列粒度：超过 31 天使用周，否则使用天
  const useWeeks = days > 31;

  // 生成列桶
  let columns: string[];
  if (useWeeks) {
    // 按周生成列
    const weekSet = new Set<string>();
    let current = startDate;
    while (current <= endDate) {
      const ws = startOfWeek(current, { weekStartsOn: 1 });
      weekSet.add(format(ws, 'yyyy-MM-dd'));
      current = addDays(current, 7);
    }
    // 确保最后一天的周也被包含
    const lastWeek = startOfWeek(endDate, { weekStartsOn: 1 });
    weekSet.add(format(lastWeek, 'yyyy-MM-dd'));
    columns = Array.from(weekSet).sort();
  } else {
    columns = dateRange(window.start, window.end);
  }

  // 获取所有 categoryL1
  const categorySet = new Set<string>();
  for (const r of filtered) {
    categorySet.add(r.categoryL1);
  }
  const rows = Array.from(categorySet).sort();

  // 构建聚合矩阵 [row][col] -> amount
  const matrix = new Map<string, Map<string, number>>();
  for (const row of rows) {
    matrix.set(row, new Map<string, number>());
  }

  for (const r of filtered) {
    const rowKey = r.categoryL1;
    const colKey = useWeeks
      ? format(startOfWeek(parse(r.date, 'yyyy-MM-dd', new Date()), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      : r.date;

    const rowMap = matrix.get(rowKey);
    if (rowMap && columns.includes(colKey)) {
      rowMap.set(colKey, (rowMap.get(colKey) ?? 0) + r.amountCNY);
    }
  }

  // 收集所有非零值用于分位数计算
  const allValues: number[] = [];
  for (const rowMap of matrix.values()) {
    for (const val of rowMap.values()) {
      if (val > 0) allValues.push(val);
    }
  }

  // 计算分位数边界 (quartiles)
  allValues.sort((a, b) => a - b);
  const getQuantile = (arr: number[], q: number): number => {
    if (arr.length === 0) return 0;
    const pos = (arr.length - 1) * q;
    const base = Math.floor(pos);
    const rest = pos - base;
    if (base + 1 < arr.length) {
      return arr[base] + rest * (arr[base + 1] - arr[base]);
    }
    return arr[base];
  };

  const q25 = getQuantile(allValues, 0.25);
  const q50 = getQuantile(allValues, 0.5);
  const q75 = getQuantile(allValues, 0.75);

  // 将值映射为等级
  const getLevel = (value: number): 0 | 1 | 2 | 3 => {
    if (value <= 0) return 0;
    if (value <= q25) return 1;
    if (value <= q50) return 2;
    if (value <= q75) return 2;
    return 3;
  };

  // 生成结果矩阵
  const result: HeatmapCell[][] = [];
  for (const row of rows) {
    const rowMap = matrix.get(row)!;
    const rowCells: HeatmapCell[] = columns.map((col) => {
      const value = rowMap.get(col) ?? 0;
      return {
        row,
        col,
        value,
        level: getLevel(value),
      };
    });
    result.push(rowCells);
  }

  return result;
}
