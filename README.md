# Repair Report + Change Requests

Host-agnostic **Repair Request / AI Report** and **Change Requests** inbox. No AI provider, no Concord/GMCR types. Host owns persistence.

## Install

```powershell
Set-Location C:\YourApp
npm install github:basabtan/services
```

Peer deps: `react` and `react-dom` (>=18). Host must compile TypeScript (Vite/Next).

## Wire it in

1. Mark real controls with `data-ui="PascalName"`. Optional: `data-ui-kind`, `data-ui-location`.
2. Mount the panel. Live DOM scan finds annotated nodes. Pass `targets` for screens that are not mounted.
3. Copy the brief, or pass `onSave` to persist.

```tsx
import { useState } from 'react';
import { RepairReportPanel, target } from '@basabtan/repair-report';
import '@basabtan/repair-report/styles.css';

const TARGETS = [
  target('Sidebar', 'panel', 'App chrome', 'left panel'),
  target('SaveButton', 'button', 'Header', 'save'),
];

export function App() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Repair Request</button>
      <aside data-ui="Sidebar" data-ui-kind="panel" data-ui-location="App chrome">…</aside>
      <RepairReportPanel
        open={open}
        onClose={() => setOpen(false)}
        targets={TARGETS}
        storageKey="myapp.repair-draft.v1"
        onSave={async record => {
          // Host persist. Omit onSave for copy-only.
          localStorage.setItem(`repair:${record.id}`, JSON.stringify(record));
        }}
      />
    </>
  );
}
```

Picker ignores descendants of `[data-ui-tool]`.

## Theme

Override on `:root` or a parent. Falls back to `--navy` / `--gold` / `--vellum` if those exist.

```css
:root {
  --repair-navy: #14243f;
  --repair-gold: #b8934f;
  --repair-vellum: #f4eddd;
}
```

Corners stay square (`border-radius: 0`).

## API

| Export | Role |
| --- | --- |
| `RepairReportPanel` | Overlay: search, `@` complete, pick mode, brief + JSON spec, copy, optional save |
| `buildRepairReport` | Pure brief/spec builder |
| `target(...)` | Catalog helper |
| `repairToRecord` | `{ id, stage, title, summary, body, … }` for host storage |
| `ChangeRequestsPanel` | Inbox: list, editor, autosave, resolve, delete |
| `emptyChangeRequest` / `requestFromRepair` | Create or map a repair save into the inbox |

`RepairReportPanel.onSave` receives a generic record (`stage: 'note' | 'request'`). Use `requestFromRepair` to drop it into the inbox.

## Change Requests

Host-owned list. Autosave, priority, status, optional surfaces, delete, clear resolved.

```tsx
import { useState } from 'react';
import { ChangeRequestsPanel, type ChangeRequest } from '@basabtan/repair-report';
import '@basabtan/repair-report/styles.css';

const SURFACES = [
  { id: 'settings', label: 'Settings' },
  { id: 'dialog', label: 'Dialog' },
];

export function Inbox() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<ChangeRequest[]>([]);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Change Requests</button>
      <ChangeRequestsPanel
        open={open}
        onClose={() => setOpen(false)}
        items={items}
        surfaces={SURFACES}
        onSave={item => setItems(current => {
          const next = current.filter(row => row.id !== item.id);
          return [...next, item];
        })}
        onDelete={id => setItems(current => current.filter(row => row.id !== id))}
      />
    </>
  );
}
```

The panel creates records. Persist `items` however you want (localStorage, API).

Repair Request uses the same **Resolved** checkbox as Change Requests. Check it
and save to emit `status: 'Completed'`; uncheck it to emit `Requested`. Loading
a saved request from the repair chain now preserves its ID and creation date,
so hosts should upsert by ID. Preserve existing inbox metadata when updating
from a repair record. **New** and successful saves with `clearOnSave` reset the
editor to a fresh, unresolved request. Older records without a status remain
unresolved by default.

## Not included

- LLM calls or API keys
- Concord Notes / store / GMCR surfaces
- Host `data-ui` annotations (you add those)

## Demo

```powershell
Set-Location C:\Users\bader\services
npm install
npm run dev
```

Opens a fake host app at http://localhost:4177. Pick a control, generate the brief, save into Change Requests.

## Test

```powershell
Set-Location C:\Users\bader\services
npm test
```

## Reusable theme collection

Four reusable palettes, approved design references, and interactive style tiles are available in [themes/](themes/README.md): Ivory + Champagne, Ink Blue + Platinum, Graphite + Soft Copper, and Light Grey + Red-orange.

