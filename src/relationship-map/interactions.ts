import type { Renderer } from './renderer';

export interface InteractionOptions {
  enablePan: boolean;
  enableZoom: boolean;
}

export interface InteractionHandlers {
  /** A node was tapped or clicked without a drag. */
  onNodeActivate(nodeId: string): void;
  /** The map background was tapped or clicked without a drag. */
  onBackgroundActivate(): void;
}

const DRAG_THRESHOLD_PX = 6;

interface PointerRecord {
  x: number;
  y: number;
}

/**
 * Pointer, wheel, and touch handling for the map. Distinguishes taps from
 * drags, supports mouse drag-to-pan, wheel zoom toward the pointer, and
 * two-finger pinch zoom without hijacking page scrolling elsewhere.
 */
export function attachInteractions(
  renderer: Renderer,
  host: HTMLElement,
  options: InteractionOptions,
  handlers: InteractionHandlers,
): { destroy(): void } {
  const { svg } = renderer;
  const pointers = new Map<number, PointerRecord>();
  let dragDistance = 0;
  let dragging = false;
  let pinchStart: { distance: number; scale: number } | null = null;
  let destroyed = false;

  if (options.enablePan) svg.style.touchAction = 'none';

  function nodeIdFromEvent(event: Event): string | null {
    const target = event.target as Element | null;
    const node = target?.closest?.('.rm-node') as SVGGElement | null;
    return node?.getAttribute('data-node-id') ?? null;
  }

  function pointerPoint(event: PointerEvent): PointerRecord {
    const rect = svg.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function zoomAt(factor: number, x: number, y: number): void {
    const viewport = renderer.getViewport();
    const scale = Math.max(0.1, viewport.scale * factor);
    const clamped = Math.max(0.1, Math.min(10, scale));
    renderer.setViewport({
      scale: clamped,
      tx: x - ((x - viewport.tx) * clamped) / viewport.scale,
      ty: y - ((y - viewport.ty) * clamped) / viewport.scale,
    });
  }

  function onPointerDown(event: PointerEvent): void {
    if (destroyed) return;
    pointers.set(event.pointerId, pointerPoint(event));
    dragDistance = 0;
    dragging = false;
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchStart = { distance: Math.hypot(a.x - b.x, a.y - b.y), scale: renderer.getViewport().scale };
    }
  }

  function onPointerMove(event: PointerEvent): void {
    if (destroyed || !pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId) as PointerRecord;
    const next = pointerPoint(event);
    pointers.set(event.pointerId, next);

    if (pointers.size === 2 && pinchStart) {
      const [a, b] = [...pointers.values()];
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const scale = (pinchStart.scale * distance) / (pinchStart.distance || 1);
      const rect = svg.getBoundingClientRect();
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const viewport = renderer.getViewport();
      renderer.setViewport({
        scale,
        tx: cx - ((cx - viewport.tx) * scale) / viewport.scale,
        ty: cy - ((cy - viewport.ty) * scale) / viewport.scale,
      });
      dragging = true;
      return;
    }

    const dx = next.x - previous.x;
    const dy = next.y - previous.y;
    dragDistance += Math.hypot(dx, dy);
    if (!dragging && dragDistance > DRAG_THRESHOLD_PX) {
      if (!options.enablePan) return;
      dragging = true;
      svg.classList.add('is-panning');
    }
    if (dragging) {
      const viewport = renderer.getViewport();
      renderer.setViewport({ ...viewport, tx: viewport.tx + dx, ty: viewport.ty + dy });
    }
  }

  function onPointerUp(event: PointerEvent): void {
    if (destroyed) return;
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinchStart = null;
    svg.classList.remove('is-panning');
    if (dragging) {
      dragging = false;
      return;
    }
    const nodeId = nodeIdFromEvent(event);
    if (nodeId) handlers.onNodeActivate(nodeId);
    else if (event.target === svg || (event.target as Element).classList?.contains('rm-viewport')) {
      handlers.onBackgroundActivate();
    }
  }

  function onWheel(event: WheelEvent): void {
    if (destroyed || !options.enableZoom) return;
    event.preventDefault();
    const rect = svg.getBoundingClientRect();
    const factor = Math.pow(1.0015, -event.deltaY);
    zoomAt(factor, event.clientX - rect.left, event.clientY - rect.top);
  }

  svg.addEventListener('pointerdown', onPointerDown);
  svg.addEventListener('pointermove', onPointerMove);
  svg.addEventListener('pointerup', onPointerUp);
  svg.addEventListener('pointercancel', onPointerUp);
  svg.addEventListener('wheel', onWheel, { passive: false });

  return {
    destroy() {
      destroyed = true;
      svg.removeEventListener('pointerdown', onPointerDown);
      svg.removeEventListener('pointermove', onPointerMove);
      svg.removeEventListener('pointerup', onPointerUp);
      svg.removeEventListener('pointercancel', onPointerUp);
      svg.removeEventListener('wheel', onWheel);
    },
  };
}
