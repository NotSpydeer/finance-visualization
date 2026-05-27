// Feature: game-finance-dashboard, Property 16: Data Cache Round-Trip
/**
 * Property 16: Data Cache Round-Trip
 *
 * *For any* array of valid ExpenseRecords, storing them to IndexedDB and loading
 * them back SHALL produce an array that is deeply equal to the original (same length,
 * same field values for every record).
 *
 * Note: jsdom does not provide a real IndexedDB implementation. We mock idb-keyval's
 * get/set/del to use an in-memory Map, then test the round-trip through cacheData
 * and loadCachedData.
 *
 * **Validates: Requirements 23.1, 23.4**
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import type { ExpenseRecord, TransactionType, ImportStatus } from '../types/expense';

// Mock idb-keyval with in-memory Map
const store = new Map<string, unknown>();

vi.mock('idb-keyval', () => ({
  get: vi.fn(async (key: string) => store.get(key)),
  set: vi.fn(async (key: string, value: unknown) => { store.set(key, value); }),
  del: vi.fn(async (key: string) => { store.delete(key); }),
}));

import { cacheData, loadCachedData } from '../state/persistence';

// --- Generators ---

const transactionTypeArb: fc.Arbitrary<TransactionType> = fc.constantFrom(
  'expense', 'income', 'intercompany', 'unclassified'
);

const importStatusArb: fc.Arbitrary<ImportStatus> = fc.constantFrom(
  'normal', 'pending_classify', 'abnormal'
);

const currencyArb: fc.Arbitrary<'RMB' | 'USD'> = fc.constantFrom('RMB', 'USD');

const validDateArb = fc
  .tuple(
    fc.integer({ min: 2020, max: 2030 }),
    fc.integer({ min: 1, max: 12 }),
    fc.integer({ min: 1, max: 28 })
  )
  .map(([y, m, d]) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);

const categoryArb = fc.constantFrom(
  '研发费用', '行政费用', '市场费用', '人力成本', '未分类'
);

const departmentArb = fc.constantFrom(
  '技术部', '市场部', '行政部', '未分配部门'
);

const expenseRecordArb: fc.Arbitrary<ExpenseRecord> = fc
  .tuple(
    fc.integer({ min: 1, max: 9999 }),
    validDateArb,
    fc.double({ min: 0.01, max: 999999, noNaN: true, noDefaultInfinity: true }),
    currencyArb,
    fc.double({ min: 0.1, max: 100, noNaN: true, noDefaultInfinity: true }),
    categoryArb,
    categoryArb,
    categoryArb,
    departmentArb,
    fc.string({ minLength: 1, maxLength: 10 }),
    fc.string({ minLength: 1, maxLength: 10 }),
    transactionTypeArb,
    importStatusArb,
    fc.integer({ min: 1, max: 10000 })
  )
  .map(([idx, date, amount, currency, exchangeRate, catL1, catL2, catL3, dept, person, bank, txType, status, rowNo]) => {
    const amountCNY = currency === 'USD' ? amount * exchangeRate : amount;
    return {
      id: `batch-${idx}-${rowNo}`,
      date,
      amount,
      amountCNY,
      currency,
      exchangeRate: currency === 'USD' ? exchangeRate : 1,
      categoryL1: catL1,
      categoryL2: catL2,
      categoryL3: catL3,
      categoryExtra: '',
      department: dept,
      person,
      bankAccount: bank,
      periodMonth: date.slice(0, 7),
      transactionType: txType,
      importStatus: status,
      sourceRowNo: rowNo,
    };
  });

const expenseRecordsArb = fc.array(expenseRecordArb, { minLength: 0, maxLength: 50 });

// --- Tests ---

describe('Property 16: Data Cache Round-Trip', () => {
  beforeEach(() => {
    store.clear();
  });

  it('storing records to cache and loading them back produces a deeply equal array', async () => {
    await fc.assert(
      fc.asyncProperty(expenseRecordsArb, async (records) => {
        // Store
        await cacheData(records);

        // Load
        const loaded = await loadCachedData();

        // Verify round-trip equality
        expect(loaded).not.toBeNull();
        expect(loaded).toHaveLength(records.length);
        expect(loaded).toEqual(records);
      }),
      { numRuns: 100 }
    );
  });

  it('each record preserves all field values after round-trip', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(expenseRecordArb, { minLength: 1, maxLength: 20 }),
        async (records) => {
          await cacheData(records);
          const loaded = await loadCachedData();

          expect(loaded).not.toBeNull();
          for (let i = 0; i < records.length; i++) {
            const original = records[i];
            const restored = loaded![i];

            expect(restored.id).toBe(original.id);
            expect(restored.date).toBe(original.date);
            expect(restored.amount).toBe(original.amount);
            expect(restored.amountCNY).toBe(original.amountCNY);
            expect(restored.currency).toBe(original.currency);
            expect(restored.exchangeRate).toBe(original.exchangeRate);
            expect(restored.categoryL1).toBe(original.categoryL1);
            expect(restored.categoryL2).toBe(original.categoryL2);
            expect(restored.categoryL3).toBe(original.categoryL3);
            expect(restored.department).toBe(original.department);
            expect(restored.person).toBe(original.person);
            expect(restored.bankAccount).toBe(original.bankAccount);
            expect(restored.periodMonth).toBe(original.periodMonth);
            expect(restored.transactionType).toBe(original.transactionType);
            expect(restored.importStatus).toBe(original.importStatus);
            expect(restored.sourceRowNo).toBe(original.sourceRowNo);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('empty array round-trips correctly', async () => {
    await cacheData([]);
    const loaded = await loadCachedData();
    expect(loaded).toEqual([]);
  });
});
