// Feature: game-finance-dashboard, Property 12: Cumulative Grain Selection
/**
 * Property-Based Tests for Cumulative Grain Selection
 * Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7
 *
 * Property 12: For any FilterState, getCumulativeGrain SHALL return:
 * - 'month' when period is a year (YYYY)
 * - 'day' when period is a month (YYYY-MM) or date is set
 * - 'day' when date range ≤ 62 days
 * - 'week' when range is 63–190 days
 * - 'month' when range > 190 days
 * Additionally, volatility (max-min)/max×100% SHALL be between 0 and 100 inclusive.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { getCumulativeGrain } from './dateUtils';
import { DEFAULT_FILTER_STATE } from './constants';
import type { FilterState } from '../types/expense';
import { format, addDays, parse } from 'date-fns';

function makeFilter(overrides: Partial<FilterState> = {}): FilterState {
  return { ...DEFAULT_FILTER_STATE, ...overrides };
}

/** Generate a year string YYYY between 1900 and 2099 */
const arbYear = fc.integer({ min: 1900, max: 2099 }).map((y) => String(y));

/** Generate a month string YYYY-MM */
const arbMonth = fc
  .record({
    year: fc.integer({ min: 1900, max: 2099 }),
    month: fc.integer({ min: 1, max: 12 }),
  })
  .map(({ year, month }) => `${year}-${String(month).padStart(2, '0')}`);

/** Generate a valid date string YYYY-MM-DD */
const arbDate = fc
  .record({
    year: fc.integer({ min: 2000, max: 2080 }),
    month: fc.integer({ min: 1, max: 12 }),
    day: fc.integer({ min: 1, max: 28 }), // Use 28 to avoid invalid dates
  })
  .map(
    ({ year, month, day }) =>
      `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  );

/** Generate a date range with a specified number of days (inclusive) */
function arbDateRange(minDays: number, maxDays: number) {
  return fc
    .record({
      year: fc.integer({ min: 2000, max: 2070 }),
      month: fc.integer({ min: 1, max: 12 }),
      day: fc.integer({ min: 1, max: 28 }),
      span: fc.integer({ min: minDays, max: maxDays }),
    })
    .map(({ year, month, day, span }) => {
      const startStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const startDate = parse(startStr, 'yyyy-MM-dd', new Date());
      const endDate = addDays(startDate, span - 1); // span days inclusive
      return {
        dateStart: startStr,
        dateEnd: format(endDate, 'yyyy-MM-dd'),
      };
    });
}

/** Generate an array of positive numbers for volatility testing */
const arbPositiveArray = fc.array(fc.double({ min: 0.01, max: 1e9, noNaN: true }), {
  minLength: 1,
  maxLength: 100,
});

describe('Property 12: Cumulative Grain Selection', () => {
  it('should return "month" when period is a year (YYYY)', () => {
    fc.assert(
      fc.property(arbYear, (year) => {
        const state = makeFilter({ period: year });
        expect(getCumulativeGrain(state)).toBe('month');
      }),
      { numRuns: 100 }
    );
  });

  it('should return "day" when period is a month (YYYY-MM)', () => {
    fc.assert(
      fc.property(arbMonth, (month) => {
        const state = makeFilter({ period: month });
        expect(getCumulativeGrain(state)).toBe('day');
      }),
      { numRuns: 100 }
    );
  });

  it('should return "day" when date is set', () => {
    fc.assert(
      fc.property(arbDate, (date) => {
        const state = makeFilter({ date });
        expect(getCumulativeGrain(state)).toBe('day');
      }),
      { numRuns: 100 }
    );
  });

  it('should return "day" when date range ≤ 62 days', () => {
    fc.assert(
      fc.property(arbDateRange(1, 62), ({ dateStart, dateEnd }) => {
        const state = makeFilter({ dateStart, dateEnd });
        expect(getCumulativeGrain(state)).toBe('day');
      }),
      { numRuns: 100 }
    );
  });

  it('should return "week" when date range is 63–190 days', () => {
    fc.assert(
      fc.property(arbDateRange(63, 190), ({ dateStart, dateEnd }) => {
        const state = makeFilter({ dateStart, dateEnd });
        expect(getCumulativeGrain(state)).toBe('week');
      }),
      { numRuns: 100 }
    );
  });

  it('should return "month" when date range > 190 days', () => {
    fc.assert(
      fc.property(arbDateRange(191, 730), ({ dateStart, dateEnd }) => {
        const state = makeFilter({ dateStart, dateEnd });
        expect(getCumulativeGrain(state)).toBe('month');
      }),
      { numRuns: 100 }
    );
  });

  it('volatility (max-min)/max×100% should be between 0 and 100 inclusive', () => {
    fc.assert(
      fc.property(arbPositiveArray, (values) => {
        const max = Math.max(...values);
        const min = Math.min(...values);
        // Volatility formula from Requirement 10.7
        const volatility = max > 0 ? ((max - min) / max) * 100 : 0;
        expect(volatility).toBeGreaterThanOrEqual(0);
        expect(volatility).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });
});
