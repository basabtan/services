import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The portable Rawshan CSS, its JSON and its components must stay in step.
const css = readFileSync('themes/rawshan-theme.css', 'utf8');
const components = readFileSync('themes/rawshan-components.css', 'utf8');
const tile = readFileSync('themes/rawshan-style-tile.html', 'utf8');
const json = JSON.parse(readFileSync('themes/rawshan-tokens.json', 'utf8'));

const block = (selector: string) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('\n}', start));
};
const plaster = block(':root[data-theme="rawshan"]');
const night = block(':root[data-theme="rawshan-night"]');
const value = (src: string, name: string) => src.match(new RegExp(`--rw-${name}\\s*:\\s*([^;]+);`))?.[1].trim();
const defined = (src: string) => new Set<string>(src.match(/--rw-[a-z0-9-]+(?=\s*:)/g) ?? []);

describe('Rawshan theme', () => {
  it('is selectable as "rawshan" (Plaster) and "rawshan-night" (Night)', () => {
    expect(json.theme).toBe('rawshan');
    expect(json.modes).toEqual({ plaster: 'rawshan', night: 'rawshan-night' });
    expect(plaster).toContain('color-scheme: light');
    expect(night).toContain('color-scheme: dark');
  });

  it('defines the same token names in both modes', () => {
    const missing = [...defined(plaster)].filter((n) => !defined(night).has(n));
    expect(missing).toEqual([]);
  });

  for (const mode of ['plaster', 'night'] as const) {
    it(`keeps the JSON ${mode} colours equal to the CSS`, () => {
      const src = mode === 'plaster' ? plaster : night;
      for (const [name, v] of Object.entries(json.colors[mode] as Record<string, string>)) {
        expect(value(src, name), name).toBe(v);
      }
    });
  }

  it('declares each token once per mode', () => {
    for (const src of [plaster, night]) {
      const all = src.match(/--rw-[a-z0-9-]+(?=\s*:)/g) ?? [];
      expect(all.filter((n, i) => all.indexOf(n) !== i)).toEqual([]);
    }
  });

  for (const mode of ['plaster', 'night'] as const) {
    it(`keeps the JSON ${mode} opacities equal to the CSS`, () => {
      const src = mode === 'plaster' ? plaster : night;
      for (const [name, v] of Object.entries(json.opacity[mode] as Record<string, string>)) {
        expect(value(src, name), name).toBe(v);
      }
    });
  }

  it('shows the error border on every field control', () => {
    for (const control of ['input', 'select', 'textarea']) {
      expect(components).toContain(`.rw-field.is-error ${control}`);
    }
  });

  it('uses only tokens the theme defines', () => {
    const known = defined(plaster);
    for (const src of [components, tile]) {
      const used = new Set<string>((src.match(/var\(--rw-[a-z0-9-]+/g) ?? []).map((m: string) => m.slice(4)));
      expect([...used].filter((n) => !known.has(n))).toEqual([]);
    }
  });

  it('keeps the component class names intact', () => {
    for (const cls of ['.rw-btn--secondary', '.rw-btn--link', '.rw-card--interactive', '.rw-card--dotted', '.rw-lattice--soft']) {
      expect(components, cls).toMatch(new RegExp(`\\${cls}(?![a-z-])`));
    }
    expect(components).not.toMatch(/\.rw-[a-z]+--rw-/);
  });

  it('keeps every corner square', () => {
    expect(json.radius['radius-none']).toBe('0');
    expect(components).not.toMatch(/border-radius:(?!\s*(?:0|var\(--rw-radius-none\)))/);
  });

  it('does not ship the commercial Effra font file', () => {
    const fonts = readdirSync('themes').filter((f: string) => /\.(ttf|otf|woff2?)$/i.test(f));
    expect(fonts).toEqual([]);
    expect(existsSync('themes/fonts')).toBe(false);
    expect(css).toMatch(/src:\s*local\("Effra"\)/);
  });
});
