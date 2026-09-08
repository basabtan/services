# Repair Report

Host-agnostic **Repair Request / AI Report** panel. Local formatter only — no AI provider, no app store, no Concord/GMCR types.

Copy the brief into Cursor or any chat. The panel does not apply UI changes.

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

`onSave` receives a generic record (`stage: 'note' | 'request'`). Map it to your inbox. No Change Requests UI is included.

## Not included

- LLM calls or API keys
- Concord Notes / Change Requests / store
- Host `data-ui` annotations (you add those)

## Test

```powershell
Set-Location C:\Users\bader\services
npm test
```
