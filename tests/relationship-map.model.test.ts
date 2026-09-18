import { describe, expect, it } from 'vitest';
import {
  buildGraph,
  connected,
  downstream,
  edgeId,
  highlightFor,
  nearestNodeInDirection,
  neighbors,
  upstream,
  validateRelationshipMapData,
} from '../src/relationship-map/model';
import type { RelationshipMapData } from '../src/relationship-map/types';

const data: RelationshipMapData = {
  groups: [
    { id: 'g1', label: 'Group One' },
    { id: 'g2', label: 'Group Two' },
  ],
  nodes: [
    { id: 'a', label: 'Alpha', x: 0, y: 0, groupId: 'g1' },
    { id: 'b', label: 'Beta', x: 100, y: 0, groupId: 'g1' },
    { id: 'c', label: 'Gamma', x: 200, y: 0, groupId: 'g2' },
    { id: 'd', label: 'Delta', x: 100, y: 100, groupId: 'g2' },
  ],
  edges: [
    { source: 'a', target: 'b', directed: true },
    { source: 'b', target: 'c', directed: true },
    { source: 'b', target: 'd', directed: false },
  ],
};

describe('relationship map validation', () => {
  it('accepts a well-formed payload', () => {
    const result = validateRelationshipMapData(data);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects missing nodes and non-array edges', () => {
    const empty = validateRelationshipMapData({ nodes: [], edges: [] });
    expect(empty.valid).toBe(false);
    expect(empty.errors[0]).toContain('non-empty');

    const noEdges = validateRelationshipMapData({ nodes: [{ id: 'a', label: 'A', x: 0, y: 0 }] } as RelationshipMapData);
    expect(noEdges.valid).toBe(false);
  });

  it('rejects duplicate node ids and non-numeric coordinates', () => {
    const dup = validateRelationshipMapData({
      nodes: [
        { id: 'a', label: 'A', x: 0, y: 0 },
        { id: 'a', label: 'A2', x: 1, y: 1 },
      ],
      edges: [],
    });
    expect(dup.valid).toBe(false);
    expect(dup.errors.join(' ')).toContain('duplicate node id');

    const badCoords = validateRelationshipMapData({
      nodes: [{ id: 'a', label: 'A', x: Number.NaN, y: 0 }],
      edges: [],
    });
    expect(badCoords.valid).toBe(false);
  });

  it('rejects edges referencing unknown nodes or groups', () => {
    const danglingEdge = validateRelationshipMapData({
      nodes: [{ id: 'a', label: 'A', x: 0, y: 0 }],
      edges: [{ source: 'a', target: 'ghost' }],
    });
    expect(danglingEdge.valid).toBe(false);
    expect(danglingEdge.errors.join(' ')).toContain('unknown target');

    const danglingGroup = validateRelationshipMapData({
      nodes: [{ id: 'a', label: 'A', x: 0, y: 0, groupId: 'ghost' }],
      edges: [],
    });
    expect(danglingGroup.valid).toBe(false);
    expect(danglingGroup.errors.join(' ')).toContain('unknown group');
  });
});

describe('relationship map graph traversal', () => {
  const graph = buildGraph(data);

  it('derives stable edge ids from endpoints', () => {
    expect(edgeId('a', 'b')).toBe(edgeId('a', 'b'));
    expect(edgeId('a', 'b')).not.toBe(edgeId('b', 'a'));
    expect(graph.edges.size).toBe(3);
  });

  it('reports direct neighbors in both directions', () => {
    expect([...neighbors(graph, 'b')].sort()).toEqual(['a', 'c', 'd']);
    expect([...neighbors(graph, 'a')]).toEqual(['b']);
  });

  it('follows directed edges downstream', () => {
    expect([...downstream(graph, 'a')].sort()).toEqual(['b', 'c', 'd']);
    expect(downstream(graph, 'c').size).toBe(0);
  });

  it('respects direction for upstream and downstream', () => {
    expect([...upstream(graph, 'c')].sort()).toEqual(['a', 'b']);
    expect(upstream(graph, 'a').size).toBe(0);
    expect([...downstream(graph, 'a')].sort()).toEqual(['b', 'c', 'd']);
  });

  it('returns transitive connected sets in both directions', () => {
    expect([...connected(graph, 'a')].sort()).toEqual(['b', 'c', 'd']);
    expect([...connected(graph, 'd')].sort()).toEqual(['a', 'b']);
  });

  it('keeps only edges between highlighted nodes in direct mode', () => {
    const highlight = highlightFor(graph, 'b', 'direct');
    expect([...highlight.nodes].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(highlight.edges.size).toBe(3);

    const leaf = highlightFor(graph, 'c', 'direct');
    expect([...leaf.nodes].sort()).toEqual(['b', 'c']);
    expect([...leaf.edges]).toEqual([edgeId('b', 'c')]);
  });
});

describe('relationship map spatial navigation', () => {
  const centers = new Map([
    ['n1', { x: 0, y: 0 }],
    ['n2', { x: 100, y: 0 }],
    ['n3', { x: 50, y: -60 }],
    ['n4', { x: -80, y: 50 }],
  ]);

  it('moves to the nearest node in the requested direction', () => {
    expect(nearestNodeInDirection(centers, 'n1', 1, 0)).toBe('n2');
    expect(nearestNodeInDirection(centers, 'n1', 0, -1)).toBe('n3');
    expect(nearestNodeInDirection(centers, 'n1', 0, 1)).toBe('n4');
    expect(nearestNodeInDirection(centers, 'n4', 0, -1)).toBe('n3');
  });

  it('returns null when no node lies in the direction', () => {
    expect(nearestNodeInDirection(centers, 'n2', 1, 0)).toBeNull();
    expect(nearestNodeInDirection(centers, 'n3', 0, -1)).toBeNull();
  });
});
