// Load Pump logo from assets
fetch('assets/transparentlogo.svg')
	.then(response => response.text())
	.then(svg => {
		gid("mm").innerHTML = svg;
		// Subtle pulse animation on first visit
		if (!localStorage.getItem('lair_visited')) {
			localStorage.setItem('lair_visited', '1');
			const el = gid("mm");
			if (el) {
				el.style.animation = 'logoPulse 1.5s ease-in-out 2';
				el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
			}
		}
	})
	.catch(() => {
		// Fallback to inline SVG if transparentlogo.svg fails to load
		gid("mm").innerHTML = `<svg class="mmic" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="22.93098" height="43.31773" viewBox="0,0,22.93098,43.31773"><g transform="translate(-228.53451,-158.34114)"><g data-paper-data="{&quot;isPaintingLayer&quot;:true}" id='lairic' fill="#ffffff" fill-rule="nonzero" stroke="none" stroke-width="0" stroke-linecap="butt" stroke-linejoin="miter" stroke-miterlimit="10" stroke-dasharray="" stroke-dashoffset="0" style="mix-blend-mode: normal"><path d="M228.68924,195.01197l-0.15473,-36.67083l19.03116,29.04225l0.00895,-17.05191l3.55036,-5.02752l0.3405,36.35491c0,0 -18.13437,-29.80707 -18.13437,-29.23736c0,5.15736 -0.30946,16.4013 -0.30946,16.4013z"/></g></g></svg>`;
	});

var defaultAppIcon = `<?xml version="1.0" encoding="UTF-8"?> <svg version="1.1" viewBox="0 0 76.805 112.36" xmlns="http://www.w3.org/2000/svg"> <g transform="translate(-201.6 -123.82)"> <g stroke-dasharray="" stroke-miterlimit="10" style="mix-blend-mode:normal" data-paper-data='{"isPaintingLayer":true}'> <path d="m201.6 236.18v-111.56h49.097l27.707 31.512v80.051z" fill="#3f7ef6" stroke-width="NaN"/> <path d="m250.82 155.02 0.12178-31.202 27.301 31.982z" fill="#054fff" stroke-width="0"/> <path d="m216.73 180.4h46.531" fill="none" stroke="#9dbaff" stroke-linecap="round" stroke-width="7.5"/> <path d="m216.73 194.37h36.44" fill="none" stroke="#9dbaff" stroke-linecap="round" stroke-width="7.5"/> <path d="m216.73 207.78h42.046" fill="none" stroke="#9dbaff" stroke-linecap="round" stroke-width="7.5"/> </g> </g> </svg>`;

var globalmimeDb = null;

function updateNavSize() {
	navheight = parseFloat(getComputedStyle(gid("lairnav")).height);
	navheight = navheight + (0.3 * remToPx);
}

// more stuff
function isDark(hexColor) {
	// Remove '#' if present
	hexColor = hexColor.replace('#', '');

	// Convert hex to RGB
	var r = parseInt(hexColor.substring(0, 2), 16);
	var g = parseInt(hexColor.substring(2, 4), 16);
	var b = parseInt(hexColor.substring(4, 6), 16);

	// Calculate luminance
	var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

	// Return true if luminance is less than or equal to 0.5 (considered dark), false otherwise
	return luminance <= 0.5;
}

function terminal() {
	gid("terminal").showModal()
}

function cuteee() {
	let stylelement = document.createElement('style')
	stylelement.innerHTML = `.windowheader {
	background:: #121212;
	backdrop-filter: blur(5px) brightness(0.5);
	position: absolute;
	padding: 0.3rem 0.8rem;
	border-radius: 0px 0 0 15px;
	padding-bottom: 0.2rem;
	padding-right: 0.3rem;
	right: 0;
	cursor: drag;
	}
	
	.windowcontent iframe {
    border: none;
    width: 100%;
    height: calc(100% - 0px);
}

.windowcontent {
	box-sizing: border-box;
	height: calc(100% - 0px);
}
`
	document.body.appendChild(stylelement)
}

