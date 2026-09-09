import { describe, expect, it } from 'vitest';
import { repairToRecord, buildRepairReport, target } from '../src/report';
import {
  emptyChangeRequest,
  formatWhen,
  isRequestResolved,
  requestFromRepair,
  toggleSurface,
} from '../src/requests';

describe('change request records', () => {
  it('starts as an unresolved Normal request', () => {
    const item = emptyChangeRequest('r1', '2026-09-09T00:00:00Z');
    expect(item.priority).toBe('Normal');
    expect(item.status).toBe('Requested');
    expect(isRequestResolved(item)).toBe(false);
    expect(item.surfaces).toEqual([]);
  });

  it('treats Completed as resolved', () => {
    expect(isRequestResolved({ status: 'Completed' })).toBe(true);
    expect(isRequestResolved({ status: 'In progress' })).toBe(false);
  });

  it('toggles surfaces without duplicates', () => {
    expect(toggleSurface([], 'rail')).toEqual(['rail']);
    expect(toggleSurface(['rail', 'dialog'], 'rail')).toEqual(['dialog']);
  });

  it('maps a repair record into a change request', () => {
    const report = buildRepairReport('Widen @Sidebar', [], [target('Sidebar', 'panel', 'Chrome')], '/');
    const repair = repairToRecord(report, 'request', 'rep-1', '2026-09-09T00:00:00Z');
    const request = requestFromRepair(repair, { surfaces: ['chrome'] });
    expect(request.id).toBe('rep-1');
    expect(request.summary).toBe('Widen @Sidebar');
    expect(request.status).toBe('Requested');
    expect(request.surfaces).toEqual(['chrome']);
    expect(request.body).toContain(report.brief);
    expect(request.acceptanceCriteria).toContain('named targets');
  });

  it('formats timestamps or falls back', () => {
    expect(formatWhen('not-a-date')).toBe('—');
    expect(formatWhen('2026-09-09T00:00:00Z')).toMatch(/2026/);
  });
});
