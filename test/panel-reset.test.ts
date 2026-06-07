/* eslint-disable import-x/no-nodejs-modules */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  DEFAULT_PANEL_RESET_SETTINGS,
  DEFAULT_SELECTED_PANEL_IDS,
  classifyPanelSource,
  getLauncherStyle,
  getTopOverlapBoundary,
  renderLauncherButton,
  renderPanelContent,
  normalizePanelIdentifier,
  shouldUseLauncherToolbarCandidate,
  shouldSelectPanelByDefault,
} from '../src/ST-PanelReset/index.ts';

test('selects the agreed Tavern panels by default', () => {
  const expected = [
    'left-nav-panel',
    'WorldInfo',
    'right-nav-panel',
    'floatingPrompt',
    'cfgConfig',
    'logprobsViewer',
    'extensionSideBar',
    'sheld',
    'zoomed_avatar',
  ];

  assert.deepEqual([...DEFAULT_SELECTED_PANEL_IDS].sort(), [...expected].sort());
  expected.forEach(panel_id => assert.equal(shouldSelectPanelByDefault(panel_id), true));
});

test('leaves dynamically discovered extension panels unselected by default', () => {
  ['expression-holder', 'phone-panel', 'some-new-extension-panel'].forEach(panel_id => {
    assert.equal(classifyPanelSource(panel_id), 'extension');
    assert.equal(shouldSelectPanelByDefault(panel_id), false);
  });
});

test('normalizes panels without ids from useful class names', () => {
  assert.equal(normalizePanelIdentifier({ id: '', class_name: 'zoomed_avatar' }), 'zoomed_avatar');
});

test('keeps viewport and top bar guards as separate default options', () => {
  assert.equal(DEFAULT_PANEL_RESET_SETTINGS.constrain_to_viewport, true);
  assert.equal(DEFAULT_PANEL_RESET_SETTINGS.avoid_top_bar, true);
});

test('only avoids top bar controls that overlap the panel horizontally', () => {
  assert.equal(
    getTopOverlapBoundary(
      { left: 20, right: 120, top: 0, bottom: 60 },
      [{ left: 300, right: 360, top: 0, bottom: 31 }],
      8,
    ),
    8,
  );

  assert.equal(
    getTopOverlapBoundary(
      { left: 320, right: 420, top: 0, bottom: 60 },
      [{ left: 300, right: 360, top: 0, bottom: 31 }],
      8,
    ),
    31,
  );
});

test('renders fixed modal controls above a scroll-only panel list with close button', () => {
  const content = renderPanelContent([], DEFAULT_PANEL_RESET_SETTINGS);

  assert.match(content, /data-stpr-action="close"/);
  assert.match(content, /class="stpr-list-scroll"/);
  assert.ok(content.indexOf('data-stpr-action="reset"') < content.indexOf('class="stpr-list-scroll"'));
  assert.ok(content.indexOf('data-stpr-setting="avoid_top_bar"') < content.indexOf('class="stpr-list-scroll"'));
});

test('renders the bottom launcher as an icon-only control', () => {
  const launcher = renderLauncherButton();

  assert.match(launcher, /id="st-panel-reset-root"/);
  assert.match(launcher, /class="qr--button menu_button interactable stpr-launcher-button"/);
  assert.match(launcher, /data-stpr-action="toggle"/);
  assert.match(launcher, /fa-window-restore/);
  assert.match(launcher, /aria-label="酒馆面板重置"/);
  assert.doesNotMatch(launcher, />酒馆面板重置</);
});

