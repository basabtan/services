import type { Graph } from './model';
import type { RelationshipMapData } from './types';

/**
 * Branch structure for the staggered expand/collapse behavior.
 *
 * A branch is the set of nodes reachable from a root. Roots are nodes with no
 * incoming directed edge; when a payload has no directed edges, each connected
 * component becomes a branch rooted at its topmost node. The structure is
 * derived from the data contract — no domain knowledge is assumed.
 */
export interface Branches {
  /** Node id -> branch id (the branch root's node id). */
  byNode: Map<string, string>;
  /** Branch id -> root node id. */
  roots: Map<string, string>;
  /** Branch id -> member node ids (root first). */
  members: Map<string, string[]>;
  /** Node id -> BFS depth from its branch root (root = 0). */
  depth: Map<string, number>;
  /** Branch id -> maximum member depth. */
  maxDepth: Map<string, number>;
}

/** Compute branches, depths, and membership from the graph. */
export function computeBranches(data: RelationshipMapData, graph: Graph): Branches {
  const byNode = new Map<string, string>();
  const roots = new Map<string, string>();
  const members = new Map<string, string[]>();
  const depth = new Map<string, number>();
  const maxDepth = new Map<string, number>();

  // Ordered topmost-first so root selection is deterministic.
  const ordered = [...data.nodes].sort((a, b) => a.y - b.y || a.x - b.x);

  const directedTargets = new Set<string>();
  for (const edge of graph.edges.values()) {
    if (edge.directed) directedTargets.add(edge.target);
  }

  // Root candidates: no incoming directed edge.
  let candidates = ordered.filter((node) => !directedTargets.has(node.id));

  // No directed edges anywhere: one root per connected component instead.
  const hasDirected = [...graph.edges.values()].some((edge) => edge.directed);
  if (!hasDirected) {
    const seen = new Set<string>();
    candidates = [];
    for (const node of ordered) {
      if (seen.has(node.id)) continue;
      candidates.push(node);
      const queue = [node.id];
      seen.add(node.id);
      while (queue.length > 0) {
        const current = queue.pop() as string;
        for (const next of graph.adjacency.get(current) ?? []) {
          if (!seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
    }
  }

  const assigned = new Set<string>();
  const seedBranch = (rootId: string, branchSet?: Set<string>): void => {
    roots.set(rootId, rootId);
    depth.set(rootId, 0);
    const list: string[] = [];
    const seen = new Set([rootId]);
    let frontier: string[] = [rootId];
    let level = 0;
    while (frontier.length > 0) {
      level += 1;
      const next: string[] = [];
      for (const current of frontier) {
        for (const neighbor of graph.adjacency.get(current) ?? []) {
          if (seen.has(neighbor) || assigned.has(neighbor)) continue;
          if (branchSet && !branchSet.has(neighbor)) continue;
          seen.add(neighbor);
          depth.set(neighbor, level);
          next.push(neighbor);
        }
      }
      frontier = next;
    }
    for (const nodeId of seen) list.push(nodeId);
    let max = 0;
    for (const nodeId of seen) max = Math.max(max, depth.get(nodeId) ?? 0);
    maxDepth.set(rootId, max);
    members.set(rootId, list);
    for (const nodeId of seen) {
      byNode.set(nodeId, rootId);
      assigned.add(nodeId);
    }
  };

  for (const root of candidates) {
    if (assigned.has(root.id)) continue;
    seedBranch(root.id);
  }

  // Any node left unassigned (a cycle with no zero-indegree entry) roots its
  // own single-node branch, topmost-first.
  for (const node of ordered) {
    if (assigned.has(node.id)) continue;
    seedBranch(node.id, new Set([node.id]));
  }

  return { byNode, roots, members, depth, maxDepth };
}

/**
 * The set of node ids visible under the current expanded-branch set. Roots are
 * always visible; members appear when their branch is expanded.
 */
export function visibleNodes(branches: Branches, expanded: Iterable<string>): Set<string> {
  const expandedSet = new Set(expanded);
  const visible = new Set<string>();
  for (const branchId of branches.roots.keys()) {
    if (expandedSet.has(branchId)) {
      for (const nodeId of branches.members.get(branchId) ?? []) visible.add(nodeId);
    } else {
      visible.add(branches.roots.get(branchId) as string);
    }
  }
  return visible;
}

/**
 * Per-node transition delays for a stagger. Expanding cascades outward from
 * the root (depth * stagger); collapsing reverses so leaves disappear first —
 * the reference map's 38 ms signature.
 */
export function staggerDelays(
  branches: Branches,
  changed: Iterable<string>,
  expanding: boolean,
  staggerMs = 38,
): Map<string, number> {
  const delays = new Map<string, number>();
  for (const nodeId of changed) {
    const branchId = branches.byNode.get(nodeId);
    if (branchId === undefined) continue;
    const depth = branches.depth.get(nodeId) ?? 0;
    const max = branches.maxDepth.get(branchId) ?? 0;
    const delay = Math.max(0, (expanding ? depth : max - depth) * staggerMs);
    delays.set(nodeId, delay);
  }
  return delays;
}
