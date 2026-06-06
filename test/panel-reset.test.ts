/* eslint-disable import-x/no-nodejs-modules */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_PANEL_RESET_SETTINGS,
  DEFAULT_SELECTED_PANEL_IDS,
  classifyPanelSource,
  getTopOverlapBoundary,
  renderPanelContent,
  normalizePanelIdentifier,
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
