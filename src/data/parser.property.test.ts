// Feature: game-finance-dashboard, Property 1: Header Alias Recognition
/**
 * Property 1: Header Alias Recognition
 *
 * *For any* header row containing one or more known aliases (from HEADER_ALIASES mapping),
 * the recognizeHeaders function SHALL map each alias to its correct standard field name,
 * and the resulting mapping SHALL contain an entry for every recognized alias.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { recognizeHeaders } from '../data/parser';
import { HEADER_ALIASES } from '../data/headerAliases';

describe('Property 1: Header Alias Recognition', () => {
  // Collect all known aliases with their standard field for use in generators
  const allAliasEntries: { standardField: string; alias: string }[] = [];
  for (const [standardField, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      allAliasEntries.push({ standardField, alias });
    }
  }

  // Generator: pick a subset of aliases (one per standard field max, to avoid first-match conflicts)
  const knownAliasSubsetArb = fc
    .shuffledSubarray(Object.keys(HEADER_ALIASES), { minLength: 1 })
    .chain((fields) =>
      fc.tuple(
        ...fields.map((field) =>
          fc.constantFrom(...HEADER_ALIASES[field]).map((alias) => ({
            standardField: field,
            alias,
          }))
        )
      )
    );

  // Generator: random non-alias strings that won't accidentally match any alias
  const randomNonAliasStr = fc.string({ minLength: 1, maxLength: 20 }).filter((s) => {
    const normalized = s.trim().toLowerCase();
    if (!normalized) return false;
    return !allAliasEntries.some((entry) => entry.alias.toLowerCase() === normalized);
  });

  it('should map every known alias in a header row to its correct standard field', () => {
    fc.assert(
      fc.property(
        knownAliasSubsetArb,
        fc.array(randomNonAliasStr, { minLength: 0, maxLength: 5 }),
        (aliasEntries, randomHeaders) => {
          // Build header row: known aliases + random strings, shuffled
          const headerRow = [
            ...aliasEntries.map((e) => e.alias),
            ...randomHeaders,
          ];

          const mapping = recognizeHeaders(headerRow);

          // Every selected alias should be mapped to the correct standard field
          for (const entry of aliasEntries) {
            expect(mapping[entry.standardField]).toBe(entry.alias);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not produce false mappings (no standard field maps to a non-alias string)', () => {
    fc.assert(
      fc.property(
        knownAliasSubsetArb,
        fc.array(randomNonAliasStr, { minLength: 1, maxLength: 5 }),
        (aliasEntries, randomHeaders) => {
          const headerRow = [
            ...aliasEntries.map((e) => e.alias),
            ...randomHeaders,
          ];

          const mapping = recognizeHeaders(headerRow);

          // Every value in the mapping must be a known alias (not a random string)
          for (const [standardField, actualColumn] of Object.entries(mapping)) {
            const validAliases = HEADER_ALIASES[standardField];
            expect(validAliases).toBeDefined();
            const isKnown = validAliases!.some(
              (a) => a.toLowerCase() === actualColumn.toLowerCase()
            );
            expect(isKnown).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should be case-insensitive (upper, lower, mixed case aliases all recognized)', () => {
    // Generator: transform a known alias to random case
    const caseTransformArb = fc
      .shuffledSubarray(Object.keys(HEADER_ALIASES), { minLength: 1 })
      .chain((fields) =>
        fc.tuple(
          ...fields.map((field) =>
            fc.constantFrom(...HEADER_ALIASES[field]).chain((alias) =>
              fc.constantFrom('upper', 'lower', 'mixed').map((caseType) => {
                let transformed: string;
                if (caseType === 'upper') {
                  transformed = alias.toUpperCase();
                } else if (caseType === 'lower') {
                  transformed = alias.toLowerCase();
                } else {
                  // Mixed case: alternate characters
                  transformed = alias
                    .split('')
                    .map((ch, i) => (i % 2 === 0 ? ch.toUpperCase() : ch.toLowerCase()))
                    .join('');
                }
                return { standardField: field, alias, transformed };
              })
            )
          )
        )
      );

    fc.assert(
      fc.property(caseTransformArb, (entries) => {
        const headerRow = entries.map((e) => e.transformed);
        const mapping = recognizeHeaders(headerRow);

        for (const entry of entries) {
          // The mapping should contain the standard field with the trimmed version
          expect(mapping[entry.standardField]).toBeDefined();
          // The mapped value should equal the transformed alias (after trim)
          expect(mapping[entry.standardField]!.toLowerCase()).toBe(
            entry.transformed.trim().toLowerCase()
          );
        }
      }),
      { numRuns: 100 }
    );
  });

  it('should handle aliases with leading/trailing spaces (trimming works)', () => {
    // Generator: add random whitespace around known aliases
    const whitespaceArb = fc
      .array(fc.constantFrom(' ', '\t'), { minLength: 1, maxLength: 3 })
      .map((chars) => chars.join(''));

    const spacedAliasArb = fc
      .shuffledSubarray(Object.keys(HEADER_ALIASES), { minLength: 1 })
      .chain((fields) =>
        fc.tuple(
          ...fields.map((field) =>
            fc
              .tuple(
                fc.constantFrom(...HEADER_ALIASES[field]),
                whitespaceArb,
                whitespaceArb
              )
              .map(([alias, leadingSpace, trailingSpace]) => ({
                standardField: field,
                alias,
                spaced: leadingSpace + alias + trailingSpace,
              }))
          )
        )
      );

    fc.assert(
      fc.property(spacedAliasArb, (entries) => {
        const headerRow = entries.map((e) => e.spaced);
        const mapping = recognizeHeaders(headerRow);

        for (const entry of entries) {
          // The standard field should be recognized despite spaces
          expect(mapping[entry.standardField]).toBeDefined();
          // The value should be the trimmed version (original alias)
          expect(mapping[entry.standardField]).toBe(entry.alias);
        }
      }),
      { numRuns: 100 }
    );
  });
});
