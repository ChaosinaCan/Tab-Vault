
var ui = new function UI() {
	this.properties = null;
	/**
	 * Reference to extension button
	 */
	this.button = null;
	/**
	 * Reference to ui.button.badge
	 */
	this.badge = null;
	/**
	 * Reference to ui.button.popup
	 */
	this.popup = null;
	
	/**
	 * Properties for badge notifications
	 */
	this.notification = {
		length: 3000,
		timer: null,
	}
	
	/**
	 * Creates the extension button and initializes the popup
	 */
	this.init = function() {
		
		ui.properties = {
			disabled: false,
			title: 'Tab Vault',
			icon: ui.getIcon(),
			onclick: this.onButtonClicked,
			badge: {
				display: 'none',
				textContent: '0',
			},
			popup: {
				href: 'window/index.html',
				width: 250,
				height: 300,
			}
		}
		
		ui.button = opera.contexts.toolbar.createItem(ui.properties);
		opera.contexts.toolbar.addItem(ui.button);
		
		ui.badge = ui.button.badge;
		ui.popup = ui.button.popup;
		
		ui.updateBadgeColors();
		ui.updateBadge();
		ui.updateIcon();
		ui.updatePopupWidth();
	}
	

	
	/**
	 * Updates the colors of the button's badge
	 */
	this.updateBadgeColors = function() {
		colorutils.getIndicatorColors(ui.badge);
	}
	
	
	/**
	 * Updates the number of tabs shown on the extension button
	 */
	this.updateBadge = function(plusone) {
		var text = storage.tabs.getTotalCount();
		if (settings.show_badge && text > 0) {
			// handle +1 notification for saving tabs
			if (plusone) {
				text = (text - 1) + '+1';
				if (ui.notification.timer)
					clearTimeout(ui.notification.timer);
				ui.notification.timer = setTimeout(ui.updateBadge, ui.notification.length);
			}
			
			// set badge text
			ui.badge.display = 'block';
			ui.badge.textContent = text;
		}
		else 
			ui.badge.display = 'none';
	}
	
	/**
	 * Returns the path to the extension button icon
	 */
	this.getIcon = function() {
		if (settings.featherweight_icon)
			return 'img/icon_18b.png';
		else
			return 'img/icon_18.png';
	}
	
	/**
	 * Updates the extension button icon
	 */
	this.updateIcon = function() {
		ui.button.icon = ui.getIcon();
	}
	
	/**
	 * Displays "err" in the button badge
	 */
	this.externalSaveError = function() {
		ui.badge.display = 'block';
		ui.badge.textContent = 'err';
		if (ui.notification.timer)
			clearTimeout(ui.notification.timer);
		ui.notification.timer = setTimeout(updateBadge, ui.notification.length);
	}
	
	
	/**
	 * Resizes the popup to fit its contents
	 * @param page The page to update for. One of "tabs", "trash"
	 * @param size Overrides the calculation of the # of tabs to account for
	 */
	this.resizePopup = function(page, size) {
		var numTabs = size || 0;
		var minTabs = 6;
		var tabHeight = 26;
		var padding = 48;
		
		// if no size given, calculate assuming all groups are collapsed
		if (!size) {
			if (page == 'tabs') 
				numTabs = storage.tabs.count;
			else if (page == 'trash') {
				numTabs = storage.trash.count;
				padding += 28;
			}
			else
				numTabs = Math.max(storage.tabs.count, storage.trash.count);
		}
		
		// resize the popup
		numTabs = (numTabs < minTabs) ? minTabs : numTabs;
		var height = padding + (numTabs + 1) * tabHeight
		ui.popup.height = settings.limit_height ? Math.min(height, settings.max_height) : height; 
	}
	
	/**
	 * Updates the width of the popup using the user's preference and the 
	 * locale's minimum width.
	 */
	this.updatePopupWidth = function() {
		ui.popup.width = Math.max(localesettings.PopupWidth, settings.popup_width);
	}
	
	
	/**
	 * Shows an indicator that a tab is being dragged over the current page
	 */
	this.showDropMessage = function(title, group, list) {
		var focused = tabs.focused();
		if (focused) {
			if (group)
				title += ' ' + utils.formatNumber(localesettings.TabCount, list);
			
			focused.postMessage({ 
				action: 'show', 
				title: title,
				msg: group ? localesettings.DropToOpenGroup : localesettings.DropToOpen,
				anim: !settings.disable_animation,
				right: ui.popup.width,
			});
		}
	}
	
	/**
	 * Hides the indicator
	 */
	this.hideDropMessage = function() {
		var focused = tabs.focused();
		if (focused)
			focused.postMessage({action: 'hide'});
	}
	
	
	/**
	 * Occurs when the extension button is clicked
	 */
	this.onButtonClicked = function() {
		ui.resizePopup('tabs');	
	}
	
	this.onRecount = function() {
		// Update count on badge
		setTimeout(ui.updateBadge, 200);
	}
	
	var resizeTimeout = null;
	this.onResize = function(e) {
		
		function doResize() {
			ui.resizePopup(e.data.page, e.data.size);
			e.source.postMessage({ action: 'resize_done' });
			resizeTimeout = null;
		}
		// If timeout is already going, cancel it
		if (resizeTimeout)
			clearTimeout(resizeTimeout);

		if (e.data.delay)
			resizeTimeout = setTimeout(doResize, e.data.delay);
		else
			doResize();
	}
	
	
	this.onEnterPage = function(e) {
		ui.showDropMessage(e.data.title, e.data.group, e.data.tabs);
	}
	
}





