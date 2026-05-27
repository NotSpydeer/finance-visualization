/**
 * 筛选联动逻辑
 * 封装筛选状态变更时的同步逻辑
 */

import type { FilterState } from '../types/expense';

/** 时间相关字段名列表 */
const TIME_FIELDS: (keyof FilterState)[] = ['period', 'date', 'dateStart', 'dateEnd'];

/**
 * 判断 partial 更新是否包含时间字段变更
 * 当时间字段变更时，需要重置 trendManual 为 false（让粒度回到自动选择）
 */
export function isTimeFieldChange(partial: Partial<FilterState>): boolean {
  return TIME_FIELDS.some((field) => field in partial);
}
