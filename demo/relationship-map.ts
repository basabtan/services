import { createRelationshipMap } from '../src/relationship-map';
import type { RelationshipMapApi, MapThemeName } from '../src/relationship-map';
import data from './groundwater-system-data.json';
import './relationship-map.css';
import '../src/relationship-map/relationship-map.css';

const app = document.getElementById('app') as HTMLElement;

const shell = document.createElement('div');
shell.className = 'demo-shell';

const header = document.createElement('header');
header.className = 'demo-header';
const heading = document.createElement('h1');
heading.textContent = data.meta.title;
const subtitle = document.createElement('p');
subtitle.textContent = data.meta.subtitle;
header.append(heading, subtitle);

const controls = document.createElement('div');
controls.className = 'demo-controls';
const themeButton = document.createElement('button');
themeButton.type = 'button';
themeButton.textContent = 'Toggle theme';
themeButton.setAttribute('aria-label', 'Toggle light and dark map theme');
let theme: MapThemeName = 'dark';
themeButton.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  map.setTheme(theme);
});
controls.append(themeButton);

const mapHost = document.createElement('div');
mapHost.id = 'map-root';
mapHost.setAttribute('aria-label', 'Interactive relationship map');

shell.append(header, controls, mapHost);
app.append(shell);

const map: RelationshipMapApi = createRelationshipMap({
  container: mapHost,
  data,
  theme: 'dark',
  options: {
    enableSearch: true,
    enableDossier: true,
    enablePan: true,
    enableZoom: true,
    enableKeyboard: true,
    edgeHighlightMode: 'direct',
  },
});