var tabs = new function Tabs() {

	this.sendTab = function(source, tab) {
		if (tab)
			source.postMessage({
				action: 'get_tab',
				url: tab.url,
				title: tab.title,
				icon: tab.faviconUrl	
			});
		else
			tabs.sendGetError(source);
	}
	
	this.sendGroup = function(source, list, title) {
		if (list && list.length > 0)
			source.postMessage({
				action: 'get_group',
				title: title || list[0].title,
				tabs: list 
			});
		else
			tabs.sendGetError(source);
	}
	
	this.sendGetError = function(source) {
		source.postMessage({action: 'get_error'});
	}

	this.sendOpenError = function(source) {
		source.postMessage({action: 'open_error'});
	}
	
	this.open = function(url, focused) {
		return opera.extension.tabs.create({
			url: url,
			focused: focused || false
		});
	}
	
	this.close = function(tab) {
		if (tab)
			tab.close();
	}
	
	this.update = function(tab, params) {
		if (tab)
			tab.update(params);
	}
	
	this.openGroup = function(list, focused) {
		//TODO: implement this
	}
	
	
	
	this.focused = function() {
		return opera.extension.tabs.getFocused();
		
	}
	
	this.inGroup = function(group) {
		return [];
	}
	
	this.all = function() {
		// Gets all tabs
		var list = [];
		var windows = opera.extension.windows.getAll();
		
		for (var i = 0; i < windows.length; i++)
			list = list.concat(tabs.inWindow(windows[i]));
		
		return list;
	}
	
	this.inWindow = function(window) {
		return window.tabs.getAll ? window.tabs.getAll() : window.tabs;
	}
	
	this.inDomain = function(domain) {
		
		return this.all().filter(function(elem) {
			return utils.getDomain(elem.url) == domain;
		});
	}
	
	
	this.onGetTab = function(e) {
		tabs.sendTab(e.source, tabs.focused());
	}
	
	this.onGetGroup = function(e) {
		var focused = tabs.focused();
		if (!focused || !focused.tabGroup)
			tabs.sendGetError(e.source);
		
		tabs.sendGroup(e.source, tabs.inGroup(focused.tabGroup));
	}
	
	this.onGetAll = function(e) {
		tabs.sendGroup(e.source, tabs.all());
	}
	
	this.onGetWindow = function(e) {
		var focused = opera.extension.windows.getFocused();
		if (!focused)
			tabs.sendGetError(e.source);
		
		tabs.sendGroup(e.source, tabs.inWindow(focused));
	}
	
	this.onGetDomain = function(e) {
		var focused = tabs.focused();
		if (!focused)
			tabs.sendGetError(e.source);
		
		var domain = utils.getDomain(focused.url);
		tabs.sendGroup(e.source, tabs.inDomain(domain));
	}
	
	this.onOpenTab = function(e) {
		tabs.open(e.data.url, e.data.focused);
	}
	
	this.onOpenGroup = function(e) {
		tabs.openGroup(e.data.tabs, e.data.focused);
	}
	
	this.onCloseTab = function(e) {
		tabs.close(tabs.focused());
	}
	
	this.onChangeTab = function(e) {
		var focused = tabs.focused();
		if (focused) {
			tabs.update(focused, {url: e.data.url});
			if (settings.close_on_pageopen);
				e.source.postMessage({ action: 'close' });
			e.source.postMessage({ action: 'open_success', url: e.data.url });
		}
		else
			tabs.sendOpenError(source);
	}
}


