/**
 * 数据标准化模块
 *
 * 负责将 Excel 原始行数据转换为 ExpenseRecord 结构，
 * 包括日期/币种/金额标准化、默认值填充和导入状态判定。
 *
 * Requirements: 3.1-3.11, 4.1-4.6
 */

import { parseDateValue } from '../utils/dateUtils';
import type {
  RawRow,
  FieldMapping,
  ImportConfig,
  NormalizeResult,
  ImportSummary,
  ExpenseRecord,
  ImportStatus,
  TransactionType,
} from '../types/expense';

/**
 * 标准化原始行数据为 ExpenseRecord 数组。
 *
 * 对每一行：提取映射字段值 → 日期/币种/金额标准化 → 默认值填充 → 状态判定。
 *
 * @param rows - 原始行数据数组
 * @param mapping - 字段映射（标准字段名 → 实际列名）
 * @param config - 导入配置（默认汇率、批次 ID）
 * @returns NormalizeResult 包含标准化记录和导入摘要
 */
export function normalizeRecords(
  rows: RawRow[],
  mapping: FieldMapping,
  config: ImportConfig
): NormalizeResult {
  const records: ExpenseRecord[] = [];
  let normalRows = 0;
  let pendingClassifyRows = 0;
  let abnormalRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const sourceRowNo = i + 2; // Excel 1-based + header row

    const record = normalizeRow(row, mapping, config, sourceRowNo);
    records.push(record);

    switch (record.importStatus) {
      case 'normal':
        normalRows++;
        break;
      case 'pending_classify':
        pendingClassifyRows++;
        break;
      case 'abnormal':
        abnormalRows++;
        break;
    }
  }

  const summary: ImportSummary = {
    totalRows: rows.length,
    normalRows,
    pendingClassifyRows,
    abnormalRows,
    fieldMapping: mapping,
  };

  return { records, summary };
}

/**
 * 判定导入状态。
 *
 * - 'normal': date 有效, amount 有限数字, currency 为 RMB|USD,
 *   periodMonth 有效, categoryL1 非 '未分类', transactionType 非 'unclassified',
 *   department 非 '未分配部门'
 * - 'pending_classify': amount 有效但分类/交易类型/部门缺失
 * - 'abnormal': date 无效, amount 非数字/非有限, currency 不支持,
 *   或 amountCNY 与计算值偏差 > 0.01
 */
export function determineImportStatus(record: Partial<ExpenseRecord>): ImportStatus {
  // Check abnormal conditions first
  const date = record.date;
  const amount = record.amount;
  const currency = record.currency;
  const periodMonth = record.periodMonth;

  // Date invalid
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return 'abnormal';
  }

  // Amount not a finite number
  if (amount == null || typeof amount !== 'number' || !Number.isFinite(amount)) {
    return 'abnormal';
  }

  // Currency unsupported
  if (currency !== 'RMB' && currency !== 'USD') {
    return 'abnormal';
  }

  // periodMonth invalid
  if (!periodMonth || !/^\d{4}-\d{2}$/.test(periodMonth)) {
    return 'abnormal';
  }

  // AmountCNY consistency check: if amountCNY provided and differs from computed
  if (
    record.amountCNY != null &&
    record.exchangeRate != null &&
    amount != null
  ) {
    const computed = amount * record.exchangeRate;
    if (Math.abs(record.amountCNY - computed) > 0.01) {
      return 'abnormal';
    }
  }

  // Check pending_classify conditions
  const categoryL1 = record.categoryL1;
  const transactionType = record.transactionType;
  const department = record.department;

  if (
    categoryL1 === '未分类' ||
    transactionType === 'unclassified' ||
    department === '未分配部门'
  ) {
    return 'pending_classify';
  }

  return 'normal';
}

/**
 * 标准化单行数据为 ExpenseRecord。
 */
