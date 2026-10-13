# Reusable themes

Approved visual references and reusable CSS tokens, collected for use in new apps.

## Preview

Download the [repository ZIP](https://github.com/basabtan/services/archive/refs/heads/main.zip), extract it, and open `themes/index.html` in a browser. The default is Bader's approved Ivory + Champagne style tile, with its complete composition, specimens, charts, and CSS/JSON downloads. Collection links appear near the footer. The [palette collection](palette-collection.html) retains the four-way palette switcher and original references, initially showing Ivory. GitHub's file viewer shows HTML source; it does not run the previews.

| Theme / reference | Preview | Reusable source |
| --- | --- | --- |
| Ivory + Champagne (default) | [Approved main style tile](zeal-ivory-style-tile.html), [Ask AI](zeal-ivory-ask.html) | [Approved Ivory CSS](zeal-ivory-tokens.css), [Approved Ivory JSON](zeal-ivory-tokens.json) |
| Ink Blue + Platinum | [Full style tile](zeal-ink-blue-full-style-tile.html), [Palette tile](zeal-ink-platinum-style-tile.html), [Ask AI](zeal-ink-blue-ask.html) | [Full reference CSS](zeal-ink-blue-tokens.css), [Full reference JSON](zeal-ink-blue-tokens.json), shared palette tokens below |
| Graphite + Soft Copper | [Style tile](zeal-graphite-copper-style-tile.html) | Shared palette CSS / JSON below |
| Light Grey + Red-orange | [Style tile](zeal-grey-orange-style-tile.html) | Shared palette CSS / JSON below |
| Gold + Obsidian (reference only) | [Original Ask AI reskin](ask-ai-gold-obsidian.html) | CSS embedded in the preview; not a shared palette |
| Original Ivory + Champagne reskin | [Ask AI](ask-ai-ivory-champagne.html) | CSS embedded in the preview |
| Gold / glass button collection | [Interactive playground](gold-button-showcase.html) | CSS and drag interactions embedded in the preview |
| Facet: Ivory + Graphite + Ruby | [Style tile](facet-style-tile.html) (Ivory and Graphite modes) | [Facet tokens CSS](facet-tokens.css) |
| Facet Studio: crystal, gunmetal, ruby (photorealistic) | [Style tile](facet-studio-style-tile.html) | [Material recipes CSS](facet-studio-materials.css) |
| **Concord** (alias **og**) — paper, graphite, sapphire | [Style tile](concord-style-tile.html) | [Portable CSS](concord-theme.css), [JSON](concord-tokens.json), complete app skin in [concord/](concord/) |

There are four reusable palette families plus the standalone references listed above. The Concord theme is another separate family, described in **Concord** below. The two Facet tiles are a separate family built from the Facet logo; they use their own variables (`--bg`, `--accent`, `--ruby` and so on, toggled by `data-theme="dark"`) and are not part of the `--zs-*` palette layer or `themes.json`. The original reskins and button collection are retained as separate references. They are not silently substituted for the later approved style tiles. Ask AI examples are visual demos, not live AI services. Some style tiles load optional Google Fonts; system fonts are available as fallbacks.

The approved main file is an exact copy of Bader's supplied `zeal-ivory-style-tile (1).html`. Its built-in **Ink blue** switch is that attachment's legacy dark companion; it is separate from the newer **Ink Blue + Platinum** design linked above. `index.html` uses the approved file with collection navigation added near the footer. The standalone Ivory CSS/JSON match the attachment's own downloads; the newer Ink Blue reference and its exports are retained under separate filenames.

## Reuse

Install the package from GitHub in an app that supports CSS imports (for example, Vite or Next.js):

```sh
npm install github:basabtan/services
```

Import [approved-palettes.tokens.css](approved-palettes.tokens.css) to use the four named palette families. Their machine-readable values are in [themes.json](themes.json). In Next.js, place the CSS import in your app's global stylesheet entry and set the attribute on the root `<html>` element; run `document` code only in the browser.

```ts
import '@basabtan/repair-report/themes/approved-palettes.tokens.css';

// ivory | ink-platinum | graphite-copper | grey-orange
document.documentElement.dataset.zealTheme = 'ivory';
```

```html
<section class="my-panel">
  <h2>Project overview</h2>
  <p>These surfaces use the selected palette.</p>
  <button class="my-primary-button" type="button">Continue</button>
</section>
```

```css
.my-panel {
  background: var(--zs-surface);
  color: var(--zs-ink);
  border: 1px solid var(--zs-line);
  border-radius: 0;
}
.my-primary-button {
  background: var(--zs-primary);
  color: var(--zs-accentInk);
  border: 1px solid var(--zs-edge);
  border-radius: 0;
}
```

The palette selectors target `:root[data-zeal-theme]`. Set the attribute on `<html>` as shown above, or write `<html data-zeal-theme="ivory">` directly. Ivory is the default design choice for this collection; the opt-in stylesheet still requires an explicit attribute and does not choose a palette on its own. Importing tokens defines only namespaced `--zs-*` variables and the selected `color-scheme`; it does not overwrite generic host variables such as `--bg`, `--text`, or `--accent`. Apply the variables in your component CSS as above. The `color-scheme` property allows native browser controls to follow the palette's light or dark mode.

[approved-palettes.css](approved-palettes.css) imports the shared tokens and adds ZEAL-specific component adapters and compatibility aliases. It overrides generic root variables including `--bg`, `--text`, and `--accent` (some with `!important`) and maps `--zt-*` variables. Use it only when you want that integration and your markup matches its selectors. The standalone Ivory CSS is a broader specimen stylesheet with global selectors and a separate `data-theme` convention; review or scope it before importing it into another app. Do not load all stylesheets indiscriminately.

The existing Repair Report and Change Requests panels still use their own styles and variables. These new theme resources are opt-in. Religion/provenance gradient values from the approved source are retained unchanged.

## Concord (alias "og")

The Concord app's default, brand-aligned theme. In the app it is called **OG**; here it is named **concord**, and `og` is kept as an alias. It is the same skin Axis uses in `basabtan/Baders` (`nexus/tools/axis.html`).

```html
<link rel="stylesheet" href="themes/concord-theme.css">
<html data-theme="concord">   <!-- or data-theme="og" -->
```

```css
.card { background: var(--og-surface); color: var(--og-ink); border: 1px solid var(--og-line); border-radius: var(--og-radius); }
.primary { background: var(--og-primary); color: var(--og-surface-strong); }
```

| File | What it is |
| --- | --- |
| [concord-theme.css](concord-theme.css) | Portable tokens: `--og-*` palette, every `--concord-*` role and `--graph-*` token that `og.css` defines (a test keeps them in step), fonts, radius, focus, and the paper-and-grid page background. Selectors: `:root[data-theme="concord"]` and `:root[data-theme="og"]`. No component styles. |
| [concord-tokens.json](concord-tokens.json) | The same values, machine-readable, with `"aliases": ["og"]`. |
| [concord-style-tile.html](concord-style-tile.html) | Swatches, type, buttons, inputs, state chips, a table, icons and an empty state. Open it through a local server so the icon sprite loads. |
| [concord/og.css](concord/og.css) | Complete OG app skin, copied unchanged from the Concord app. It targets Concord's own markup (`.btn`, `.panel`, `.rail` …) under `:root[data-theme="og"]`. |
| [concord/concord-tokens.css](concord/concord-tokens.css) | Frozen Concord brand primitives and derived shades (`--concord-*`), copied unchanged. |
| [concord/concord-icon-tokens.css](concord/concord-icon-tokens.css) | Icon construction tokens (grids, strokes, node sizes, states), copied unchanged. |
| [concord/brand/](concord/brand/) | Flat mark, mono mark, favicon, the 29-icon sprite and the watermark/pattern SVGs. |

Colours: paper `#F3F0EA`, surface `#F8F6F1` / `#FFFDFC`, chrome `#ECE8E0`, graphite ink `#141B23`, slate muted `#5A687C`, lines `#D5D0C7` / `#AEB4B8`, sapphire `#185FB5`, crimson `#BC2627`, bronze `#9A744F` (text `#735638`), stable `#2F6F5E`. Fonts: Bahnschrift (display, 600), Segoe UI (UI), Cascadia Mono (labels); all are Windows system fonts with fallbacks. Geometry: 1px borders, 2px radius, no shadows, faint 36px grid.

Naming note: inside the Concord app, `data-theme="concord"` is a separate dark skin and this theme is `og`. Outside the app, in this collection, `concord` means this theme.

## Downloads

The [palette collection](palette-collection.html) and the three companion palette tiles provide:

- **Download all four palettes (CSS):** `approved-palettes.tokens.css`, the same portable stylesheet supplied in the package. It contains all four palettes and requires the `data-zeal-theme` attribute described above.
- **Download selected palette (JSON):** `zeal-theme-tokens.json`, containing `{ "theme": { ... }, "religionGradients": { ... } }` for the selected palette.
- **Complete collection JSON:** [themes.json](themes.json), containing `{ "themes": { "ivory": { ... }, ... }, "religionGradients": { ... } }` for all four palettes.

The default preview and approved Ivory style tile export `zeal-ivory-tokens.css` and `zeal-ivory-tokens.json`, taken directly from the supplied attachment. The separate full Ink Blue + Platinum tile exports `zeal-ink-blue-tokens.css` and `zeal-ink-blue-tokens.json`. Both are broader reference styles using `data-theme`, including their own light/dark companions; they are not interchangeable with the portable `--zs-*` palette layer.

## Provenance

- The authoritative Ivory + Champagne main tile was supplied directly by Bader as `zeal-ivory-style-tile (1).html`; it replaces the previously published combined reference. Its SHA-256 is `c6c25b13e474fbe507ef394933f45adfffc3d26cbf21e50d8024584ec00cd143`. Its embedded export version is 2.1.0. Explicit source approval takes precedence over the previous reference's 3.0.0 label.
- The remaining approved style tiles and the separately retained Ink Blue + Platinum reference originated in `basabtan/Baders`, `zeal/public/style-tiles/`, commit `f8cd17df576963bb32b0bb36a5ab5e4b88dbb143`.
- Gold/Obsidian Ask AI, original Ivory/Champagne Ask AI, and the gold/glass playground were supplied in `services-themes-ready-to-publish.zip` as the original design references.
- `index.html` presents the approved Ivory composition by default; `palette-collection.html` retains navigation to the three original previews.
- `zeal-ink-blue-ask.html` is the source Ask AI preview with its existing Ink Blue mode selected initially. It completes a link already present in the source style tile.
- Publication adjustments separate portable tokens from compatibility aliases, wrap Ask header controls on narrow screens, and clarify palette counts, download formats, and reuse instructions. The preview styles retain their embedded palette and compatibility rules; approved color and gradient values are unchanged.

- The Facet and Facet Studio tiles were built on 11 October 2026 from Bader's Facet logo render (crystal hexagon, gunmetal lattice, ruby core). Facet Studio embeds that render and three close-up crops of it as images, so the file is self-contained at about 210 KB.

- The Concord theme files were copied on 13 October 2026 from `basabtan/concord` at commit `1271480c544b103f76fc9625c16777c8a03be2a5` ("Add OG as the default brand-aligned theme"). `concord/og.css`, `concord/concord-tokens.css` and `concord/concord-icon-tokens.css` are byte-for-byte copies (SHA-256 `a274d076…`, `df5a3cb7…`, `1a1fe8ed…`). The brand SVGs come from `public/brand/concord/`. The large lockups (1.7 MB SVGs) and the 2.8 MB primary PNG stay in the Concord repo. `concord-theme.css`, `concord-tokens.json` and the style tile were written from those files. The values are the same; only the theme name `concord` and the alias `og` were added.

Published here as repository assets. This change does not deploy a website or publish a new npm registry release.