var utils = function Utils() {
	
	this.getDomain = function(url) {
		return url.match(/:\/\/(www\.)?(.[^/:]+)/)[2];
	}
	
	this.checkPassword = function(pass) {
		var actual = settings.password;
		return actual && pass == actual
	}
	
	
	this.formatNumber = function(text, value) {
		var parts = text.split('|');
		
		var i = Math.min(parts.length - 1, Math.floor(value));
		
		if (Math.floor(value) != value)
			i = parts.length - 1;
		
		return parts[i].replace('%s', value);
	}


	
}

var tabutils = new function TabUtils() {
	
	this.toAdr = function(list) {
		list = list || storage.tabs.getAll();
		return session.writeAdr(list);
	}
	
	this.toSession = function(list) {
		list = list || storage.tabs.getAll();
		return session.write(list, {
			x: screen.width * 0.1,
			y: screen.height * 0.1,
			width: screen.width * 0.75,
			height: screen.height * 0.75,
		});
	}
	
	/**
	 * Reloads the favicon url of an already saved tab
	 */
	this.reloadFavicon = function(index, group, callback) {
		var tab = storage.tabs.get(index, group);
		tabutils.getFavicon(tab, function(data) {
			storage.tabs.set(index, data, group);
			if (callback)
				callback(data);
		});
	}
	
	/**
	 * Gets the favicon url of a page by opening it, checking until it loads the favicon, then closing it
	 */ 
	this.getFavicon = function(tabObj, callback) {
		var polling = {
			interval: 100,
			maxTries: 15000 / 100,
		}
		
		var tab = tabs.open(tabObj.url, false);
		var tries = 0;
		
		var check = function() {
			//debug('checking: try ' + tries);
			if (tab.faviconUrl) {
				tab.close();
				tabObj.icon = tab.faviconUrl;
				callback(tabObj);
			}
			else {
				tries++;
				if (tries < polling.maxTries)
					setTimeout(check, polling.interval);
				else {
					tab.close();
					tabObj.icon = null;
					callback(tabObj);
					console.log('Tab Vault: Timeout getting favicon for "' + tabObj.url + '"');
				}
			}
		}
		check();
	}
	
	/**
	 * Gets the favicon urls of a series of already saved tabs using reloadFavicon()
	 * @param indices An array of tab indices in the format { index: #, group: # } 
	 */
	this.getFavicons = function(indices, callback) {
		
		var i = -1;
		function getNext() {
			i++;
			if (i < indices.length) {
				tabutils.reloadFavicon(indices[i].index, indices[i].group, getNext);
			}
			else if (callback) {
				callback();
			}
		}
		getNext();
	}
	
	
	this.importTabs = function(fileText, callback, onerror) {
		if (!sessionInit(recall(this, arguments)))
			return;
		
		var list = session.read(fileText);
		try {
			var added = storage.tabs.importTabs(list);
			ui.updateBadge();
			tabutils.getFavicons(added, callback)
		} catch (ex) {
			console.error(ex.toString(), ex);
			if (onerror)
				onerror(ex);
		}
	}
	
	this.exportTabs = function(format, focused, list) {
		if (!sessionInit(recall(this, arguments)))
			return;
		
		var uri;
		if (format == 'adr')
			uri = tabutils.toAdr(list);
		else
			uri = tabutils.toSession(list);
		
		tabs.open(uri, focused || false);
	}
	
	
	this.onReloadIcon = function(e) {
		tabutils.reloadFavicon(e.data.index, e.data.group, function(data) {
			e.source.postMessage({
				action: 'reload_icon_done',
				index: e.data.index,
				group: e.data.group,
				icon: data.icon
			});
		})
	}
	
	this.onExport = function(e) {	
		tabutils.exportTabs(e.data.format, e.data.focused);
	}
	
	this.onImport = function(e) {
		tabutils.importTabs(e.data.session, function() {
			e.source.postMessage({ action: 'import_done' })
		}, function(ex) {
			console.log('Tab Vault: Error occurred while importing:\n' + ex.toString());
			e.source.postMessage({ action: 'import_error' });
		})
	}
	
	this.onExternalSave = function(e) {
		// Page asks to save itself or another page
		if (!utils.checkPassword(e.data.pass)) {
			opera.postError('Tab Vault: Cannot save page. Invalid password.');
			return;
		}
				
		// If no URL provided, get info from focused tab
		if (!e.data.url) {
			var tab = tabs.focused();
			if (tab) {
				e.data.url = tab.url;
				e.data.title = tab.title;
				// Don't know why, but this fails when called from a button or shortcut
				e.data.icon = tab.faviconUrl;
			}
			else {
				ui.externalSaveError();
				return;
			}
		}

		storage.tabs.add({
			url: e.data.url,
			title: e.data.title,
			icon: e.data.icon,
		});

		if (settings.save_to_top) 
			storage.tabs.move(storage.tabs.count - 1, 0);

		ui.updateBadge(true);

		if (e.data.close)
			tab.close();
	}
	
	this.onReloadIcon = function(e) {
		tabutils.reloadFavicon(e.data.index, e.data.group, function(data) {
			// Popup may be closed now (probably is since Opera likes closing it
			// for no good reason) so ignore any errors this generates
			try {
				e.source.postMessage({
					action: 'reload_icon_done',
					index: index,
					group: group,
					icon: data.icon
				});
			} catch (ex) {}
		});
	}
}

