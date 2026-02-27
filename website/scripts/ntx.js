class NTXSession {
    constructor() {
        const wrapAsync = (fn) =>
            typeof fn === "function"
                ? Object.assign(
                    async (...args) => await fn(...args),
                    { appIdSupport: fn.appIdSupport }
                )
                : fn;

        this.fileGet = {
            byId: wrapAsync(getFileById),
            nameById: wrapAsync(getFileNameByID),
            detailsById: wrapAsync(findFileDetails),
            byPath: wrapAsync(getFileByPath)
        };
        this.fileSet = {
            createFile: wrapAsync(createFile),
            updateFile: wrapAsync(updateFile),
            removeFile: wrapAsync(remfile),
            moveFile: wrapAsync(moveFileToFolder)
        };
        this.dir = {
            getFolderNames: wrapAsync(getFolderNames),
            remove: wrapAsync(remfolder),
            create: wrapAsync(createFolder)
        };
        this.olp = {
            openFile: wrapAsync(openfile),
            launch: wrapAsync(openlaunchprotocol),
            useHandler: wrapAsync(useHandler)
        };
        this.settings = {
            get: wrapAsync(getSetting),
            set: wrapAsync(setSetting),
            remove: wrapAsync(remSettingKey),
            resetAll: wrapAsync(resetAllSettings),
            ensurePreferencesFile: wrapAsync(ensureAllSettingsFilesExist)
        };
        this.appStorage = {
            get: wrapAsync(appStorage.get),
            set: wrapAsync(appStorage.set),
            reset: wrapAsync(appStorage.reset),
            remove: wrapAsync(appStorage.remove)
        }
        this.accounts = {
            removeUser: wrapAsync(removeUser),
            removeInvalidMagicStrings: wrapAsync(removeInvalidMagicStrings),
            changePassword: wrapAsync(checkPassword),
            password: wrapAsync(password),
            getAllUsers: wrapAsync(sharedStore.getAllUsers),
            username: wrapAsync(CurrentUsername)
        };
        this.apps = {
            getIcon: wrapAsync(getAppIcon),
            // getPerms: wrapAsync(getPerms),
            getHandlers: handlers
        };
        this.sysUI = {
            confirm: wrapAsync(justConfirm),
            dropdown: wrapAsync(showDropdownModal),
            ask: wrapAsync(ask),
            say: wrapAsync(say),
            toast: wrapAsync(toast),
            createWindow: wrapAsync(openwindow),
            clwin: wrapAsync(clwin),
            notify: wrapAsync(notify),
            genDesktop: wrapAsync(genDesktop),
            genTaskBar: wrapAsync(genTaskBar),
            loadtaskspanel: wrapAsync(loadtaskspanel),
            setTitle: wrapAsync(setTitle),
        };
        this.utility = {
            timeAgo: timeAgo,
            genUID: genUID,
            isBase64: isBase64,
            isElement: isElement,
            decodeBase64Content: decodeBase64Content,
            getTime: getfourthdimension,
            getBaseFileType: getbaseflty,
            getBaseName: basename,
            markdownToHTML: markdownToHTML,
            getMimeType: getMimeType,
            stringToPastelColor: stringToPastelColor,
            stringToDarkPastelColor: stringToDarkPastelColor,
            toTitleCase: toTitleCase,
            getRandomNothingQuote: getRandomNothingQuote,
            debounce: debounce,
            mtpetxt: mtpetxt,
            calculateSimilarity: calculateSimilarity
        };
        this.system = {
            ercache: ercache,
            cleanupInvalidAssociations: cleanupInvalidAssociations,
            sysLog: sysLog,
            password: password,
            erasePump: erdbsfull
        };
        this.specific = {
            usePumpOffline: usePumpOffline,
            removeSWs: removeSWs,
            installdefaultapps: installdefaultapps
        }
    }
}

const ntxWrapper = new NTXSession();
const namespaceDetails = {
    fileGet: { risk: 10, description: "read file data" },
    fileSet: { risk: 40, description: "create and modify file data and files" },
    dir: { risk: 30, description: "manipulate directories" },
    olp: { risk: 20, description: "use open apps and use their features" },
    settings: { risk: 80, description: "read and <span class='dangertext'>modify system settings and permissions</span>" },
    accounts: { risk: 50, description: "manage user accounts" },
    apps: { risk: 25, description: "know handlers and permissions" },
    appStorage: { risk: 15, description: "locally store data associated with the app" },
    sysUI: { risk: 30, description: "show dialogs and trigger UI functions" },
    utility: { risk: 20, description: "use various utilities" },
    system: { risk: 80, description: "gain unrestricted access to <span class='dangertext'>high risk system functions</span>" },
    specific: { risk: 90, description: "trigger specific <span class='dangertext'>risky system sequences</span>" },
    unsandboxed: { risk: 100, description: "Run <span class='dangertext'>with full system access.</span>" }
};
function describeNamespaces(namespaceKey) {
    if (namespaceDetails[namespaceKey]) {
        return namespaceDetails[namespaceKey].description;
    }
    return null;
}

function supportsXData(wrapper, name) {
    const arr = ["sysUI.notify", "sysUI.say", "sysUI.toast", "sysUI.ask", "sysUI.confirm", "sysUI.dropdown", "appStorage.get", "appStorage.set", "appStorage.reset", "appStorage.remove"];
    return arr.includes(wrapper + "." + name);
}


function getNamespaceRisk(namespaceKey) {
    if (namespaceDetails[namespaceKey]) {
        return namespaceDetails[namespaceKey].risk;
    }
    return null;
}
function returnallnamespaces() {
    return Object.keys(namespaceDetails);
}