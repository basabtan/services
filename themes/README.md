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

There are four reusable palette families plus the standalone references listed above. The original reskins and button collection are retained as separate references. They are not silently substituted for the later approved style tiles. Ask AI examples are visual demos, not live AI services. Some style tiles load optional Google Fonts; system fonts are available as fallbacks.

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

Published here as repository assets. This change does not deploy a website or publish a new npm registry release.