test('hides the bottom launcher on narrow screens without leaving an interactive ghost', () => {
  const style = getLauncherStyle();

  assert.match(style, /@media \(max-width: 768px\)/);
  assert.match(style, /#st-panel-reset-root\s*\{[^}]*display: none !important;/s);
  assert.match(style, /#st-panel-reset-root\s*\{[^}]*pointer-events: none !important;/s);
  assert.match(style, /#st-panel-reset-root\s*\{[^}]*width: 0 !important;/s);
  assert.match(style, /#st-panel-reset-root\s*\{[^}]*height: 0 !important;/s);
});

test('keeps the launcher the same size and flow as the neighboring toolbar buttons', () => {
  const style = getLauncherStyle();

  assert.doesNotMatch(style, /#st-panel-reset-root\s*\{[^}]*width: 100%;/s);
  assert.doesNotMatch(style, /#st-panel-reset-root\s*\{[^}]*flex: 0 0 100%;/s);
  assert.doesNotMatch(style, /#st-panel-reset-root\s*\{[^}]*order: -1;/s);
  assert.match(style, /#st-panel-reset-root\s*\{[^}]*order: 11;/s);
  assert.doesNotMatch(style, /#st-panel-reset-root\s*\{[^}]*display: contents;/s);
  assert.doesNotMatch(style, /\.stpr-launcher-button\s*\{[^}]*(^|\s)width:/s);
  assert.doesNotMatch(style, /\.stpr-launcher-button\s*\{[^}]*(^|\s)height:/s);
  assert.doesNotMatch(style, /\.stpr-launcher-button\s*\{[^}]*(^|\s)min-width:/s);
});

test('only mounts the launcher into an existing toolbar row', () => {
  assert.equal(
    shouldUseLauncherToolbarCandidate({
      interactive_child_count: 3,
      interactive_descendant_count: 3,
      contains_textbox: false,
    }),
    true,
  );
  assert.equal(
    shouldUseLauncherToolbarCandidate({
      interactive_child_count: 0,
      interactive_descendant_count: 8,
      contains_textbox: false,
    }),
    true,
  );
  assert.equal(
    shouldUseLauncherToolbarCandidate({
      interactive_child_count: 1,
      interactive_descendant_count: 1,
      contains_textbox: false,
    }),
    false,
  );
  assert.equal(
    shouldUseLauncherToolbarCandidate({
      interactive_child_count: 8,
      interactive_descendant_count: 8,
      contains_textbox: true,
    }),
    false,
  );
});

test('scopes the message-button-manager anchor lookup to the input area', () => {
  const source = readFileSync(new URL('../src/ST-PanelReset/index.ts', import.meta.url), 'utf8');

  assert.match(source, /queryLauncherInputRoots\(input_roots, MESSAGE_BUTTON_MANAGER_SELECTOR\)/);
  assert.doesNotMatch(source, /tavern_document\.querySelector<HTMLElement>\(\s*MESSAGE_BUTTON_MANAGER_SELECTOR/);
});

test('keeps the lower send-button row as the last launcher fallback', () => {
  const source = readFileSync(new URL('../src/ST-PanelReset/index.ts', import.meta.url), 'utf8');
  const mountTargetSource = source.slice(
    source.indexOf('function getLauncherMountTarget()'),
    source.indexOf('function mountLauncher()'),
  );

  assert.ok(mountTargetSource.indexOf('const explicit_toolbar_selectors') < mountTargetSource.indexOf('const toolbar'));
  assert.ok(mountTargetSource.indexOf('const toolbar') < mountTargetSource.indexOf('const input_button_row'));
});

test('prefers the visible Luker input helper toolbar over hidden toolbar candidates', () => {
  const source = readFileSync(new URL('../src/ST-PanelReset/index.ts', import.meta.url), 'utf8');
  const mountTargetSource = source.slice(
    source.indexOf('function getLauncherMountTarget()'),
    source.indexOf('function mountLauncher()'),
  );

  assert.match(mountTargetSource, /#input_helper_toolbar/);
  assert.match(mountTargetSource, /#qr--bar/);
  assert.match(mountTargetSource, /isVisibleLauncherMountTarget\(candidate\)/);
});

test('remounts when a stale launcher root is recreated outside the input area', () => {
  const source = readFileSync(new URL('../src/ST-PanelReset/index.ts', import.meta.url), 'utf8');
  const observerSource = source.slice(source.indexOf('function bindLauncherMountObserver()'), source.indexOf('function init()'));

  assert.match(observerSource, /const existing_launcher = tavern_document\.getElementById\(ROOT_ID\);/);
  assert.match(observerSource, /!existing_launcher \|\| !isElementInLauncherInputArea\(existing_launcher\)/);
});
