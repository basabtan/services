import { describe, expect, it } from 'vitest';
import {
  ATTACHMENT_MAX_COUNT,
  describeRejections,
  filesToAttachments,
  formatBytes,
  isAttachment,
  isImageAttachment,
} from '../src/attachments';
import { buildRepairReport, repairToRecord, target } from '../src/report';
import { emptyChangeRequest, requestAttachments, requestFromRepair } from '../src/requests';

const opts = { now: () => '2026-09-13T19:00:00.000Z', id: () => 'att-1' };

describe('attachments', () => {
  it('embeds a small file as a data URL with its metadata', async () => {
    const file = new File([new Uint8Array([104, 105])], 'note.txt', { type: 'text/plain' });
    const result = await filesToAttachments([file], 0, opts);
    expect(result.rejected).toEqual([]);
    expect(result.accepted).toEqual([{
      id: 'att-1', name: 'note.txt', type: 'text/plain', size: 2,
      dataUrl: 'data:text/plain;base64,aGk=', addedAt: '2026-09-13T19:00:00.000Z',
    }]);
    expect(isAttachment(result.accepted[0])).toBe(true);
  });

  it('rejects oversized files and files past the count cap without dropping the rest', async () => {
    const big = new File([new Uint8Array(3000)], 'big.png', { type: 'image/png' });
    const small = new File([new Uint8Array(10)], 'small.png', { type: 'image/png' });
    const result = await filesToAttachments([big, small], 0, { ...opts, maxBytes: 2048 });
    expect(result.accepted.map(a => a.name)).toEqual(['small.png']);
    expect(result.rejected).toEqual([{ name: 'big.png', reason: 'Larger than 2.0 KB' }]);

    const capped = await filesToAttachments([small], ATTACHMENT_MAX_COUNT, opts);
    expect(capped.accepted).toEqual([]);
    expect(capped.rejected[0].reason).toMatch(/Limit of/);
    expect(describeRejections(capped.rejected)).toBe(`small.png: Limit of ${ATTACHMENT_MAX_COUNT} attachments reached`);
    expect(describeRejections([])).toBe('');
  });

  it('formats sizes and recognises images', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2.0 KB');
    expect(formatBytes(3 * 1024 * 1024)).toBe('3.0 MB');
    expect(isImageAttachment({ type: 'image/webp' })).toBe(true);
    expect(isImageAttachment({ type: 'application/pdf' })).toBe(false);
  });

  it('validates stored attachment shapes and tolerates records without them', () => {
    expect(isAttachment({ id: 'a', name: 'n', type: 't', size: 1, dataUrl: '', addedAt: 'x' })).toBe(true);
    expect(isAttachment({ id: 'a', name: 'n' })).toBe(false);
    expect(requestAttachments(emptyChangeRequest('r', 'now'))).toEqual([]);
    expect(requestAttachments({ attachments: undefined })).toEqual([]);
    expect(requestAttachments({ attachments: [{ bogus: true } as never, { id: 'a', name: 'n', type: 't', size: 1, dataUrl: '', addedAt: 'x' }] })).toHaveLength(1);
  });
});

describe('attachments in reports and records', () => {
  const registry = [target('AppHeader', 'panel', 'App chrome')];
  const attachment = { id: 'att-1', name: 'shot.png', type: 'image/png', size: 10, dataUrl: 'data:image/png;base64,AA==', addedAt: 'now' };

  it('lists attachment names in the brief and the spec only when present', () => {
    const plain = buildRepairReport('Fix @AppHeader', [], registry, { route: '/' });
    expect(plain.brief).not.toContain('ATTACHMENTS');
    expect('attachments' in plain.spec).toBe(false);

    const withFile = buildRepairReport('Fix @AppHeader', [], registry, { route: '/', attachments: [attachment] });
    expect(withFile.brief).toContain('ATTACHMENTS\n- shot.png (image/png)');
    expect((withFile.spec as { attachments?: unknown[] }).attachments).toEqual([{ name: 'shot.png', type: 'image/png', size: 10 }]);
    expect(withFile.brief).not.toContain('base64');
  });

  it('carries attachments and target names from the record into the inbox request', () => {
    const report = buildRepairReport('Widen @AppHeader search', [], registry, { route: '/zeal/' });
    const record = repairToRecord(report, 'request', 'rec-1', '2026-09-13T19:05:00.000Z', [attachment]);
    expect(record.targets).toEqual(['AppHeader']);
    expect(record.attachments).toEqual([attachment]);
    const request = requestFromRepair(record);
    expect(request.attachments).toEqual([attachment]);
    expect(requestFromRepair({ ...record, attachments: [] }, { attachments: [attachment] }).attachments).toEqual([attachment]);
  });
});
