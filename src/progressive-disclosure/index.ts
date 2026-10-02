export type DisclosureLayer = 'signal' | 'context' | 'explanation' | 'evidence' | 'action' | 'implementation' | 'alternatives';
export type DisclosurePriority = 'primary' | 'secondary' | 'optional';

export interface DisclosureNode {
  id: string;
  layer: DisclosureLayer;
  title: string;
  summary?: string;
  priority?: DisclosurePriority;
  next?: string[];
  meta?: Record<string, string | number | boolean | null>;
}

export interface DisclosureJourney { id: string; title: string; entry: string; nodes: DisclosureNode[]; }
export interface RankedDisclosureNode extends DisclosureNode { score: number; }

const layerWeight: Record<DisclosureLayer, number> = { signal:700, context:600, explanation:500, evidence:400, action:300, implementation:200, alternatives:100 };
const priorityWeight: Record<DisclosurePriority, number> = { primary:30, secondary:20, optional:10 };

export function validateJourney(journey: DisclosureJourney): string[] {
  const errors: string[] = [];
  const ids = new Set(journey.nodes.map(node => node.id));
  if (!ids.has(journey.entry)) errors.push('Entry node "' + journey.entry + '" does not exist.');
  for (const node of journey.nodes) for (const next of node.next ?? []) if (!ids.has(next)) errors.push('Node "' + node.id + '" points to missing node "' + next + '".');
  return errors;
}

export function nodeById(journey: DisclosureJourney, id: string): DisclosureNode | undefined { return journey.nodes.find(node => node.id === id); }
export function nextNodes(journey: DisclosureJourney, currentId: string): DisclosureNode[] {
  const current = nodeById(journey,currentId);
  if (!current) return [];
  return (current.next ?? []).map(id => nodeById(journey,id)).filter((node): node is DisclosureNode => Boolean(node));
}
export function rankNext(journey: DisclosureJourney, currentId: string): RankedDisclosureNode[] {
  return nextNodes(journey,currentId).map(node => ({...node,score:layerWeight[node.layer]+priorityWeight[node.priority ?? 'secondary']})).sort((a,b)=>b.score-a.score);
}
export function recommendedNext(journey: DisclosureJourney,currentId:string): DisclosureNode | undefined { return rankNext(journey,currentId)[0]; }

export const disclosurePrinciples = {
  sequence:['signal','context','explanation','evidence','action','implementation','alternatives'] as DisclosureLayer[],
  rule:'Show the minimum information needed now; make the most likely next question one action away.',
  actionRule:'One recommended next action may be prominent; alternatives remain visible but quieter.',
  motionRule:'Open and close transitions should be spatial inverses.'
};