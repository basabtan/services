import { useEffect, useState } from 'react';
import {
  ChangeRequestsPanel,
  RepairReportPanel,
  requestFromRepair,
  target,
  type ChangeRequest,
} from '../src';

const TARGETS = [
  target('HostSidebar', 'panel', 'App chrome', 'left panel', 'sidebar'),
  target('HostHeader', 'panel', 'App chrome', 'header', 'top bar'),
  target('SaveButton', 'button', 'Header', 'save'),
  target('NotesBody', 'input', 'Main', 'text-box', 'textarea', 'notes'),
];

const SURFACES = [
  { id: 'chrome', label: 'Chrome' },
  { id: 'editor', label: 'Editor' },
  { id: 'dialog', label: 'Dialog' },
];

const STORE_KEY = 'repair-demo.requests.v1';

function loadRequests(): ChangeRequest[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY) ?? '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export function App() {
  const [repairOpen, setRepairOpen] = useState(false);
  const [inboxOpen, setInboxOpen] = useState(false);
  const [items, setItems] = useState<ChangeRequest[]>(loadRequests);
  const [notes, setNotes] = useState('Host app content. Mark real controls with data-ui, then pick them.');

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
  }, [items]);

  const upsert = (item: ChangeRequest) => {
    setItems(current => [...current.filter(row => row.id !== item.id), item]);
  };

  return (
    <div className="host">
      <aside className="host-sidebar" data-ui="HostSidebar" data-ui-kind="panel" data-ui-location="App chrome">
        <strong>Host app</strong>
        <button type="button" onClick={() => setRepairOpen(true)}>Repair Request</button>
        <button type="button" onClick={() => setInboxOpen(true)}>Change Requests ({items.length})</button>
      </aside>
      <div className="host-main">
        <header className="host-header" data-ui="HostHeader" data-ui-kind="panel" data-ui-location="App chrome">
          <span>Demo workspace</span>
          <button type="button" data-ui="SaveButton" data-ui-kind="button" data-ui-location="Header">Save</button>
        </header>
        <textarea
          data-ui="NotesBody"
          data-ui-kind="input"
          data-ui-location="Main"
          value={notes}
          onChange={event => setNotes(event.target.value)}
        />
      </div>
      <RepairReportPanel
        open={repairOpen}
        onClose={() => setRepairOpen(false)}
        targets={TARGETS}
        storageKey="repair-demo.draft.v1"
        example={{
          text: 'Make @HostSidebar narrower. Keep @NotesBody unchanged.',
          selected: ['HostSidebar', 'NotesBody'],
        }}
        onSave={record => upsert(requestFromRepair(record, { surfaces: ['chrome'] }))}
        onSaved={() => setInboxOpen(true)}
      />
      <ChangeRequestsPanel
        open={inboxOpen}
        onClose={() => setInboxOpen(false)}
        items={items}
        surfaces={SURFACES}
        onSave={upsert}
        onDelete={id => setItems(current => current.filter(row => row.id !== id))}
        onRepair={() => { setInboxOpen(false); setRepairOpen(true); }}
      />
    </div>
  );
}
