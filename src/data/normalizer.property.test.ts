// Feature: game-finance-dashboard, Property 5: Import Status Determination
/**
 * Property 5: Import Status Determination
 *
 * *For any* record, the importStatus SHALL be determined as follows:
 * - 'normal': date valid, amount valid number, currency RMB|USD, periodMonth valid,
 *   categoryL1 ≠ '未分类', transactionType ≠ 'unclassified', department ≠ '未分配部门'
 * - 'pending_classify': amount valid but classification/department missing
 * - 'abnormal': date invalid, amount not number, currency unsupported,
 *   or amountCNY consistency fail
 *
 * **Validates: Requirements 4.1, 4.2, 4.3, 4.4, 4.5**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { determineImportStatus, normalizeRecords } from '../data/normalizer';
import type { ExpenseRecord, RawRow, FieldMapping, ImportConfig } from '../types/expense';

describe('Property 5: Import Status Determination', () => {
  // --- Generators ---

  /** Generate a valid YYYY-MM-DD date string */
  const validDateArb = fc
    .tuple(
      fc.integer({ min: 2000, max: 2099 }),
      fc.integer({ min: 1, max: 12 }),
      fc.integer({ min: 1, max: 28 }) // use 28 to guarantee valid day for any month
    )
    .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

  /** Generate a valid YYYY-MM period month string */
  const validPeriodMonthArb = fc
    .tuple(fc.integer({ min: 2000, max: 2099 }), fc.integer({ min: 1, max: 12 }))
    .map(([y, m]) => `${y}-${String(m).padStart(2, '0')}`);

  /** Generate a valid finite amount (non-NaN, non-Infinity) */
  const validAmountArb = fc.double({ min: -1_000_000, max: 1_000_000, noNaN: true, noDefaultInfinity: true });

  /** Generate a valid currency */
  const validCurrencyArb = fc.constantFrom<'RMB' | 'USD'>('RMB', 'USD');

  /** Generate a valid exchange rate */
  const validExchangeRateArb = fc.double({ min: 0.01, max: 100, noNaN: true, noDefaultInfinity: true });

  /** Generate a classified categoryL1 (not '未分类') */
  const classifiedCategoryL1Arb = fc.constantFrom('研发费用', '市场推广', '人力成本', '行政办公', '服务器费用');

  /** Generate a classified transaction type (not 'unclassified') */
  const classifiedTransactionTypeArb = fc.constantFrom<'expense' | 'income' | 'intercompany'>('expense', 'income', 'intercompany');

  /** Generate a classified department (not '未分配部门') */
  const classifiedDepartmentArb = fc.constantFrom('技术部', '市场部', '财务部', '运营部', '人力资源部');

  /** Generate a fully valid (normal) record */
  const normalRecordArb = fc
    .tuple(
      validDateArb,
      validAmountArb,
      validCurrencyArb,
      validExchangeRateArb,
      validPeriodMonthArb,
      classifiedCategoryL1Arb,
      classifiedTransactionTypeArb,
      classifiedDepartmentArb
    )
    .map(([date, amount, currency, exchangeRate, periodMonth, categoryL1, transactionType, department]) => {
      const amountCNY = amount * exchangeRate;
      return {
        date,
        amount,
        amountCNY,
        currency,
        exchangeRate,
        periodMonth,
        categoryL1,
        transactionType,
        department,
      } as Partial<ExpenseRecord>;
    });

  // --- Test cases ---

  it('records with all valid fields → status is "normal"', () => {
    fc.assert(
      fc.property(normalRecordArb, (record) => {
        const status = determineImportStatus(record);
        expect(status).toBe('normal');
      }),
      { numRuns: 100 }
    );
  });

  it('records with valid amount but categoryL1="未分类" → status is "pending_classify"', () => {
    fc.assert(
      fc.property(
        validDateArb,
        validAmountArb,
        validCurrencyArb,
        validExchangeRateArb,
        validPeriodMonthArb,
        classifiedTransactionTypeArb,
        classifiedDepartmentArb,
        (date, amount, currency, exchangeRate, periodMonth, transactionType, department) => {
          const record: Partial<ExpenseRecord> = {
            date,
            amount,
            amountCNY: amount * exchangeRate,
            currency,
            exchangeRate,
            periodMonth,
            categoryL1: '未分类',
            transactionType,
            department,
          };
          const status = determineImportStatus(record);
          expect(status).toBe('pending_classify');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('records with valid amount but department="未分配部门" → status is "pending_classify"', () => {
    fc.assert(
      fc.property(
        validDateArb,
        validAmountArb,
        validCurrencyArb,
        validExchangeRateArb,
        validPeriodMonthArb,
        classifiedCategoryL1Arb,
        classifiedTransactionTypeArb,
        (date, amount, currency, exchangeRate, periodMonth, categoryL1, transactionType) => {
          const record: Partial<ExpenseRecord> = {
            date,
            amount,
            amountCNY: amount * exchangeRate,
            currency,
            exchangeRate,
            periodMonth,
            categoryL1,
            transactionType,
            department: '未分配部门',
          };
          const status = determineImportStatus(record);
          expect(status).toBe('pending_classify');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('records with invalid date → status is "abnormal"', () => {
    // Generate dates that don't match YYYY-MM-DD format
    const invalidDateArb = fc.oneof(
      fc.constant(''),
      fc.constant('not-a-date'),
      fc.constant('2023/01/15'),
      fc.constant('20230115'),
      fc.constant('01-15-2023'),
      fc.string({ minLength: 0, maxLength: 8 }).filter((s) => !/^\d{4}-\d{2}-\d{2}$/.test(s))
    );

    fc.assert(
      fc.property(
        invalidDateArb,
        validAmountArb,
        validCurrencyArb,
        validExchangeRateArb,
        validPeriodMonthArb,
        classifiedCategoryL1Arb,
        classifiedTransactionTypeArb,
        classifiedDepartmentArb,
        (date, amount, currency, exchangeRate, periodMonth, categoryL1, transactionType, department) => {
          const record: Partial<ExpenseRecord> = {
            date,
            amount,
            amountCNY: amount * exchangeRate,
            currency,
            exchangeRate,
            periodMonth,
            categoryL1,
            transactionType,
            department,
          };
          const status = determineImportStatus(record);
          expect(status).toBe('abnormal');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('records with non-number amount → status is "abnormal"', () => {
    const invalidAmountArb = fc.oneof(
      fc.constant(NaN),
      fc.constant(Infinity),
      fc.constant(-Infinity),
      fc.constant(undefined as unknown as number),
      fc.constant(null as unknown as number)
    );

    fc.assert(
      fc.property(
        validDateArb,
        invalidAmountArb,
        validCurrencyArb,
        validPeriodMonthArb,
        classifiedCategoryL1Arb,
        classifiedTransactionTypeArb,
        classifiedDepartmentArb,
        (date, amount, currency, periodMonth, categoryL1, transactionType, department) => {
          const record: Partial<ExpenseRecord> = {
            date,
            amount,
            currency,
            periodMonth,
            categoryL1,
            transactionType,
            department,
          };
          const status = determineImportStatus(record);
          expect(status).toBe('abnormal');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('records with unsupported currency → status is "abnormal"', () => {
    const unsupportedCurrencyArb = fc.oneof(
      fc.constant('EUR' as 'RMB' | 'USD'),
      fc.constant('JPY' as 'RMB' | 'USD'),
      fc.constant('GBP' as 'RMB' | 'USD'),
      fc.constant('' as 'RMB' | 'USD'),
      fc.constant('CNY' as 'RMB' | 'USD') // CNY is normalized to RMB upstream; raw CNY here is unsupported
    );

    fc.assert(
      fc.property(
        validDateArb,
        validAmountArb,
        unsupportedCurrencyArb,
        validExchangeRateArb,
        validPeriodMonthArb,
        classifiedCategoryL1Arb,
        classifiedTransactionTypeArb,
        classifiedDepartmentArb,
        (date, amount, currency, exchangeRate, periodMonth, categoryL1, transactionType, department) => {
          const record: Partial<ExpenseRecord> = {
            date,
            amount,
            amountCNY: amount * exchangeRate,
            currency,
            exchangeRate,
            periodMonth,
            categoryL1,
            transactionType,
            department,
          };
          const status = determineImportStatus(record);
          expect(status).toBe('abnormal');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('records with amountCNY consistency failure → status is "abnormal"', () => {
    fc.assert(
      fc.property(
        validDateArb,
        validAmountArb.filter((a) => Math.abs(a) > 0.1), // need non-tiny amount for meaningful deviation
        validCurrencyArb,
        validExchangeRateArb,
        validPeriodMonthArb,
        classifiedCategoryL1Arb,
        classifiedTransactionTypeArb,
        classifiedDepartmentArb,
        // Generate a deviation that exceeds 0.01
        fc.double({ min: 0.02, max: 100, noNaN: true, noDefaultInfinity: true }),
        (date, amount, currency, exchangeRate, periodMonth, categoryL1, transactionType, department, deviation) => {
          const computed = amount * exchangeRate;
          // Add deviation that's > 0.01 to break consistency
          const wrongAmountCNY = computed + deviation;

          const record: Partial<ExpenseRecord> = {
            date,
            amount,
            amountCNY: wrongAmountCNY,
            currency,
            exchangeRate,
            periodMonth,
            categoryL1,
            transactionType,
            department,
          };
          const status = determineImportStatus(record);
          expect(status).toBe('abnormal');
        }
      ),
      { numRuns: 100 }
    );
  });
});


// Feature: game-finance-dashboard, Property 3: Currency Alias Normalization
/**
 * Property 3: Currency Alias Normalization
 *
 * *For any* currency value that is one of 'RMB', 'CNY', '人民币', 'USD', or '美元',
 * the Normalizer SHALL produce either 'RMB' (for RMB/CNY/人民币) or 'USD' (for USD/美元),
 * and no other output values are possible for valid inputs.
 *
 * **Validates: Requirements 3.3, 3.4**
 */

describe('Property 3: Currency Alias Normalization', () => {
  // Valid currency aliases grouped by expected output
  const rmbAliases = ['RMB', 'CNY', '人民币'] as const;
  const usdAliases = ['USD', '美元'] as const;
  const allValidAliases = [...rmbAliases, ...usdAliases] as const;

  // Standard field mapping that maps 'currency' to the column name '币种'
  const mapping: FieldMapping = {
    date: '日期',
    amount: '金额',
    currency: '币种',
  };

  // Default import config
  const config: ImportConfig = {
    defaultUsdRate: 7.2,
    importBatchId: 'test-batch',
  };

  // Generator for a valid date string
  const validDateArb = fc
    .date({
      min: new Date(2000, 0, 1),
      max: new Date(2099, 11, 31),
    })
    .map((d) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    });

  // Generator for a valid amount (positive finite number)
  const validAmountArb = fc.double({ min: 0.01, max: 1_000_000, noNaN: true });

  // Generator for a currency alias from the valid set
  const currencyAliasArb = fc.constantFrom(...allValidAliases);

  // Generator for a minimal valid row with a given currency alias
  const rowWithCurrencyArb = fc
    .tuple(validDateArb, validAmountArb, currencyAliasArb)
    .map(([date, amount, currency]): RawRow => ({
      '日期': date,
      '金额': amount,
      '币种': currency,
    }));

  it('should normalize RMB/CNY/人民币 to "RMB" and USD/美元 to "USD"', () => {
    fc.assert(
      fc.property(rowWithCurrencyArb, (row) => {
        const { records } = normalizeRecords([row], mapping, config);

        expect(records).toHaveLength(1);
        const record = records[0];
        const inputCurrency = String(row['币种']);

        if (rmbAliases.includes(inputCurrency as typeof rmbAliases[number])) {
          expect(record.currency).toBe('RMB');
        } else {
          expect(record.currency).toBe('USD');
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should only produce "RMB" or "USD" for any valid currency input', () => {
    fc.assert(
      fc.property(rowWithCurrencyArb, (row) => {
        const { records } = normalizeRecords([row], mapping, config);

        expect(records).toHaveLength(1);
        const record = records[0];

        // The currency field must be exactly one of these two values
        expect(['RMB', 'USD']).toContain(record.currency);
      }),
      { numRuns: 100 }
    );
  });

  it('should correctly normalize currency across multiple rows with mixed aliases', () => {
    // Generator for an array of rows with random valid currency aliases
    const multipleRowsArb = fc.array(rowWithCurrencyArb, { minLength: 1, maxLength: 20 });

    fc.assert(
      fc.property(multipleRowsArb, (rows) => {
        const { records } = normalizeRecords(rows, mapping, config);

        expect(records).toHaveLength(rows.length);

        for (let i = 0; i < rows.length; i++) {
          const inputCurrency = String(rows[i]['币种']);
          const outputCurrency = records[i].currency;

          if (rmbAliases.includes(inputCurrency as typeof rmbAliases[number])) {
            expect(outputCurrency).toBe('RMB');
          } else if (usdAliases.includes(inputCurrency as typeof usdAliases[number])) {
            expect(outputCurrency).toBe('USD');
          }

          // No other values possible
          expect(['RMB', 'USD']).toContain(outputCurrency);
        }
      }),
      { numRuns: 100 }
    );
  });
});
