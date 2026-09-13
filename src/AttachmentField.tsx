import { useRef } from 'react';
import { ATTACHMENT_MAX_COUNT, formatBytes, isImageAttachment, type Attachment } from './attachments';

export interface AttachmentFieldProps {
  attachments: Attachment[];
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
  /** Prefix for class names: `repair` or `cr`. */
  prefix: 'repair' | 'cr';
  label?: string;
  hint?: string;
  disabled?: boolean;
}

/** Attachment list with an Add button. Dropping files anywhere on the window is handled by the panel. */
export function AttachmentField({ attachments, onAdd, onRemove, prefix, label = 'Attachments', hint, disabled = false }: AttachmentFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const full = attachments.length >= ATTACHMENT_MAX_COUNT;
  return (
    <div className="rr-attachments" data-testid="attachments">
      <div className="rr-attachments-head">
        <span className="rr-attachments-label">{label}{attachments.length ? ` (${attachments.length})` : ''}</span>
        <button className={`${prefix}-btn ${prefix}-btn-ghost`} type="button" disabled={disabled || full} onClick={() => inputRef.current?.click()} data-testid="button-add-attachment">
          + Attach file
        </button>
        <input ref={inputRef} type="file" multiple hidden aria-label="Choose files to attach" data-testid="input-attachment"
          onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; if (files.length) onAdd(files); }} />
      </div>
      {attachments.length === 0
        ? <p className="rr-attachments-hint">{hint ?? 'Drop files anywhere on this window, or attach them here.'}</p>
        : (
          <ul className="rr-attachment-list">
            {attachments.map(attachment => (
              <li key={attachment.id} className="rr-attachment" data-testid="attachment">
                {isImageAttachment(attachment) && attachment.dataUrl
                  ? <img className="rr-attachment-thumb" src={attachment.dataUrl} alt="" />
                  : <span className="rr-attachment-thumb rr-attachment-file" aria-hidden="true">{extension(attachment.name)}</span>}
                <span className="rr-attachment-meta">
                  {attachment.dataUrl
                    ? <a href={attachment.dataUrl} download={attachment.name} target="_blank" rel="noreferrer">{attachment.name}</a>
                    : <strong>{attachment.name}</strong>}
                  <small>{formatBytes(attachment.size)}{attachment.type ? ` · ${attachment.type}` : ''}</small>
                </span>
                <button type="button" className="rr-attachment-remove" aria-label={`Remove ${attachment.name}`} disabled={disabled} onClick={() => onRemove(attachment.id)}>×</button>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

function extension(name: string) {
  const match = /\.([A-Za-z0-9]{1,5})$/.exec(name);
  return (match?.[1] ?? 'file').toUpperCase().slice(0, 4);
}
