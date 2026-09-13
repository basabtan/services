import type { RepairRecord } from './report';
import { isAttachment, type Attachment } from './attachments';

export const REQUEST_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'] as const;
export type RequestPriority = (typeof REQUEST_PRIORITIES)[number];

export const REQUEST_STATUSES = ['Requested', 'Planned', 'In progress', 'Completed'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface RequestSurface {
  id: string;
  label: string;
}

export interface ChangeRequest {
  id: string;
  title: string;
  summary: string;
  body: string;
  priority: RequestPriority;
  status: RequestStatus;
  surfaces: string[];
  desiredOutcome: string;
  acceptanceCriteria: string;
  createdAt: string;
  updatedAt: string;
  /** Optional so records saved before attachments existed still validate. */
  attachments?: Attachment[];
}

export function emptyChangeRequest(id: string, now: string): ChangeRequest {
  return {
    id, title: '', summary: '', body: '',
    priority: 'Normal', status: 'Requested', surfaces: [],
    desiredOutcome: '', acceptanceCriteria: '',
    createdAt: now, updatedAt: now,
    attachments: [],
  };
}

export function requestAttachments(request: Pick<ChangeRequest, 'attachments'>): Attachment[] {
  return Array.isArray(request.attachments) ? request.attachments.filter(isAttachment) : [];
}

export function isRequestResolved(request: Pick<ChangeRequest, 'status'>): boolean {
  return request.status === 'Completed';
}

export function toggleSurface(current: string[], surface: string): string[] {
  return current.includes(surface) ? current.filter(item => item !== surface) : [...current, surface];
}

export function requestFromRepair(record: RepairRecord, extras: Partial<ChangeRequest> = {}): ChangeRequest {
  return {
    id: record.id,
    title: record.title,
    summary: record.summary,
    body: record.body,
    priority: extras.priority ?? 'Normal',
    status: extras.status ?? 'Requested',
    surfaces: extras.surfaces ?? [],
    desiredOutcome: extras.desiredOutcome ?? '',
    acceptanceCriteria: extras.acceptanceCriteria ?? record.acceptanceCriteria,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    attachments: extras.attachments ?? record.attachments ?? [],
  };
}

export function formatWhen(iso: string | number | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}
