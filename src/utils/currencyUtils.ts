/**
 * 币种/金额显示工具函数
 * Requirements: 7.1, 7.2
 */

import type { CurrencyMode } from '../types/expense';

/**
 * 格式化金额为展示字符串
 * - CNY 模式：「X.X万」
 * - USD 模式：「$X.X万」（amountCNY ÷ usdRate 后再换算为万）
 *
 * @param amountCNY 人民币金额（单位：元）
 * @param currencyMode 展示口径
 * @param usdRate 美元汇率
 * @returns 格式化后的金额字符串
 */
export function displayMoney(
  amountCNY: number,
  currencyMode: CurrencyMode,
  usdRate: number
): string {
  if (currencyMode === 'CNY') {
    return `${(amountCNY / 10000).toFixed(1)}万`;
  }
  // USD 模式：先转换为美元，再换算为万
  return `$${(amountCNY / usdRate / 10000).toFixed(1)}万`;
}

/**
 * 将人民币金额转换为展示口径对应的数值
 * - CNY 模式：直接返回原值
 * - USD 模式：返回 amountCNY ÷ rate
 *
 * @param amountCNY 人民币金额（单位：元）
 * @param mode 展示口径
 * @param rate 美元汇率
 * @returns 转换后的数值
 */
export function convertToDisplayCurrency(
  amountCNY: number,
  mode: CurrencyMode,
  rate: number
): number {
  if (mode === 'CNY') {
    return amountCNY;
  }
  return amountCNY / rate;
}
