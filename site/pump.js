
var pumpfunsdk = {
  shrinkString: function (str) {
    return window.parent.shrinkbsf(str)
  },
  unshrinkString: function (str) {
    return window.parent.unshrinkbsf(str)
  },
  ask: function (str) {
    return window.parent.ask(str)
  },
  say: function (str) {
    return window.parent.say(str)
  },
  justConfirm: function (...args) {
    return window.parent.justConfirm(args)
  },
  openFile: function (...args) {
    return window.parent.openfile(args)
  },
  OpenL: function (...args) {
    return window.parent.openlaunchprotocol(args)
  },
  notify: function (...args) {
    return window.parent.notify(args)
  },
  appInstances: function () {
    return window.parent.winds;
  },
  genUID: function () {
    return genUID();
  },
  createFile: function(...args) {
    return window.parent.createFile(args);
  },
  getFileById: function(...args) {
    return window.parent.getFileById(args);
  },
  getFileByPath: function(...args) {
    return window.parent.getFileByPath(args);
  },
  getFileNamesByFolder: function(...args) {
    return window.parent.getFileNamesByFolder(args);
  },
  CurrentUsername: window.parent.CurrentUsername
}