export {
  buildRepairReport,
  DEFAULT_ACCEPTANCE,
  DEFAULT_CONSTRAINTS,
  findRepairTargets,
  insertRepairTarget,
  isTargetName,
  mentionAt,
  removeRepairTarget,
  repairClarity,
  repairToRecord,
  resolveRepairTargets,
  target,
  targetMentions,
  targetSelector,
} from './report';
export type {
  Mention,
  RepairRecord,
  RepairReport,
  RepairReportOptions,
  RepairTarget,
} from './report';
export { RepairReportPanel } from './RepairReportPanel';
export type { RepairReportPanelProps } from './RepairReportPanel';
