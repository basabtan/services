import type {
  HighlightMode,
  MapNode,
  NodeSize,
  RelationshipMapData,
} from './types';

/** Node geometry in canvas pixels, keyed by size preset. */
export const NODE_SIZE_PX: Record<NodeSize, number> = { sm: 14, md: 20, lg: 28 };

export const DEFAULT_NODE_SIZE: NodeSize = 'md';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Validate a data payload before rendering. Structural only — the engine
 * never inspects domain semantics.
 */
export function validateRelationshipMapData(data: RelationshipMapData): ValidationResult {
  const errors: string[] = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['data must be an object'] };
  }
  if (!Array.isArray(data.nodes) || data.nodes.length === 0) {
    errors.push('nodes must be a non-empty array');
    return { valid: false, errors };
  }
  if (!Array.isArray(data.edges)) errors.push('edges must be an array');

  const nodeIds = new Set<string>();
  for (const [index, node] of data.nodes.entries()) {
    if (!node || typeof node !== 'object') {
      errors.push(`nodes[${index}] must be an object`);
      continue;
    }
    if (!node.id || typeof node.id !== 'string') errors.push(`nodes[${index}].id must be a non-empty string`);
    else if (nodeIds.has(node.id)) errors.push(`duplicate node id "${node.id}"`);
    else nodeIds.add(node.id);
    if (!node.label || typeof node.label !== 'string') errors.push(`node "${node.id ?? index}" must have a label`);
    if (typeof node.x !== 'number' || Number.isNaN(node.x) || typeof node.y !== 'number' || Number.isNaN(node.y)) {
      errors.push(`node "${node.id ?? index}" must have numeric x and y`);
    }
  }

  const groupIds = new Set((data.groups ?? []).map((group) => group.id));
  for (const node of data.nodes) {
    if (node?.groupId && !groupIds.has(node.groupId)) {
      errors.push(`node "${node.id}" references unknown group "${node.groupId}"`);
    }
  }

  for (const [index, edge] of (data.edges ?? []).entries()) {
    if (!edge || typeof edge !== 'object') {
      errors.push(`edges[${index}] must be an object`);
      continue;
    }
    const name = edge.id ?? `${edge.source} -> ${edge.target}`;
    if (!nodeIds.has(edge.source)) errors.push(`edge "${name}" references unknown source "${edge.source}"`);
    if (!nodeIds.has(edge.target)) errors.push(`edge "${name}" references unknown target "${edge.target}"`);
  }

  return { valid: errors.length === 0, errors };
}

export interface EdgeRecord {
  id: string;
  source: string;
  target: string;
  directed: boolean;
}

export interface Graph {
  /** All nodes keyed by id. */
  nodes: Map<string, MapNode>;
  /** Adjacency including both directions of every edge. */
  adjacency: Map<string, string[]>;
  /** Edges keyed by resolved id. */
  edges: Map<string, EdgeRecord>;
}

/** Resolve the stable id for an edge. */
export function edgeId(source: string, target: string): string {
  return `${source}\u0000${target}`;
}

export function buildGraph(data: RelationshipMapData): Graph {
  const nodes = new Map(data.nodes.map((node) => [node.id, node]));
  const edges = new Map<string, EdgeRecord>();
  const adjacency = new Map<string, string[]>();
  for (const node of data.nodes) adjacency.set(node.id, []);

  for (const edge of data.edges) {
    const id = edge.id ?? edgeId(edge.source, edge.target);
    edges.set(id, { id, source: edge.source, target: edge.target, directed: edge.directed === true });
    adjacency.get(edge.source)?.push(edge.target);
    adjacency.get(edge.target)?.push(edge.source);
  }
  return { nodes, adjacency, edges };
}

/** Direct neighbors of a node, regardless of direction. */
export function neighbors(graph: Graph, nodeId: string): Set<string> {
  return new Set(graph.adjacency.get(nodeId) ?? []);
}

function walk(graph: Graph, nodeId: string, direction: 'up' | 'down'): Set<string> {
  const seen = new Set<string>([nodeId]);
  const frontier = [nodeId];
  while (frontier.length > 0) {
    const current = frontier.pop() as string;
    for (const edge of graph.edges.values()) {
      const next =
        direction === 'down' && edge.source === current
          ? edge.target
          : direction === 'up' && edge.target === current
            ? edge.source
            : null;
      if (next !== null && !seen.has(next)) {
        seen.add(next);
        frontier.push(next);
      }
    }
  }
  seen.delete(nodeId);
  return seen;
}

/** All nodes reachable from `nodeId` following directed edges forward. */
export function downstream(graph: Graph, nodeId: string): Set<string> {
  return walk(graph, nodeId, 'down');
}

/** All nodes that can reach `nodeId` following directed edges forward. */
export function upstream(graph: Graph, nodeId: string): Set<string> {
  return walk(graph, nodeId, 'up');
}

/** Union of upstream and downstream, transitive. */
export function connected(graph: Graph, nodeId: string): Set<string> {
  const all = upstream(graph, nodeId);
  for (const id of downstream(graph, nodeId)) all.add(id);
  return all;
}

export interface HighlightResult {
  /** Node ids that stay fully rendered. */
  nodes: Set<string>;
  /** Edge ids that stay fully rendered. */
  edges: Set<string>;
}

/**
 * Compute which nodes and edges remain highlighted for a selection under
 * the configured highlight mode.
 */
export function highlightFor(graph: Graph, nodeId: string, mode: HighlightMode = 'direct'): HighlightResult {
  const nodes = new Set<string>([nodeId]);
  const related =
    mode === 'upstream'
      ? upstream(graph, nodeId)
      : mode === 'downstream'
        ? downstream(graph, nodeId)
        : mode === 'connected'
          ? connected(graph, nodeId)
          : neighbors(graph, nodeId);
  for (const id of related) nodes.add(id);

  const edges = new Set<string>();
  for (const edge of graph.edges.values()) {
    if (nodes.has(edge.source) && nodes.has(edge.target)) edges.add(edge.id);
  }
  return { nodes, edges };
}

/** Effective size preset for a node. */
export function nodeRadius(node: MapNode): number {
  return NODE_SIZE_PX[node.size ?? DEFAULT_NODE_SIZE];
}

/** Node centers for spatial keyboard navigation. */
export function nodeCenters(data: RelationshipMapData): Map<string, { x: number; y: number }> {
  return new Map(data.nodes.map((node) => [node.id, { x: node.x, y: node.y }]));
}

/**
 * Nearest node center from `from` in the unit direction `dx, dy`.
 * Candidates need a positive projection; the most aligned node wins,
 * with the closest projection breaking ties.
 */
export function nearestNodeInDirection(
  centers: Map<string, { x: number; y: number }>,
  from: string,
  dx: number,
  dy: number,
): string | null {
  const origin = centers.get(from);
  if (!origin) return null;
  let bestId: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let bestProjection = Number.POSITIVE_INFINITY;
  for (const [id, center] of centers) {
    if (id === from) continue;
    const vx = center.x - origin.x;
    const vy = center.y - origin.y;
    const projection = vx * dx + vy * dy;
    if (projection <= 0) continue;
    const score = projection / Math.hypot(vx, vy);
    if (score > bestScore || (score === bestScore && projection < bestProjection)) {
      bestScore = score;
      bestProjection = projection;
      bestId = id;
    }
  }
  return bestId;
}
