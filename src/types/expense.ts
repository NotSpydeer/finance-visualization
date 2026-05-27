/**
 * 费用记录核心类型定义
 * Requirements: 3.1-3.11, 4.1-4.5, 5.1
 */

/** 交易类型 */
export type TransactionType = 'expense' | 'income' | 'intercompany' | 'unclassified';

/** 导入状态 */
export type ImportStatus = 'normal' | 'pending_classify' | 'abnormal';

/** 币种展示口径 */
export type CurrencyMode = 'CNY' | 'USD';

/** 趋势图时间粒度 */
export type TrendGrain = 'year' | 'quarter' | 'month' | 'day';

/** 费用记录数据模型 */
export interface ExpenseRecord {
  /** 唯一 ID: `${importBatchId}-${sourceRowNo}` */
  id: string;
  /** 交易日期 YYYY-MM-DD */
  date: string;
  /** 原币金额 */
  amount: number;
  /** 本位币金额（人民币） */
  amountCNY: number;
  /** 交易原币种 */
  currency: 'RMB' | 'USD';
  /** 汇率 */
  exchangeRate: number;
  /** 一级分类 */
  categoryL1: string;
  /** 二级分类 */
  categoryL2: string;
  /** 三级分类 */
  categoryL3: string;
  /** 辅助分类 */
  categoryExtra: string;
  /** 部门/项目 */
  department: string;
  /** 主体/公司实体 */
  person: string;
  /** 银行账户 */
  bankAccount: string;
  /** 期间 YYYY-MM */
  periodMonth: string;
  /** 交易类型 */
  transactionType: TransactionType;
  /** 导入状态 */
  importStatus: ImportStatus;
  /** Excel 原始行号 */
  sourceRowNo: number;
  /** 未映射字段缓存 */
  rawFields?: Record<string, unknown>;
}

/** 全局筛选状态 */
export interface FilterState {
  /** '' | 'YYYY' | 'YYYY-MM' */
  period: string;
  /** '' | 'YYYY-MM-DD' */
  date: string;
  /** 日期区间开始 */
  dateStart: string;
  /** 日期区间结束 */
  dateEnd: string;
  /** 主体筛选 */
  person: string;
  /** 部门筛选 */
  department: string;
  /** 一级分类筛选 */
  categoryL1: string;
  /** 二级分类筛选 */
  categoryL2: string;
  /** 三级分类筛选 */
  categoryL3: string;
  /** 银行账户筛选 */
  bankAccount: string;
  /** 币种筛选 */
  currency: '' | 'RMB' | 'USD';
  /** 导入状态筛选 */
  importStatus: '' | 'normal' | 'pending_classify' | 'abnormal';
  /** 展示口径 */
  currencyMode: CurrencyMode;
  /** 趋势粒度（空表示自动） */
  trendGrain: TrendGrain | '';
  /** 是否用户手动设置粒度 */
  trendManual: boolean;
}

/** 导入摘要 */
export interface ImportSummary {
  totalRows: number;
  normalRows: number;
  pendingClassifyRows: number;
  abnormalRows: number;
  fieldMapping: FieldMapping;
}

/** 导入配置 */
export interface ImportConfig {
  defaultUsdRate: number;
  importBatchId: string;
}

/** 保存的筛选视图 */
export interface SavedView {
  id: string;
  name: string;
  state: FilterState;
  createdAt: string;
}

/** 字段映射：标准字段名 -> 实际列名 */
export type FieldMapping = Record<string, string>;

/** Excel 原始行数据 */
export type RawRow = Record<string, unknown>;

/** 解析结果 */
export interface ParseResult {
  success: boolean;
  rows: RawRow[];
  fieldMapping: FieldMapping;
  errors: ParseError[];
}

/** 解析错误 */
export interface ParseError {
  type: 'missing_header' | 'invalid_format' | 'no_valid_headers';
  /** 中文错误信息 */
  message: string;
}

/** 标准化结果 */
export interface NormalizeResult {
  records: ExpenseRecord[];
  summary: ImportSummary;
}
