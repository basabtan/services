/** Node shapes supported by the renderer. */
export type NodeShape = 'circle' | 'rect' | 'diamond' | 'pill';

/** Node size presets, mapped to pixel geometry by the renderer. */
export type NodeSize = 'sm' | 'md' | 'lg';

/** Optional detail payload rendered inside the dossier card. */
export interface NodeDetail {
  /** Small category line above the title. */
  eyebrow?: string;
  /** Card title. Defaults to the node label. */
  title?: string;
  /** Explanatory body text. */
  body?: string;
  /** Key/value rows rendered under the body. */
  meta?: Array<{ label: string; value: string }>;
}

/** A single entity rendered on the map. */
export interface MapNode {
  id: string;
  label: string;
  /** Optional subtitle rendered under the label. */
  secondaryLabel?: string;
  /** Group id; must exist in `groups` when provided. */
  groupId?: string;
  /** Fixed canvas x position. */
  x: number;
  /** Fixed canvas y position. */
  y: number;
  shape?: NodeShape;
  size?: NodeSize;
  /** Free-form tags, searchable. */
  tags?: string[];
  detail?: NodeDetail;
}

/** A relationship between two nodes. */
export interface MapEdge {
  /** Stable id; derived from endpoints when omitted. */
  id?: string;
  source: string;
  target: string;
  /** Relationship kind, e.g. `feeds`, `monitors`. */
  type?: string;
  /** Optional label rendered on the edge. */
  label?: string;
  /** Renders an arrow marker from source to target. */
  directed?: boolean;
  /** Visual weight, 1-3. */
  weight?: number;
}

/** Visual grouping for nodes. */
export interface MapGroup {
  id: string;
  label: string;
  /** CSS color value or custom property reference. */
  color?: string;
}

export interface MapCanvas {
  width: number;
  height: number;
  minZoom?: number;
  maxZoom?: number;
}

export interface MapMeta {
  title?: string;
  subtitle?: string;
}

/** Declarative data contract. No domain logic lives in the engine. */
export interface RelationshipMapData {
  meta?: MapMeta;
  canvas?: MapCanvas;
  groups?: MapGroup[];
  nodes: MapNode[];
  edges: MapEdge[];
}

/** How related nodes are highlighted when a node is selected. */
export type HighlightMode = 'direct' | 'upstream' | 'downstream' | 'connected';

export type MapThemeName = 'dark' | 'light';

export interface RelationshipMapOptions {
  enableSearch?: boolean;
  enableDossier?: boolean;
  enablePan?: boolean;
  enableZoom?: boolean;
  enableKeyboard?: boolean;
  /** Disable all motion when the user prefers reduced motion. Default true. */
  respectReducedMotion?: boolean;
  /** Highlight scope for the selected node. Default `direct`. */
  edgeHighlightMode?: HighlightMode;
}

export interface RelationshipMapConfig {
  /** Selector or Element to mount into. */
  container: string | HTMLElement;
  data: RelationshipMapData;
  theme?: MapThemeName;
  options?: RelationshipMapOptions;
}

export interface SearchMatch {
  nodeId: string;
  /** Where the match was found: label, secondaryLabel, tag, or group. */
  field: 'label' | 'secondaryLabel' | 'tag' | 'group';
  score: number;
}

/** Public API returned by `createRelationshipMap`. */
export interface RelationshipMapApi {
  /** Select a node, highlight relationships, and open its dossier. */
  selectNode(nodeId: string): boolean;
  /** Clear selection and close the dossier. */
  clearSelection(): void;
  /** Center and zoom to a node without changing selection. */
  focusNode(nodeId: string): boolean;
  /** Run a query against the search index. */
  search(query: string): SearchMatch[];
  /** Reset pan/zoom to the fitted initial view. */
  resetViewport(): void;
  /** Switch between token themes. */
  setTheme(theme: MapThemeName): void;
  /** Remove listeners and mounted DOM. */
  destroy(): void;
}
