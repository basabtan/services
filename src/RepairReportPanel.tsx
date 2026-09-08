import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  buildRepairReport,
  findRepairTargets,
  insertRepairTarget,
  isTargetName,
  mentionAt,
  removeRepairTarget,
  repairToRecord,
  resolveRepairTargets,
  type Mention,
  type RepairRecord,
  type RepairReportOptions,
  type RepairTarget,
} from './report';

const DEFAULT_DRAFT_KEY = 'repair-draft.v1';

type Draft = { text: string; selected: string[]; knownTargets?: RepairTarget[] };

function readDraft(storageKey: string): Draft {
  try {
    const draft = JSON.parse(sessionStorage.getItem(storageKey) ?? 'null');
    if (typeof draft?.text === 'string' && Array.isArray(draft.selected)) {
      const knownTargets = Array.isArray(draft.knownTargets) ? draft.knownTargets.filter((t: Partial<RepairTarget>) =>
        t && typeof t.name === 'string' && isTargetName(t.name) && typeof t.kind === 'string'
        && typeof t.location === 'string' && Array.isArray(t.aliases) && t.aliases.every(a => typeof a === 'string')) : [];
      return { text: draft.text, selected: draft.selected.filter((s: unknown): s is string => typeof s === 'string' && isTargetName(s)), knownTargets };
    }
  } catch { /* Storage can be unavailable; in-memory editing still works. */ }
  return { text: '', selected: [] };
}

function readRegistry(catalog: RepairTarget[]) {
  const registry = new Map(catalog.map(t => [t.name, t]));
  const present: string[] = [];
  if (typeof document === 'undefined') return { registry: [...registry.values()], present };
  document.querySelectorAll<Element>('[data-ui]').forEach(el => {
    if (el.closest('[data-ui-tool]')) return;
    const name = el.getAttribute('data-ui')!;
    if (!isTargetName(name)) return;
    present.push(name);
    if (!registry.has(name)) registry.set(name, {
      name, kind: el.getAttribute('data-ui-kind') ?? 'component',
      location: el.getAttribute('data-ui-location') ?? 'Current screen', aliases: [],
    });
  });
  return { registry: [...registry.values()], present };
}

function pickElement(node: EventTarget | null) {
  if (!(node instanceof Element) || node.closest('[data-ui-tool]')) return null;
  const el = node.closest('[data-ui]');
  return el && isTargetName(el.getAttribute('data-ui') ?? '') ? el : null;
}

function currentRoute() {
  if (typeof window === 'undefined') return '/';
  return window.location.pathname + window.location.search;
}

export interface RepairReportPanelProps {
  open: boolean;
  onClose: () => void;
  /** Static catalog. Live `[data-ui]` nodes are merged in automatically. */
  targets?: RepairTarget[];
  route?: string;
  storageKey?: string;
  reportOptions?: Omit<RepairReportOptions, 'route'>;
  example?: { text: string; selected: string[] };
  /** Persist a formatted record. Omit to copy-only. */
  onSave?: (record: RepairRecord) => void | Promise<void>;
  saveNoteLabel?: string;
  saveRequestLabel?: string;
  onSaved?: () => void;
  observeRoot?: string;
}