function normalizeRow(
  row: RawRow,
  mapping: FieldMapping,
  config: ImportConfig,
  sourceRowNo: number
): ExpenseRecord {
  // Extract raw values using field mapping
  const rawDate = getFieldValue(row, mapping, 'date');
  const rawAmount = getFieldValue(row, mapping, 'amount');
  const rawAmountCNY = getFieldValue(row, mapping, 'amountCNY');
  const rawCurrency = getFieldValue(row, mapping, 'currency');
  const rawExchangeRate = getFieldValue(row, mapping, 'exchangeRate');
  const rawCategoryL1 = getFieldValue(row, mapping, 'categoryL1');
  const rawCategoryL2 = getFieldValue(row, mapping, 'categoryL2');
  const rawCategoryL3 = getFieldValue(row, mapping, 'categoryL3');
  const rawCategoryExtra = getFieldValue(row, mapping, 'categoryExtra');
  const rawDepartment = getFieldValue(row, mapping, 'department');
  const rawPerson = getFieldValue(row, mapping, 'person');
  const rawBankAccount = getFieldValue(row, mapping, 'bankAccount');
  const rawPeriodMonth = getFieldValue(row, mapping, 'periodMonth');
  const rawTransactionType = getFieldValue(row, mapping, 'transactionType');

  // --- Date standardization ---
  const date = parseDateValue(rawDate) ?? '';

  // --- PeriodMonth: derive from date if missing or non-standard format ---
  let periodMonth = normalizePeriodMonth(rawPeriodMonth);
  if (!periodMonth && date.length >= 7) {
    periodMonth = date.slice(0, 7);
  }

  // --- Currency standardization ---
  const currency = normalizeCurrency(rawCurrency);

  // --- Amount ---
  const amount = toFiniteNumber(rawAmount);

  // --- Exchange rate ---
  let exchangeRate = toFiniteNumber(rawExchangeRate);
  if (exchangeRate == null || exchangeRate === 0) {
    if (currency === 'RMB') {
      exchangeRate = 1;
    } else if (currency === 'USD') {
      exchangeRate = config.defaultUsdRate;
    } else {
      exchangeRate = 1;
    }
  }

  // --- AmountCNY ---
  const providedAmountCNY = toFiniteNumber(rawAmountCNY);
  let amountCNY: number;
  let amountCNYFromExcel = false;

  if (providedAmountCNY != null) {
    amountCNY = providedAmountCNY;
    amountCNYFromExcel = true;
  } else {
    amountCNY = (amount ?? 0) * exchangeRate;
  }

  // --- Default value filling ---
  const categoryL1 = normalizeString(rawCategoryL1) || '未分类';
  const categoryL2 = normalizeString(rawCategoryL2) || '';
  const categoryL3 = normalizeString(rawCategoryL3) || '';
  const categoryExtra = normalizeString(rawCategoryExtra) || '';
  const department = normalizeString(rawDepartment) || '未分配部门';
  const person = normalizeString(rawPerson) || '';
  const bankAccount = normalizeString(rawBankAccount) || '';
  const transactionType = normalizeTransactionType(rawTransactionType);

  // --- ID generation ---
  const id = `${config.importBatchId}-${sourceRowNo}`;

  // Build partial record for status determination
  const partialRecord: Partial<ExpenseRecord> = {
    date,
    amount: amount ?? NaN,
    amountCNY,
    currency: currency as ExpenseRecord['currency'],
    exchangeRate,
    periodMonth,
    categoryL1,
    transactionType,
    department,
  };

  // For amountCNY consistency check, only flag if Excel provided a value
  // We need to check if provided amountCNY differs from computed
  let importStatus: ImportStatus;
  if (amountCNYFromExcel && amount != null && Number.isFinite(amount)) {
    const computed = amount * exchangeRate;
    if (Math.abs(amountCNY - computed) > 0.01) {
      importStatus = 'abnormal';
    } else {
      importStatus = determineImportStatus(partialRecord);
    }
  } else {
    importStatus = determineImportStatus(partialRecord);
  }

  // Collect unmapped raw fields
  const rawFields = collectUnmappedFields(row, mapping);

  return {
    id,
    date,
    amount: amount ?? NaN,
    amountCNY,
    currency: (currency === 'RMB' || currency === 'USD' ? currency : 'RMB') as ExpenseRecord['currency'],
    exchangeRate,
    categoryL1,
    categoryL2,
    categoryL3,
    categoryExtra,
    department,
    person,
    bankAccount,
    periodMonth,
    transactionType,
    importStatus,
    sourceRowNo,
    rawFields: Object.keys(rawFields).length > 0 ? rawFields : undefined,
  };
}

