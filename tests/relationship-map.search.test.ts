import { describe, expect, it } from 'vitest';
import { buildSearchIndex, searchIndex, searchNodes } from '../src/relationship-map/search';
import type { RelationshipMapData } from '../src/relationship-map/types';

const data: RelationshipMapData = {
  groups: [{ id: 'hydro', label: 'Hydrology' }, { id: 'ops', label: 'Operations' }],
  nodes: [
    { id: 'a', label: 'Alluvial Aquifer', secondaryLabel: 'shallow storage', groupId: 'hydro', x: 0, y: 0, tags: ['aquifer', 'storage'] },
    { id: 'b', label: 'Pumping Well', secondaryLabel: 'production asset', groupId: 'ops', x: 100, y: 0, tags: ['well', 'production'] },
    { id: 'c', label: 'Rainfall Input', groupId: 'hydro', x: 200, y: 0, tags: ['climate'] },
    { id: 'd', label: 'Recharge Zone', secondaryLabel: 'intake area', groupId: 'hydro', x: 300, y: 0, tags: ['recharge'] },
  ],
  edges: [],
};

describe('relationship map search', () => {
  it('matches labels case-insensitively and ranks prefixes first', () => {
    const matches = searchNodes(data, 'aqu');
    expect(matches).toHaveLength(1);
    expect(matches[0]).toMatchObject({ nodeId: 'a', field: 'label' });

    const prefix = searchNodes(data, 'pump');
    expect(prefix[0]).toMatchObject({ nodeId: 'b', field: 'label', score: 100 });

    const contains = searchNodes(data, 'well');
    expect(contains[0]).toMatchObject({ nodeId: 'b', field: 'label', score: 70 });
  });

  it('matches secondary labels, tags, and group names', () => {
    expect(searchNodes(data, 'intake').map((m) => m.nodeId)).toEqual(['d']);
    expect(searchNodes(data, 'climate').map((m) => m.nodeId)).toEqual(['c']);
    expect(searchNodes(data, 'operations').map((m) => m.nodeId)).toEqual(['b']);
  });

  it('matches secondary labels with a lower rank than labels', () => {
    const matches = searchNodes(data, 'storage');
    expect(matches.map((m) => m.nodeId)).toEqual(['a']);
    expect(matches[0].field).toBe('secondaryLabel');
  });

  it('returns nothing for empty or unmatched queries', () => {
    expect(searchNodes(data, '')).toEqual([]);
    expect(searchNodes(data, '   ')).toEqual([]);
    expect(searchNodes(data, 'volcano')).toEqual([]);
  });

  it('caps results at the configured limit', () => {
    const wide = searchNodes(data, 'a');
    expect(wide.length).toBeGreaterThan(1);
    const limited = searchIndex(buildSearchIndex(data), 'a', 1);
    expect(limited).toHaveLength(1);
  });

  it('deduplicates a node to its highest-ranking field', () => {
    const matches = searchNodes(data, 'alluvial');
    expect(matches).toHaveLength(1);
    expect(matches[0].nodeId).toBe('a');
  });
});
