import { useCallback, useEffect, useRef, useState, type CSSProperties, type DragEvent as ReactDragEvent, type PointerEvent as ReactPointerEvent } from 'react';
import { filesFromDataTransfer, hasFiles } from './attachments';

/**
 * Floating-window position. `null` means "centred by CSS"; a value means the
 * user has dragged it and the window sits at explicit viewport coordinates.
 */
export type WindowPosition = { left: number; top: number } | null;

const MARGIN = 8;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

/** Drag a floating window by its header. Buttons, inputs and links inside the header stay clickable. */
export function useWindowDrag(disabled = false) {
  const [position, setPosition] = useState<WindowPosition>(null);
  const windowRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; dx: number; dy: number; w: number; h: number; scale: number } | null>(null);

  const onPointerDown = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    if (disabled || event.button !== 0) return;
    if ((event.target as Element).closest('button, a, input, textarea, select, [data-no-drag]')) return;
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    // Hosts that zoom the document (CSS `zoom` on <html>) report pointer and rect
    // coordinates in screen pixels while `left`/`top` are laid out in CSS pixels.
    // The ratio between the two box measurements gives the factor.
    const scale = el.offsetWidth ? rect.width / el.offsetWidth : 1;
    drag.current = { pointerId: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top, w: rect.width, h: rect.height, scale };
    event.currentTarget.setPointerCapture(event.pointerId);
    el.classList.add('is-dragging');
    event.preventDefault();
  }, [disabled]);

  const onPointerMove = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    const left = clamp(event.clientX - d.dx, MARGIN - d.w + 80, window.innerWidth - 80) / d.scale;
    const top = clamp(event.clientY - d.dy, MARGIN, window.innerHeight - 48) / d.scale;
    setPosition({ left, top });
  }, []);

  const end = useCallback((event: ReactPointerEvent<HTMLElement>) => {
    const d = drag.current;
    if (!d || d.pointerId !== event.pointerId) return;
    drag.current = null;
    try { event.currentTarget.releasePointerCapture(event.pointerId); } catch { /* already released */ }
    windowRef.current?.classList.remove('is-dragging');
  }, []);

  useEffect(() => {
    if (!position) return;
    const keepOnScreen = () => {
      const el = windowRef.current;
      const scale = el && el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1;
      setPosition(current => current && {
        left: clamp(current.left, MARGIN - 400, window.innerWidth / scale - 80),
        top: clamp(current.top, MARGIN, window.innerHeight / scale - 48),
      });
    };
    window.addEventListener('resize', keepOnScreen);
    return () => window.removeEventListener('resize', keepOnScreen);
  }, [position]);

  /** Slide the window by a CSS-pixel offset with the `is-sliding` transition, e.g. to make room for a side drawer. */
  const nudge = useCallback((dx: number, dy: number) => {
    const el = windowRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const scale = el.offsetWidth ? rect.width / el.offsetWidth : 1;
    el.classList.add('is-sliding');
    window.setTimeout(() => el.classList.remove('is-sliding'), 420);
    setPosition({ left: rect.left / scale + dx, top: rect.top / scale + dy });
  }, []);

  /** Current box in CSS pixels plus the screen-to-CSS factor, for room calculations. */
  const measure = useCallback(() => {
    const el = windowRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const scale = el.offsetWidth ? rect.width / el.offsetWidth : 1;
    const viewportWidth = (document.documentElement.clientWidth || window.innerWidth) / scale;
    return { left: rect.left / scale, top: rect.top / scale, right: rect.right / scale, width: rect.width / scale, scale, viewportWidth };
  }, []);

  // Centred by `inset` + `margin: auto` until dragged; then pinned by explicit left/top.
  const style: CSSProperties | undefined = position ? { left: position.left, top: position.top, right: 'auto', bottom: 'auto', margin: 0 } : undefined;
  const handleProps = { onPointerDown, onPointerMove, onPointerUp: end, onPointerCancel: end };
  return { windowRef, style, handleProps, reset: () => setPosition(null), moved: position !== null, nudge, measure };
}

/**
 * Whole-window drop zone. Counts enter/leave so nested children do not flicker
 * the overlay, and only lights up for file drags.
 */
export function useFileDrop(onFiles: (files: File[]) => void, disabled = false) {
  const [active, setActive] = useState(false);
  const depth = useRef(0);
  const reset = () => { depth.current = 0; setActive(false); };
  const onDragEnter = (event: ReactDragEvent) => {
    if (disabled || !hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    depth.current += 1;
    setActive(true);
  };
  const onDragOver = (event: ReactDragEvent) => {
    if (disabled || !hasFiles(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  };
  const onDragLeave = (event: ReactDragEvent) => {
    if (disabled || !hasFiles(event.dataTransfer)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setActive(false);
  };
  const onDrop = (event: ReactDragEvent) => {
    if (disabled) return;
    event.preventDefault();
    reset();
    const files = filesFromDataTransfer(event.dataTransfer);
    if (files.length) onFiles(files);
  };
  useEffect(() => {
    const end = () => reset();
    window.addEventListener('dragend', end);
    window.addEventListener('drop', end);
    return () => { window.removeEventListener('dragend', end); window.removeEventListener('drop', end); };
  }, []);
  return { active, dropProps: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}

export function DropOverlay({ active, label = 'Drop files to attach', className = '' }: { active: boolean; label?: string; className?: string }) {
  return (
    <div className={`rr-drop-overlay${active ? ' is-active' : ''} ${className}`.trim()} aria-hidden={!active} data-testid="drop-overlay">
      <div className="rr-drop-overlay-card">
        <span className="rr-drop-overlay-icon" aria-hidden="true">⤓</span>
        <strong>{label}</strong>
        <small>Images, PDFs, text — anything up to 2 MB each</small>
      </div>
    </div>
  );
}
