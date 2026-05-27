// Feature: game-finance-dashboard, Property 8: Currency Display Formatting
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { displayMoney } from './currencyUtils';

/**
 * **Validates: Requirements 7.1, 7.2**
 *
 * Property 8: Currency Display Formatting
 * For any non-negative amountCNY value and valid USD exchange rate,
 * displayMoney SHALL return a string matching the format "X.X万" when currencyMode is CNY,
 * or "$X.X万" when currencyMode is USD (where the USD value equals amountCNY ÷ rate),
 * and the numeric value in the string SHALL be within 0.1 of the expected value.
 */
describe('Property 8: Currency Display Formatting', () => {
  const amountArb = fc.double({ min: 0, max: 1_000_000_000, noNaN: true, noDefaultInfinity: true });
  const rateArb = fc.double({ min: 1, max: 20, noNaN: true, noDefaultInfinity: true });

  it('CNY mode: result matches /^-?\\d+\\.\\d万$/ and numeric value ≈ amountCNY / 10000', () => {
    fc.assert(
      fc.property(amountArb, (amountCNY) => {
        const result = displayMoney(amountCNY, 'CNY', 7.0);

        // Verify format matches X.X万
        expect(result).toMatch(/^-?\d+\.\d万$/);

        // Extract numeric value and verify closeness
        const numericStr = result.replace('万', '');
        const numericValue = parseFloat(numericStr);
        const expected = amountCNY / 10000;

        expect(Math.abs(numericValue - expected)).toBeLessThanOrEqual(0.1);
      }),
      { numRuns: 100 }
    );
  });

  it('USD mode: result matches /^\\$-?\\d+\\.\\d万$/ and numeric value ≈ amountCNY / rate / 10000', () => {
    fc.assert(
      fc.property(amountArb, rateArb, (amountCNY, usdRate) => {
        const result = displayMoney(amountCNY, 'USD', usdRate);

        // Verify format matches $X.X万
        expect(result).toMatch(/^\$-?\d+\.\d万$/);

        // Extract numeric value (remove $ prefix and 万 suffix)
        const numericStr = result.replace('$', '').replace('万', '');
        const numericValue = parseFloat(numericStr);
        const expected = amountCNY / usdRate / 10000;

        expect(Math.abs(numericValue - expected)).toBeLessThanOrEqual(0.1);
      }),
      { numRuns: 100 }
    );
  });
});