Download the [repository ZIP](https://github.com/basabtan/services/archive/refs/heads/main.zip), extract it, and open `themes/index.html` locally. It opens Bader's approved Ivory + Champagne main style tile by default. The [palette collection](themes/palette-collection.html) retains the four-way switcher. Gold + Obsidian and the original Ivory reskin are standalone references with embedded CSS; the gold/glass button playground is also included. Ask AI examples are visual demonstrations.

Import the portable palette tokens separately from the existing panels:

```ts
import '@basabtan/repair-report/themes/approved-palettes.tokens.css';

// ivory | ink-platinum | graphite-copper | grey-orange
document.documentElement.dataset.zealTheme = 'ivory';
```

Apply `--zs-*` variables in your own component CSS. The token stylesheet preserves generic host CSS variables; the separate ZEAL adapter stylesheet overrides them only when explicitly imported. See the [theme README](themes/README.md) for a complete example, downloads, and source provenance. Existing Repair Report and Change Requests styling is unchanged.


---

# Relationship Map

A second export in this repository: a framework-agnostic, data-driven SVG relationship/lineage-map engine. It renders any `nodes`/`edges` dataset with fixed coordinates and provides selection with relationship highlighting, a dossier card, search, pan/zoom, touch support, keyboard navigation, and token themes. No React required; it works in plain HTML, Vite, or React hosts.

Install (same package):

```powershell
npm install github:basabtan/services
```

## Wire it in

```ts
import { createRelationshipMap } from '@basabtan/repair-report/relationship-map';
import '@basabtan/repair-report/relationship-map.css';

const map = createRelationshipMap({
  container: '#map-root',
  data: myMapData,           // JSON: nodes, edges, groups, canvas, meta
  theme: 'dark',             // 'dark' | 'light'
  options: {
    enableSearch: true,
    enableDossier: true,
    enablePan: true,
    enableZoom: true,
    enableKeyboard: true,
    edgeHighlightMode: 'direct', // 'direct' | 'upstream' | 'downstream' | 'connected'
  },
});
```

Public API:

```ts
map.selectNode(nodeId);     // select, highlight relations, open dossier
map.clearSelection();
map.focusNode(nodeId);       // center viewport on a node
map.search(query);           // returns ranked matches
map.resetViewport();         // refit the initial view
map.setTheme('light');
map.destroy();
```

## Data contract

```jsonc
{
  "meta": { "title": "Example Relationship Map" },
  "canvas": { "width": 1500, "height": 950, "minZoom": 0.4, "maxZoom": 3 },
  "groups": [{ "id": "storage", "label": "Recharge and Storage", "color": "var(--map-group-a)" }],
  "nodes": [
    {
      "id": "alluvial-aquifer",
      "label": "Alluvial Aquifer",
      "secondaryLabel": "shallow storage",
      "groupId": "storage",
      "x": 800, "y": 430,
      "shape": "circle",        // circle | rect | diamond | pill
      "size": "lg",             // sm | md | lg
      "tags": ["aquifer"],
      "detail": {
        "eyebrow": "Storage",
        "title": "Alluvial Aquifer",
        "body": "Explanatory text shown in the dossier.",
        "meta": [{ "label": "Type", "value": "Storage" }]
      }
    }
  ],
  "edges": [
    { "source": "rainfall", "target": "runoff", "directed": true, "type": "generates", "weight": 2 }
  ]
}
```

Replacing the dataset with any other topic requires no source changes. Data is validated at mount (`validateRelationshipMapData`) and the graph, search, and traversal helpers (`buildGraph`, `neighbors`, `upstream`, `downstream`, `connected`, `highlightFor`, `searchNodes`) are exported for tests and host tooling.

## Behavior

- Click/tap a node to select it; related nodes stay lit, everything else dims.
- Highlight scope is configurable: direct neighbors (default), upstream, downstream, or the full connected component.
- The dossier opens next to the selected node, traps focus, and returns focus to the node on close.
- Escape closes the dossier first; a second Escape clears the selection. Background click clears selection.
- Search matches labels, secondary labels, tags, and group names; choosing a result centers, selects, and opens the node.
- Mouse drag pans; wheel zooms toward the pointer; two-finger pinch zooms on touch; tap still selects.
- Arrow keys move between the nearest nodes in each direction; Enter/Space activate; visible focus rings throughout.
- `prefers-reduced-motion` disables transitions.
- Sharp corners everywhere; no mixed radii.

## Theme

All colors are CSS custom properties on `.rm-host` (`--map-bg`, `--map-text`, `--map-node-*`, `--map-edge-*`, `--map-dossier-*`, `--map-group-a` through `--map-group-f`). Dark and light token sets ship in `relationship-map.css`; override any token on `.rm-host` or a parent to rebrand. `DEFAULT_TOKENS` is exported for programmatic use.

## Demo

Run the Vite dev server, then open `/relationship-map.html` at the served port - a synthetic "Groundwater System Dependencies" example (16 nodes, 20 edges, 4 groups, all four node shapes, directed and undirected edges). The main index demo for Repair Report is unchanged.

## Tests

`tests/relationship-map.model.test.ts` covers data validation, graph traversal, and spatial keyboard navigation. `tests/relationship-map.search.test.ts` covers search matching and ranking. Run with `npm test`.
