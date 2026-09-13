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

## Not included

- LLM calls or API keys
- Concord Notes / store / GMCR surfaces
- Host `data-ui` annotations (you add those)

## Test

```powershell
Set-Location C:\Users\bader\services
npm test
```

## Reusable theme collection

Four reusable palettes, approved design references, and interactive style tiles are available in [themes/](themes/README.md): Ivory + Champagne, Ink Blue + Platinum, Graphite + Soft Copper, and Light Grey + Red-orange.

Download the [repository ZIP](https://github.com/basabtan/services/archive/refs/heads/main.zip), extract it, and open `themes/index.html` locally for the palette switcher. Gold + Obsidian and the original Ivory reskin are standalone references with embedded CSS; the gold/glass button playground is also included. Ask AI examples are visual demonstrations.

Import the portable palette tokens separately from the existing panels:

```ts
import '@basabtan/repair-report/themes/approved-palettes.tokens.css';

// ivory | ink-platinum | graphite-copper | grey-orange
document.documentElement.dataset.zealTheme = 'graphite-copper';
```

Apply `--zs-*` variables in your own component CSS. The token stylesheet preserves generic host CSS variables; the separate ZEAL adapter stylesheet overrides them only when explicitly imported. See the [theme README](themes/README.md) for a complete example, downloads, and source provenance. Existing Repair Report and Change Requests styling is unchanged.
