import { attachKeyboard, prefersReducedMotion } from './a11y';
import { createDossier } from './dossier';
import { attachInteractions } from './interactions';
import { buildGraph, highlightFor, validateRelationshipMapData } from './model';
import type { Graph } from './model';
import { createRenderer } from './renderer';
import { searchNodes } from './search';
import type {
  MapThemeName,
  RelationshipMapApi,
  RelationshipMapConfig,
  RelationshipMapData,
  SearchMatch,
} from './types';

export type {
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
  const dossier = createDossier(stage, {
    // Closing the dossier keeps the map selection lit; the next Escape or
    // background click clears it.
    onClosed: () => undefined,
  });

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
        renderer.focusNode(match.nodeId);
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
      if (dossier.isOpen()) dossier.close();
      else clearSelection();
    },
  });

  function resetViewport(): void {
    renderer.fitToView();
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
    destroy() {
      interactions.destroy();
      keyboard.destroy();
      dossier.destroy();
      renderer.destroy();
      root.remove();
      host.classList.remove('rm-host', 'rm-theme-dark', 'rm-theme-light');
    },
  };
}
