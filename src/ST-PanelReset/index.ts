type PanelSource = 'tavern' | 'extension';

type ResetOptions = {
	reset_position: boolean;
	reset_size: boolean;
};

type PanelResetSettings = ResetOptions & {
	selected_panel_ids: string[];
	reset_on_load: boolean;
	constrain_to_viewport: boolean;
	avoid_top_bar: boolean;
};

type PanelIdentity = {
	id: string;
	class_name: string;
};

type DetectedPanel = {
	id: string;
	label: string;
	source: PanelSource;
	source_label: string;
	trigger_label: string;
	is_open: boolean;
	element: HTMLElement;
	header: HTMLElement;
};

type RectLike = {
	left: number;
	right: number;
	top: number;
	bottom: number;
};

const ROOT_ID = 'st-panel-reset-root';
const OVERLAY_ID = 'st-panel-reset-overlay';
const STYLE_ID = 'st-panel-reset-style';
const SETTINGS_KEY = 'ST-PanelReset';
const EVENT_NAMESPACE = '.stPanelReset';

const POSITION_PROPERTIES = ['inset', 'left', 'top', 'right', 'bottom', 'margin', 'transform'];
const SIZE_PROPERTIES = ['width', 'height', 'min-width', 'min-height', 'max-width', 'max-height'];

export const DEFAULT_SELECTED_PANEL_IDS = new Set([
	'left-nav-panel',
	'WorldInfo',
	'right-nav-panel',
	'floatingPrompt',
	'cfgConfig',
	'logprobsViewer',
	'extensionSideBar',
	'sheld',
	'zoomed_avatar',
]);

export const DEFAULT_PANEL_RESET_SETTINGS: PanelResetSettings = {
	selected_panel_ids: [...DEFAULT_SELECTED_PANEL_IDS],
	reset_position: true,
	reset_size: true,
	reset_on_load: false,
	constrain_to_viewport: true,
	avoid_top_bar: true,
};

const KNOWN_PANEL_LABELS: Record<string, { label: string; trigger_label: string; source: PanelSource }> = {
	'left-nav-panel': { label: 'AI响应配置', trigger_label: '#leftNavDrawerIcon / fa-sliders', source: 'tavern' },
	WorldInfo: { label: '世界信息', trigger_label: '#WIDrawerIcon / fa-book-atlas', source: 'tavern' },
	'right-nav-panel': { label: '角色管理', trigger_label: '#rightNavDrawerIcon / fa-address-card', source: 'tavern' },
	floatingPrompt: { label: '作者备注', trigger_label: '查看作者备注按钮 / floatingPrompt', source: 'tavern' },
	cfgConfig: { label: 'CFG配置', trigger_label: 'CFG配置浮窗 / cfgConfig', source: 'tavern' },
	logprobsViewer: { label: '词符概率', trigger_label: '#option_toggle_logprobs / 词符概率', source: 'tavern' },
	extensionSideBar: { label: '扩展侧栏', trigger_label: '#extensionTopBarToggleSidebar / fa-box-archive', source: 'tavern' },
	sheld: { label: '聊天显示/操作面板', trigger_label: '#sheld / 包含 #chat 与 #form_sheld', source: 'tavern' },
	zoomed_avatar: { label: '头像放大层', trigger_label: '头像悬停放大', source: 'tavern' },
	'expression-holder': { label: '表情面板', trigger_label: '#expression-holder', source: 'extension' },
	'phone-panel': { label: '手机面板', trigger_label: '#phoneDrawerIcon / phone-panel', source: 'extension' },
};

export function normalizePanelIdentifier(panel: PanelIdentity): string {
	if (panel.id.trim() !== '') {
		return panel.id;
	}

	const class_names = panel.class_name.split(/\s+/).filter(Boolean);
	if (class_names.includes('zoomed_avatar')) {
		return 'zoomed_avatar';
	}

	return class_names.find(class_name => !['drawer-content', 'draggable', 'flexGap5'].includes(class_name)) ?? 'unknown-panel';
}

export function classifyPanelSource(panel_id: string): PanelSource {
	return KNOWN_PANEL_LABELS[panel_id]?.source ?? (DEFAULT_SELECTED_PANEL_IDS.has(panel_id) ? 'tavern' : 'extension');
}

export function shouldSelectPanelByDefault(panel_id: string): boolean {
	return DEFAULT_SELECTED_PANEL_IDS.has(panel_id);
}

