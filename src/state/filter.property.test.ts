// Feature: game-finance-dashboard, Property 6: Filter Time Priority
/**
 * Property 6: Filter Time Priority
 *
 * *For any* set of ExpenseRecords and FilterState, the filterRecords function SHALL apply
 * time filters in priority order:
 *   1. if date is set, only records with matching date pass
 *   2. else if dateStart/dateEnd are set, only records within the range pass
 *   3. else if period is set (YYYY or YYYY-MM), only records matching the period pass
 * At no point SHALL a lower-priority time filter override a higher-priority one.
 *
 * **Validates: Requirements 5.3, 5.4, 5.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { filterRecords } from '../data/selectors';
import type { ExpenseRecord, FilterState } from '../types/expense';
import { DEFAULT_FILTER_STATE } from '../utils/constants';

// --- Generators ---

/** Generate a valid YYYY-MM-DD date string */
const validDateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

/** Generate a valid YYYY-MM period string */
const periodMonthArb = fc
  .tuple(fc.integer({ min: 2020, max: 2030 }), fc.integer({ min: 1, max: 12 }))
  .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`);

/** Generate a valid YYYY period string */
const periodYearArb = fc.integer({ min: 2020, max: 2030 }).map((y) => `${y}`);

/** Generate a period (either year or month) */
const periodArb = fc.oneof(periodYearArb, periodMonthArb);

/** Generate a minimal valid ExpenseRecord with a given date */
function makeRecord(date: string, id?: string): ExpenseRecord {
  return {
    id: id ?? `batch-1`,
    date,
    amount: 1000,
    amountCNY: 1000,
    currency: 'RMB',
    exchangeRate: 1,
    categoryL1: '研发费用',
    categoryL2: '人工',
    categoryL3: '薪资',
    categoryExtra: '',
    department: '技术部',
    person: '公司A',
    bankAccount: '招行0001',
    periodMonth: date.slice(0, 7),
    transactionType: 'expense',
    importStatus: 'normal',
    sourceRowNo: 1,
  };
}

/** Generate an array of records with various random dates */
const recordsArb = fc
  .array(validDateArb, { minLength: 1, maxLength: 30 })
  .map((dates) => dates.map((date, i) => makeRecord(date, `batch-${i}`)));

/** Generate a base filter state (empty - no filters) */
function baseFilter(): FilterState {
  return { ...DEFAULT_FILTER_STATE };
}

// --- Tests ---

describe('Property 6: Filter Time Priority', () => {
  it('when date is set, only records with matching date pass (regardless of other time fields)', () => {
    fc.assert(
      fc.property(recordsArb, validDateArb, (records, targetDate) => {
        const state: FilterState = {
          ...baseFilter(),
          date: targetDate,
          // also set lower-priority time filters that should be ignored
          dateStart: '2020-01-01',
          dateEnd: '2030-12-31',
          period: '2025',
        };

        const result = filterRecords(records, state);

        // Every result must have the exact target date
        for (const r of result) {
          expect(r.date).toBe(targetDate);
        }

        // All records with that date must be included
        const expected = records.filter((r) => r.date === targetDate);
        expect(result).toHaveLength(expected.length);
      }),
      { numRuns: 100 }
    );
  });

  it('when date AND dateStart/dateEnd are both set, date takes priority', () => {
    fc.assert(
      fc.property(recordsArb, validDateArb, validDateArb, validDateArb, (records, targetDate, rangeStart, rangeEnd) => {
        // Ensure range doesn't include the target date (to prove date priority)
        const adjustedStart = '2020-01-01';
        const adjustedEnd = '2020-01-05';
        // target date outside the range
        const state: FilterState = {
          ...baseFilter(),
          date: '2025-06-15',
          dateStart: adjustedStart,
          dateEnd: adjustedEnd,
        };

        const result = filterRecords(records, state);

        // All results must match the exact date, not the range
        for (const r of result) {
          expect(r.date).toBe('2025-06-15');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('when date is empty and dateStart/dateEnd are set, only records within range pass', () => {
    // Generate ordered date pairs for valid ranges
    const dateRangeArb = fc
      .tuple(validDateArb, validDateArb)
      .map(([a, b]) => (a <= b ? [a, b] : [b, a]) as [string, string]);

    fc.assert(
      fc.property(recordsArb, dateRangeArb, (records, [start, end]) => {
        const state: FilterState = {
          ...baseFilter(),
          date: '', // not set
          dateStart: start,
          dateEnd: end,
          period: '2020', // lower-priority, should be ignored
        };

        const result = filterRecords(records, state);

        // All results must be within the range
        for (const r of result) {
          expect(r.date >= start).toBe(true);
          expect(r.date <= end).toBe(true);
        }

        // All records in range must be included
        const expected = records.filter((r) => r.date >= start && r.date <= end);
        expect(result).toHaveLength(expected.length);
      }),
      { numRuns: 100 }
    );
  });

  it('when date and dateRange are empty, period (YYYY-MM) filters by month', () => {
    fc.assert(
      fc.property(recordsArb, periodMonthArb, (records, period) => {
        const state: FilterState = {
          ...baseFilter(),
          date: '',
          dateStart: '',
          dateEnd: '',
          period,
        };

        const result = filterRecords(records, state);

        // All results must match the period month
        for (const r of result) {
          expect(r.date.startsWith(period)).toBe(true);
        }

        // All matching records must be included
        const expected = records.filter((r) => r.date.startsWith(period));
        expect(result).toHaveLength(expected.length);
      }),
      { numRuns: 100 }
    );
  });

  it('when date and dateRange are empty, period (YYYY) filters by year', () => {
    fc.assert(
      fc.property(recordsArb, periodYearArb, (records, period) => {
        const state: FilterState = {
          ...baseFilter(),
          date: '',
          dateStart: '',
          dateEnd: '',
          period,
        };

        const result = filterRecords(records, state);

        // All results must match the period year
        for (const r of result) {
          expect(r.date.startsWith(period)).toBe(true);
        }

        // All matching records must be included
        const expected = records.filter((r) => r.date.startsWith(period));
        expect(result).toHaveLength(expected.length);
      }),
      { numRuns: 100 }
    );
  });

  it('when all three time fields are set, date wins over dateRange and period', () => {
    fc.assert(
      fc.property(recordsArb, validDateArb, periodArb, (records, targetDate, period) => {
        const state: FilterState = {
          ...baseFilter(),
          date: targetDate,
          dateStart: '2020-01-01',
          dateEnd: '2030-12-31',
          period,
        };

        const result = filterRecords(records, state);

        // date is highest priority: only matching records pass
        const expected = records.filter((r) => r.date === targetDate);
        expect(result).toHaveLength(expected.length);

        for (const r of result) {
          expect(r.date).toBe(targetDate);
        }
      }),
      { numRuns: 100 }
    );
  });
});


// Feature: game-finance-dashboard, Property 9: Currency Filter Correctness
/**
 * Property 9: Currency Filter Correctness
 *
 * *For any* set of ExpenseRecords containing both RMB and USD transactions:
 *   - When currency filter is 'RMB', all returned records SHALL have currency='RMB'
 *   - When currency filter is 'USD', all returned records SHALL have currency='USD'
 *   - When currency filter is empty, records of both currencies SHALL be included
 *
 * **Validates: Requirements 7.3, 7.4**
 */

describe('Property 9: Currency Filter Correctness', () => {
  /** Generate a record with a specific currency */
  function makeRecordWithCurrency(
    currency: 'RMB' | 'USD',
    index: number
  ): ExpenseRecord {
    return {
      id: `batch-cur-${index}`,
      date: '2025-06-15',
      amount: currency === 'USD' ? 1000 : 7200,
      amountCNY: 7200,
      currency,
      exchangeRate: currency === 'USD' ? 7.2 : 1,
      categoryL1: '研发费用',
      categoryL2: '人工',
      categoryL3: '薪资',
      categoryExtra: '',
      department: '技术部',
      person: '公司A',
      bankAccount: '招行0001',
      periodMonth: '2025-06',
      transactionType: 'expense',
      importStatus: 'normal',
      sourceRowNo: index,
    };
  }

  /**
   * Generate a mixed set of records containing BOTH RMB and USD transactions.
   * Uses at least 1 RMB and 1 USD record to guarantee both currencies are present.
   */
  const mixedCurrencyRecordsArb = fc
    .tuple(
      fc.array(fc.constant('RMB' as const), { minLength: 1, maxLength: 15 }),
      fc.array(fc.constant('USD' as const), { minLength: 1, maxLength: 15 })
    )
    .map(([rmbList, usdList]) => {
      const all = [...rmbList, ...usdList];
      return all.map((cur, i) => makeRecordWithCurrency(cur, i));
    });

  it('when currency filter is RMB, all returned records have currency=RMB', () => {
    fc.assert(
      fc.property(mixedCurrencyRecordsArb, (records) => {
        const state: FilterState = {
          ...baseFilter(),
          currency: 'RMB',
        };

        const result = filterRecords(records, state);

        // All results must have currency RMB
        for (const r of result) {
          expect(r.currency).toBe('RMB');
        }

        // All RMB records in input must be included
        const expectedCount = records.filter((r) => r.currency === 'RMB').length;
        expect(result).toHaveLength(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('when currency filter is USD, all returned records have currency=USD', () => {
    fc.assert(
      fc.property(mixedCurrencyRecordsArb, (records) => {
        const state: FilterState = {
          ...baseFilter(),
          currency: 'USD',
        };

        const result = filterRecords(records, state);

        // All results must have currency USD
        for (const r of result) {
          expect(r.currency).toBe('USD');
        }

        // All USD records in input must be included
        const expectedCount = records.filter((r) => r.currency === 'USD').length;
        expect(result).toHaveLength(expectedCount);
      }),
      { numRuns: 100 }
    );
  });

  it('when currency filter is empty, records of both currencies are included', () => {
    fc.assert(
      fc.property(mixedCurrencyRecordsArb, (records) => {
        const state: FilterState = {
          ...baseFilter(),
          currency: '',
        };

        const result = filterRecords(records, state);

        // All records should pass (no currency filter)
        expect(result).toHaveLength(records.length);

        // Both currencies must be present in results
        const currencies = new Set(result.map((r) => r.currency));
        expect(currencies.has('RMB')).toBe(true);
        expect(currencies.has('USD')).toBe(true);
      }),
      { numRuns: 100 }
    );
  });
});
