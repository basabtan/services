import type { RelationshipMapData, SearchMatch } from './types';

interface IndexEntry {
  nodeId: string;
  label: string;
  secondaryLabel: string;
  tags: string[];
  group: string;
}

/** Build the searchable index from map data. Pure; no DOM. */
export function buildSearchIndex(data: RelationshipMapData): IndexEntry[] {
  const groupLabels = new Map((data.groups ?? []).map((group) => [group.id, group.label]));
  return data.nodes.map((node) => ({
    nodeId: node.id,
    label: node.label.toLowerCase(),
    secondaryLabel: (node.secondaryLabel ?? '').toLowerCase(),
    tags: (node.tags ?? []).map((tag) => tag.toLowerCase()),
    group: (node.groupId ? (groupLabels.get(node.groupId) ?? '') : '').toLowerCase(),
  }));
}

/**
 * Match a query against labels, secondary labels, tags, and group labels.
 * Prefix matches on labels rank highest; results are capped at `limit`.
 */
export function searchIndex(index: IndexEntry[], query: string, limit = 20): SearchMatch[] {
  const needle = query.trim().toLowerCase();
  if (needle.length === 0) return [];
  const matches: SearchMatch[] = [];

  for (const entry of index) {
    if (entry.label.startsWith(needle)) {
      matches.push({ nodeId: entry.nodeId, field: 'label', score: 100 });
      continue;
    }
    if (entry.label.includes(needle)) {
      matches.push({ nodeId: entry.nodeId, field: 'label', score: 70 });
      continue;
    }
    if (entry.secondaryLabel.includes(needle)) {
      matches.push({ nodeId: entry.nodeId, field: 'secondaryLabel', score: 50 });
      continue;
    }
    if (entry.tags.some((tag) => tag.includes(needle))) {
      matches.push({ nodeId: entry.nodeId, field: 'tag', score: 40 });
      continue;
    }
    if (entry.group.includes(needle)) {
      matches.push({ nodeId: entry.nodeId, field: 'group', score: 30 });
    }
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, limit);
}

/** Convenience wrapper: index and query in one call. */
export function searchNodes(data: RelationshipMapData, query: string, limit?: number): SearchMatch[] {
  return searchIndex(buildSearchIndex(data), query, limit);
}