function isBrowserScript(): boolean {
	return typeof window !== 'undefined' && typeof document !== 'undefined' && typeof $ !== 'undefined';
}

function getTavernWindow(): Window {
	try {
		return window.parent?.document ? window.parent : window;
	} catch {
		return window;
	}
}

function getTavernDocument(): Document {
	return getTavernWindow().document;
}

function readSettings(): PanelResetSettings {
	const defaults = DEFAULT_PANEL_RESET_SETTINGS;

	if (!isBrowserScript() || typeof getVariables !== 'function') {
		return defaults;
	}

	try {
		const variables = getVariables({ type: 'script' });
		const saved = variables[SETTINGS_KEY] as Partial<PanelResetSettings> | undefined;
		if (!saved || typeof saved !== 'object') {
			return defaults;
		}

		return {
			selected_panel_ids: Array.isArray(saved.selected_panel_ids)
				? saved.selected_panel_ids.filter((panel_id): panel_id is string => typeof panel_id === 'string')
				: defaults.selected_panel_ids,
			reset_position: typeof saved.reset_position === 'boolean' ? saved.reset_position : defaults.reset_position,
			reset_size: typeof saved.reset_size === 'boolean' ? saved.reset_size : defaults.reset_size,
			reset_on_load: typeof saved.reset_on_load === 'boolean' ? saved.reset_on_load : defaults.reset_on_load,
			constrain_to_viewport:
				typeof saved.constrain_to_viewport === 'boolean'
					? saved.constrain_to_viewport
					: typeof saved.keep_in_view === 'boolean'
						? saved.keep_in_view
						: defaults.constrain_to_viewport,
			avoid_top_bar:
				typeof saved.avoid_top_bar === 'boolean'
					? saved.avoid_top_bar
					: typeof saved.keep_in_view === 'boolean'
						? saved.keep_in_view
						: defaults.avoid_top_bar,
		};
	} catch (error) {
		console.warn('[ST-PanelReset] 读取设置失败, 使用默认设置', error);
		return defaults;
	}
}

function saveSettings(settings: PanelResetSettings): void {
	if (!isBrowserScript() || typeof getVariables !== 'function' || typeof replaceVariables !== 'function') {
		return;
	}

	try {
		const variables = getVariables({ type: 'script' });
		variables[SETTINGS_KEY] = settings;
		replaceVariables(variables, { type: 'script' });
	} catch (error) {
		console.warn('[ST-PanelReset] 保存设置失败', error);
	}
}

function getPanelElementFromHeader(header: HTMLElement): HTMLElement | null {
	const parent = header.parentElement as HTMLElement | null;
	if (!parent) {
		return null;
	}

	if (parent.classList.contains('panelControlBar')) {
		return (
			(parent.closest('.drawer-content') as HTMLElement | null) ??
			(parent.closest('.zoomed_avatar') as HTMLElement | null) ??
			(parent.closest('.draggable') as HTMLElement | null) ??
			(parent.parentElement as HTMLElement | null)
		);
	}

	if (parent.classList.contains('logprobs_panel_controls')) {
		return (
			(parent.closest('#logprobsViewer') as HTMLElement | null) ??
			(parent.closest('.drawer-content') as HTMLElement | null) ??
			(parent.parentElement?.parentElement as HTMLElement | null) ??
			parent
		);
	}

	return parent;
}

function isPanelOpen(panel: HTMLElement): boolean {
	const rect = panel.getBoundingClientRect();
	const style = (panel.ownerDocument.defaultView ?? getTavernWindow()).getComputedStyle(panel);

	return (
		style.display !== 'none' &&
		style.visibility !== 'hidden' &&
		rect.width > 0 &&
		rect.height > 0 &&
		!panel.classList.contains('closedDrawer') &&
		!panel.classList.contains('phone-panel-hidden')
	);
}

function getFallbackLabel(panel: HTMLElement, panel_id: string): string {
	if (panel_id !== 'unknown-panel') {
		return panel_id;
	}

	return panel.className.toString().split(/\s+/).filter(Boolean).slice(0, 2).join('.') || panel.tagName.toLowerCase();
}

