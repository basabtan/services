import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The portable Concord theme must offer the same token contract as the app's own OG skin.
const og = readFileSync('themes/concord/og.css', 'utf8');
const portable = readFileSync('themes/concord-theme.css', 'utf8');
const json = JSON.parse(readFileSync('themes/concord-tokens.json', 'utf8'));
const names = (css: string, prefix: string) => new Set(css.match(new RegExp(`--${prefix}-[a-z0-9-]+(?=\\s*:)`, 'g')) ?? []);
const value = (css: string, name: string) => css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`))?.[1].trim();

describe('Concord theme (alias og)', () => {
  it('is selectable as "concord" and as the alias "og"', () => {
    expect(portable).toContain(':root[data-theme="concord"]');
    expect(portable).toContain(':root[data-theme="og"]');
    expect(json.theme).toBe('concord');
    expect(json.aliases).toEqual(['og']);
  });

  for (const prefix of ['og', 'concord', 'graph']) {
    it(`defines every --${prefix}-* token that og.css defines, with the same value`, () => {
      const missing = [...names(og, prefix)].filter((n) => !names(portable, prefix).has(n));
      expect(missing).toEqual([]);
      for (const n of names(og, prefix)) expect(value(portable, n), n).toBe(value(og, n));
    });
  }

  it('keeps the JSON colours equal to og.css', () => {
    expect(json.colors.bg).toBe(value(og, '--og-bg'));
    expect(json.colors.primary).toBe(value(og, '--og-primary'));
    expect(json.colors.danger).toBe(value(og, '--og-danger'));
    expect(json.geometry.radius).toBe(value(og, '--og-radius'));
  });
});