var colorutils = new function ColorUtils() {
	
	/**
	 * Gets the indicator colors from settings
	 */
	this.getIndicatorColors = function(data) {
		data = data || {};
		var alphaScale = 0.5;
		data.backgroundColor = colorutils.rgba(
			settings.bkg_color, 
			settings.bkg_alpha * alphaScale);
		data.color = colorutils.rgba(
			settings.text_color, 
			settings.text_alpha * alphaScale);
		return data;
	}
	
	/**
	 * Mixes an rgb color with an opacity and returns it in rgba() form
	 */
	this.rgba = function(color, opacity) {
		var a = parseInt(opacity) / 256;
		
		var match = color.match(/^#?([0-9a-f]{1,2})([0-9a-f]{1,2})([0-9a-f]{1,2})$/);
		if (!match)
			return 'rgba(0,0,0,' + a + ')';
		
		var r,g,b;
		r = parseInt(match[1], 16);
		g = parseInt(match[2], 16);
		b = parseInt(match[3], 16);
		
		return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
	}
}





function init() {
	storage.settings.init();
	
	loadLocale();
	
	ui.init();
}



var messageHandlers = {
	get_tab: tabs.onGetTab,
	get_group: tabs.onGetGroup,
	get_all: tabs.onGetAll,
	get_window: tabs.onGetWindow,
	get_domain: tabs.onGetDomain,
	
	open_tab: tabs.onOpenTab,
	open_group: tabs.onOpenGroup,
	close_tab: tabs.onCloseTab,
	change_tab: tabs.onChangeTab,
	
	recount: ui.onRecount,
	resize: ui.onResize,
	reload_icon: tabutils.onReloadIcon,
	
	enter_page: ui.onEnterPage,
	leave_page: ui.hideDropMessage,
	
	'export': tabutils.onExport,
	'import': tabutils.onImport,
	external_save: tabutils.onExternalSave,
}


window.addEventListener('load', checkVersion, false);
window.addEventListener('load', init, false);

opera.extension.tabs.onfocus = ui.hideDropMessage;
opera.extension.onmessage = function(e) {
	var handler = messageHandlers[e.data.action];
	if (handler)
		messageHandlers[e.data.action](e);
	else 
		console.log('Tab Vault: Unknown action "' + e.data.action + '"');
}


	
	
/**
* Checks for upgrading from version 1.x to 2
*/
function checkVersion() {
	var version = settings.get('version');
	var initialized = settings.get('initialized');

	if (initialized) {
		if (!version || version < 2) {
			// Attempt upgrade here
			debug('Tab Vault: Upgrading settings');
			tabs.open('upgrade.html', true);
		}
	}
	else {
		settings.set('version', 2);
		tabs.open('help.html#first', true);
	}	
}


function resetAll() {
	widget.preferences.clear();
	opera.contexts.toolbar.removeItem(button);
	checkVersion();
	init();
}
	
	
	
function loadLocale() {
	var locale = settings.locale;
	if (locale == '') {
		var def = getLocaleDef(navigator.language);
		if (def !== null)
			locale = def.language;
	}

	if (locale) {
		var a = document.getElementsByTagName('script');
		for (var i = 0; i < a.length; i++) {
			if (a[i].src.indexOf('locale-misc.js') != -1) {
				a[i].parentNode.removeChild(a[i]);
			}
		}

		var s = document.createElement('script');
		s.src = 'locales/' + locale + '/locale-misc.js';
		document.head.appendChild(s);

		setTimeout(ui.updatePopupWidth, 500);
	}
}
	
	
var updateTimeout;

window.addEventListener('storage', function(e) {
	if (!e)
		return;

	var name = e.key.replace(/^st_/, '');

	switch (name) {
		case 'show_badge':
			ui.updateBadge();
			break;
		case 'locale':
			loadLocale();
			break;
		case 'bkg_color':
		case 'bkg_alpha':
		case 'text_color':
		case 'text_alpha':
			ui.updateBadgeColors();
			break;
		case 'featherweight_icon':
			ui.updateIcon();
			break;
		case 'popup_width':
			ui.updatePopupWidth();
			break;
	}

	// Check if the number of stored tabs changed
	// Wait a moment in case multiple changes occur at once
	if (name.match(/_count/)) {
		if (updateTimeout)
			clearTimeout(updateTimeout);
		updateTimeout = setTimeout(function() {
			ui.updateBadge();
			updateTimeout = null;
		}, 200);
	}

}, false);




var sessionScriptLoaded = false;
function sessionInit(callback) {
	if (sessionScriptLoaded)
		return true;
	
	var script = document.createElement('script');
	script.src = 'js/session.js';
	document.head.appendChild(script);
	sessionScriptLoaded = true;
	
	setTimeout(function() {
		if (callback)
			callback();
	}, 100)
	return false;
}

function recall(thisArg, args) {
	return Function.prototype.apply.apply.bind(args.callee, 
		thisArg, Array.prototype.slice.call(args, 0));
}