function getInferredTriggerLabel(panel: HTMLElement, header: HTMLElement): string {
	const known = KNOWN_PANEL_LABELS[normalizePanelIdentifier({ id: panel.id, class_name: panel.className.toString() })];
	if (known) {
		return known.trigger_label;
	}

	const drawer_icon = panel.closest('.drawer')?.querySelector('.drawer-icon[title], .interactable[title]') as HTMLElement | null;
	const candidate = drawer_icon ?? (panel.parentElement?.querySelector('.interactable[title], button[title]') as HTMLElement | null);
	const title = candidate?.getAttribute('title')?.trim();
	if (title) {
		return `${title}${candidate?.id ? ` / #${candidate.id}` : ''}`;
	}

	return header.id ? `#${header.id}` : '动态发现的拖拽面板';
}

function scanPanels(): DetectedPanel[] {
	const seen = new Set<HTMLElement>();

	return Array.from(getTavernDocument().querySelectorAll<HTMLElement>('.drag-grabber'))
		.map(header => ({ header, panel: getPanelElementFromHeader(header) }))
		.filter((entry): entry is { header: HTMLElement; panel: HTMLElement } => entry.panel !== null)
		.filter(({ panel }) => {
			if (seen.has(panel)) {
				return false;
			}
			seen.add(panel);
			return true;
		})
		.map(({ header, panel }) => {
			const id = normalizePanelIdentifier({ id: panel.id, class_name: panel.className.toString() });
			const known = KNOWN_PANEL_LABELS[id];
			const source = classifyPanelSource(id);
			return {
				id,
				label: known?.label ?? getFallbackLabel(panel, id),
				source,
				source_label: source === 'tavern' ? '酒馆面板' : '扩展/未识别面板',
				trigger_label: known?.trigger_label ?? getInferredTriggerLabel(panel, header),
				is_open: isPanelOpen(panel),
				element: panel,
				header,
			};
		})
		.sort((lhs, rhs) => Number(rhs.is_open) - Number(lhs.is_open) || lhs.source.localeCompare(rhs.source));
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function injectStyle(): void {
	$(`#${STYLE_ID}`).remove();
	$('<style>')
		.attr('id', STYLE_ID)
		.text(`
			#${OVERLAY_ID} { position: fixed; inset: 0; z-index: 12000; display: none; place-items: center; pointer-events: none; }
			#${OVERLAY_ID}.stpr-open { display: grid; }
			#${OVERLAY_ID} .stpr-panel { display: flex; flex-direction: column; width: min(620px, calc(100vw - 32px)); max-height: min(720px, calc(100vh - 48px)); overflow: hidden; padding: 12px; border: 1px solid var(--SmartThemeBorderColor, rgba(255,255,255,.22)); border-radius: 8px; background: var(--SmartThemeBlurTintColor, rgba(20,20,20,.94)); color: var(--SmartThemeBodyColor, inherit); box-shadow: 0 18px 48px rgba(0,0,0,.42); pointer-events: auto; }
			#${OVERLAY_ID} .stpr-title { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; font-weight: 700; }
			#${OVERLAY_ID} .stpr-title-actions { display: flex; align-items: center; gap: 6px; }
			#${OVERLAY_ID} .stpr-close { min-width: 28px; }
			#${OVERLAY_ID} .stpr-actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0 10px; }
			#${OVERLAY_ID} .stpr-list-scroll { min-height: 0; overflow: auto; padding-right: 2px; }
			#${OVERLAY_ID} .stpr-section { margin-top: 8px; }
			#${OVERLAY_ID} .stpr-section-title { margin: 0 0 5px; font-size: 12px; font-weight: 700; opacity: .86; }
			#${OVERLAY_ID} .stpr-list { display: grid; gap: 4px; }
			#${OVERLAY_ID} .stpr-item { display: grid; grid-template-columns: auto 1fr; gap: 7px; align-items: start; padding: 6px; border: 1px solid rgba(128,128,128,.28); border-radius: 6px; }
			#${OVERLAY_ID} .stpr-item-main { min-width: 0; }
			#${OVERLAY_ID} .stpr-item-label { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; font-weight: 600; }
			#${OVERLAY_ID} .stpr-badge { padding: 1px 5px; border-radius: 999px; border: 1px solid rgba(128,128,128,.34); font-size: 11px; opacity: .86; }
			#${OVERLAY_ID} .stpr-meta { margin-top: 2px; font-size: 11px; opacity: .72; overflow-wrap: anywhere; }
			#${OVERLAY_ID} .stpr-options { display: grid; gap: 5px; }
			#${OVERLAY_ID} .stpr-option { display: flex; gap: 7px; align-items: center; }
			#${OVERLAY_ID} .stpr-empty { padding: 8px; opacity: .72; font-size: 12px; }
			#${OVERLAY_ID} .stpr-status { margin-top: 8px; font-size: 12px; opacity: .8; min-height: 16px; }
		`)
		.appendTo('head');
}

function renderPanelList(panels: DetectedPanel[], settings: PanelResetSettings): string {
	const selected_panel_ids = new Set(settings.selected_panel_ids);
	const renderGroup = (title: string, group_panels: DetectedPanel[]) => `
		<div class="stpr-section">
			<div class="stpr-section-title">${escapeHtml(title)}</div>
			<div class="stpr-list">
				${
					group_panels.length === 0
						? '<div class="stpr-empty">没有发现对应面板</div>'
						: group_panels
								.map(
									panel => `
										<label class="stpr-item">
											<input type="checkbox" data-stpr-panel-id="${escapeHtml(panel.id)}" ${selected_panel_ids.has(panel.id) ? 'checked' : ''}>
											<span class="stpr-item-main">
												<span class="stpr-item-label">
													<span>${escapeHtml(panel.label)}</span>
													<span class="stpr-badge">${panel.is_open ? '打开' : '隐藏'}</span>
													<span class="stpr-badge">${escapeHtml(panel.id)}</span>
												</span>
												<span class="stpr-meta">触发入口: ${escapeHtml(panel.trigger_label)}</span>
											</span>
										</label>
									`,
								)
								.join('')
				}
			</div>
		</div>
	`;

	return [
		renderGroup('酒馆原生', panels.filter(panel => panel.source === 'tavern')),
		renderGroup('扩展', panels.filter(panel => panel.source === 'extension')),
	].join('');
}

export function renderPanelContent(panels: DetectedPanel[], settings: PanelResetSettings): string {
	const selected_count = panels.filter(panel => settings.selected_panel_ids.includes(panel.id)).length;

	return `
		<div class="stpr-title">
			<span>酒馆面板重置</span>
			<span class="stpr-title-actions">
				<button type="button" class="menu_button interactable" data-stpr-action="refresh">刷新列表</button>
				<button type="button" class="menu_button interactable stpr-close" data-stpr-action="close" aria-label="关闭">X</button>
			</span>
		</div>
		<div class="stpr-actions">
			<button type="button" class="menu_button interactable" data-stpr-action="reset">执行重置</button>
		</div>
		<div class="stpr-options">
			<label class="stpr-option"><input type="checkbox" data-stpr-setting="reset_position" ${settings.reset_position ? 'checked' : ''}>复原位置</label>
			<label class="stpr-option"><input type="checkbox" data-stpr-setting="reset_size" ${settings.reset_size ? 'checked' : ''}>复原大小</label>
			<label class="stpr-option"><input type="checkbox" data-stpr-setting="reset_on_load" ${settings.reset_on_load ? 'checked' : ''}>刷新时自动重置</label>
			<label class="stpr-option"><input type="checkbox" data-stpr-setting="constrain_to_viewport" ${settings.constrain_to_viewport ? 'checked' : ''}>强制面板不超出屏幕</label>
			<label class="stpr-option"><input type="checkbox" data-stpr-setting="avoid_top_bar" ${settings.avoid_top_bar ? 'checked' : ''}>不被顶栏遮挡</label>
		</div>
		<div class="stpr-list-scroll">
			${renderPanelList(panels, settings)}
		</div>
		<div class="stpr-status">发现 ${panels.length} 个可拖拽面板，当前选择 ${selected_count} 个。</div>
	`;
}

function renderPanel($panel: JQuery<HTMLElement>): void {
	$panel.html(renderPanelContent(scanPanels(), readSettings()));
}

function updateSetting(setting_name: keyof Omit<PanelResetSettings, 'selected_panel_ids'>, value: boolean): void {
	saveSettings({ ...readSettings(), [setting_name]: value });
}

function updateSelectedPanels($panel: JQuery<HTMLElement>): void {
	const selected_panel_ids = $panel
		.find<HTMLInputElement>('input[data-stpr-panel-id]:checked')
		.map((_, element) => $(element).attr('data-stpr-panel-id') ?? '')
		.get()
		.filter(Boolean);

	saveSettings({ ...readSettings(), selected_panel_ids });
	$panel.find('.stpr-status').text(`已选择 ${selected_panel_ids.length} 个面板。`);
}

function resetPanel(panel: HTMLElement, options: ResetOptions): void {
	const properties = [
		...(options.reset_position ? POSITION_PROPERTIES : []),
		...(options.reset_size ? SIZE_PROPERTIES : []),
	];

	properties.forEach(property => panel.style.removeProperty(property));
}

function rectsOverlapHorizontally(lhs: RectLike, rhs: RectLike): boolean {
	return lhs.left < rhs.right && rhs.left < lhs.right;
}

export function getTopOverlapBoundary(panel_rect: RectLike, top_bar_rects: RectLike[], fallback_top: number): number {
	const bottom = top_bar_rects
		.filter(rect => rect.bottom > 0 && rect.bottom < 120 && rectsOverlapHorizontally(panel_rect, rect))
		.reduce((max_bottom, rect) => Math.max(max_bottom, rect.bottom), fallback_top);

	return Math.ceil(bottom);
}

function getTopBarControlRects(): RectLike[] {
	return Array.from(
		getTavernDocument().querySelectorAll<HTMLElement>(
			'#top-settings-holder .drawer-icon, #top-settings-holder .interactable, #top-settings-holder button, #top-settings-holder [role="button"]',
		),
	)
		.map(element => element.getBoundingClientRect())
		.filter(rect => rect.width > 0 && rect.height > 0)
		.map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }));
}

