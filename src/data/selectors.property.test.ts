// Feature: game-finance-dashboard, Property 10: KPI Calculation Invariants
/**
 * Property 10: KPI Calculation Invariants
 *
 * *For any* set of filtered ExpenseRecords:
 * (1) confirmedExpense SHALL equal the sum of amountCNY where transactionType='expense' AND importStatus='normal'
 * (2) rawAmount SHALL equal the sum of all records' amountCNY
 * (3) pendingAmount SHALL equal the sum of amountCNY where importStatus!='normal' OR categoryL1='未分类'
 * (4) peakAmount SHALL equal the maximum value when records are grouped by periodMonth and summed
 * (5) confirmedExpense + pendingAmount SHALL be ≤ rawAmount (approximate due to floating point)
 *
 * **Validates: Requirements 8.1, 8.2, 8.3, 8.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getKpis, filterRecords, getDepartmentRanking, getCategoryDistribution } from '../data/selectors';
import { DEFAULT_FILTER_STATE } from '../utils/constants';
import type { ExpenseRecord, TransactionType, ImportStatus } from '../types/expense';

describe('Property 10: KPI Calculation Invariants', () => {
  // --- Generators ---

  const transactionTypeArb = fc.constantFrom<TransactionType>('expense', 'income', 'intercompany', 'unclassified');
  const importStatusArb = fc.constantFrom<ImportStatus>('normal', 'pending_classify', 'abnormal');
  const categoryL1Arb = fc.constantFrom('研发费用', '市场推广', '人力成本', '行政办公', '未分类');
  const periodMonthArb = fc.constantFrom('2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06',
    '2024-07', '2024-08', '2024-09', '2024-10', '2024-11', '2024-12');
  const amountCNYArb = fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

  /** Generate a valid ExpenseRecord with varying key fields */
  const expenseRecordArb = fc.tuple(
    fc.nat({ max: 9999 }),
    amountCNYArb,
    transactionTypeArb,
    importStatusArb,
    categoryL1Arb,
    periodMonthArb
  ).map(([rowNo, amountCNY, transactionType, importStatus, categoryL1, periodMonth]): ExpenseRecord => ({
    id: `batch-${rowNo}`,
    date: `${periodMonth}-15`,
    amount: amountCNY,
    amountCNY,
    currency: 'RMB',
    exchangeRate: 1,
    categoryL1,
    categoryL2: '子分类',
    categoryL3: '明细分类',
    categoryExtra: '',
    department: '技术部',
    person: '主体A',
    bankAccount: '工商银行',
    periodMonth,
    transactionType,
    importStatus,
    sourceRowNo: rowNo,
  }));

  /** Generate an array of ExpenseRecords */
  const recordsArb = fc.array(expenseRecordArb, { minLength: 0, maxLength: 50 });

  // --- Tests ---

  it('(1) confirmedExpense equals sum of amountCNY where transactionType=expense AND importStatus=normal AND categoryL1≠未分类', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const kpis = getKpis(records, DEFAULT_FILTER_STATE);

        const expected = records
          .filter((r) => r.transactionType === 'expense' && r.importStatus === 'normal' && r.categoryL1 !== '未分类')
          .reduce((sum, r) => sum + r.amountCNY, 0);

        expect(Math.abs(kpis.confirmedExpense - expected)).toBeLessThan(0.001);
      }),
      { numRuns: 100 }
    );
  });

  it('(2) rawAmount equals the sum of all records amountCNY', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const kpis = getKpis(records, DEFAULT_FILTER_STATE);

        const expected = records.reduce((sum, r) => sum + r.amountCNY, 0);

        expect(Math.abs(kpis.rawAmount - expected)).toBeLessThan(0.001);
      }),
      { numRuns: 100 }
    );
  });

  it('(3) pendingAmount equals sum of amountCNY where importStatus!=normal OR categoryL1=未分类', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const kpis = getKpis(records, DEFAULT_FILTER_STATE);

        const expected = records
          .filter((r) => r.importStatus !== 'normal' || r.categoryL1 === '未分类')
          .reduce((sum, r) => sum + r.amountCNY, 0);

        expect(Math.abs(kpis.pendingAmount - expected)).toBeLessThan(0.001);
      }),
      { numRuns: 100 }
    );
  });

  it('(4) peakAmount equals the maximum monthly sum when records are grouped by periodMonth', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const kpis = getKpis(records, DEFAULT_FILTER_STATE);

        // Manually group by periodMonth and find max sum
        const monthlyMap = new Map<string, number>();
        for (const r of records) {
          monthlyMap.set(r.periodMonth, (monthlyMap.get(r.periodMonth) ?? 0) + r.amountCNY);
        }

        let expectedPeak = 0;
        for (const amount of monthlyMap.values()) {
          if (amount > expectedPeak) {
            expectedPeak = amount;
          }
        }

        expect(Math.abs(kpis.peakAmount - expectedPeak)).toBeLessThan(0.001);
      }),
      { numRuns: 100 }
    );
  });

  it('(5) confirmedExpense + pendingAmount <= rawAmount (with floating point tolerance)', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const kpis = getKpis(records, DEFAULT_FILTER_STATE);

        // Allow small floating-point tolerance (epsilon)
        const tolerance = 0.001;
        expect(kpis.confirmedExpense + kpis.pendingAmount).toBeLessThanOrEqual(kpis.rawAmount + tolerance);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: game-finance-dashboard, Property 14: Department Ranking Sort Order
/**
 * Property 14: Department Ranking Sort Order
 *
 * *For any* set of ExpenseRecords and FilterState, getDepartmentRanking SHALL return
 * departments sorted in strictly non-increasing order by amount, computed using all
 * filters EXCEPT department.
 *
 * **Validates: Requirements 13.1**
 */

describe('Property 14: Department Ranking Sort Order', () => {
  // --- Generators ---

  const departmentArb = fc.constantFrom('技术部', '市场部', '人力资源部', '财务部', '行政部', '产品部', '运营部');
  const amountCNYArb = fc.double({ min: 0.01, max: 1_000_000, noNaN: true, noDefaultInfinity: true });
  const periodMonthArb = fc.constantFrom('2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06');

  /** Generate a valid ExpenseRecord with varying departments */
  const expenseRecordArb = fc.tuple(
    fc.nat({ max: 9999 }),
    amountCNYArb,
    departmentArb,
    periodMonthArb
  ).map(([rowNo, amountCNY, department, periodMonth]): ExpenseRecord => ({
    id: `batch-${rowNo}`,
    date: `${periodMonth}-15`,
    amount: amountCNY,
    amountCNY,
    currency: 'RMB',
    exchangeRate: 1,
    categoryL1: '研发费用',
    categoryL2: '子分类',
    categoryL3: '明细分类',
    categoryExtra: '',
    department,
    person: '主体A',
    bankAccount: '工商银行',
    periodMonth,
    transactionType: 'expense',
    importStatus: 'normal',
    sourceRowNo: rowNo,
  }));

  /** Generate an array of ExpenseRecords with at least 1 record */
  const recordsArb = fc.array(expenseRecordArb, { minLength: 1, maxLength: 50 });

  // --- Tests ---

  it('result is sorted in non-increasing order by amount', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const ranking = getDepartmentRanking(records, DEFAULT_FILTER_STATE);

        // Verify non-increasing order: each element's amount >= next element's amount
        for (let i = 0; i < ranking.length - 1; i++) {
          expect(ranking[i].amount).toBeGreaterThanOrEqual(ranking[i + 1].amount);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('all unique departments in the records appear in the result', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const ranking = getDepartmentRanking(records, DEFAULT_FILTER_STATE);

        // Collect all unique departments from records
        const uniqueDepartments = new Set(records.map((r) => r.department));

        // All unique departments should appear in the ranking
        const rankedDepartments = new Set(ranking.map((r) => r.department));
        for (const dept of uniqueDepartments) {
          expect(rankedDepartments.has(dept)).toBe(true);
        }

        // Ranking should have exactly as many entries as unique departments
        expect(ranking.length).toBe(uniqueDepartments.size);
      }),
      { numRuns: 100 }
    );
  });
});