export function RepairReportPanel({
  open, onClose,
  targets = [],
  route,
  storageKey = DEFAULT_DRAFT_KEY,
  reportOptions,
  example,
  onSave,
  saveNoteLabel = 'Save as note',
  saveRequestLabel = 'Save request',
  onSaved,
  observeRoot = 'root',
}: RepairReportPanelProps) {
  const [draft, setDraft] = useState<Draft>(() => readDraft(storageKey));
  const [catalog, setCatalog] = useState(() => ({ registry: [...targets, ...(draft.knownTargets ?? [])], present: [] as string[] }));
  const [draftStored, setDraftStored] = useState(true);
  const [query, setQuery] = useState('');
  const [auto, setAuto] = useState<{ source: 'search' | 'request'; mention?: Mention } | null>(null);
  const [autoIndex, setAutoIndex] = useState(0);
  const [pickMode, setPickMode] = useState(false);
  const [hover, setHover] = useState<{ name: string; kind: string; rect: DOMRect; x: number; y: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'brief' | 'spec'>('brief');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<{ key: string; stages: string[] }>({ key: '', stages: [] });
  const savingRef = useRef(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const requestRef = useRef<HTMLTextAreaElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const registryRef = useRef(catalog.registry);
  registryRef.current = catalog.registry;
  const catalogRef = useRef(targets);
  catalogRef.current = targets;
  const resolvedRoute = route ?? currentRoute();
  const report = useMemo(
    () => buildRepairReport(draft.text, draft.selected, catalog.registry, { route: resolvedRoute, ...reportOptions }),
    [draft, catalog.registry, resolvedRoute, reportOptions],
  );
  const resolved = useMemo(() => resolveRepairTargets(draft.text, draft.selected, catalog.registry), [draft, catalog.registry]);
  const contentKey = report.machine;
  const matches = auto ? findRepairTargets(auto.source === 'search' ? query : auto.mention?.query ?? '', catalog.registry).slice(0, 8) : [];

  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify(draft)); setDraftStored(true); }
    catch { setDraftStored(false); }
    setNotice('');
    setError('');
  }, [draft, storageKey]);

  useEffect(() => {
    if (!open) { setPickMode(false); setAuto(null); setHover(null); return; }
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    searchRef.current?.focus();
    return () => { if (opener.current?.isConnected) opener.current.focus(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const scan = () => setCatalog(current => {
      const next = readRegistry(catalogRef.current);
      return { registry: [...new Map([...current.registry, ...next.registry].map(t => [t.name, t])).values()], present: next.present };
    });
    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(scan);
    };
    scan();
    const root = document.getElementById(observeRoot) ?? document.body;
    const observer = new MutationObserver(records => {
      if (records.some(r => !(r.target instanceof Element && r.target.closest('[data-ui-tool]')))) refresh();
    });
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-ui'] });
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [open, observeRoot]);

  const addTarget = useCallback((name: string, mention?: Mention) => {
    setDraft(current => {
      const next = insertRepairTarget(current.text, name, mention);
      requestAnimationFrame(() => { requestRef.current?.focus(); requestRef.current?.setSelectionRange(next.caret, next.caret); });
      const metadata = registryRef.current.find(t => t.name === name);
      const knownTargets = metadata && !catalogRef.current.some(t => t.name === name)
        ? [...new Map([...(current.knownTargets ?? []), metadata].map(t => [t.name, t])).values()]
        : current.knownTargets;
      return { text: next.text, selected: [...new Set([...current.selected, name])], knownTargets };
    });
    setQuery(''); setAuto(null); setPickMode(false); setHover(null);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (pickMode) { setPickMode(false); setHover(null); requestAnimationFrame(() => searchRef.current?.focus()); }
        else if (auto) setAuto(null);
        else onClose();
      } else if (pickMode && pickElement(event.target) && event.key !== 'Tab') {
        event.preventDefault(); event.stopImmediatePropagation();
        if (event.key === 'Enter' || event.key === ' ') addTarget(pickElement(event.target)!.getAttribute('data-ui')!);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, pickMode, auto, onClose, addTarget]);

  useEffect(() => {
    if (!open || !pickMode) return;
    document.body.classList.add('repair-picking');
    cancelRef.current?.focus();
    let frame = 0;
    const move = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = pickElement(document.elementFromPoint(event.clientX, event.clientY));
        if (!el) { setHover(null); return; }
        const name = el.getAttribute('data-ui')!;
        setHover({ name, kind: catalog.registry.find(t => t.name === name)?.kind ?? 'component', rect: el.getBoundingClientRect(), x: event.clientX, y: event.clientY });
      });
    };
    const down = (event: Event) => {
      if (!pickElement(event.target)) return;
      event.preventDefault(); event.stopImmediatePropagation();
    };
    const click = (event: MouseEvent) => {
      const el = pickElement(event.target);
      if (!el) return;
      event.preventDefault(); event.stopImmediatePropagation();
      addTarget(el.getAttribute('data-ui')!);
    };
    const hide = () => { cancelAnimationFrame(frame); setHover(null); };
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('mousedown', down, true);
    window.addEventListener('click', click, true);
    window.addEventListener('dragstart', down, true);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
    return () => {
      document.body.classList.remove('repair-picking'); cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('mousedown', down, true);
      window.removeEventListener('click', click, true);
      window.removeEventListener('dragstart', down, true);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.removeEventListener('blur', hide);
    };
  }, [open, pickMode, catalog.registry, addTarget]);

  useEffect(() => {
    if (!auto) return;
    document.getElementById(`repair-option-${autoIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [autoIndex, auto]);

  const choose = (t: RepairTarget) => addTarget(t.name, auto?.source === 'request' ? auto.mention : undefined);
  const autoKeys = (event: ReactKeyboardEvent) => {
    if (!auto || event.nativeEvent.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setAutoIndex(i => Math.max(0, Math.min(matches.length - 1, i + (event.key === 'ArrowDown' ? 1 : -1))));
    } else if ((event.key === 'Enter' || event.key === 'Tab') && matches[autoIndex]) {
      event.preventDefault(); choose(matches[autoIndex]);
    }
  };
  const updateMention = (el: HTMLTextAreaElement) => {
    const mention = mentionAt(el.value, el.selectionStart);
    setAuto(mention ? { source: 'request', mention } : null); setAutoIndex(0);
  };
  const startPick = () => { setAuto(null); setHover(null); setPickMode(true); setNotice(''); };
  const save = async (stage: 'note' | 'request') => {
    if (!onSave || savingRef.current || !report.clarity.hasRequest) return;
    savingRef.current = true; setSaving(true); setError('');
    try {
      await onSave(repairToRecord(report, stage, crypto.randomUUID(), new Date().toISOString()));
      setSaved(current => ({ key: contentKey, stages: [...(current.key === contentKey ? current.stages : []), stage] }));
      onSaved?.();
      setNotice(stage === 'note' ? 'Saved as a note record.' : 'Saved as a request record.');
    } catch (e) { setError(`Could not save: ${e instanceof Error ? e.message : String(e)}`); }
    finally { savingRef.current = false; setSaving(false); }
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(activeTab === 'brief' ? report.brief : report.machine); setNotice('Copied to clipboard.'); setError(''); }
    catch { setError('Clipboard access failed. Select the report text and copy it manually.'); }
  };
  const suggestions = (source: 'search' | 'request') => auto?.source === source && (
    <div className="repair-autocomplete" id="repair-suggestions" role="listbox" aria-label="Component targets">
      {matches.map((t, i) => (
        <div id={`repair-option-${i}`} key={t.name} role="option" aria-selected={i === autoIndex}
          className={i === autoIndex ? 'is-active' : ''}
          onPointerDown={event => { event.preventDefault(); choose(t); }}>
          <strong>@{t.name}</strong><span>{t.kind} · {t.location}</span>
          <small>{catalog.present.includes(t.name) ? 'Mounted on this screen' : 'Open this location to pick visually'}</small>
        </div>
      ))}
      {!matches.length && <p>No matching component. Try “panel”, “button”, or “text-box”.</p>}
    </div>
  );
  const autoProps = (source: 'search' | 'request') => ({
    'aria-autocomplete': 'list' as const,
    'aria-expanded': auto?.source === source,
    'aria-controls': auto?.source === source ? 'repair-suggestions' : undefined,
    'aria-activedescendant': auto?.source === source && matches[autoIndex] ? `repair-option-${autoIndex}` : undefined,
    onKeyDown: autoKeys, onBlur: () => setAuto(null),
  });

  if (!open) return null;
  return createPortal(
    <div data-ui-tool="repair-request">
      <div className={`repair-scrim${pickMode ? ' is-picking' : ''}`} aria-hidden="true" />
      {pickMode && hover && <>
        <div className="repair-pick-outline" aria-hidden="true" style={{ left: hover.rect.left - 2, top: hover.rect.top - 2, width: hover.rect.width + 4, height: hover.rect.height + 4 }} />
        <div className="repair-pick-tip" aria-hidden="true" style={{ left: Math.max(8, Math.min(window.innerWidth - 270, hover.x + 14)), top: Math.max(8, Math.min(window.innerHeight - 70, hover.y + 14)) }}>
          @{hover.name}<span>{hover.kind}</span>
        </div>
      </>}
      <section className={`repair-panel${pickMode ? ' is-picking' : ''}`} role="dialog" aria-modal="false" aria-labelledby="repair-title" aria-describedby="repair-description" data-testid="repair-panel">
        <header className="repair-head">
          <div><span className="repair-eyebrow">Repair Request / AI Report</span><h2 id="repair-title">{pickMode ? 'Pick a UI target' : 'Describe the change naturally'}</h2>
            <p id="repair-description">{pickMode ? 'Click a highlighted element, or use Tab then Enter. Esc cancels. The panel restores after selection.' : 'Pick exact UI targets or type @ to autocomplete. You can still navigate the app underneath.'}</p>
          </div>
          <button className="repair-close" type="button" onClick={onClose} aria-label="Close Repair Request">×</button>
        </header>
        {pickMode ? <div className="repair-pick-banner"><strong>PICK MODE</strong><p>Scroll to your target, then click to select it without activating it.</p><button ref={cancelRef} className="repair-btn repair-btn-primary" type="button" onClick={() => { setPickMode(false); setHover(null); requestAnimationFrame(() => searchRef.current?.focus()); }}>Cancel Pick</button></div> : <>
          <div className="repair-body">
            <div className="repair-quick">
              <div className="repair-autofield">
                <label className="repair-vh" htmlFor="repair-search">Find a UI target</label>
                <input ref={searchRef} id="repair-search" role="combobox" placeholder="Try: panel, text-box, button, or @" value={query} {...autoProps('search')}
                  onFocus={() => { if (query) { setAuto({ source: 'search' }); setAutoIndex(0); } }}
                  onChange={e => { setQuery(e.target.value); setAuto(e.target.value ? { source: 'search' } : null); setAutoIndex(0); }} />
                {suggestions('search')}
              </div>
              <button className="repair-btn repair-btn-ghost" type="button" onClick={startPick}>+ Pick Target</button>
            </div>
            <div className="repair-chips" aria-label="Selected targets">
              {resolved.targets.map(t => <span className="repair-chip" key={t.name}>@{t.name}<button type="button" aria-label={`Remove ${t.name}`} onClick={() => setDraft(current => ({ ...current, text: removeRepairTarget(current.text, t), selected: current.selected.filter(n => n !== t.name && !t.aliases.includes(n)) }))}>×</button></span>)}
              {!resolved.targets.length && <span className="repair-hint">No targets selected yet.</span>}
            </div>
            <div className="repair-editor">
              <label htmlFor="repair-request">What should change?</label>
              <div className="repair-autofield">
                <textarea ref={requestRef} id="repair-request" value={draft.text} placeholder="Describe the change and what must stay unchanged…" {...autoProps('request')}
                  onChange={e => { setDraft(current => ({ ...current, text: e.target.value })); updateMention(e.target); }}
                  onClick={e => updateMention(e.currentTarget)} onKeyUp={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) updateMention(e.currentTarget); }} />
                {suggestions('request')}
              </div>
              <div className="repair-clarity"><span>Machine clarity <small>(heuristic)</small></span><meter min={0} max={100} value={report.clarity.score} aria-label="Machine clarity" /><strong>{report.clarity.score}%</strong><span>{report.clarity.vague.length ? `${report.clarity.vague.length} vague phrase${report.clarity.vague.length === 1 ? '' : 's'}` : 'No obvious vague phrases'}</span></div>
            </div>
            <div className="repair-actions">
              <button className="repair-btn repair-btn-primary" type="button" disabled={!report.clarity.hasRequest} onClick={() => { setActiveTab('brief'); setAuto(null); setNotice('Brief refreshed locally. Review the open questions; no AI service was called.'); }}>AI Clarify</button>
              <button className="repair-btn repair-btn-ghost" type="button" onClick={startPick}>+ Pick Target</button>
              {example && <button className="repair-btn repair-btn-ghost" type="button" onClick={() => { setDraft({ text: example.text, selected: example.selected }); setAuto(null); setQuery(''); }}>Load Example</button>}
              <button className="repair-btn repair-btn-ghost" type="button" onClick={() => { setDraft({ text: '', selected: [] }); setQuery(''); setAuto(null); setSaved({ key: '', stages: [] }); }}>Clear</button>
            </div>
            <p className="repair-disclosure">Local formatter, not an AI service. Preview updates as you type; no app changes are applied.</p>
            <div className="repair-result">
              <div className="repair-result-head">
                <div className="repair-tabs" role="tablist" aria-label="Report format">
                  {(['brief', 'spec'] as const).map(tab => <button type="button" role="tab" key={tab} id={`repair-tab-${tab}`} aria-controls="repair-output" aria-selected={activeTab === tab} tabIndex={activeTab === tab ? 0 : -1}
                    onClick={() => setActiveTab(tab)} onKeyDown={e => { if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) { e.preventDefault(); const next = e.key === 'Home' ? 'brief' : e.key === 'End' ? 'spec' : tab === 'brief' ? 'spec' : 'brief'; setActiveTab(next); document.getElementById(`repair-tab-${next}`)?.focus(); } }}>{tab === 'brief' ? 'AI-ready brief' : 'Machine spec'}</button>)}
                </div><button className="repair-btn repair-btn-ghost" type="button" onClick={() => { void copy(); }} disabled={!report.clarity.hasRequest}>Copy</button>
              </div>
              <pre id="repair-output" role="tabpanel" aria-labelledby={`repair-tab-${activeTab}`} tabIndex={0}>{activeTab === 'brief' ? report.brief : report.machine}</pre>
            </div>
          </div>
          <footer className="repair-footer">
            <small>{draftStored ? 'Draft stays in this browser tab.' : 'Browser draft storage is unavailable. Copy or save before leaving.'}</small>
            {notice && <p role="status">{notice}</p>}{error && <p className="repair-error" role="alert">{error}</p>}
            {onSave && (
              <div className="repair-actions">
                <button className="repair-btn repair-btn-ghost" type="button" disabled={saving || !report.clarity.hasRequest || (saved.key === contentKey && saved.stages.includes('note'))} onClick={() => { void save('note'); }}>{saveNoteLabel}</button>
                <button className="repair-btn repair-btn-primary" type="button" disabled={saving || !report.clarity.hasRequest || (saved.key === contentKey && saved.stages.includes('request'))} onClick={() => { void save('request'); }}>{saving ? 'Saving…' : saveRequestLabel}</button>
              </div>
            )}
          </footer>
        </>}
      </section>
    </div>, document.body,
  );
}
