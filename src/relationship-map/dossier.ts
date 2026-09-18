import type { MapNode } from './types';

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
 */
export function createDossier(container: HTMLElement, callbacks: DossierCallbacks): Dossier {
  let panel: HTMLElement | null = null;
  let lastReturn: HTMLElement | null = null;

  function onKeydown(event: KeyboardEvent): void {
    if (!panel) return;
    if (event.key === 'Escape') {
      event.stopPropagation();
      close(lastReturn);
      callbacks.onClosed();
      return;
    }
    if (event.key === 'Tab') {
      const focusables = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)];
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
  }

  function close(returnTo?: HTMLElement | null): void {
    if (!panel) return;
    panel.remove();
    panel = null;
    document.removeEventListener('keydown', onKeydown, true);
    if (returnTo instanceof HTMLElement) returnTo.focus();
  }

  return {
    open(node, anchorRect) {
      close();
      lastReturn = (document.activeElement as HTMLElement) ?? null;

      panel = el('div', 'rm-dossier');
      panel.setAttribute('role', 'dialog');
      panel.setAttribute('aria-modal', 'false');
      panel.setAttribute('aria-label', node.detail?.title ?? node.label);

      const header = el('div', 'rm-dossier-header');
      if (node.detail?.eyebrow) header.appendChild(el('p', 'rm-dossier-eyebrow', node.detail.eyebrow));
      header.appendChild(el('h3', 'rm-dossier-title', node.detail?.title ?? node.label));
      const closeButton = el('button', 'rm-dossier-close', 'Close');
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', `Close details for ${node.detail?.title ?? node.label}`);
      closeButton.addEventListener('click', () => {
        close(lastReturn);
        callbacks.onClosed();
      });
      header.appendChild(closeButton);
      panel.appendChild(header);

      if (node.secondaryLabel) panel.appendChild(el('p', 'rm-dossier-subtitle', node.secondaryLabel));
      if (node.detail?.body) panel.appendChild(el('p', 'rm-dossier-body', node.detail.body));

      if (node.detail?.meta && node.detail.meta.length > 0) {
        const list = el('dl', 'rm-dossier-meta');
        for (const row of node.detail.meta) {
          list.appendChild(el('dt', 'rm-dossier-meta-key', row.label));
          list.appendChild(el('dd', 'rm-dossier-meta-value', row.value));
        }
        panel.appendChild(list);
      }

      container.appendChild(panel);

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
      panel.style.top = `${top}px`;

      document.addEventListener('keydown', onKeydown, true);
      const focusTarget = panel.querySelector<HTMLElement>(FOCUSABLE);
      if (focusTarget) focusTarget.focus();
    },
    close(returnTo) {
      close(returnTo ?? lastReturn);
    },
    isOpen: () => panel !== null,
    destroy() {
      close();
    },
  };
}
