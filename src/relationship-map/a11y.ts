import { nearestNodeInDirection, nodeCenters } from './model';
import type { RelationshipMapData } from './types';
import type { Renderer } from './renderer';

export interface A11yHandlers {
  onNodeActivate(nodeId: string): void;
  /** Escape pressed: close dossier first, then clear selection. */
  onEscape(): void;
}

export interface A11yOptions {
  enableKeyboard: boolean;
}

const DIRECTIONS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/**
 * Keyboard support: arrow keys move focus to the spatially nearest node in
 * the chosen direction, Enter/Space activate, Escape defers to the host.
 */
export function attachKeyboard(
  renderer: Renderer,
  host: HTMLElement,
  data: RelationshipMapData,
  options: A11yOptions,
  handlers: A11yHandlers,
): { destroy(): void } {
  if (!options.enableKeyboard) return { destroy: () => undefined };
  const centers = nodeCenters(data);

  function focusNode(nodeId: string): void {
    const element = renderer.getNodeElement(nodeId);
    element?.focus();
  }

  function onKeydown(event: KeyboardEvent): void {
    const target = event.target as Element | null;
    const onNode = target?.closest?.('.rm-node') != null;

    if (event.key === 'Escape') {
      handlers.onEscape();
      return;
    }
    if (!onNode) return;

    const nodeId = (target as Element).getAttribute('data-node-id') as string;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlers.onNodeActivate(nodeId);
      return;
    }
    const direction = DIRECTIONS[event.key];
    if (direction) {
      event.preventDefault();
      const next = nearestNodeInDirection(centers, nodeId, direction[0], direction[1]);
      if (next) focusNode(next);
    }
  }

  host.addEventListener('keydown', onKeydown);
  return {
    destroy() {
      host.removeEventListener('keydown', onKeydown);
    },
  };
}

/** Detect the user's reduced-motion preference. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}
