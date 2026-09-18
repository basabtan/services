import type { MapThemeName } from './types';

/**
 * Default design tokens per theme, mirroring `relationship-map.css`.
 * Hosts can override any token on `.rm-host` (or a parent) instead of
 * passing values here; this map exists for tooling and documentation.
 */
export const DEFAULT_TOKENS: Record<MapThemeName, Record<string, string>> = {
  dark: {
    '--map-bg': '#0d1117',
    '--map-surface': '#161b26',
    '--map-text': '#e7ecf3',
    '--map-muted': '#98a2b3',
    '--map-node-fill': '#1c2333',
    '--map-node-stroke': '#8b95a7',
    '--map-node-selected': '#7aa2f7',
    '--map-node-dimmed': '#2a2f3a',
    '--map-edge': '#4a5568',
    '--map-edge-selected': '#7aa2f7',
    '--map-focus-ring': '#7aa2f7',
    '--map-dossier-bg': '#161b26',
    '--map-dossier-text': '#e7ecf3',
    '--map-group-a': '#7aa2f7',
    '--map-group-b': '#9ece6a',
    '--map-group-c': '#e0af68',
    '--map-group-d': '#f7768e',
    '--map-group-e': '#bb9af7',
    '--map-group-f': '#7dcfff',
  },
  light: {
    '--map-bg': '#f7f8fa',
    '--map-surface': '#ffffff',
    '--map-text': '#1f2430',
    '--map-muted': '#5c6675',
    '--map-node-fill': '#ffffff',
    '--map-node-stroke': '#667085',
    '--map-node-selected': '#1f6feb',
    '--map-node-dimmed': '#cfd4dc',
    '--map-edge': '#98a2b3',
    '--map-edge-selected': '#1f6feb',
    '--map-focus-ring': '#1f6feb',
    '--map-dossier-bg': '#ffffff',
    '--map-dossier-text': '#1f2430',
    '--map-group-a': '#1f6feb',
    '--map-group-b': '#2da44e',
    '--map-group-c': '#bf8700',
    '--map-group-d': '#cf222e',
    '--map-group-e': '#8250df',
    '--map-group-f': '#0969da',
  },
};

/** Apply default tokens for a theme onto an element. */
export function applyDefaultTokens(element: HTMLElement, theme: MapThemeName): void {
  for (const [token, value] of Object.entries(DEFAULT_TOKENS[theme])) {
    element.style.setProperty(token, value);
  }
}
