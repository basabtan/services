import type { MapNode } from './types';

export type DossierMode = 'anchored' | 'origin';

export interface DossierCallbacks {
  /** Called after the dossier finishes closing. */
  onClosed(): void;
}

export interface Dossier {
  /** Open (or replace) the card for a node, anchored near its screen position. */
  open(node: MapNode, anchorRect: DOMRect): void;
  /** Close the card and restore focus to `returnTo` when provided. */
  close(returnTo?: HTMLElement | null): void;
  isOpen(): boolean;
  destroy(): void;
}

function el<T extends keyof HTMLElementTagNameMap>(tag: T, className: string, text?: string): HTMLElementTagNameMap[T] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

const FOCUSABLE = 'button, [href], [tabindex]:not([tabindex="-1"])';

/**
 * Detail card for the selected node. Renders only what the data provides:
 * eyebrow, title, body, and meta rows. Traps focus while open and returns
 * focus to the triggering element on close.
 *
 * `mode: 'origin'` adds the signature DNA: the card grows out of the clicked
 * node with a clip-path reveal and child stagger (480 ms
 * cubic-bezier(.22,.74,.18,1)), and shrinks back to the node on close
 * (400 ms cubic-bezier(.4,0,.2,1)) — with a cancel-safe opening/open/closing
 * state machine, scrim, and resize handling, ported from the reference map's
 * `installDossier`.
 */
