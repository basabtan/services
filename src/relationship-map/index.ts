import { attachKeyboard, prefersReducedMotion } from './a11y';
import { computeBranches, staggerDelays, visibleNodes } from './branch';
import type { Branches } from './branch';
import { createDossier } from './dossier';
import { createFocusMode, glideViewport } from './focus';
import { attachInteractions } from './interactions';
import { buildGraph, highlightFor, validateRelationshipMapData } from './model';
import type { Graph } from './model';
import { createRenderer } from './renderer';
import { searchNodes } from './search';
import type {
  BranchSummary,
  MapThemeName,
  RelationshipMapApi,
  RelationshipMapConfig,
  RelationshipMapData,
  SearchMatch,
} from './types';

export type {
  DossierMode,
  HighlightMode,
  MapCanvas,
  MapEdge,
  MapGroup,
  MapNode,
  MapThemeName,
  NodeDetail,
  NodeShape,
  NodeSize,
  RelationshipMapApi,
  RelationshipMapData,
  RelationshipMapOptions,
  SearchMatch,
} from './types';
export { computeBranches, staggerDelays, visibleNodes } from './branch';
export type { Branches } from './branch';

export {
  buildGraph,
  connected,
  downstream,
  highlightFor,
  neighbors,
  nearestNodeInDirection,
  nodeCenters,
  upstream,
  validateRelationshipMapData,
} from './model';
export { buildSearchIndex, searchIndex, searchNodes } from './search';

function resolveContainer(candidate: string | HTMLElement): HTMLElement {
  if (typeof candidate !== 'string') {
    if (!(candidate instanceof HTMLElement)) throw new Error('container must be a selector or HTMLElement');
    return candidate;
  }
  const found = document.querySelector<HTMLElement>(candidate);
  if (!found) throw new Error(`container "${candidate}" not found`);
  return found;
}