/**
 * 从 RawRow 中获取指定标准字段对应的值。
 */
function getFieldValue(
  row: RawRow,
  mapping: FieldMapping,
  standardField: string
): unknown {
  const actualColumn = mapping[standardField];
  if (!actualColumn) return undefined;
  return row[actualColumn];
}

/**
 * 标准化币种值。
 * RMB/CNY/人民币 → 'RMB'; USD/美元 → 'USD'; 其他 → 原值或空串
 */
function normalizeCurrency(value: unknown): string {
  if (value == null) return '';
  const str = String(value).trim().toUpperCase();

  if (str === 'RMB' || str === 'CNY' || str === '人民币') {
    return 'RMB';
  }
  if (str === 'USD' || str === '美元') {
    return 'USD';
  }
  return str; // unsupported currency - will be marked abnormal
}

/**
 * 标准化交易类型。
 */
function normalizeTransactionType(value: unknown): TransactionType {
  if (value == null) return 'unclassified';
  const str = String(value).trim().toLowerCase();

  switch (str) {
    case 'expense':
    case '支出':
    case '费用':
      return 'expense';
    case 'income':
    case '收入':
      return 'income';
    case 'intercompany':
    case '关联交易':
    case '内部往来':
      return 'intercompany';
    default:
      return 'unclassified';
  }
}

/**
 * 将值转换为有限数字，无效则返回 null。
 * 支持带千分位逗号的数字字符串（如 "10,000.00"）
 */
function toFiniteNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'string') {
    // 去除千分位逗号和空格
    const trimmed = value.trim().replace(/,/g, '');
    if (!trimmed) return null;
    const num = Number(trimmed);
    return Number.isFinite(num) ? num : null;
  }
  return null;
}

/**
 * 将值转为 trimmed string，无效则返回空字符串。
 */
function normalizeString(value: unknown): string {
  if (value == null) return '';
  return String(value).trim();
}

/**
 * 标准化期间字段为 YYYY-MM 格式。
 * 支持：'2025年1月'、'2025年01月'、'2025-01'、'202501' 等
 */
function normalizePeriodMonth(value: unknown): string {
  if (value == null) return '';
  const str = String(value).trim().replace(/"/g, '');
  if (!str) return '';

  // 已经是 YYYY-MM 格式
  if (/^\d{4}-\d{2}$/.test(str)) return str;

  // 中文格式：2025年1月 或 2025年01月
  const chineseMatch = str.match(/^(\d{4})\s*年\s*(\d{1,2})\s*月?$/);
  if (chineseMatch) {
    const year = chineseMatch[1];
    const month = chineseMatch[2].padStart(2, '0');
    return `${year}-${month}`;
  }

  // 紧凑格式：202501
  if (/^\d{6}$/.test(str)) {
    return `${str.slice(0, 4)}-${str.slice(4, 6)}`;
  }

  return '';
}

/**
 * 收集未映射的原始字段。
 */
function collectUnmappedFields(
  row: RawRow,
  mapping: FieldMapping
): Record<string, unknown> {
  const mappedColumns = new Set(Object.values(mapping));
  const unmapped: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (!mappedColumns.has(key) && value != null) {
      unmapped[key] = value;
    }
  }

  return unmapped;
}
