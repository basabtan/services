import type { Renderer } from './renderer';

/**
 * Focus mode — the fullscreen workspace morph ported from the Zeal lineage
 * map's `map-motion.js`. The stage lifts out of the page into a centered
 * overlay with a scrim, animates its rect with the signature 480/440 ms
 * cubic-bezier(.22,.61,.36,1) curves, makes everything behind it inert, and
 * restores the exact inline position on close. All map interactions keep
 * working because the stage DOM node (and its listeners) moves with it.
 */
export interface FocusMode {
  open(): void;
  close(): void;
  isOpen(): boolean;
  destroy(): void;
}

export interface FocusModeOptions {
  /** The stage element that lifts into the overlay. */
  stage: HTMLElement;
  /** Called when the overlay's Reset view button is pressed. */
  onResetView: () => void;
  /** Called when the overlay's Expand all / Collapse all button is pressed. */
  onToggleAll?: () => void;
  /** Initial label for the expand/collapse toggle, when used. */
  toggleAllLabel?: () => string;
  reducedMotion: boolean;
}

const EASE = 'cubic-bezier(.22,.61,.36,1)';

export function createFocusMode(options: FocusModeOptions): FocusMode {
  const { stage, reducedMotion } = options;

  const overlay = document.createElement('div');
  overlay.className = 'rm-focus-overlay';

  const scrim = document.createElement('div');
  scrim.className = 'rm-focus-scrim';

  const tools = document.createElement('div');
  tools.className = 'rm-focus-tools';

  const closeButton = document.createElement('button');
  closeButton.type = 'button';
  closeButton.className = 'rm-focus-button';
  closeButton.textContent = '× Close';
  closeButton.setAttribute('aria-label', 'Close focused map view');

  const resetButton = document.createElement('button');
  resetButton.type = 'button';
  resetButton.className = 'rm-focus-button';
  resetButton.textContent = 'Reset view';
  resetButton.setAttribute('aria-label', 'Reset map view');

  let toggleAllButton: HTMLButtonElement | null = null;
  if (options.onToggleAll) {
    toggleAllButton = document.createElement('button');
    toggleAllButton.type = 'button';
    toggleAllButton.className = 'rm-focus-button';
    const refresh = (): void => {
      if (toggleAllButton) toggleAllButton.textContent = options.toggleAllLabel?.() ?? 'Expand all';
    };
    toggleAllButton.addEventListener('click', () => {
      options.onToggleAll?.();
      refresh();
    });
    refresh();
    tools.append(toggleAllButton);
  }

  tools.append(resetButton, closeButton);
  overlay.append(scrim, tools);

  let state: 'closed' | 'opening' | 'open' | 'closing' = 'closed';
  let token = 0;
  let animations: Animation[] = [];
  let placeholder: HTMLElement | null = null;
  let parent: HTMLElement | null = null;
  let nextSibling: Node | null = null;
  let returnFocus: HTMLElement | null = null;
  let originalPageScroll: { x: number; y: number } | null = null;

  const snap = (n: number): number => Math.round(n * (window.devicePixelRatio || 1)) / (window.devicePixelRatio || 1);

  const stopAnimations = (): void => {
    for (const animation of animations) {
      try {
        animation.cancel();
      } catch {
        /* already finished */
      }
    }
    animations = [];
  };

  const targetGeometry = (): { left: string; top: string; width: string; height: string } => {
    const touch = window.matchMedia('(pointer: coarse)').matches;
    const margin = touch ? 12 : 24;
    const width = window.innerWidth - margin * 2;
    const height = Math.max(
      160,
      window.innerHeight - margin * 2 - (touch ? 36 : 44),
    );
    return {
      left: `${snap(margin)}px`,
      top: `${snap(margin)}px`,
      width: `${snap(width)}px`,
      height: `${snap(height)}px`,
    };
  };

  const setGeometry = (g: { left: string; top: string; width: string; height: string }): void => {
    stage.style.left = g.left;
    stage.style.top = g.top;
    stage.style.width = g.width;
    stage.style.height = g.height;
  };

  function onKeydown(event: KeyboardEvent): void {
    if (state === 'closed') return;
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  }

  function onResize(): void {
    if (state === 'closed') return;
    if (state === 'opening' || state === 'closing') {
      token += 1;
      stopAnimations();
      if (state === 'opening') {
        state = 'open';
        stage.classList.add('is-focused');
      } else {
        finishClose();
        return;
      }
    }
    setGeometry(targetGeometry());
  }

  function finishClose(): void {
    state = 'closed';
    stage.classList.remove('is-focused');
    for (const key of ['left', 'top', 'width', 'height'] as const) stage.style[key] = '';
    if (placeholder) {
      placeholder.replaceWith(stage);
      placeholder = null;
    }
    overlay.remove();
    document.body.classList.remove('rm-focus-open');
    for (const child of Array.from(document.body.children)) {
      if (child !== overlay && child instanceof HTMLElement) child.inert = false;
    }
    if (originalPageScroll) window.scrollTo(originalPageScroll.x, originalPageScroll.y);
    if (returnFocus?.isConnected) queueMicrotask(() => returnFocus?.focus());
  }

  function open(): void {
    if (state !== 'closed') return;
    state = 'opening';
    const currentToken = ++token;
    returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    originalPageScroll = { x: window.scrollX, y: window.scrollY };

    const before = stage.getBoundingClientRect().toJSON();
    parent = stage.parentElement;
    nextSibling = stage.nextSibling;
    placeholder = document.createElement('div');
    placeholder.className = 'rm-focus-placeholder';
    placeholder.style.height = `${before.height}px`;
    stage.parentNode?.insertBefore(placeholder, stage);

    document.body.append(overlay);
    overlay.append(stage);
    document.body.classList.add('rm-focus-open');
    for (const child of Array.from(document.body.children)) {
      if (child !== overlay && child instanceof HTMLElement) child.inert = true;
    }

    const target = targetGeometry();
    setGeometry(target);

    const finish = (): void => {
      if (currentToken !== token || state !== 'opening') return;
      stopAnimations();
      state = 'open';
      stage.classList.add('is-focused');
      stage.style.transform = 'none';
      stage.style.opacity = '1';
      closeButton.focus({ preventScroll: true });
    };

    if (reducedMotion) {
      scrim.classList.add('on');
      tools.classList.add('on');
      finish();
      return;
    }

    scrim.classList.add('on');
    tools.classList.add('on');
    // Animate from the inline rect to the overlay rect. The stage is already
    // in the overlay (fixed positioning); animate from `before` to `target`.
    const animation = stage.animate(
      [
        { left: `${before.left}px`, top: `${before.top}px`, width: `${before.width}px`, height: `${before.height}px` },
        { left: target.left, top: target.top, width: target.width, height: target.height },
      ],
      {
        duration: 480,
        easing: EASE,
        fill: 'none',
      },
    );
    animations = [animation];
    animation.finished
      .catch(() => null)
      .then(finish);
  }

  function close(): void {
    if (state === 'closed' || state === 'closing') return;
    const currentToken = ++token;
    state = 'closing';
    stopAnimations();
    scrim.classList.remove('on');
    tools.classList.remove('on');

    const finish = (): void => {
      if (currentToken !== token) return;
      finishClose();
    };

    if (reducedMotion || !placeholder) {
      finish();
      return;
    }

    const current = stage.getBoundingClientRect();
    const destination = placeholder.getBoundingClientRect();
    const animation = stage.animate(
      [
        { left: `${current.left}px`, top: `${current.top}px`, width: `${current.width}px`, height: `${current.height}px` },
        { left: `${destination.left}px`, top: `${destination.top}px`, width: `${destination.width}px`, height: `${destination.height}px` },
      ],
      { duration: 440, easing: EASE, fill: 'none' },
    );
    animations = [animation];
    animation.finished
      .catch(() => null)
      .then(finish);
  }

  closeButton.addEventListener('click', close);
  scrim.addEventListener('click', close);
  resetButton.addEventListener('click', () => options.onResetView());
  document.addEventListener('keydown', onKeydown);
  window.addEventListener('resize', onResize);

  return {
    open,
    close,
    isOpen: () => state === 'open' || state === 'opening',
    destroy() {
      token += 1;
      stopAnimations();
      if (state !== 'closed') {
        stage.classList.remove('is-focused');
        if (placeholder) {
          placeholder.replaceWith(stage);
          placeholder = null;
        }
        overlay.remove();
        document.body.classList.remove('rm-focus-open');
        for (const child of Array.from(document.body.children)) {
          if (child !== overlay && child instanceof HTMLElement) child.inert = false;
        }
        state = 'closed';
      }
      document.removeEventListener('keydown', onKeydown);
      window.removeEventListener('resize', onResize);
    },
  };
}

/**
 * Signature inertia glide for viewport transitions inside focus mode: each
 * frame closes 14% of the remaining distance, like the reference map's
 * horizontal glide. Resolves when settled.
 */
export function glideViewport(
  renderer: Renderer,
  target: { scale: number; tx: number; ty: number },
  reducedMotion: boolean,
): void {
  if (reducedMotion) {
    renderer.setViewport(target);
    return;
  }
  let frame = 0;
  const tick = (): void => {
    const current = renderer.getViewport();
    const ds = target.scale - current.scale;
    const dx = target.tx - current.tx;
    const dy = target.ty - current.ty;
    if (Math.abs(ds) < 0.0005 && Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      renderer.setViewport(target);
      return;
    }
    renderer.setViewport({
      scale: current.scale + ds * 0.14,
      tx: current.tx + dx * 0.14,
      ty: current.ty + dy * 0.14,
    });
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
