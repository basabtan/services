/** Portable online request contracts. Existing panels remain host-owned. */
export const CREATIVE_MODES = ['elevate', 'refine', 'reimagine'] as const;
export type CreativeMode = (typeof CREATIVE_MODES)[number];
export const WORKFLOW_STATUSES = ['Requested', 'Planned', 'In progress', 'Needs information', 'Preview ready', 'Completed'] as const;
export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];
export interface RequestOrigin {
  appId: string;
  url: string;
  pageTitle: string;
  route: string;
  locale: 'en' | 'ar';
  capturedAt: string;
  targets: string[];
  legacy?: boolean;
}
export interface AttachmentReference {
  id: string; name: string; type: string; size: number; addedAt: string;
  /** Authenticated broker link, never a signed storage URL. */
  url: string;
}
export interface OnlineRequestInput {
  id: string; title: string; text: string; kind: 'change' | 'repair';
  priority: 'Low' | 'Normal' | 'High' | 'Urgent';
  creativeMode: CreativeMode; desiredOutcome: string;
  origin: RequestOrigin; attachments: AttachmentReference[];
  legacy?: { createdAt: string; updatedAt: string; completed: boolean; body: string; acceptanceCriteria: string; surfaces: string[] };
}
export interface OnlineRequest extends OnlineRequestInput {
  submitterId: string; submitterName: string; createdAt: string; updatedAt: string;
  status: WorkflowStatus; delivery: 'queued' | 'syncing' | 'saved' | 'attention';
  issueNumber: number | null; issueUrl?: string; previewUrl?: string;
}
export interface RequestUpdate {
  id: string; text: string; audience: 'customer' | 'internal';
  kind: 'amendment' | 'workflow' | 'comment'; createdAt: string;
  delivery?: string;
}
export interface RequestStorageAdapter {
  list(): Promise<OnlineRequest[]>;
  read(id: string): Promise<{ request: OnlineRequest; updates: RequestUpdate[] }>;
  submit(input: OnlineRequestInput): Promise<OnlineRequest>;
  amend(id: string, update: { id: string; text: string; creativeMode?: CreativeMode }): Promise<void>;
}
const SENSITIVE = /token|secret|password|credential|authorization|signature|api.?key|^code$|^state$|^session$/i;
export function safeRequestUrl(raw: string): string {
  const url = new URL(raw);
  url.username = ''; url.password = ''; url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (SENSITIVE.test(key)) url.searchParams.delete(key);
  return url.href;
}
export function captureRequestOrigin(appId: string, locale: 'en' | 'ar' = 'en'): RequestOrigin {
  const url = safeRequestUrl(window.location.href);
  const parsed = new URL(url);
  return { appId, url, route: parsed.pathname + parsed.search, pageTitle: document.title,
    locale, capturedAt: new Date().toISOString(), targets: [] };
}
export function workflowKickoff(issue: number, mode: CreativeMode): string {
  return `Use $request-to-delight for basabtan/app-requests#${issue}. Read the issue and amendments and retrieve its attachments. Creative mode: ${mode}. Create a Codex chat in an isolated worktree for the registered app, coordinate its work and send follow-ups, and take this request through interpretation, implementation, and reviewed preview. Preserve the original requirements and update this same request through the owner workflow API. Present the verified result before production release. This authorizes chat creation, coordination, and request updates for this request; production release requires my decision.`;
}
