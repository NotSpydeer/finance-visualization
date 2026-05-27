/**
 * 日期工具函数
 * Validates: Requirements 9.1-9.5, 10.1-10.6
 */

import {
  parse,
  format,
  isValid,
  differenceInDays,
  addDays,
  addMonths,
  startOfMonth,
  endOfMonth,
  startOfQuarter,
  endOfQuarter,
  getDaysInMonth,
} from 'date-fns';
import type { FilterState, ExpenseRecord, TrendGrain } from '../types/expense';
import type { QuarterBucket } from '../types/chart';

/**
 * 解析日期值，支持 Excel serial date、YYYY/MM/DD、YYYY-MM-DD
 * 返回 YYYY-MM-DD 格式或 null
 */
export function parseDateValue(value: unknown): string | null {
  if (value == null) return null;

  // Handle Excel serial date numbers
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 1) return null;
    // Excel serial date: days since 1900-01-01
    // Excel has a bug where it treats 1900 as a leap year (Feb 29, 1900 = serial 60)
    // Serial 1 = 1900-01-01
    // We need to subtract 1 extra day for dates after Feb 28, 1900 (serial > 59)
    let adjustedDays = value - 1; // serial 1 -> day 0 offset from 1900-01-01
    if (value > 59) {
      adjustedDays -= 1; // account for the phantom Feb 29, 1900
    }
    const baseDate = new Date(1900, 0, 1); // Jan 1, 1900
    const resultDate = addDays(baseDate, adjustedDays);
    return validateAndFormat(resultDate);
  }

  if (typeof value === 'string') {
    // 清除可能的引号字符（Excel 中文日期有时带引号）
    const trimmed = value.trim().replace(/"/g, '');
    if (!trimmed) return null;

    // Try Chinese date format: YYYY年M月D日
    const chineseMatch = trimmed.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日?$/);
    if (chineseMatch) {
      const [, yearStr, monthStr, dayStr] = chineseMatch;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      return validateComponents(year, month, day);
    }

    // Try YYYY/MM/DD
    const slashMatch = trimmed.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
    if (slashMatch) {
      const [, yearStr, monthStr, dayStr] = slashMatch;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      return validateComponents(year, month, day);
    }

    // Try YYYY-MM-DD
    const dashMatch = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (dashMatch) {
      const [, yearStr, monthStr, dayStr] = dashMatch;
      const year = parseInt(yearStr, 10);
      const month = parseInt(monthStr, 10);
      const day = parseInt(dayStr, 10);
      return validateComponents(year, month, day);
    }
  }

  return null;
}

/**
 * 校验年月日分量并格式化为 YYYY-MM-DD
 * 严格校验：不允许 Date 构造函数的自动溢出
 */
function validateComponents(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1) return null;

  // Create date and check it didn't overflow
  const date = new Date(year, month - 1, day);
  if (!isValid(date)) return null;

  // Ensure the date didn't roll over (e.g. Feb 30 → Mar 2)
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return format(date, 'yyyy-MM-dd');
}

/**
 * 校验日期并格式化为 YYYY-MM-DD (for Date objects from serial number parsing)
 */
function validateAndFormat(date: Date): string | null {
  if (!isValid(date)) return null;
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();

  // Validate ranges
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > getDaysInMonth(date)) return null;

  return format(date, 'yyyy-MM-dd');
}

/**
 * 根据筛选状态自动选择趋势时间粒度
 */
export function getDefaultTrendGrain(state: FilterState): TrendGrain {
  // Period matches YYYY (4 digits year)
  if (/^\d{4}$/.test(state.period)) {
    return 'month';
  }

  // Period matches YYYY-MM
  if (/^\d{4}-\d{2}$/.test(state.period)) {
    return 'day';
  }

  // Date is set (specific day)
  if (state.date) {
    return 'day';
  }

  // Date range is set
  if (state.dateStart && state.dateEnd) {
    const start = parse(state.dateStart, 'yyyy-MM-dd', new Date());
    const end = parse(state.dateEnd, 'yyyy-MM-dd', new Date());
    const days = differenceInDays(end, start) + 1;

    if (days <= 31) return 'day';
    if (days <= 365) return 'month';
    return 'quarter';
  }

  // No time filter
  return 'month';
}

/**
 * 根据筛选状态选择累计分析粒度
 */
