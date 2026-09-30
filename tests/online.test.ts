import { describe, expect, it } from 'vitest';
import { safeRequestUrl, workflowKickoff } from '../src/online';
describe('request provenance', () => {
  it('removes credentials, fragments and secret query parameters, preserving useful context', () => {
    expect(safeRequestUrl('https://u:p@baders.sa/zeal/atlas?view=map&access_token=secret&code=oauth#secret')).toBe('https://baders.sa/zeal/atlas?view=map');
  });
  it('preserves the chosen creative scope and explicit release boundary in handoff', () => {
    const prompt = workflowKickoff(42, 'refine');
    expect(prompt).toContain('basabtan/app-requests#42');
    expect(prompt).toContain('Creative mode: refine');
    expect(prompt).toContain('production release requires my decision');
  });
});
