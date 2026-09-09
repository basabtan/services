import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  emptyChangeRequest,
  formatWhen,
  isRequestResolved,
  REQUEST_PRIORITIES,
  REQUEST_STATUSES,
  toggleSurface,
  type ChangeRequest,
  type RequestPriority,
  type RequestStatus,
  type RequestSurface,
} from './requests';

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';

export interface ChangeRequestsPanelProps {
  open: boolean;
  onClose: () => void;
  items: ChangeRequest[];
  onSave: (item: ChangeRequest) => void | Promise<void>;
  onDelete: (id: string) => void | Promise<void>;
  surfaces?: RequestSurface[];
  priorities?: readonly RequestPriority[];
  statuses?: readonly RequestStatus[];
  onRepair?: () => void;
}

export function ChangeRequestsPanel({
  open, onClose, items, onSave, onDelete,
  surfaces = [],
  priorities = REQUEST_PRIORITIES,
  statuses = REQUEST_STATUSES,
  onRepair,
}: ChangeRequestsPanelProps) {
  const requests = items.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const resolvedRequests = requests.filter(isRequestResolved);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ChangeRequest | null>(null);
  const [pane, setPane] = useState<'list' | 'editor'>('list');
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [err, setErr] = useState('');
  const [ask, setAsk] = useState<{ kind: 'delete' | 'clear'; x: number; y: number } | null>(null);
  const editVersion = useRef(0);

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      setDraft(null);
      setPane('list');
      setSaveState('saved');
      setErr('');
      setAsk(null);
    }
  }, [open]);

  useEffect(() => {
    if (!selectedId) {
      setDraft(null);
      return;
    }
    const current = items.find(item => item.id === selectedId);
    if (!current) return;
    setDraft(previous => (previous?.id === current.id ? previous : current));
    setSaveState(previous => (previous === 'dirty' || previous === 'saving' ? previous : 'saved'));
  }, [items, selectedId]);

  const saveDraft = async (item: ChangeRequest, version: number) => {
    setSaveState('saving');
    try {
      const next = { ...item, updatedAt: new Date().toISOString() };
      await onSave(next);
      if (editVersion.current === version) {
        setDraft(current => (current?.id === next.id ? next : current));
        setSaveState('saved');
      } else {
        setSaveState('dirty');
      }
      setErr('');
      return true;
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
      setSaveState('error');
      return false;
    }
  };

  useEffect(() => {
    if (!open || !draft || saveState !== 'dirty') return;
    const snapshot = draft;
    const version = editVersion.current;
    const timer = window.setTimeout(() => { void saveDraft(snapshot, version); }, 700);
    return () => window.clearTimeout(timer);
  }, [draft, open, saveState]);

  const flush = async () => {
    if (!draft || (saveState !== 'dirty' && saveState !== 'error')) return true;
    return saveDraft(draft, editVersion.current);
  };

  const patch = (partial: Partial<ChangeRequest>) => {
    editVersion.current += 1;
    setSaveState('dirty');
    setDraft(current => (current ? { ...current, ...partial } : current));
  };

  const select = async (id: string) => {
    if (!(await flush())) return;
    setSelectedId(id);
    setPane('editor');
    setSaveState('saved');
    setErr('');
  };

  const createRequest = async () => {
    if (!(await flush())) return;
    const request = emptyChangeRequest(crypto.randomUUID(), new Date().toISOString());
    try {
      await onSave(request);
      setSelectedId(request.id);
      setDraft(request);
      setPane('editor');
      setSaveState('saved');
      setErr('');
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    }
  };

  const remove = async () => {
    if (!draft) return;
    try {
      await onDelete(draft.id);
      setSelectedId(null);
      setDraft(null);
      setPane('list');
      setSaveState('saved');
      setErr('');
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    }
  };

  const clearResolved = async () => {
    if (!(await flush())) return;
    try {
      await Promise.all(resolvedRequests.map(request => onDelete(request.id)));
      if (draft && resolvedRequests.some(request => request.id === draft.id)) {
        setSelectedId(null);
        setDraft(null);
        setPane('list');
        setSaveState('saved');
      }
      setErr('');
    } catch (error) {
      setErr(error instanceof Error ? error.message : String(error));
    }
  };

  const requestClose = async () => {
    if (await flush()) onClose();
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (ask) setAsk(null);
        else void requestClose();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, ask, draft, saveState]);

  if (!open) return null;
  return createPortal(
    <div data-ui-tool="change-requests">
      <div className="cr-scrim" onClick={() => { void requestClose(); }} />
      <section className="cr-panel" role="dialog" aria-modal="true" aria-labelledby="cr-title" aria-describedby="cr-description" data-testid="change-requests-panel">
        <header className="cr-head">
          <div>
            <span className="cr-eyebrow">Product request inbox</span>
            <h2 id="cr-title">Change Requests</h2>
            <p id="cr-description">Describe what should change, why it matters, and what success looks like. Requests autosave as you type.</p>
          </div>
          <div className="cr-head-actions">
            {onRepair && <button className="cr-btn cr-btn-ghost" type="button" onClick={onRepair}>Repair Request</button>}
            <button className="cr-close" type="button" onClick={() => { void requestClose(); }} aria-label="Close Change Requests">×</button>
          </div>
        </header>
        <div className={`cr-body${pane === 'editor' ? ' show-editor' : ' show-list'}`}>
          <aside className="cr-list">
            <div className="cr-list-toolbar">
              <button className="cr-btn cr-btn-primary" type="button" onClick={() => { void createRequest(); }} data-testid="button-new-request">New request</button>
              {resolvedRequests.length > 0 && (
                <button
                  className="cr-btn cr-btn-danger"
                  type="button"
                  onClick={event => setAsk({ kind: 'clear', x: event.clientX, y: event.clientY })}
                  data-testid="button-clear-resolved-requests"
                >
                  Clear resolved ({resolvedRequests.length})
                </button>
              )}
            </div>
            {requests.length === 0 && (
              <div className="cr-empty">
                <strong>No change requests yet</strong>
                Add the problem, affected surface, priority, and the result you expect.
              </div>
            )}
            <ul>
              {requests.map(request => (
                <li key={request.id}>
                  <button
                    className={`cr-item${request.id === selectedId ? ' is-active' : ''}${isRequestResolved(request) ? ' is-resolved' : ''}`}
                    type="button"
                    onClick={() => { void select(request.id); }}
                  >
                    <span className="cr-item-meta">
                      <span className={`cr-priority priority-${request.priority.toLowerCase()}`}>{request.priority}</span>
                      <span>{request.status}</span>
                      {isRequestResolved(request) && <span className="cr-resolved-mark">Resolved</span>}
                    </span>
                    <strong>{request.title.trim() || 'Untitled request'}</strong>
                    <span>{request.summary.trim() || 'Describe the requested change'}</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
          <div className="cr-editor">
            {draft ? (
              <form
                className="cr-form"
                onSubmit={event => {
                  event.preventDefault();
                  void saveDraft(draft, editVersion.current);
                }}
              >
                <button className="cr-btn cr-btn-ghost cr-back" type="button" onClick={() => setPane('list')}>Back to requests</button>
                {err && <div className="cr-banner" role="alert">{err}</div>}
                <label className="cr-field">
                  <span>Request title</span>
                  <input id="request-title" value={draft.title} onChange={event => patch({ title: event.target.value })} placeholder="What should change?" data-testid="input-request-title" />
                </label>
                <label className="cr-field">
                  <span>Requested change</span>
                  <textarea id="request-change" data-ui="ChangeRequestInput" value={draft.summary} onChange={event => patch({ summary: event.target.value })} placeholder="Describe the behavior or interface you want changed." data-testid="input-request-summary" />
                </label>
                <div className="cr-grid">
                  <label className="cr-field">
                    <span>Priority</span>
                    <select value={draft.priority} onChange={event => patch({ priority: event.target.value as RequestPriority })}>
                      {priorities.map(priority => <option key={priority} value={priority}>{priority}</option>)}
                    </select>
                  </label>
                  <label className="cr-field">
                    <span>Status</span>
                    <select value={draft.status} onChange={event => patch({ status: event.target.value as RequestStatus })}>
                      {statuses.map(status => <option key={status} value={status}>{status}</option>)}
                    </select>
                  </label>
                </div>
                <label className={`cr-resolved${isRequestResolved(draft) ? ' is-resolved' : ''}`}>
                  <input
                    type="checkbox"
                    checked={isRequestResolved(draft)}
                    onChange={event => patch({ status: event.target.checked ? 'Completed' : 'Requested' })}
                    data-testid="checkbox-request-resolved"
                  />
                  <span>
                    <strong>Resolved</strong>
                    <small>Mark this request complete so it can be cleared from the inbox.</small>
                  </span>
                </label>
                {surfaces.length > 0 && (
                  <fieldset className="cr-surfaces">
                    <legend>Affected surfaces</legend>
                    <div className="cr-check-grid">
                      {surfaces.map(surface => (
                        <label key={surface.id}>
                          <input
                            type="checkbox"
                            checked={draft.surfaces.includes(surface.id)}
                            onChange={() => patch({ surfaces: toggleSurface(draft.surfaces, surface.id) })}
                          />
                          {surface.label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                )}
                <label className="cr-field">
                  <span>Context or evidence</span>
                  <textarea value={draft.body} onChange={event => patch({ body: event.target.value })} placeholder="What happened, where did it happen, and what is the current workaround?" />
                </label>
                <label className="cr-field">
                  <span>Desired outcome</span>
                  <textarea value={draft.desiredOutcome} onChange={event => patch({ desiredOutcome: event.target.value })} placeholder="What should be easier or possible after this change?" />
                </label>
                <label className="cr-field">
                  <span>Acceptance criteria</span>
                  <textarea value={draft.acceptanceCriteria} onChange={event => patch({ acceptanceCriteria: event.target.value })} placeholder="List the observable checks that would make this request complete." />
                </label>
                <p className="cr-timestamp">Created {formatWhen(draft.createdAt)} · Updated {formatWhen(draft.updatedAt)}</p>
                <div className="cr-form-actions">
                  <button className="cr-btn cr-btn-ghost" type="submit">Save now</button>
                  <span className={`cr-save cr-save-${saveState}`} role="status" aria-live="polite">
                    {saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Autosave pending' : saveState === 'error' ? 'Autosave failed' : 'All changes saved'}
                  </span>
                  <button
                    className="cr-btn cr-btn-danger cr-spacer"
                    type="button"
                    onClick={event => setAsk({ kind: 'delete', x: event.clientX, y: event.clientY })}
                  >
                    Delete request
                  </button>
                </div>
              </form>
            ) : (
              <div className="cr-empty">
                <strong>Select a request</strong>
                Or create a new request from the list.
              </div>
            )}
          </div>
        </div>
        {ask && (
          <div className="cr-confirm" style={{ left: Math.max(8, Math.min(window.innerWidth - 280, ask.x - 20)), top: Math.max(8, Math.min(window.innerHeight - 140, ask.y + 8)) }} role="alertdialog">
            <p>
              {ask.kind === 'delete'
                ? `Delete "${draft?.title.trim() || 'Untitled request'}"? This cannot be undone.`
                : `Clear ${resolvedRequests.length} resolved ${resolvedRequests.length === 1 ? 'request' : 'requests'}? This permanently removes ${resolvedRequests.length === 1 ? 'it' : 'them'}.`}
            </p>
            <div className="cr-confirm-actions">
              <button className="cr-btn cr-btn-ghost" type="button" onClick={() => setAsk(null)}>Cancel</button>
              <button
                className="cr-btn cr-btn-danger"
                type="button"
                onClick={() => {
                  const kind = ask.kind;
                  setAsk(null);
                  if (kind === 'delete') void remove();
                  else void clearResolved();
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        )}
      </section>
    </div>,
    document.body,
  );
}
