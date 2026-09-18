import { describe, expect, it } from 'vitest';
import { computeBranches, staggerDelays, visibleNodes } from '../src/relationship-map/branch';
import { buildGraph, edgeId } from '../src/relationship-map/model';
import type { RelationshipMapData } from '../src/relationship-map/types';

function makeData(
  nodes: Array<{ id: string; x: number; y: number }>,
  edges: Array<{ source: string; target: string; directed?: boolean }>,
): RelationshipMapData {
  return {
    nodes: nodes.map((node) => ({ id: node.id, label: node.id, x: node.x, y: node.y })),
    edges: edges.map((edge) => ({
      source: edge.source,
      target: edge.target,
      directed: edge.directed ?? true,
    })),
  };
}

describe('computeBranches', () => {
  it('roots branches at nodes with no incoming directed edge', () => {
    const data = makeData(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 10 },
        { id: 'c', x: 20, y: 20 },
      ],
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    );
    const branches = computeBranches(data, buildGraph(data));
    expect([...branches.roots.keys()]).toEqual(['a']);
    expect(branches.byNode.get('c')).toBe('a');
    expect(branches.depth.get('a')).toBe(0);
    expect(branches.depth.get('b')).toBe(1);
    expect(branches.depth.get('c')).toBe(2);
    expect(branches.maxDepth.get('a')).toBe(2);
  });

  it('handles multiple roots each owning their reachable nodes', () => {
    const data = makeData(
      [
        { id: 'r1', x: 0, y: 0 },
        { id: 'r2', x: 100, y: 0 },
        { id: 'x', x: 10, y: 10 },
        { id: 'y', x: 110, y: 10 },
      ],
      [
        { source: 'r1', target: 'x' },
        { source: 'r2', target: 'y' },
      ],
    );
    const branches = computeBranches(data, buildGraph(data));
    expect([...branches.roots.keys()].sort()).toEqual(['r1', 'r2']);
    expect(branches.byNode.get('x')).toBe('r1');
    expect(branches.byNode.get('y')).toBe('r2');
  });

  it('falls back to connected components when no edge is directed', () => {
    const data = makeData(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 0, y: 10 },
        { id: 'c', x: 500, y: 0 },
      ],
      [
        { source: 'a', target: 'b', directed: false },
      ],
    );
    const branches = computeBranches(data, buildGraph(data));
    // Two components: {a, b} rooted at the topmost node, {c} alone.
    expect([...branches.roots.keys()].sort()).toEqual(['a', 'c']);
    expect(branches.byNode.get('b')).toBe('a');
  });

  it('gives purely cyclic directed graphs single-node branches', () => {
    const data = makeData(
      [
        { id: 'p', x: 0, y: 0 },
        { id: 'q', x: 10, y: 10 },
      ],
      [
        { source: 'p', target: 'q' },
        { source: 'q', target: 'p' },
      ],
    );
    const branches = computeBranches(data, buildGraph(data));
    expect(branches.byNode.get('p')).toBe('p');
    expect(branches.byNode.get('q')).toBe('q');
    expect([...branches.roots.keys()].sort()).toEqual(['p', 'q']);
  });
});

describe('visibleNodes', () => {
  it('shows only roots when nothing is expanded', () => {
    const data = makeData(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 10 },
      ],
      [{ source: 'a', target: 'b' }],
    );
    const branches = computeBranches(data, buildGraph(data));
    expect(visibleNodes(branches, [])).toEqual(new Set(['a']));
  });

  it('shows all members when the branch is expanded', () => {
    const data = makeData(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 10 },
      ],
      [{ source: 'a', target: 'b' }],
    );
    const branches = computeBranches(data, buildGraph(data));
    expect(visibleNodes(branches, ['a'])).toEqual(new Set(['a', 'b']));
  });
});

describe('staggerDelays', () => {
  it('expanding cascades outward from the root at 38 ms per depth', () => {
    const data = makeData(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 10 },
        { id: 'c', x: 20, y: 20 },
      ],
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    );
    const branches = computeBranches(data, buildGraph(data));
    const delays = staggerDelays(branches, ['b', 'c'], true, 38);
    expect(delays.get('b')).toBe(38);
    expect(delays.get('c')).toBe(76);
  });

  it('collapsing reverses the stagger so leaves go first', () => {
    const data = makeData(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 10 },
        { id: 'c', x: 20, y: 20 },
      ],
      [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    );
    const branches = computeBranches(data, buildGraph(data));
    const delays = staggerDelays(branches, ['b', 'c'], false, 38);
    expect(delays.get('b')).toBe(38);
    expect(delays.get('c')).toBe(0);
  });

  it('skips nodes outside every branch', () => {
    const data = makeData(
      [
        { id: 'a', x: 0, y: 0 },
        { id: 'b', x: 10, y: 10 },
      ],
      [{ source: 'a', target: 'b' }],
    );
    const branches = computeBranches(data, buildGraph(data));
    const delays = staggerDelays(branches, ['unknown'], true);
    expect(delays.has('unknown')).toBe(false);
  });
});

describe('edgeId interop', () => {
  it('resolves default edge ids so branch visibility can find edge elements', () => {
    const id = edgeId('a', 'b');
    expect(id).toBe('a\u0000b');
  });
});