export function getCumulativeGrain(state: FilterState): 'day' | 'week' | 'month' {
  // Period is YYYY (year)
  if (/^\d{4}$/.test(state.period)) {
    return 'month';
  }

  // Period is YYYY-MM or date is set
  if (/^\d{4}-\d{2}$/.test(state.period) || state.date) {
    return 'day';
  }

  // Date range
  if (state.dateStart && state.dateEnd) {
    const start = parse(state.dateStart, 'yyyy-MM-dd', new Date());
    const end = parse(state.dateEnd, 'yyyy-MM-dd', new Date());
    const days = differenceInDays(end, start) + 1;

    if (days <= 62) return 'day';
    if (days <= 190) return 'week';
    return 'month';
  }

  // No filter
  return 'month';
}

/**
 * 计算当前可见日期窗口
 */
export function getDateWindow(
  state: FilterState,
  records: ExpenseRecord[]
): { start: string; end: string } {
  // Date is set → month containing that date
  if (state.date) {
    const d = parse(state.date, 'yyyy-MM-dd', new Date());
    const monthStart = startOfMonth(d);
    const monthEnd = endOfMonth(d);
    return {
      start: format(monthStart, 'yyyy-MM-dd'),
      end: format(monthEnd, 'yyyy-MM-dd'),
    };
  }

  // Date range
  if (state.dateStart && state.dateEnd) {
    return {
      start: state.dateStart,
      end: state.dateEnd,
    };
  }

  // Period YYYY → Jan 1 to Dec 31
  if (/^\d{4}$/.test(state.period)) {
    const year = state.period;
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    };
  }

  // Period YYYY-MM → first to last day of that month
  if (/^\d{4}-\d{2}$/.test(state.period)) {
    const d = parse(`${state.period}-01`, 'yyyy-MM-dd', new Date());
    const monthEnd = endOfMonth(d);
    return {
      start: format(d, 'yyyy-MM-dd'),
      end: format(monthEnd, 'yyyy-MM-dd'),
    };
  }

  // No filter → use min/max dates from records
  if (records.length === 0) {
    const today = new Date();
    const monthStart = startOfMonth(today);
    const monthEnd = endOfMonth(today);
    return {
      start: format(monthStart, 'yyyy-MM-dd'),
      end: format(monthEnd, 'yyyy-MM-dd'),
    };
  }

  let minDate = records[0].date;
  let maxDate = records[0].date;
  for (const record of records) {
    if (record.date < minDate) minDate = record.date;
    if (record.date > maxDate) maxDate = record.date;
  }
  return { start: minDate, end: maxDate };
}

/**
 * 生成 YYYY-MM 月份范围数组
 */
export function monthRange(start: string, end: string): string[] {
  const result: string[] = [];
  // Parse start as first day of the month
  const startDate = parse(
    start.length === 7 ? `${start}-01` : start,
    'yyyy-MM-dd',
    new Date()
  );
  const endDate = parse(
    end.length === 7 ? `${end}-01` : end,
    'yyyy-MM-dd',
    new Date()
  );

  // Get YYYY-MM for start and end
  const endMonth = format(endDate, 'yyyy-MM');

  let current = startOfMonth(startDate);
  while (format(current, 'yyyy-MM') <= endMonth) {
    result.push(format(current, 'yyyy-MM'));
    current = addMonths(current, 1);
  }

  return result;
}

/**
 * 生成 YYYY-MM-DD 日期范围数组
 */
export function dateRange(start: string, end: string): string[] {
  const result: string[] = [];
  const startDate = parse(start, 'yyyy-MM-dd', new Date());
  const endDate = parse(end, 'yyyy-MM-dd', new Date());
  const days = differenceInDays(endDate, startDate);

  if (days < 0) return result;

  let current = startDate;
  for (let i = 0; i <= days; i++) {
    result.push(format(current, 'yyyy-MM-dd'));
    current = addDays(current, 1);
  }

  return result;
}

/**
 * 生成季度桶数组
 */
export function quarterRange(start: string, end: string): QuarterBucket[] {
  const result: QuarterBucket[] = [];
  const startDate = parse(start, 'yyyy-MM-dd', new Date());
  const endDate = parse(end, 'yyyy-MM-dd', new Date());

  if (!isValid(startDate) || !isValid(endDate)) return result;

  let current = startOfQuarter(startDate);
  while (current <= endDate) {
    const qEnd = endOfQuarter(current);
    const year = current.getFullYear();
    const quarter = Math.floor(current.getMonth() / 3) + 1;

    result.push({
      label: `${year}Q${quarter}`,
      start: format(current, 'yyyy-MM-dd'),
      end: format(qEnd, 'yyyy-MM-dd'),
    });

    current = addMonths(current, 3);
    current = startOfQuarter(current);
  }

  return result;
}