async function checkAndRunFromURL() {
	const params = new URLSearchParams(window.location.search);

	const run = params.get('run');
	const viewapp = params.get('view');

	if (viewapp) {
		onstartup.push(async () => {
			useHandler("content_store", { 'opener': 'viewapp', 'data': viewapp })
		});
	}

	if (run === 'erdbsfull') {
		let x = await justConfirm("Reset all your data?", "The link you opened PumpOS had a param to erase your device. Do this only if its instructed to do so by PumpOS developers.");
		if (x) {
			erdbsfull();
		}
	}

	const filePath = params.get('path');

	if (filePath) {
		console.log(`Opening PumpOS path: ${filePath}`);

		onstartup.push(async () => {
			let fileid = await getFileByPath(filePath);
			openfile(fileid.id);
		});
	}
}
const hardcodedMimeTypes = {
	'html': 'text/html',
	'app': 'text/html',
	'js': 'application/javascript',
	'css': 'text/css',
	'json': 'application/json',
	'jpg': 'image/jpeg',
	'jpeg': 'image/jpeg',
	'webp': 'image/webp',
	'webm': 'image/webm',
	'png': 'image/png',
	'gif': 'image/gif',
	'txt': 'text/plain',
	'pdf': 'application/pdf'
};

async function getMimeType(extension) {
	if (globalmimeDb == null) {
		const mimeDbUrl = 'https://cdn.jsdelivr.net/npm/mime-db@1.52.0/db.json';
		try {
			const responseformimedb = await fetch(mimeDbUrl);
			if (!responseformimedb.ok) throw new Error('Network response was not ok');
			globalmimeDb = await responseformimedb.json();
		} catch (error) {
			return hardcodedMimeTypes[extension] || 'application/octet-stream';
		}
	}
	for (const [key, value] of Object.entries(globalmimeDb)) {
		if (value.extensions && value.extensions.includes(extension)) {
			return key;
		}
	}
	return 'application/octet-stream';
}

async function usePumpOffline() {
	if (await justConfirm("Turn on offline mode?", "Offline mode saves a copy of PumpOS (~5MB) in your browser.")) {

		if ('serviceWorker' in navigator) {
			navigator.serviceWorker.register('sw.js', { scope: '/' })
				.then((registration) => {
					console.log('Service Worker registered with scope:', registration.scope);
				})
				.catch((error) => {
					console.log('Service Worker registration failed:', error);
				});
		}
	}
}

function getReadableTimestamp() {
	const now = new Date();
	const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
	const date = now.toLocaleDateString();
	return `${time} ${date}`;
}

const draggableTimeDiv = document.getElementById('draggable-time');
draggableTimeDiv.addEventListener('dragstart', (e) => {
	e.dataTransfer.setData('text/plain', getReadableTimestamp());
});

async function qsetsRefresh() {
	return await updateMemoryData();
}

// themes
async function checkdmode() {
	if (!lairdotcsscache) {
		const response = await fetch('lair.css');
		lairdotcsscache = await response.text();
	}

	if (CurrentUsername) {
		const themeColors = await getSetting("themeColors") || {};
		applyTheme(themeColors, document);
	}
}

function applyThemeNonVisual(data, doc) {
	applyTheme(data.colors, doc);

	if (data.wallpaper) {
		window.top.makewall(data.wallpaper);
	}

	window.top.setSetting("themeColors", data.colors);
}

const appliedThemeVars = new Set();
let themeStyleTag = null;