export function createDossier(
  container: HTMLElement,
  callbacks: DossierCallbacks,
  options: { mode?: DossierMode; reducedMotion?: boolean } = {},
): Dossier {
  const mode = options.mode ?? 'origin';
  const reducedMotion = options.reducedMotion ?? false;

  let panel: HTMLElement | null = null;
  let lastReturn: HTMLElement | null = null;
  let originRect: DOMRect | null = null;

  // Origin-mode state machine.
  let state: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  let token = 0;
  let animations: Animation[] = [];

  const scrim = document.createElement('div');
  scrim.className = 'rm-dossier-scrim';

  const cardSnap = (n: number): number =>
    Math.round(n * (window.devicePixelRatio || 1)) / (window.devicePixelRatio || 1);

  function stopAnimations(): void {
    for (const animation of animations) {
      try {
        animation.cancel();
      } catch {
        /* already finished */
      }
    }
    animations = [];
  }

  function targetRect(): { left: number; top: number; width: number; height: number } {
    const narrow = window.innerWidth <= 640;
    const margin = narrow ? 12 : 16;
    const width = Math.min(760, window.innerWidth - margin * 2);
    const height = Math.min(narrow ? 760 : 840, window.innerHeight * (narrow ? 0.86 : 0.84), window.innerHeight - margin * 2);
    return {
      left: cardSnap((window.innerWidth - width) / 2),
      top: cardSnap((window.innerHeight - height) / 2),
      width: cardSnap(width),
      height: cardSnap(height),
    };
  }

  /** The node's on-screen rect, clamped to a 18–34 px square, if visible. */
  function visibleOriginRect(origin: DOMRect | null): { left: number; top: number; width: number; height: number } | null {
    if (!origin) return null;
    if (!origin.width || !origin.height || origin.right < 0 || origin.left > window.innerWidth || origin.bottom < 0 || origin.top > window.innerHeight) {
      return null;
    }
    const size = Math.max(18, Math.min(34, Math.max(origin.width, origin.height)));
    return {
      left: cardSnap(origin.left + origin.width / 2 - size / 2),
      top: cardSnap(origin.top + origin.height / 2 - size / 2),
      width: cardSnap(size),
      height: cardSnap(size),
    };
  }

  function setRect(r: { left: number; top: number; width: number; height: number }): void {
    panel!.style.left = `${r.left}px`;
    panel!.style.top = `${r.top}px`;
    panel!.style.width = `${r.width}px`;
    panel!.style.height = `${r.height}px`;
  }

  function clearStyles(): void {
    if (!panel) return;
    for (const key of ['left', 'top', 'width', 'height', 'clipPath', 'transform', 'opacity'] as const) {
      panel.style[key] = '';
    }
    for (const child of Array.from(panel.children)) {
      (child as HTMLElement).style.opacity = '';
      (child as HTMLElement).style.transform = '';
    }
  }

  function finishOpen(currentToken: number): void {
    if (currentToken !== token || state !== 'opening') return;
    stopAnimations();
    state = 'open';
    panel?.classList.remove('is-animating');
    if (panel) {
      panel.style.clipPath = 'none';
      panel.style.transform = 'none';
      panel.style.opacity = '1';
    }
    panel?.querySelector<HTMLElement>('.rm-dossier-close')?.focus({ preventScroll: true });
  }

  function finishClose(currentToken: number): void {
    if (currentToken !== token) return;
    stopAnimations();
    state = 'closed';
    panel?.remove();
    panel = null;
    scrim.classList.remove('on');
    document.body.classList.remove('rm-dossier-open');
    const restore = lastReturn;
    lastReturn = null;
    originRect = null;
    if (restore?.isConnected) queueMicrotask(() => restore?.focus({ preventScroll: true }));
    callbacks.onClosed();
  }

  function close(returnTo?: HTMLElement | null): void {
    if (returnTo) lastReturn = returnTo;
    if (!panel || state === 'closed' || state === 'closing') return;
    const currentToken = ++token;
    state = 'closing';
    stopAnimations();
    scrim.classList.remove('on');

    if (mode !== 'origin' || reducedMotion) {
      finishClose(currentToken);
      return;
    }

    const start = panel.getBoundingClientRect();
    const destination = visibleOriginRect(originRect);
    const end = destination ?? { left: start.left, top: start.top, width: start.width, height: start.height };
    panel.classList.add('is-animating');
    const main = panel.animate(
      [
        { left: `${start.left}px`, top: `${start.top}px`, width: `${start.width}px`, height: `${start.height}px`, opacity: 1, clipPath: 'inset(0 0 0 0 round 0)' },
        {
          left: `${end.left}px`,
          top: `${end.top}px`,
          width: `${end.width}px`,
          height: `${end.height}px`,
          opacity: destination ? 0.18 : 0,
          clipPath: destination ? 'inset(0 0 88% 0 round 0)' : 'inset(4% 4% 4% 4% round 0)',
        },
      ],
      { duration: 400, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' },
    );
    const childAnimations = Array.from(panel.children).map((child) =>
      (child as HTMLElement).animate([{ opacity: 1 }, { opacity: 0 }], { duration: 180, easing: 'ease', fill: 'both' }),
    );
    animations = [main, ...childAnimations];
    Promise.all(animations.map((a) => a.finished.catch(() => null))).then(() => finishClose(currentToken));
  }

  function open(node: MapNode, anchorRect: DOMRect): void {
    if (state === 'open' || state === 'opening') {
      // Replace content in place — the reference re-renders without
      // re-running the open animation.
      if (panel) {
        renderContent(node);
        originRect = anchorRect || originRect;
        return;
      }
    }
    if (state === 'closing') {
      token += 1;
      stopAnimations();
      panel?.classList.remove('is-animating');
      finishCloseCleanup();
    }

    lastReturn = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    originRect = anchorRect;
    panel = buildPanel(node);
    renderContentInto(panel, node);

    if (mode !== 'origin') {
      container.appendChild(panel);
      positionAnchored(anchorRect);
      const focusTarget = panel.querySelector<HTMLElement>(FOCUSABLE);
      if (focusTarget) focusTarget.focus();
      state = 'open';
      document.addEventListener('keydown', onKeydown, true);
      return;
    }

    document.body.append(scrim, panel);
    document.body.classList.add('rm-dossier-open');
    state = 'opening';
    const currentToken = ++token;
    const target = targetRect();
    const origin = visibleOriginRect(anchorRect) ?? {
      left: cardSnap(target.left + target.width / 2 - 18),
      top: cardSnap(target.top + target.height / 2 - 18),
      width: 36,
      height: 36,
    };
    setRect(target);
    panel.classList.add('on', 'is-animating');
    scrim.classList.add('on');
    document.addEventListener('keydown', onKeydown, true);

    if (reducedMotion) {
      scrim.classList.add('rm-instant');
      finishOpen(currentToken);
      return;
    }

    const main = panel.animate(
      [
        { left: `${origin.left}px`, top: `${origin.top}px`, width: `${origin.width}px`, height: `${origin.height}px`, opacity: 0.18, clipPath: 'inset(0 0 88% 0 round 0)' },
        { left: `${target.left}px`, top: `${target.top}px`, width: `${target.width}px`, height: `${target.height}px`, opacity: 1, clipPath: 'inset(0 0 0 0 round 0)' },
      ],
      { duration: 480, easing: 'cubic-bezier(.22,.74,.18,1)', fill: 'both' },
    );
    const childAnimations = Array.from(panel.children).map((child) =>
      (child as HTMLElement).animate(
        [
          { opacity: 0, transform: 'translateY(-8px)', offset: 0 },
          { opacity: 0, transform: 'translateY(-8px)', offset: 0.42 },
          { opacity: 1, transform: 'translateY(0)', offset: 1 },
        ],
        { duration: 480, easing: 'cubic-bezier(.22,.74,.18,1)', fill: 'both' },
      ),
    );
    animations = [main, ...childAnimations];
    Promise.all(animations.map((a) => a.finished.catch(() => null))).then(() => finishOpen(currentToken));
  }

  function finishCloseCleanup(): void {
    panel?.remove();
    panel = null;
    scrim.classList.remove('on');
    document.body.classList.remove('rm-dossier-open');
    state = 'closed';
  }

  function buildPanel(node: MapNode): HTMLElement {
    const element = el('div', `rm-dossier${mode === 'origin' ? ' rm-dossier--origin' : ''}`);
    element.setAttribute('role', 'dialog');
    element.setAttribute('aria-modal', mode === 'origin' ? 'true' : 'false');
    element.setAttribute('aria-label', node.detail?.title ?? node.label);
    return element;
  }

  function renderContent(node: MapNode): void {
    if (!panel) return;
    const returnTo = lastReturn;
    const next = buildPanel(node);
    renderContentInto(next, node);
    panel.replaceWith(next);
    panel = next;
    lastReturn = returnTo;
    if (state === 'open') {
      panel.classList.add('on');
      if (mode === 'origin') setRect(targetRect());
    }
  }

  function renderContentInto(element: HTMLElement, node: MapNode): void {
    const header = el('div', 'rm-dossier-header');
    if (node.detail?.eyebrow) header.appendChild(el('p', 'rm-dossier-eyebrow', node.detail.eyebrow));
    header.appendChild(el('h3', 'rm-dossier-title', node.detail?.title ?? node.label));
    const closeButton = el('button', 'rm-dossier-close', 'Close');
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', `Close details for ${node.detail?.title ?? node.label}`);
    closeButton.addEventListener('click', () => close(lastReturn));
    header.appendChild(closeButton);
    element.appendChild(header);

    if (node.secondaryLabel) element.appendChild(el('p', 'rm-dossier-subtitle', node.secondaryLabel));
    if (node.detail?.body) element.appendChild(el('p', 'rm-dossier-body', node.detail.body));

    if (node.detail?.meta && node.detail.meta.length > 0) {
      const list = el('dl', 'rm-dossier-meta');
      for (const row of node.detail.meta) {
        list.appendChild(el('dt', 'rm-dossier-meta-key', row.label));
        list.appendChild(el('dd', 'rm-dossier-meta-value', row.value));
      }
      element.appendChild(list);
    }
  }

  function positionAnchored(anchorRect: DOMRect): void {
    if (!panel) return;
    const hostRect = container.getBoundingClientRect();
    const margin = 12;
    const preferRight = anchorRect.right + margin + panel.offsetWidth < hostRect.right;
    const left = preferRight
      ? Math.min(anchorRect.right + margin, hostRect.right - panel.offsetWidth - margin)
      : Math.max(margin, anchorRect.left - panel.offsetWidth - margin);
    const top = Math.min(
      Math.max(margin, anchorRect.top - hostRect.top),
      Math.max(margin, hostRect.height - panel.offsetHeight - margin),
    );
    panel.style.left = `${left - hostRect.left}px`;
    panel.style.top = `${top - hostRect.top}px`;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (!panel) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      close(lastReturn);
      return;
    }
    if (event.key !== 'Tab') return;
    const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
      (candidate) => candidate.getClientRects().length > 0,
    );
    if (focusables.length === 0) {
      event.preventDefault();
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (event.shiftKey && (active === first || !panel.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onResize(): void {
    if (!panel) return;
    if (state === 'open') {
      if (mode === 'origin') {
        setRect(targetRect());
        panel.style.transform = 'none';
      } else {
        if (originRect) positionAnchored(originRect);
      }
      return;
    }
    if (state === 'opening') {
      token += 1;
      stopAnimations();
      state = 'open';
      panel.classList.remove('is-animating');
      if (mode === 'origin') {
        setRect(targetRect());
        panel.style.clipPath = 'none';
        panel.style.transform = 'none';
        panel.style.opacity = '1';
      }
      panel.querySelector<HTMLElement>('.rm-dossier-close')?.focus({ preventScroll: true });
      return;
    }
    if (state === 'closing') {
      token += 1;
      finishClose(token);
    }
  }

  scrim.addEventListener('click', () => close(lastReturn));
  window.addEventListener('resize', onResize);

  return {
    open,
    close(returnTo) {
      close(returnTo ?? lastReturn);
    },
    isOpen: () => panel !== null,
    destroy() {
      token += 1;
      stopAnimations();
      document.removeEventListener('keydown', onKeydown, true);
      window.removeEventListener('resize', onResize);
      panel?.remove();
      scrim.remove();
      panel = null;
      state = 'closed';
      document.body.classList.remove('rm-dossier-open');
    },
  };
}