function constrainPanelToViewport(panel: HTMLElement): void {
	if (!isPanelOpen(panel)) {
		return;
	}

	const padding = 8;
	const tavern_window = getTavernWindow();
	const settings = readSettings();
	const initial_rect = panel.getBoundingClientRect();
	const top_bar_bottom = settings.avoid_top_bar ? getTopOverlapBoundary(initial_rect, getTopBarControlRects(), 0) : 0;
	const viewport_top_boundary = settings.constrain_to_viewport ? padding : Number.NEGATIVE_INFINITY;
	const top_bar_boundary = top_bar_bottom > 0 ? top_bar_bottom + padding : Number.NEGATIVE_INFINITY;
	const top_boundary = Math.max(viewport_top_boundary, top_bar_boundary);
	const max_width = Math.max(160, tavern_window.innerWidth - padding * 2);
	const max_height = Math.max(120, tavern_window.innerHeight - top_boundary - padding);
	let rect = panel.getBoundingClientRect();

	if (settings.constrain_to_viewport && rect.width > max_width) {
		panel.style.setProperty('width', `${max_width}px`);
	}
	if ((settings.constrain_to_viewport || settings.avoid_top_bar) && rect.height > max_height) {
		panel.style.setProperty('height', `${max_height}px`);
	}

	rect = panel.getBoundingClientRect();
	const left = settings.constrain_to_viewport
		? Math.min(Math.max(rect.left, padding), Math.max(padding, tavern_window.innerWidth - rect.width - padding))
		: rect.left;
	const top = settings.constrain_to_viewport
		? Math.min(
				Math.max(rect.top, top_boundary),
				Math.max(top_boundary, tavern_window.innerHeight - rect.height - padding),
			)
		: top_bar_bottom > 0
			? Math.max(rect.top, top_bar_boundary)
			: rect.top;

	if (Math.round(left) !== Math.round(rect.left) || Math.round(top) !== Math.round(rect.top)) {
		panel.style.removeProperty('right');
		panel.style.removeProperty('bottom');
		panel.style.removeProperty('inset');
		panel.style.setProperty('left', `${Math.round(left)}px`);
		panel.style.setProperty('top', `${Math.round(top)}px`);
		panel.style.setProperty('margin', 'unset');
	}
}

