import { edgeId, nodeRadius } from './model';
import type { HighlightResult } from './model';
import type { MapEdge, MapNode, RelationshipMapData } from './types';

export const SVG_NS = 'http://www.w3.org/2000/svg';

export interface Viewport {
  scale: number;
  tx: number;
  ty: number;
}

export interface RendererOptions {
  minZoom: number;
  maxZoom: number;
  reducedMotion: boolean;
}

export interface Renderer {
  readonly svg: SVGSVGElement;
  readonly viewport: SVGGElement;
  getNodeElement(nodeId: string): SVGGElement | null;
  getViewport(): Viewport;
  setViewport(viewport: Viewport): void;
  fitToView(): void;
  focusNode(nodeId: string, zoom?: number): void;
  setStates(selectedId: string | null, highlight: HighlightResult | null): void;
  clientToCanvas(clientX: number, clientY: number): { x: number; y: number };
  destroy(): void;
}

function svgElement<K extends keyof SVGElementTagNameMap>(tag: K, className?: string): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG_NS, tag);
  if (className) element.setAttribute('class', className);
  return element;
}

function shapeMarkup(node: MapNode, radius: number): SVGElement {
  const size = node.shape ?? 'circle';
  const d = radius * 2;
  if (size === 'circle' || size === 'pill') {
    const rx = size === 'pill' ? radius * 1.7 : radius;
    const ellipse = svgElement('ellipse', 'rm-node-shape');
    ellipse.setAttribute('rx', String(rx));
    ellipse.setAttribute('ry', String(radius));
    return ellipse;
  }
  if (size === 'diamond') {
    const path = svgElement('path', 'rm-node-shape');
    path.setAttribute('d', `M 0 ${-radius * 1.25} L ${radius * 1.25} 0 L 0 ${radius * 1.25} L ${-radius * 1.25} Z`);
    return path;
  }
  const rect = svgElement('rect', 'rm-node-shape');
  rect.setAttribute('x', String(-radius * 1.3));
  rect.setAttribute('y', String(-radius));
  rect.setAttribute('width', String(radius * 2.6));
  rect.setAttribute('height', String(d));
  return rect;
}

/**
 * Create the SVG scene for a data payload. Nodes and edges are rendered from
 * data only; nothing about the domain is assumed.
 */
