import { describe, expect, it } from 'vitest';
import {
  buildRepairReport,
  findRepairTargets,
  insertRepairTarget,
  mentionAt,
  removeRepairTarget,
  repairClarity,
  repairToRecord,
  resolveRepairTargets,
  target,
  targetSelector,
} from '../src/report';

const TARGETS = [
  target('Sidebar', 'panel', 'Application navigation', 'LeftSidebarPanel', 'left panel', 'sidebar'),
  target('RunButton', 'button', 'Toolbar', 'RunAnalysisButton', 'run button'),
  target('NotesBody', 'input', 'Notes dialog', 'NotesTextArea', 'text-box', 'textarea'),
  target('Chart', 'graph', 'Workspace / Chart', 'StateGraphCanvas', 'graph', 'canvas'),
];

describe('repair target registry and autocomplete', () => {
  it('maps aliases to canonical names without inventing missing targets', () => {
    expect(findRepairTargets('LeftSidebarPanel', TARGETS)[0].name).toBe('Sidebar');
    expect(findRepairTargets('RunAnalysisButton', TARGETS)[0].name).toBe('RunButton');
    expect(findRepairTargets('NotesTextArea', TARGETS)[0].name).toBe('NotesBody');
    expect(findRepairTargets('StateGraphCanvas', TARGETS)[0].name).toBe('Chart');
    expect(resolveRepairTargets('@SaveButton', [], TARGETS).unresolved).toEqual(['SaveButton']);
    expect(findRepairTargets('MetricsRow', TARGETS)).toEqual([]);
  });

  it('supports aliases, component types, empty @ queries and case-insensitive search', () => {
    expect(findRepairTargets('TEXT-BOX', TARGETS).map(t => t.name)).toContain('NotesBody');
    expect(findRepairTargets('@', TARGETS)).toHaveLength(TARGETS.length);
    expect(findRepairTargets('button', TARGETS).map(t => t.name)).toContain('RunButton');
  });

  it('uses unique safe IDs', () => {
    expect(new Set(TARGETS.map(t => t.name)).size).toBe(TARGETS.length);
    for (const t of TARGETS) expect(targetSelector(t.name)).toBe(`[data-ui="${t.name}"]`);
    expect(() => targetSelector('a"] onclick="x')).toThrow();
  });

  it('finds a mention at the caret, replaces the complete token, and preserves surrounding prose', () => {
    const text = 'Move @NotesBody higher, keep the rest.';
    const mention = mentionAt(text, 11)!;
    expect(mention.query).toBe('Notes');
    expect(insertRepairTarget(text, 'NotesEditor', mention).text).toBe('Move @NotesEditor higher, keep the rest.');
    expect(mentionAt('email@example.com', 10)).toBeNull();
    expect(mentionAt('Move the panel', 14)).toBeNull();
  });

  it('does not duplicate tokens and removes only exact mentions', () => {
    expect(insertRepairTarget('@Chart', 'Chart').text).toBe('@Chart');
    const chart = TARGETS.find(t => t.name === 'Chart')!;
    expect(removeRepairTarget('@Chart @ChartNode-0x1 @StateGraphCanvas', chart).trim()).toBe('@ChartNode-0x1');
  });

  it('deduplicates selected and typed targets, resolves aliases, and reports unknown names', () => {
    const result = resolveRepairTargets('@StateGraphCanvas @Chart @Unknown', ['Chart'], TARGETS);
    expect(result.targets.map(t => t.name)).toEqual(['Chart']);
    expect(result.unresolved).toEqual(['Unknown']);
  });
});

describe('local AI-ready repair reports', () => {
  it('preserves requests verbatim without claiming to infer vague visual changes', () => {
    const raw = 'Make @Sidebar a little thinner. Keep @NotesBody unchanged.';
    const report = buildRepairReport(raw, [], TARGETS, '/settings');
    expect(report.spec.source_note).toBe(raw);
    expect(report.spec.preserve_instructions).toEqual(['Keep @NotesBody unchanged.']);
    expect(report.spec.open_questions.join()).toContain('a little');
    expect(report.spec.targets.map(t => t.name)).not.toContain('Chart');
    expect(report.brief).not.toContain('@StateGraphCanvas');
    expect(report.spec.generator).toBe('local_formatter');
    expect(report.spec.constraints).toMatchObject({ preserve_functionality: true, avoid_unrelated_changes: true });
    expect(report.brief).not.toContain('GMCR');
  });

  it('handles empty, target-only, unknown and hostile source content as data', () => {
    expect(repairClarity('', 0)).toMatchObject({ score: 0, hasRequest: false });
    expect(repairClarity('@Chart', 1).hasRequest).toBe(false);
    const report = buildRepairReport('<script>alert(1)</script> @NoSuchTarget', [], TARGETS, '/');
    expect(JSON.parse(report.machine).source_note).toBe('<script>alert(1)</script> @NoSuchTarget');
    expect(report.spec.unresolved_targets).toEqual(['NoSuchTarget']);
  });

  it('reflects edits immediately and keeps brief/spec targets consistent', () => {
    const first = buildRepairReport('Resize @Sidebar', [], TARGETS, '/');
    const next = buildRepairReport('Resize @NotesBody', [], TARGETS, '/');
    expect(next.machine).not.toContain('Sidebar');
    expect(next.brief).toContain('@NotesBody');
    expect(first.machine).not.toBe(next.machine);
  });

  it('creates separate note and request records with full brief and spec', () => {
    const report = buildRepairReport('Align @RunButton.', [], TARGETS, '/app');
    const note = repairToRecord(report, 'note', 'new-note', '2026-09-08T00:00:00Z');
    const request = repairToRecord(report, 'request', 'new-request', note.createdAt);
    expect(note.stage).toBe('note');
    expect(request.stage).toBe('request');
    expect(note.id).not.toBe(request.id);
    expect(note.body).toContain(report.brief);
    expect(note.body).toContain(report.machine);
  });

  it('accepts host constraints and acceptance criteria', () => {
    const report = buildRepairReport('Widen @Sidebar', [], TARGETS, {
      route: '/x',
      constraints: { preserve_custom: true },
      acceptanceCriteria: ['Sidebar is wider.'],
    });
    expect(report.spec.constraints).toMatchObject({ preserve_custom: true, preserve_functionality: true });
    expect(report.spec.acceptance_criteria).toEqual(['Sidebar is wider.']);
  });
});