function getSelectedDetectedPanels(settings = readSettings()): DetectedPanel[] {
	const selected_panel_ids = new Set(settings.selected_panel_ids);
	return scanPanels().filter(panel => selected_panel_ids.has(panel.id));
}

function resetSelectedPanels(settings = readSettings(), silent = false): number {
	const selected_panels = getSelectedDetectedPanels(settings);
	selected_panels.forEach(panel => {
		resetPanel(panel.element, settings);
		if (settings.constrain_to_viewport || settings.avoid_top_bar) {
			constrainPanelToViewport(panel.element);
		}
	});

	if (!silent) {
		toastr.info(`已处理 ${selected_panels.length} 个面板`, 'ST-PanelReset');
	}

	return selected_panels.length;
}

function constrainSelectedPanels(): void {
	const settings = readSettings();
	if (!settings.constrain_to_viewport && !settings.avoid_top_bar) {
		return;
	}

	getSelectedDetectedPanels(settings).forEach(panel => constrainPanelToViewport(panel.element));
}

function bindUi($root: JQuery<HTMLElement>, $overlay: JQuery<HTMLElement>, $panel: JQuery<HTMLElement>): void {
	const $event_host = $root.add($overlay);

	$event_host.off(EVENT_NAMESPACE);
	$event_host.on(`click${EVENT_NAMESPACE}`, '[data-stpr-action="toggle"]', () => {
		$overlay.toggleClass('stpr-open');
		if ($overlay.hasClass('stpr-open')) {
			renderPanel($panel);
		}
	});
	$event_host.on(`click${EVENT_NAMESPACE}`, '[data-stpr-action="refresh"]', () => renderPanel($panel));
	$event_host.on(`click${EVENT_NAMESPACE}`, '[data-stpr-action="close"]', () => $overlay.removeClass('stpr-open'));
	$event_host.on(`click${EVENT_NAMESPACE}`, '[data-stpr-action="reset"]', () => {
		updateSelectedPanels($panel);
		const count = resetSelectedPanels();
		$panel.find('.stpr-status').text(`已处理 ${count} 个面板。`);
	});
	$event_host.on(`change${EVENT_NAMESPACE}`, '[data-stpr-setting]', event => {
		const input = event.currentTarget as HTMLInputElement;
		updateSetting(input.dataset.stprSetting as keyof Omit<PanelResetSettings, 'selected_panel_ids'>, input.checked);
		if (input.dataset.stprSetting === 'constrain_to_viewport' || input.dataset.stprSetting === 'avoid_top_bar') {
			constrainSelectedPanels();
		}
	});
	$event_host.on(`change${EVENT_NAMESPACE}`, '[data-stpr-panel-id]', () => {
		updateSelectedPanels($panel);
		constrainSelectedPanels();
	});
}