export function createRenderer(
  host: HTMLElement,
  data: RelationshipMapData,
  options: RendererOptions,
): Renderer {
  const canvas = { width: data.canvas?.width ?? 1200, height: data.canvas?.height ?? 800, ...data.canvas };
  const groupOf = new Map((data.groups ?? []).map((group) => [group.id, group]));

  const svg = svgElement('svg', 'rm-svg');
  svg.setAttribute('viewBox', `0 0 ${host.clientWidth || canvas.width} ${host.clientHeight || canvas.height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.setAttribute('role', 'img');
  const metaTitle = data.meta?.title ?? 'Relationship map';
  svg.setAttribute('aria-label', `${metaTitle}. Use arrow keys to move between nodes. Enter opens details. Escape closes.`);

  const defs = svgElement('defs');
  const marker = svgElement('marker', 'rm-arrow');
  marker.setAttribute('id', 'rm-arrow-head');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '9');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '7');
  marker.setAttribute('markerHeight', '7');
  marker.setAttribute('orient', 'auto-start-reverse');
  const markerPath = svgElement('path');
  markerPath.setAttribute('d', 'M 0 1 L 9 5 L 0 9 z');
  markerPath.setAttribute('fill', 'var(--map-edge)');
  marker.appendChild(markerPath);
  defs.appendChild(marker);
  svg.appendChild(defs);

  const viewport = svgElement('g', 'rm-viewport');
  svg.appendChild(viewport);
  viewport.appendChild(svgElement('g', 'rm-edge-layer'));
  const nodeLayer = svgElement('g', 'rm-node-layer');
  viewport.appendChild(nodeLayer);

  const nodeElements = new Map<string, SVGGElement>();
  const edgeElements = new Map<string, SVGPathElement>();

  for (const edge of data.edges) {
    renderEdge(edge);
  }
  for (const node of data.nodes) {
    renderNode(node);
  }

  function renderEdge(edge: MapEdge): void {
    const source = data.nodes.find((node) => node.id === edge.source);
    const target = data.nodes.find((node) => node.id === edge.target);
    if (!source || !target) return;
    const id = edge.id ?? edgeId(edge.source, edge.target);
    const path = svgElement('path', 'rm-edge');
    const markerGap = nodeRadius(target) + 10;
    const dx = target.x - source.x;
    const dy = target.y - source.y;
    const length = Math.hypot(dx, dy) || 1;
    const endX = edge.directed ? target.x - (dx / length) * markerGap : target.x;
    const endY = edge.directed ? target.y - (dy / length) * markerGap : target.y;
    const midX = (source.x + target.x) / 2;
    const midY = (source.y + target.y) / 2 - 14;
    path.setAttribute('d', `M ${source.x} ${source.y} Q ${midX} ${midY} ${endX} ${endY}`);
    path.setAttribute('data-edge-id', id);
    path.setAttribute('stroke-width', String(1 + (edge.weight ?? 1) * 0.4));
    if (edge.directed) path.setAttribute('marker-end', 'url(#rm-arrow-head)');
    edgeElements.set(id, path);
    (viewport.querySelector('.rm-edge-layer') as SVGGElement).appendChild(path);
    if (edge.label) {
      const text = svgElement('text', 'rm-edge-label');
      text.setAttribute('x', String(midX));
      text.setAttribute('y', String(midY - 4));
      text.setAttribute('text-anchor', 'middle');
      text.textContent = edge.label;
      (viewport.querySelector('.rm-edge-layer') as SVGGElement).appendChild(text);
    }
  }

  function renderNode(node: MapNode): void {
    const group = svgElement('g', 'rm-node');
    group.setAttribute('transform', `translate(${node.x} ${node.y})`);
    group.setAttribute('data-node-id', node.id);
    group.setAttribute('tabindex', '0');
    group.setAttribute('role', 'button');
    const detail = node.detail;
    group.setAttribute(
      'aria-label',
      detail ? `${node.label}${node.secondaryLabel ? `, ${node.secondaryLabel}` : ''}` : node.label,
    );

    const radius = nodeRadius(node);
    const shape = shapeMarkup(node, radius);
    if (node.groupId) {
      const groupDef = groupOf.get(node.groupId);
      if (groupDef?.color) shape.style.setProperty('--rm-group-color', groupDef.color);
      group.setAttribute('data-group-id', node.groupId);
    }
    group.appendChild(shape);

    const label = svgElement('text', 'rm-node-label');
    label.setAttribute('y', String(radius + 16));
    label.setAttribute('text-anchor', 'middle');
    label.textContent = node.label;
    group.appendChild(label);

    if (node.secondaryLabel) {
      const secondary = svgElement('text', 'rm-node-secondary');
      secondary.setAttribute('y', String(radius + 32));
      secondary.setAttribute('text-anchor', 'middle');
      secondary.textContent = node.secondaryLabel;
      group.appendChild(secondary);
    }

    nodeElements.set(node.id, group);
    nodeLayer.appendChild(group);
  }

  let current: Viewport = { scale: 1, tx: 0, ty: 0 };

  function applyViewport(): void {
    viewport.setAttribute('transform', `translate(${current.tx} ${current.ty}) scale(${current.scale})`);
  }

  function fitToView(): void {
    const width = host.clientWidth || 800;
    const height = host.clientHeight || 600;
    const scale = Math.min(width / canvas.width, height / canvas.height, 1);
    current = {
      scale,
      tx: (width - canvas.width * scale) / 2,
      ty: (height - canvas.height * scale) / 2,
    };
    applyViewport();
  }

  const observer = new ResizeObserver(() => {
    svg.setAttribute('viewBox', `0 0 ${host.clientWidth || canvas.width} ${host.clientHeight || canvas.height}`);
  });
  observer.observe(host);

  return {
    svg,
    viewport,
    getNodeElement: (nodeId) => nodeElements.get(nodeId) ?? null,
    getViewport: () => ({ ...current }),
    setViewport(next) {
      current = {
        scale: Math.min(options.maxZoom, Math.max(options.minZoom, next.scale)),
        tx: next.tx,
        ty: next.ty,
      };
      applyViewport();
    },
    fitToView,
    focusNode(nodeId, zoom) {
      const node = data.nodes.find((candidate) => candidate.id === nodeId);
      if (!node) return;
      const width = host.clientWidth || 800;
      const height = host.clientHeight || 600;
      const scale = Math.min(options.maxZoom, Math.max(options.minZoom, zoom ?? current.scale));
      current = { scale, tx: width / 2 - node.x * scale, ty: height / 2 - node.y * scale };
      applyViewport();
    },
    setStates(selectedId, highlight) {
      const activeNodes = highlight?.nodes ?? null;
      const activeEdges = highlight?.edges ?? null;
      for (const [id, element] of nodeElements) {
        element.classList.toggle('is-selected', id === selectedId);
        const dimmed = activeNodes !== null && !activeNodes.has(id);
        element.classList.toggle('is-dimmed', dimmed);
        element.setAttribute('aria-current', id === selectedId ? 'true' : 'false');
      }
      for (const [id, element] of edgeElements) {
        const dimmed = activeEdges !== null && !activeEdges.has(id);
        element.classList.toggle('is-dimmed', dimmed);
        element.classList.toggle('is-active', activeEdges?.has(id) === true);
      }
    },
    clientToCanvas(clientX, clientY) {
      const rect = svg.getBoundingClientRect();
      return {
        x: (clientX - rect.left - current.tx) / current.scale,
        y: (clientY - rect.top - current.ty) / current.scale,
      };
    },
    destroy() {
      observer.disconnect();
      svg.remove();
    },
  };
}