function el<T extends keyof HTMLElementTagNameMap>(tag: T, className: string, text?: string): HTMLElementTagNameMap[T] {
  const element = document.createElement(tag);
  element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

/**
 * Mount a data-driven, framework-agnostic SVG relationship map.
 *
 * ```ts
 * const map = createRelationshipMap({
 *   container: '#map-root',
 *   data: groundwaterData,
 *   theme: 'dark',
 *   options: { edgeHighlightMode: 'connected' },
 * });
 * ```
 */
export function createRelationshipMap(config: RelationshipMapConfig): RelationshipMapApi {
  const { data, theme = 'dark' } = config;
  const options = {
    enableSearch: true,
    enableDossier: true,
    enablePan: true,
    enableZoom: true,
    enableKeyboard: true,
    respectReducedMotion: true,
    edgeHighlightMode: 'direct' as const,
    dossierMode: 'origin' as const,
    enableFocus: false,
    enableBranches: false,
    initiallyExpanded: true,
    branchStaggerMs: 38,
    ...(config.options ?? {}),
  };

  const validation = validateRelationshipMapData(data as RelationshipMapData);
  if (!validation.valid) {
    throw new Error(`Invalid relationship-map data: ${validation.errors.join('; ')}`);
  }

  const host = resolveContainer(config.container);
  host.classList.add('rm-host', `rm-theme-${theme}`);

  const root = el('div', 'rm-root');
  const reducedMotion = options.respectReducedMotion && prefersReducedMotion();

  let toolbar: HTMLElement | null = null;
  let searchInput: HTMLInputElement | null = null;
  let resultsList: HTMLUListElement | null = null;
  if (options.enableSearch) {
    toolbar = el('div', 'rm-toolbar');
    const searchWrap = el('div', 'rm-search');
    const input = el('input', 'rm-search-input');
    input.type = 'search';
    input.setAttribute('aria-label', 'Search map nodes');
    input.setAttribute('placeholder', 'Search nodes');
    searchInput = input;
    searchWrap.appendChild(input);
    resultsList = el('ul', 'rm-search-results');
    resultsList.setAttribute('role', 'listbox');
    resultsList.setAttribute('aria-label', 'Search results');
    searchWrap.appendChild(resultsList);
    toolbar.appendChild(searchWrap);

    const resetButton = el('button', 'rm-button', 'Reset view');
    resetButton.type = 'button';
    resetButton.setAttribute('aria-label', 'Reset map view');
    toolbar.appendChild(resetButton);
    resetButton.addEventListener('click', () => resetViewport());

    root.appendChild(toolbar);

    input.addEventListener('input', () => {
      renderSearchResults(searchNodes(data, input.value));
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        const first = resultsList?.querySelector<HTMLElement>('.rm-search-result');
        if (first) first.click();
      } else if (event.key === 'Escape') {
        input.value = '';
        renderSearchResults([]);
      }
    });
  } else if (options.enableFocus) {
    toolbar = el('div', 'rm-toolbar');
    root.appendChild(toolbar);
  }

  const stage = el('div', 'rm-stage');
  root.appendChild(stage);
  host.appendChild(root);

  const renderer = createRenderer(stage, data, {
    minZoom: data.canvas?.minZoom ?? 0.4,
    maxZoom: data.canvas?.maxZoom ?? 3,
    reducedMotion,
  });
  stage.appendChild(renderer.svg);

  const graph: Graph = buildGraph(data);
  const dossier = createDossier(
    stage,
    // Closing the dossier keeps the map selection lit; the next Escape or
    // background click clears it.
    { onClosed: () => undefined },
    { mode: options.dossierMode, reducedMotion },
  );

  // --- Branch state -------------------------------------------------------

  const branches: Branches | null = options.enableBranches
    ? computeBranches(data, graph)
    : null;
  const expandedBranches = new Set<string>();
  let currentVisible: Set<string> | null = null;

  function applyBranchState(expanding: boolean): void {
    if (!branches) return;
    const visible = visibleNodes(branches, expandedBranches);
    const changed: string[] = [];
    if (currentVisible) {
      for (const id of visible) if (!currentVisible.has(id)) changed.push(id);
      for (const id of currentVisible) if (!visible.has(id)) changed.push(id);
    }
    const delays = staggerDelays(branches, changed, expanding, options.branchStaggerMs);
    for (const node of data.nodes) {
      const element = renderer.getNodeElement(node.id);
      if (!element) continue;
      const isVisible = visible.has(node.id);
      element.classList.toggle('is-branch-hidden', !isVisible);
      element.setAttribute('tabindex', isVisible ? '0' : '-1');
      element.setAttribute('aria-hidden', isVisible ? 'false' : 'true');
      if (delays.has(node.id)) {
        element.style.setProperty('--rm-branch-delay', `${delays.get(node.id)}ms`);
      } else {
        element.style.removeProperty('--rm-branch-delay');
      }
    }
    for (const edge of data.edges) {
      const id = edge.id ?? `${edge.source}\u0000${edge.target}`;
      const element = renderer.getEdgeElement(id);
      if (!element) continue;
      const isVisible = visible.has(edge.source) && visible.has(edge.target);
      element.classList.toggle('is-branch-hidden', !isVisible);
      const targetDelay = delays.get(edge.target) ?? delays.get(edge.source);
      if (targetDelay !== undefined) {
        element.style.setProperty('--rm-branch-delay', `${targetDelay}ms`);
      } else {
        element.style.removeProperty('--rm-branch-delay');
      }
      // Edge labels ride along with their edge.
      for (const label of edgeLabels.get(id) ?? []) {
        label.classList.toggle('is-branch-hidden', !isVisible);
        if (targetDelay !== undefined) {
          label.style.setProperty('--rm-branch-delay', `${targetDelay}ms`);
        } else {
          label.style.removeProperty('--rm-branch-delay');
        }
      }
    }
    currentVisible = visible;
    syncBranchToggles();
    updateBranchButton();
  }

  const branchToggles = new Map<string, SVGGElement>();
  const edgeLabels = new Map<string, SVGElement[]>();
  if (branches) {
    for (const label of stage.querySelectorAll('[data-edge-label-for]')) {
      const id = label.getAttribute('data-edge-label-for');
      if (!id) continue;
      const list = edgeLabels.get(id) ?? [];
      list.push(label as SVGElement);
      edgeLabels.set(id, list);
    }
  }
  if (branches) {
    for (const [branchId, rootNodeId] of branches.roots) {
      const rootNode = data.nodes.find((node) => node.id === rootNodeId);
      if (!rootNode) continue;
      const radius = 20;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.setAttribute('class', 'rm-branch-toggle');
      group.setAttribute('role', 'button');
      group.setAttribute('tabindex', '0');
      group.setAttribute('transform', `translate(${rootNode.x + radius + 14} ${rootNode.y - radius - 6})`);
      group.setAttribute('aria-label', `Expand branch of ${rootNode.label}`);
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('width', '22');
      rect.setAttribute('height', '22');
      group.appendChild(rect);
      const horizontal = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      horizontal.setAttribute('x', '5');
      horizontal.setAttribute('y', '10');
      horizontal.setAttribute('width', '12');
      horizontal.setAttribute('height', '2');
      horizontal.setAttribute('class', 'rm-branch-toggle-v');
      group.appendChild(horizontal);
      const vertical = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      vertical.setAttribute('x', '10');
      vertical.setAttribute('y', '5');
      vertical.setAttribute('width', '2');
      vertical.setAttribute('height', '12');
      vertical.setAttribute('class', 'rm-branch-toggle-v');
      group.appendChild(vertical);
      const activate = (): void => toggleBranch(branchId);
      group.addEventListener('click', (event) => {
        event.stopPropagation();
        activate();
      });
      group.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          activate();
        }
      });
      branchToggles.set(branchId, group);
      renderer.nodeLayer.appendChild(group);
    }
  }

  function syncBranchToggles(): void {
    for (const [branchId, group] of branchToggles) {
      const isExpanded = expandedBranches.has(branchId);
      group.setAttribute('aria-expanded', String(isExpanded));
      const rootNodeId = branches?.roots.get(branchId);
      const rootNode = data.nodes.find((node) => node.id === rootNodeId);
      group.setAttribute('aria-label', `${isExpanded ? 'Collapse' : 'Expand'} branch of ${rootNode?.label ?? ''}`);
      const verticals = group.querySelectorAll('.rm-branch-toggle-v');
      for (const vertical of Array.from(verticals)) {
        (vertical as SVGRectElement).style.opacity = isExpanded ? '0' : '1';
      }
    }
  }

  function toggleBranch(branchId: string): void {
    if (!branches) return;
    const expanding = !expandedBranches.has(branchId);
    if (expanding) expandedBranches.add(branchId);
    else expandedBranches.delete(branchId);
    applyBranchState(expanding);
  }

  function setAllBranches(open: boolean): void {
    if (!branches) return;
    expandedBranches.clear();
    if (open) for (const branchId of branches.roots.keys()) expandedBranches.add(branchId);
    applyBranchState(open);
  }

  let branchButton: HTMLButtonElement | null = null;
  if (options.enableBranches && toolbar) {
    branchButton = el('button', 'rm-button', 'Collapse all');
    branchButton.type = 'button';
    branchButton.setAttribute('aria-label', 'Expand or collapse all branches');
    branchButton.addEventListener('click', () => setAllBranches(!allExpanded()));
    toolbar.appendChild(branchButton);
  }

  function allExpanded(): boolean {
    if (!branches) return true;
    for (const branchId of branches.roots.keys()) {
      if (!expandedBranches.has(branchId)) return false;
    }
    return true;
  }

  function updateBranchButton(): void {
    if (!branchButton) return;
    branchButton.textContent = allExpanded() ? 'Collapse all' : 'Expand all';
  }

  function revealNode(nodeId: string): boolean {
    if (!graph.nodes.has(nodeId)) return false;
    const branchId = branches?.byNode.get(nodeId);
    if (branchId && !expandedBranches.has(branchId)) toggleBranch(branchId);
    renderer.focusNode(nodeId);
    renderer.getNodeElement(nodeId)?.focus();
    return true;
  }

  // Initialize branch visibility before first paint.
  if (branches) {
    if (options.initiallyExpanded) {
      for (const branchId of branches.roots.keys()) expandedBranches.add(branchId);
    }
    applyBranchState(true);
  }

  // --- Focus mode ---------------------------------------------------------

  let focusMode: ReturnType<typeof createFocusMode> | null = null;
  let focusButton: HTMLButtonElement | null = null;
  if (options.enableFocus) {
    if (toolbar) {
      focusButton = el('button', 'rm-button', 'Focus');
      focusButton.type = 'button';
      focusButton.setAttribute('aria-label', 'Open the fullscreen focused map view');
      toolbar.appendChild(focusButton);
    }
    focusMode = createFocusMode({
      stage,
      reducedMotion,
      onResetView: () => {
        glideViewport(renderer, fittedViewport(), reducedMotion);
      },
      onToggleAll: branches
        ? () => setAllBranches(!allExpanded())
        : undefined,
      toggleAllLabel: () => (allExpanded() ? 'Collapse all' : 'Expand all'),
    });
    focusButton?.addEventListener('click', () => focusMode?.open());
  }

  function fittedViewport(): { scale: number; tx: number; ty: number } {
    // Apply-and-restore keeps a single source of truth for the fit formula.
    const saved = renderer.getViewport();
    const fitted = renderer.fitToView();
    renderer.setViewport(saved);
    return fitted;
  }

  let hasReset = false;
  function resetViewport(): void {
    if (!hasReset || reducedMotion) {
      hasReset = true;
      renderer.fitToView();
      return;
    }
    glideViewport(renderer, fittedViewport(), reducedMotion);
  }

  // --- Selection ----------------------------------------------------------

  let selectedId: string | null = null;

  function clearSelection(): void {
    if (selectedId === null && !dossier.isOpen()) return;
    if (dossier.isOpen()) dossier.close();
    selectedId = null;
    renderer.setStates(null, null);
    hideSearchResults();
  }

  function selectNodeInternal(nodeId: string, openDossier: boolean): boolean {
    const node = data.nodes.find((candidate) => candidate.id === nodeId);
    if (!node) return false;
    if (currentVisible && !currentVisible.has(nodeId)) {
      const branchId = branches?.byNode.get(nodeId);
      if (branchId && !expandedBranches.has(branchId)) toggleBranch(branchId);
    }
    selectedId = nodeId;
    renderer.setStates(nodeId, highlightFor(graph, nodeId, options.edgeHighlightMode));
    if (openDossier && options.enableDossier) {
      const element = renderer.getNodeElement(nodeId);
      dossier.open(node, element ? element.getBoundingClientRect() : stage.getBoundingClientRect());
    }
    return true;
  }

  function hideSearchResults(): void {
    if (resultsList) resultsList.innerHTML = '';
  }

  function renderSearchResults(matches: SearchMatch[]): void {
    if (!resultsList || !searchInput) return;
    resultsList.innerHTML = '';
    if (matches.length === 0 || searchInput.value.trim().length === 0) return;
    for (const match of matches) {
      const node = data.nodes.find((candidate) => candidate.id === match.nodeId);
      if (!node) continue;
      const item = el('li', 'rm-search-item');
      item.setAttribute('role', 'option');
      const button = el('button', 'rm-search-result', node.label);
      button.type = 'button';
      button.addEventListener('click', () => {
        hideSearchResults();
        if (searchInput) searchInput.value = '';
        revealNode(match.nodeId);
        selectNodeInternal(match.nodeId, true);
        renderer.getNodeElement(match.nodeId)?.focus();
      });
      item.appendChild(button);
      resultsList.appendChild(item);
    }
  }

  const interactions = attachInteractions(
    renderer,
    stage,
    { enablePan: options.enablePan, enableZoom: options.enableZoom },
    {
      onNodeActivate: (nodeId) => {
        if (selectedId === nodeId && dossier.isOpen()) {
          clearSelection();
          return;
        }
        selectNodeInternal(nodeId, true);
      },
      onBackgroundActivate: () => clearSelection(),
    },
  );

  const keyboard = attachKeyboard(renderer, root, data, { enableKeyboard: options.enableKeyboard }, {
    onNodeActivate: (nodeId) => selectNodeInternal(nodeId, true),
    onEscape: () => {
      if (focusMode?.isOpen()) {
        focusMode.close();
        return;
      }
      clearSelection();
    },
  });

  if (focusMode) {
    // Escape while the dossier is open never reaches here: the dossier's own
    // capture-phase handler stops it, mirroring the reference layer order.
    stage.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && focusMode && !focusMode.isOpen() && event.target === stage) {
        event.preventDefault();
        focusMode.open();
      }
    });
  }

  if (focusMode) {
    // Keep the fitted view when the stage lifts into the overlay.
    const originalOpen = focusMode.open.bind(focusMode);
    focusMode.open = (): void => {
      const before = renderer.getViewport();
      const widthBefore = stage.clientWidth || 800;
      const heightBefore = stage.clientHeight || 600;
      const centerX = (widthBefore / 2 - before.tx) / before.scale;
      const centerY = (heightBefore / 2 - before.ty) / before.scale;
      originalOpen();
      queueMicrotask(() => {
        if (!focusMode?.isOpen()) return;
        const width = stage.clientWidth || 800;
        const height = stage.clientHeight || 600;
        renderer.setViewport({
          scale: before.scale,
          tx: width / 2 - centerX * before.scale,
          ty: height / 2 - centerY * before.scale,
        });
      });
    };
  }

  resetViewport();

  return {
    selectNode: (nodeId) => selectNodeInternal(nodeId, true),
    clearSelection,
    focusNode: (nodeId) => {
      if (!graph.nodes.has(nodeId)) return false;
      renderer.focusNode(nodeId);
      return true;
    },
    search: (query) => searchNodes(data, query),
    resetViewport,
    setTheme(next: MapThemeName) {
      host.classList.remove('rm-theme-dark', 'rm-theme-light');
      host.classList.add(`rm-theme-${next}`);
    },
    openFocus: () => focusMode?.open(),
    closeFocus: () => focusMode?.close(),
    branches: (): BranchSummary[] => {
      if (!branches) return [];
      return [...branches.roots.entries()].map(([id, rootNodeId]) => ({
        id,
        rootNodeId,
        nodeIds: [...(branches.members.get(id) ?? [])],
      }));
    },
    toggleBranch,
    expandAll: () => setAllBranches(true),
    collapseAll: () => setAllBranches(false),
    revealNode,
    destroy() {
      interactions.destroy();
      keyboard.destroy();
      focusMode?.destroy();
      dossier.destroy();
      renderer.destroy();
      root.remove();
      host.classList.remove('rm-host', 'rm-theme-dark', 'rm-theme-light');
    },
  };
}