function bindViewportGuard(): void {
	const tavern_document = getTavernDocument();
	const tavern_window = getTavernWindow();

	$(tavern_document).off(EVENT_NAMESPACE);
	$(tavern_window).off(EVENT_NAMESPACE);

	const scheduleConstrain = _.debounce(constrainSelectedPanels, 50);
	$(tavern_document).on(
		`mouseup${EVENT_NAMESPACE} touchend${EVENT_NAMESPACE} pointerup${EVENT_NAMESPACE}`,
		scheduleConstrain,
	);
	$(tavern_window).on(`resize${EVENT_NAMESPACE}`, scheduleConstrain);
}

function mountMenu(): void {
	const $menu = $('#extensionsMenu');
	if ($menu.length === 0) {
		console.warn('[ST-PanelReset] 未找到 #extensionsMenu, 无法挂载菜单入口');
		return;
	}

	$(`#${ROOT_ID}`).remove();
	$(`#${OVERLAY_ID}`).remove();
	const $root = $(
		`<div id="${ROOT_ID}">
			<div class="list-group-item flex-container flexGap5 interactable" tabindex="0" role="listitem" data-stpr-action="toggle"><span class="fa-solid fa-window-restore"></span><span>酒馆面板重置</span></div>
		</div>`,
	).appendTo($menu) as JQuery<HTMLElement>;
	const $overlay = $(`<div id="${OVERLAY_ID}"><div class="stpr-panel"></div></div>`).appendTo('body') as JQuery<HTMLElement>;
	const $content_panel = $overlay.find<HTMLElement>('.stpr-panel');

	bindUi($root, $overlay, $content_panel);
}

function init(): void {
	injectStyle();
	mountMenu();
	bindViewportGuard();

	const settings = readSettings();
	if (settings.reset_on_load) {
		[100, 1000, 2500].forEach(delay => window.setTimeout(() => resetSelectedPanels(readSettings(), true), delay));
	}
	if (settings.constrain_to_viewport || settings.avoid_top_bar) {
		window.setTimeout(constrainSelectedPanels, 1000);
	}

	$(window).on(`pagehide${EVENT_NAMESPACE}`, () => {
		$(`#${ROOT_ID}`).remove();
		$(`#${OVERLAY_ID}`).remove();
		$(`#${STYLE_ID}`).remove();
		$(getTavernDocument()).off(EVENT_NAMESPACE);
		$(getTavernWindow()).off(EVENT_NAMESPACE);
		$(window).off(EVENT_NAMESPACE);
	});
}

if (isBrowserScript()) {
	$(() => {
		const run = typeof errorCatched === 'function' ? errorCatched(init) : init;
		run();
	});
}
