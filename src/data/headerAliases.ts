/**
 * 表头别名映射表
 *
 * 将标准字段名映射到可识别的中英文表头别名。
 * 匹配时应使用大小写不敏感比较（case-insensitive matching）。
 *
 * 别名覆盖游戏公司费用报表中常见的中文财务术语。
 */
export const HEADER_ALIASES: Record<string, string[]> = {
  date: ['日期', '交易日期', '记账日期', 'date'],
  amount: ['原币金额', '金额', '借方金额', '贷方金额', '交易金额', '交易金额  贷', '交易金额 贷', '交易金额贷', 'amount'],
  amountCNY: ['本位币金额', '人民币金额', '折人民币', 'amountCNY'],
  currency: ['币种', '货币', 'currency'],
  exchangeRate: ['汇率', 'exchangeRate'],
  categoryL1: ['一级分类', '费用大类', 'categoryL1'],
  categoryL2: ['二级分类', '费用分类', 'categoryL2'],
  categoryL3: ['三级分类', '明细分类', 'categoryL3'],
  categoryExtra: ['辅助分类', '标签', '分类2', 'categoryExtra'],
  department: ['部门', '项目', '部门/项目', 'department'],
  person: ['主体', '公司', '公司主体', 'person'],
  bankAccount: ['银行账户', '账户', '银行', 'bankAccount'],
  periodMonth: ['期间', '月份', 'periodMonth'],
  transactionType: ['交易类型', '收支类型', 'transactionType'],
};
