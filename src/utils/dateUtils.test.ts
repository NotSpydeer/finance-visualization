/**
 * 日期工具函数单元测试
 * Validates: Requirements 9.1-9.5, 10.1-10.6
 */

import { describe, it, expect } from 'vitest';
import {
  parseDateValue,
  getDefaultTrendGrain,
  getCumulativeGrain,
  getDateWindow,
  monthRange,
  dateRange,
  quarterRange,
} from './dateUtils';
import type { FilterState } from '../types/expense';
import { DEFAULT_FILTER_STATE } from './constants';

function makeFilter(overrides: Partial<FilterState> = {}): FilterState {
  return { ...DEFAULT_FILTER_STATE, ...overrides };
}

describe('parseDateValue', () => {
  describe('Excel serial date numbers', () => {
    it('should parse serial 1 as 1900-01-01', () => {
      expect(parseDateValue(1)).toBe('1900-01-01');
    });

    it('should parse serial 59 as 1900-02-28', () => {
      expect(parseDateValue(59)).toBe('1900-02-28');
    });

    it('should parse serial 61 as 1900-03-01 (skip phantom Feb 29)', () => {
      expect(parseDateValue(61)).toBe('1900-03-01');
    });

    it('should parse serial 44927 (2023-01-01)', () => {
      // 2023-01-01 is serial 44927 in Excel
      expect(parseDateValue(44927)).toBe('2023-01-01');
    });

    it('should parse serial 44197 (2021-01-01)', () => {
      expect(parseDateValue(44197)).toBe('2021-01-01');
    });

    it('should return null for 0 or negative numbers', () => {
      expect(parseDateValue(0)).toBeNull();
      expect(parseDateValue(-1)).toBeNull();
    });

    it('should return null for NaN or Infinity', () => {
      expect(parseDateValue(NaN)).toBeNull();
      expect(parseDateValue(Infinity)).toBeNull();
    });
  });

  describe('YYYY/MM/DD format', () => {
    it('should parse valid date', () => {
      expect(parseDateValue('2023/03/15')).toBe('2023-03-15');
    });

    it('should parse date with single-digit month/day', () => {
      expect(parseDateValue('2023/1/5')).toBe('2023-01-05');
    });

    it('should return null for invalid month', () => {
      expect(parseDateValue('2023/13/01')).toBeNull();
    });

    it('should return null for invalid day', () => {
      expect(parseDateValue('2023/02/30')).toBeNull();
    });
  });

  describe('YYYY-MM-DD format', () => {
    it('should parse valid date', () => {
      expect(parseDateValue('2023-03-15')).toBe('2023-03-15');
    });

    it('should parse single-digit month/day', () => {
      expect(parseDateValue('2023-1-5')).toBe('2023-01-05');
    });

    it('should return null for year out of range', () => {
      expect(parseDateValue('1899-01-01')).toBeNull();
      expect(parseDateValue('2101-01-01')).toBeNull();
    });

    it('should return null for Feb 29 in non-leap year', () => {
      expect(parseDateValue('2023-02-29')).toBeNull();
    });

    it('should accept Feb 29 in leap year', () => {
      expect(parseDateValue('2024-02-29')).toBe('2024-02-29');
    });
  });

  describe('invalid inputs', () => {
    it('should return null for null/undefined', () => {
      expect(parseDateValue(null)).toBeNull();
      expect(parseDateValue(undefined)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(parseDateValue('')).toBeNull();
    });

    it('should return null for random strings', () => {
      expect(parseDateValue('hello')).toBeNull();
      expect(parseDateValue('2023/13')).toBeNull();
    });
  });
});

describe('getDefaultTrendGrain', () => {
  it('should return month when period is YYYY', () => {
    const state = makeFilter({ period: '2023' });
    expect(getDefaultTrendGrain(state)).toBe('month');
  });

  it('should return day when period is YYYY-MM', () => {
    const state = makeFilter({ period: '2023-03' });
    expect(getDefaultTrendGrain(state)).toBe('day');
  });

  it('should return day when date is set', () => {
    const state = makeFilter({ date: '2023-03-15' });
    expect(getDefaultTrendGrain(state)).toBe('day');
  });

  it('should return day for date range ≤ 31 days', () => {
    const state = makeFilter({ dateStart: '2023-03-01', dateEnd: '2023-03-31' });
    expect(getDefaultTrendGrain(state)).toBe('day');
  });

  it('should return month for date range ≤ 365 days', () => {
    const state = makeFilter({ dateStart: '2023-01-01', dateEnd: '2023-06-30' });
    expect(getDefaultTrendGrain(state)).toBe('month');
  });

  it('should return quarter for date range > 365 days', () => {
    const state = makeFilter({ dateStart: '2022-01-01', dateEnd: '2023-06-30' });
    expect(getDefaultTrendGrain(state)).toBe('quarter');
  });

  it('should return month when no time filter set', () => {
    const state = makeFilter();
    expect(getDefaultTrendGrain(state)).toBe('month');
  });
});

describe('getCumulativeGrain', () => {
  it('should return month when period is YYYY', () => {
    const state = makeFilter({ period: '2023' });
    expect(getCumulativeGrain(state)).toBe('month');
  });

  it('should return day when period is YYYY-MM', () => {
    const state = makeFilter({ period: '2023-03' });
    expect(getCumulativeGrain(state)).toBe('day');
  });

  it('should return day when date is set', () => {
    const state = makeFilter({ date: '2023-03-15' });
    expect(getCumulativeGrain(state)).toBe('day');
  });

  it('should return day for date range ≤ 62 days', () => {
    const state = makeFilter({ dateStart: '2023-03-01', dateEnd: '2023-04-30' });
    expect(getCumulativeGrain(state)).toBe('day');
  });

  it('should return week for date range 63-190 days', () => {
    const state = makeFilter({ dateStart: '2023-01-01', dateEnd: '2023-05-01' });
    expect(getCumulativeGrain(state)).toBe('week');
  });

  it('should return month for date range > 190 days', () => {
    const state = makeFilter({ dateStart: '2023-01-01', dateEnd: '2023-12-31' });
    expect(getCumulativeGrain(state)).toBe('month');
  });

  it('should return month when no filter set', () => {
    const state = makeFilter();
    expect(getCumulativeGrain(state)).toBe('month');
  });
});

describe('getDateWindow', () => {
  it('should return month window when date is set', () => {
    const state = makeFilter({ date: '2023-03-15' });
    const result = getDateWindow(state, []);
    expect(result.start).toBe('2023-03-01');
    expect(result.end).toBe('2023-03-31');
  });

  it('should return exact range when dateStart/dateEnd set', () => {
    const state = makeFilter({ dateStart: '2023-02-01', dateEnd: '2023-04-15' });
    const result = getDateWindow(state, []);
    expect(result.start).toBe('2023-02-01');
    expect(result.end).toBe('2023-04-15');
  });

  it('should return full year when period is YYYY', () => {
    const state = makeFilter({ period: '2023' });
    const result = getDateWindow(state, []);
    expect(result.start).toBe('2023-01-01');
    expect(result.end).toBe('2023-12-31');
  });

  it('should return month range when period is YYYY-MM', () => {
    const state = makeFilter({ period: '2023-02' });
    const result = getDateWindow(state, []);
    expect(result.start).toBe('2023-02-01');
    expect(result.end).toBe('2023-02-28');
  });

  it('should use min/max from records when no filter', () => {
    const state = makeFilter();
    const records = [
      { date: '2023-03-10' },
      { date: '2023-01-05' },
      { date: '2023-06-20' },
    ] as any[];
    const result = getDateWindow(state, records);
    expect(result.start).toBe('2023-01-05');
    expect(result.end).toBe('2023-06-20');
  });
});

describe('monthRange', () => {
  it('should generate consecutive months', () => {
    const result = monthRange('2023-01-01', '2023-04-30');
    expect(result).toEqual(['2023-01', '2023-02', '2023-03', '2023-04']);
  });

  it('should work with YYYY-MM format inputs', () => {
    const result = monthRange('2023-01', '2023-03');
    expect(result).toEqual(['2023-01', '2023-02', '2023-03']);
  });

  it('should handle single month', () => {
    const result = monthRange('2023-03-01', '2023-03-31');
    expect(result).toEqual(['2023-03']);
  });

  it('should span years', () => {
    const result = monthRange('2022-11-01', '2023-02-28');
    expect(result).toEqual(['2022-11', '2022-12', '2023-01', '2023-02']);
  });
});

describe('dateRange', () => {
  it('should generate consecutive dates', () => {
    const result = dateRange('2023-03-28', '2023-04-02');
    expect(result).toEqual([
      '2023-03-28', '2023-03-29', '2023-03-30', '2023-03-31',
      '2023-04-01', '2023-04-02',
    ]);
  });

  it('should handle single day', () => {
    const result = dateRange('2023-03-15', '2023-03-15');
    expect(result).toEqual(['2023-03-15']);
  });

  it('should return empty for reversed range', () => {
    const result = dateRange('2023-03-15', '2023-03-10');
    expect(result).toEqual([]);
  });
});

describe('quarterRange', () => {
  it('should generate quarters for a full year', () => {
    const result = quarterRange('2023-01-01', '2023-12-31');
    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({ label: '2023Q1', start: '2023-01-01', end: '2023-03-31' });
    expect(result[1]).toEqual({ label: '2023Q2', start: '2023-04-01', end: '2023-06-30' });
    expect(result[2]).toEqual({ label: '2023Q3', start: '2023-07-01', end: '2023-09-30' });
    expect(result[3]).toEqual({ label: '2023Q4', start: '2023-10-01', end: '2023-12-31' });
  });

  it('should handle partial quarter at start', () => {
    const result = quarterRange('2023-02-15', '2023-06-30');
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('2023Q1');
    expect(result[1].label).toBe('2023Q2');
  });

  it('should span years', () => {
    const result = quarterRange('2022-10-01', '2023-03-31');
    expect(result).toHaveLength(2);
    expect(result[0].label).toBe('2022Q4');
    expect(result[1].label).toBe('2023Q1');
  });
});
