/**
 * 本地持久化模块
 * IndexedDB 数据缓存 + localStorage 保存视图
 * Requirements: 23.1-23.4, 18.1-18.4
 */

import { get, set, del } from 'idb-keyval';
import type { ExpenseRecord, FilterState, SavedView } from '../types/expense';
import { MAX_SAVED_VIEWS } from '../utils/constants';

// ============================================================
// IndexedDB 数据缓存 (使用 idb-keyval)
// ============================================================

const IDB_CACHE_KEY = 'expense-records-cache';

/**
 * 缓存费用记录到 IndexedDB
 * IndexedDB 不可用时静默降级，不抛错
 */
export async function cacheData(records: ExpenseRecord[]): Promise<void> {
  try {
    await set(IDB_CACHE_KEY, records);
  } catch {
    // IndexedDB 不可用，静默降级
  }
}

/**
 * 从 IndexedDB 加载缓存的费用记录
 * 返回 null 表示无缓存或不可用
 */
export async function loadCachedData(): Promise<ExpenseRecord[] | null> {
  try {
    const data = await get<ExpenseRecord[]>(IDB_CACHE_KEY);
    return data ?? null;
  } catch {
    return null;
  }
}

/**
 * 清除 IndexedDB 缓存数据
 */
export async function clearCachedData(): Promise<void> {
  try {
    await del(IDB_CACHE_KEY);
  } catch {
    // 静默降级
  }
}

/**
 * 检测是否存在缓存数据（不加载完整数据）
 */
export async function hasCachedData(): Promise<boolean> {
  try {
    const data = await get<ExpenseRecord[]>(IDB_CACHE_KEY);
    return Array.isArray(data) && data.length > 0;
  } catch {
    return false;
  }
}

// ============================================================
// localStorage 保存视图
// ============================================================

const VIEWS_STORAGE_KEY = 'saved-views';

/**
 * 保存视图到 localStorage
 * 超过最大数量时移除最早创建的视图
 * localStorage 满时 catch 错误并打印警告
 */
export function saveView(view: SavedView): void {
  try {
    const views = loadViews();
    views.push(view);
    // 超过上限时移除最早的（按 createdAt 排序，删除最旧的）
    while (views.length > MAX_SAVED_VIEWS) {
      views.shift();
    }
    localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(views));
  } catch (e) {
    console.warn('保存视图失败，本地存储空间不足', e);
  }
}

/**
 * 从 localStorage 加载所有保存的视图
 */
export function loadViews(): SavedView[] {
  try {
    const raw = localStorage.getItem(VIEWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed;
  } catch {
    return [];
  }
}

/**
 * 删除指定 ID 的视图
 */
export function deleteView(id: string): void {
  try {
    const views = loadViews();
    const filtered = views.filter((v) => v.id !== id);
    localStorage.setItem(VIEWS_STORAGE_KEY, JSON.stringify(filtered));
  } catch (e) {
    console.warn('删除视图失败', e);
  }
}

// ============================================================
// 视图名称自动生成
// ============================================================

/**
 * 根据筛选状态自动生成视图名称
 * 格式示例: "period:2026-03 / categoryL1:未分类"
 * 只包含非空的筛选字段
 */
export function generateViewName(state: FilterState): string {
  const parts: string[] = [];

  if (state.period) parts.push(`period:${state.period}`);
  if (state.date) parts.push(`date:${state.date}`);
  if (state.dateStart && state.dateEnd) {
    parts.push(`dateRange:${state.dateStart}~${state.dateEnd}`);
  } else if (state.dateStart) {
    parts.push(`dateStart:${state.dateStart}`);
  } else if (state.dateEnd) {
    parts.push(`dateEnd:${state.dateEnd}`);
  }
  if (state.person) parts.push(`person:${state.person}`);
  if (state.department) parts.push(`department:${state.department}`);
  if (state.categoryL1) parts.push(`categoryL1:${state.categoryL1}`);
  if (state.categoryL2) parts.push(`categoryL2:${state.categoryL2}`);
  if (state.categoryL3) parts.push(`categoryL3:${state.categoryL3}`);
  if (state.bankAccount) parts.push(`bankAccount:${state.bankAccount}`);
  if (state.currency) parts.push(`currency:${state.currency}`);
  if (state.importStatus) parts.push(`importStatus:${state.importStatus}`);

  return parts.length > 0 ? parts.join(' / ') : '全部数据';
}