function applyTheme(colors, doc) {
	if (!themeStyleTag) {
		themeStyleTag = document.createElement('style');
		themeStyleTag.id = "laircsstag";
	}

	if (!document.getElementById("laircsstag")) {
		document.head.appendChild(themeStyleTag);
	}

	if (doc && doc !== document && !doc.getElementById("laircsstag")) {
		doc.head.appendChild(themeStyleTag.cloneNode(true));
	}

	const cssVars = Object.fromEntries(
		[...lairdotcsscache.matchAll(/(--[\w-]+):\s*([^;]+)/g)]
			.map(([_, key, value]) => [key, value.trim()])
	);

	const textColor = colors["--col-txt1"] ?? cssVars["--col-txt1"];
	const textSelectors = [
		"--colors-text-section",
		"--colors-text-sub"
	];

	const baseRadius = parseFloat(colors["--siz-radius1"] ?? cssVars["--siz-radius1"]) || 0.5;
	colors["--siz-radius2"] = (baseRadius / 2).toFixed(3) + "em";
	colors["--siz-radius3"] = (baseRadius / 3).toFixed(3) + "em";

	let cssText = '';
	for (const variableName in cssVars) {
		let colorValue = colors[variableName] ?? cssVars[variableName];
		if (textSelectors.includes(variableName)) {
			colorValue = textColor;
		}
		cssText += `${variableName}: ${colorValue};\n`;
		appliedThemeVars.add(variableName);
	}

	cssText += `--siz-radius2: ${colors["--siz-radius2"]};\n`;
	cssText += `--siz-radius3: ${colors["--siz-radius3"]};\n`;

	themeStyleTag.textContent = `:root { ${cssText} }`;

	if (doc && doc !== document) {
		const docStyle = doc.getElementById("laircsstag");
		if (docStyle) docStyle.textContent = themeStyleTag.textContent;
	}

	broadcastStyleToIframes(themeStyleTag.textContent);
}

const broadcastStyleToIframes = (css) => {
	document.querySelectorAll('iframe').forEach((iframe) => {
		if (iframe.contentWindow) {
			iframe.contentWindow.postMessage({ type: 'lair-style', css }, '*');
		}
	});
};