// Feature: game-finance-dashboard, Property 13: Category Distribution Invariants
/**
 * Property 13: Category Distribution Invariants
 *
 * *For any* set of ExpenseRecords and FilterState, getCategoryDistribution SHALL:
 * (1) compute distribution based on all filters EXCEPT categoryL1/L2/L3
 * (2) produce shares that sum to approximately 1.0 (±0.001) when records exist
 * (3) include every distinct categoryL1 value present in the filtered base
 * (4) each item's amount SHALL be non-negative
 *
 * **Validates: Requirements 11.1, 11.3**
 */

describe('Property 13: Category Distribution Invariants', () => {
  // --- Generators ---

  const transactionTypeArb = fc.constantFrom<TransactionType>('expense', 'income', 'intercompany', 'unclassified');
  const importStatusArb = fc.constantFrom<ImportStatus>('normal', 'pending_classify', 'abnormal');
  const categoryL1Values = ['研发费用', '市场推广', '人力成本', '行政办公', '未分类'] as const;
  const categoryL1Arb = fc.constantFrom(...categoryL1Values);
  const departmentArb = fc.constantFrom('技术部', '市场部', '财务部', '人事部');
  const personArb = fc.constantFrom('主体A', '主体B', '主体C');
  const currencyArb = fc.constantFrom<'RMB' | 'USD'>('RMB', 'USD');
  const periodMonthArb = fc.constantFrom('2024-01', '2024-02', '2024-03', '2024-04', '2024-05', '2024-06');
  const amountCNYArb = fc.double({ min: 0, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

  /** Generate a valid ExpenseRecord with varying key fields */
  const expenseRecordArb = fc.tuple(
    fc.nat({ max: 9999 }),
    amountCNYArb,
    transactionTypeArb,
    importStatusArb,
    categoryL1Arb,
    departmentArb,
    personArb,
    currencyArb,
    periodMonthArb
  ).map(([rowNo, amountCNY, transactionType, importStatus, categoryL1, department, person, currency, periodMonth]): ExpenseRecord => ({
    id: `batch-${rowNo}`,
    date: `${periodMonth}-15`,
    amount: amountCNY,
    amountCNY,
    currency,
    exchangeRate: currency === 'RMB' ? 1 : 7.2,
    categoryL1,
    categoryL2: '子分类',
    categoryL3: '明细分类',
    categoryExtra: '',
    department,
    person,
    bankAccount: '工商银行',
    periodMonth,
    transactionType,
    importStatus,
    sourceRowNo: rowNo,
  }));

  /** Generate an array of ExpenseRecords (at least 1 record for share-sum tests) */
  const recordsArb = fc.array(expenseRecordArb, { minLength: 1, maxLength: 50 });
  const recordsWithEmptyArb = fc.array(expenseRecordArb, { minLength: 0, maxLength: 50 });

  /** Generate a FilterState that may have categoryL1/L2/L3 set (to verify they are excluded) */
  const filterStateArb = fc.record({
    period: fc.constantFrom('', '2024', '2024-03'),
    date: fc.constant(''),
    dateStart: fc.constant(''),
    dateEnd: fc.constant(''),
    person: fc.constantFrom('', '主体A', '主体B'),
    department: fc.constantFrom('', '技术部', '市场部'),
    categoryL1: fc.constantFrom('', '研发费用', '市场推广'),
    categoryL2: fc.constantFrom('', '子分类'),
    categoryL3: fc.constantFrom('', '明细分类'),
    bankAccount: fc.constant(''),
    currency: fc.constantFrom<'' | 'RMB' | 'USD'>('', 'RMB', 'USD'),
    importStatus: fc.constantFrom<'' | 'normal' | 'pending_classify' | 'abnormal'>('', 'normal'),
    currencyMode: fc.constant<'CNY'>('CNY'),
    trendGrain: fc.constant<'' | 'month'>(''),
    trendManual: fc.constant(false),
  });

  // --- Tests ---

  it('(1) distribution ignores categoryL1/L2/L3 filters - same result regardless of category filter', () => {
    fc.assert(
      fc.property(recordsWithEmptyArb, filterStateArb, (records, state) => {
        // Get distribution with the given state (which may have category filters)
        const result = getCategoryDistribution(records, state);

        // Get distribution with category filters explicitly cleared
        const stateWithoutCategory = { ...state, categoryL1: '', categoryL2: '', categoryL3: '' };
        const resultNoCategory = getCategoryDistribution(records, stateWithoutCategory);

        // Both should produce identical results since getCategoryDistribution ignores category filters
        expect(result.length).toBe(resultNoCategory.length);
        for (let i = 0; i < result.length; i++) {
          expect(result[i].categoryL1).toBe(resultNoCategory[i].categoryL1);
          expect(Math.abs(result[i].amount - resultNoCategory[i].amount)).toBeLessThan(0.001);
          expect(Math.abs(result[i].share - resultNoCategory[i].share)).toBeLessThan(0.001);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('(2) shares sum to approximately 1.0 (±0.001) when records exist after filtering', () => {
    fc.assert(
      fc.property(recordsArb, (records) => {
        const result = getCategoryDistribution(records, DEFAULT_FILTER_STATE);

        if (result.length > 0) {
          const shareSum = result.reduce((sum, item) => sum + item.share, 0);
          expect(Math.abs(shareSum - 1.0)).toBeLessThan(0.001);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('(3) includes every distinct categoryL1 value present in the filtered base', () => {
    fc.assert(
      fc.property(recordsArb, filterStateArb, (records, state) => {
        const result = getCategoryDistribution(records, state);

        // Compute the filtered base (same as getCategoryDistribution internally does: ignore category filters)
        const baseState = { ...state, categoryL1: '', categoryL2: '', categoryL3: '' };
        const filteredBase = filterRecords(records, baseState);

        // Collect distinct categoryL1 from the filtered base
        const expectedCategories = new Set(filteredBase.map((r) => r.categoryL1));
        const resultCategories = new Set(result.map((item) => item.categoryL1));

        // Every category in the filtered base should appear in the result
        for (const cat of expectedCategories) {
          expect(resultCategories.has(cat)).toBe(true);
        }

        // And vice versa: result shouldn't contain categories not in the filtered base
        for (const cat of resultCategories) {
          expect(expectedCategories.has(cat)).toBe(true);
        }
      }),
      { numRuns: 100 }
    );
  });

  it('(4) each item amount is non-negative', () => {
    fc.assert(
      fc.property(recordsWithEmptyArb, filterStateArb, (records, state) => {
        const result = getCategoryDistribution(records, state);

        for (const item of result) {
          expect(item.amount).toBeGreaterThanOrEqual(0);
        }
      }),
      { numRuns: 100 }
    );
  });
});
