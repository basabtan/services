/**
 * Attachments travel inside the request record as data URLs so the host can
 * persist them with the same storage it already owns. Records live in
 * localStorage for most hosts, so a per-file cap keeps a single screenshot
 * from filling the quota.
 */
export interface Attachment {
  id: string;
  name: string;
  type: string;
  size: number;
  /** data: URL. Empty when the file was too large to embed. */
  dataUrl: string;
  addedAt: string;
}

export const ATTACHMENT_MAX_BYTES = 2 * 1024 * 1024;
export const ATTACHMENT_MAX_COUNT = 12;

export function isAttachment(value: unknown): value is Attachment {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return typeof row.id === 'string' && typeof row.name === 'string' && typeof row.type === 'string'
    && typeof row.size === 'number' && typeof row.dataUrl === 'string' && typeof row.addedAt === 'string';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageAttachment(attachment: Pick<Attachment, 'type'>): boolean {
  return attachment.type.startsWith('image/');
}

export interface AttachResult {
  accepted: Attachment[];
  rejected: { name: string; reason: string }[];
}

/** arrayBuffer + btoa rather than FileReader, so the same code runs in the browser and in Node tests. */
async function readAsDataUrl(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return `data:${file.type || 'application/octet-stream'};base64,${btoa(binary)}`;
}

/**
 * Turn dropped or picked files into attachments. Oversized files and files past
 * the count cap are reported back rather than silently dropped.
 */
export async function filesToAttachments(
  files: Iterable<File>,
  existingCount = 0,
  options: { maxBytes?: number; maxCount?: number; now?: () => string; id?: () => string } = {},
): Promise<AttachResult> {
  const maxBytes = options.maxBytes ?? ATTACHMENT_MAX_BYTES;
  const maxCount = options.maxCount ?? ATTACHMENT_MAX_COUNT;
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => crypto.randomUUID());
  const accepted: Attachment[] = [];
  const rejected: AttachResult['rejected'] = [];
  let count = existingCount;
  for (const file of files) {
    if (count >= maxCount) { rejected.push({ name: file.name, reason: `Limit of ${maxCount} attachments reached` }); continue; }
    if (file.size > maxBytes) { rejected.push({ name: file.name, reason: `Larger than ${formatBytes(maxBytes)}` }); continue; }
    try {
      const dataUrl = await readAsDataUrl(file);
      accepted.push({ id: id(), name: file.name || 'attachment', type: file.type || 'application/octet-stream', size: file.size, dataUrl, addedAt: now() });
      count += 1;
    } catch (error) {
      rejected.push({ name: file.name, reason: error instanceof Error ? error.message : 'Could not read file' });
    }
  }
  return { accepted, rejected };
}

/** Files from a drop or paste event. Directories and non-file drags yield nothing. */
export function filesFromDataTransfer(transfer: DataTransfer | null | undefined): File[] {
  if (!transfer) return [];
  const out: File[] = [];
  if (transfer.items?.length) {
    for (const item of Array.from(transfer.items)) {
      if (item.kind !== 'file') continue;
      const file = item.getAsFile();
      if (file) out.push(file);
    }
    if (out.length) return out;
  }
  return Array.from(transfer.files ?? []);
}

export function hasFiles(transfer: DataTransfer | null | undefined): boolean {
  if (!transfer) return false;
  return Array.from(transfer.types ?? []).includes('Files');
}

export function describeRejections(rejected: AttachResult['rejected']): string {
  if (!rejected.length) return '';
  return rejected.map(r => `${r.name}: ${r.reason}`).join('. ');
}