function removeTheme() {
	if (themeStyleTag) {
		themeStyleTag.remove();
		themeStyleTag = null;
	}

	appliedThemeVars.clear();
}
function convertTontxSession(jsCode) {
	const hardcodedMethodMap = {
		getFileById: "fileGet.byId",
		getFileNameByID: "fileGet.nameById",
		findFileDetails: "fileGet.detailsById",
		getFileByPath: "fileGet.byPath",

		createFile: "fileSet.createFile",
		updateFile: "fileSet.updateFile",
		remfile: "fileSet.removeFile",
		moveFileToFolder: "fileSet.moveFile",

		getFolderNames: "dir.getFolderNames",
		remfolder: "dir.remove",
		createFolder: "dir.create",

		openfile: "olp.openFile",
		openlaunchprotocol: "olp.launch",
		useHandler: "olp.useHandler",

		getSetting: "settings.get",
		setSetting: "settings.set",
		remSettingKey: "settings.remove",
		resetAllSettings: "settings.resetAll",
		ensureAllSettingsFilesExist: "settings.ensurePreferencesFile",

		removeUser: "accounts.removeUser",
		removeInvalidMagicStrings: "accounts.removeInvalidMagicStrings",
		checkPassword: "accounts.changePassword",
		password: "accounts.password",
		getallusers: "accounts.getAllUsers",
		CurrentUsername: "accounts.username",

		getAppIcon: "apps.getIcon",
		handlers: "apps.getHandlers",

		justConfirm: "sysUI.confirm",
		showDropdownModal: "sysUI.dropdown",
		ask: "sysUI.ask",
		say: "sysUI.say",
		toast: "sysUI.toast",
		openwindow: "sysUI.createWindow",
		clwin: "sysUI.clwin",
		notify: "sysUI.notify",
		genDesktop: "sysUI.genDesktop",
		genTaskBar: "sysUI.genTaskBar",
		loadtaskspanel: "sysUI.loadtaskspanel",

		timeAgo: "utility.timeAgo",
		genUID: "utility.genUID",
		isBase64: "utility.isBase64",
		isElement: "utility.isElement",
		decodeBase64Content: "utility.decodeBase64Content",
		getfourthdimension: "utility.getTime",
		getbaseflty: "utility.getBaseFileType",
		basename: "utility.getBaseName",
		markdownToHTML: "utility.markdownToHTML",
		getMimeType: "utility.getMimeType",
		stringToPastelColor: "utility.stringToPastelColor",
		stringToDarkPastelColor: "utility.stringToDarkPastelColor",
		toTitleCase: "utility.toTitleCase",
		getRandomNothingQuote: "utility.getRandomNothingQuote",
		debounce: "utility.debounce",
		mtpetxt: "utility.mtpetxt",
		calculateSimilarity: "utility.calculateSimilarity",

		ercache: "system.ercache",
		cleanupInvalidAssociations: "system.cleanupInvalidAssociations",
		sysLog: "system.sysLog",

		usePumpOffline: "specific.usePumpOffline",
		removeSWs: "specific.removeSWs",
		installdefaultapps: "specific.installdefaultapps",
		erdbsfull: "system.erasePump"
	};

	const convertedCode = jsCode.replace(
		/(?<!await\s)(window\.parent\.)(\w+)\s*\(/g,
		(match, base, fnName) => {
			const path = hardcodedMethodMap[fnName];
			if (path) {
				return `await ntxSession.send("${path}", `;
			}
			return match;
		}
	).replace(
		/await\s+window\.parent\.(\w+)\s*\(/g,
		(match, fnName) => {
			const path = hardcodedMethodMap[fnName];
			if (path) {
				return `await ntxSession.send("${path}", `;
			}
			return match;
		}
	);

	const dialog = document.createElement("dialog");
	dialog.style.padding = "20px";
	dialog.style.border = "none";
	dialog.style.boxShadow = "0px 4px 10px rgba(0, 0, 0, 0.2)";
	dialog.style.width = "60vw";
	dialog.innerHTML = `
<h3>Converted Code</h3>
<textarea style="width: 100%; height: 300px;">${convertedCode}</textarea>
<br>
<button id="closeDialog">Close</button>
`;
	document.body.appendChild(dialog);
	dialog.showModal();

	document.getElementById("closeDialog").addEventListener("click", () => {
		dialog.close();
		document.body.removeChild(dialog);
	});
}

function backupsdia() {
	let url = `bios.html?un=${CurrentUsername}`;
	let title = "biowin";
	let height = 250, width = 450;
	const screenLeft = window.screenLeft !== undefined ? window.screenLeft : screen.left;
	const screenTop = window.screenTop !== undefined ? window.screenTop : screen.top;

	const screenWidth = window.innerWidth || document.documentElement.clientWidth || screen.width;
	const screenHeight = window.innerHeight || document.documentElement.clientHeight || screen.height;

	const left = screenLeft + (screenWidth - width) / 2;
	const top = screenTop + (screenHeight - height) / 2;

	const features = `width=${width},height=${height},top=${top},left=${left},resizable,scrollbars`;
	window.open(url, title, features);
}

async function addShortcut(flid) {
	const getFolderNames = (memory, parentPath = '', level = 0) => {
		let folders = [];
		Object.keys(memory).forEach(key => {
			const fullPath = parentPath + key;
			if (fullPath.endsWith('/')) {
				const indent = '-'.repeat(level * 2);
				folders.push(indent + fullPath);
				folders = folders.concat(getFolderNames(memory[key], fullPath, level + 1));
			}
		});
		return folders;
	};

	let folders = getFolderNames(memory.root);

	let selectedFolder = await showDropdownModal("Select a folder", "Create shortcut for " + flid + " in:", folders);

	if (selectedFolder) {
		const openable = {
			"open": flid
		};
		const dataUri = `data:application/json;base64,${btoa(JSON.stringify(openable))}`;
		let x = await ask("Enter a shortcut file name: (without extension)", "MyFile");
		await createFile(selectedFolder, x + ".lnk", false, dataUri);
		toast("Shortcut created")
	}
}