// Name: Rotur.js
// Author: Mistium
// Description: Utilise rotur in your projects

// License: MPL-2.0
// This Source Code is subject to the terms of the Mozilla Public License, v2.0,
// If a copy of the MPL was not distributed with this file,
// Then you can obtain one at https://mozilla.org/MPL/2.0/

randomString = function (length) {
  var result = "";
  var characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
  }
  return result;
};

function wsClose() {
  this.ws.close();
}

class RoturExtension {
  constructor(runtime) {
    this.runtime = runtime;
    this.ws = null;
    this.client = {};
    this.packets = {};
    this.is_connected = false;
    this.authenticated = false;
    this.accounts = "";
    this.server = "";
    this.userToken = "";
    this.user = {};
    this.first_login = false;
    this.designation = "";
    this.username = "";
    this.my_client = {};
    this.mail = {};
    this.localKeys = {};
    this.syncedVariables = {};
    this.packetQueue = [];
    this.showDangerous = false;

    this.lastJoined = "";
    this.lastLeft = "";

    this.version = 7;
    this.outdated = false;

    this.callJson = {};

    fetch("https://raw.githubusercontent.com/Mistium/Origin-lairOS/main/Resources/info.json")
      .then((response) => {
        if (response.ok) return response.json();
        else throw new Error('Network response was not ok');
      })
      .then((data) => {
        this.accounts = data.name;
        this.server = data.server;
      })
      .catch((error) => {
        this.accounts = "sys.-origin";
        this.server = "wss://rotur.mistium.com";
      });

    this._initializeBadges(); // Start fetching badges

  }

  async _initializeBadges() {
    await this._getBadges(); // Wait for the fetch operation to complete
  }

  async _getBadges() {
    try {
      const response = await fetch("https://raw.githubusercontent.com/RoturTW/Badges/main/badges.json");
      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      this.badges = data;
    } catch (error) {
      this.badges = [];
    }
  }

  openUpdate() {
    window.open("https://extensions.mistium.com/featured/rotur.js");
  }

  // main functions

  handlePromise(message, funcmain) {
    const cmd = message?.val?.command;
    return new Promise((resolve, reject) => {
      this.ws.send(
        JSON.stringify(message),
      );

      const func = (event) => {
        const packet = JSON.parse(event.data);
        if (packet?.origin?.username === this.accounts) {
          if (cmd && packet?.val?.source_command === cmd) {
            funcmain(packet, resolve, reject);
            this.ws.removeEventListener("message", func);
          }
        }
      }
      this.ws.addEventListener("message", func);
    });
  }

  connectToServer(args) {
    if (!this.server || !this.accounts) {
      console.log("Waiting for server and accounts...");
      setTimeout(() => {
        this.connectToServer(args);
      }, 1000);
      return;
    }
    if (this.ws) { this.disconnect(); }
    this.designation = args.DESIGNATION;
    this.username = randomString(32);
    this.my_client = {
      system: args.SYSTEM,
      version: args.VERSION,
    };
    this.connectToWebsocket();
  }

  openPorts() {
    let ports = [];
    for (let key in this.packets) {
      ports.push(key);
    }
    if (ports.length === 0) return ["No Open Ports"];
    else return ports;
  }

  accountKeys() {
    let keys = [];
    for (let key of Object.keys(this.user)) {
      keys.push(key);
    }
    if (!keys || keys.length === 0) return ["No User Keys"];
    else return keys;
  }

  myFriends() {
    if (!(this.authenticated && this.is_connected)) return ["Not Authenticated"];
    let keys = this.user["sys.friends"];
    if (typeof keys === "string") {
      try {
        keys = JSON.parse(keys);
      } catch (e) {
        console.error("Failed to parse friends list:", e);
        return ["Invalid Friends List"];
      }
    }
    if (!keys || keys.length === 0) return ["No Friends"];
    else return keys;
  }

  myRequests() {
    if (!(this.authenticated && this.is_connected)) return ["Not Authenticated"];
    let keys = this.user["sys.requests"];
    if (typeof keys === "string") {
      try {
        keys = JSON.parse(keys);
      } catch (e) {
        console.error("Failed to parse requests list:", e);
        return ["Invalid Requests List"];
      }
    }
    if (!keys || keys.length === 0) return ["No Requests"];
    else return keys;
  }

  serverOnline() {
    if (!this.is_connected) return false;
    return this.client.users.indexOf(this.accounts) !== -1;
  }

  connectToWebsocket() {

    if (this.ws) this.disconnect();

    this.ws = new WebSocket(this.server);
    this.ws.onopen = () => {
      this.sendHandshake();

      this.ws.onmessage = (event) => {
        let packet = JSON.parse(event.data);
        if (packet.cmd == "client_ip") {
          this.client.ip = packet.val;
        } else if (packet.cmd == "statuscode" && typeof (packet.val) === "object") {
          this.client = Object.assign(this.client, packet.val);
          this.client.username = packet.val.username;
        } else if (packet.cmd == "ulist") {
          if (packet.mode == "add") {
            this.client.users.push(packet.val.username);
            roturTWEventCall("roturEXT_onJoin");
            this.lastJoined = packet.val;
          } else if (packet.mode == "remove") {
            this.client.users = this.client.users.filter(
              (user) => user != packet.val.username,
            );
            roturTWEventCall("roturEXT_onLeave");
            this.lastLeft = packet.val;
          } else if (packet.mode == "set") {
            this.client.users = [];
            for (let user of packet.val) {
              this.client.users.push(user.username);
            }
          }
        }
        if (packet.cmd == "pmsg") {
          this.packetQueue.push(packet);
          packet.origin = packet.origin.username;
          delete packet.rooms;
          delete packet.cmd;
          packet.client = packet.val.client;
          packet.source = packet.val.source;
          packet.payload = packet.val.payload;
          packet.timestamp = packet.val.timestamp;
          if (packet.val.source_command) {
            packet.source_command = packet.val.source_command;
            delete packet.val.source_command;
          }
          if (packet.origin === this.accounts) {
            switch (packet.source_command) {
              case "call":
                if (packet.val.payload === "request") {
                  this.callJson = packet.val;
                  roturTWEventCall("roturEXT_whenCallReceived");
                }
                break;
              case "omail_received":
                roturTWEventCall("roturEXT_whenMailReceived");
                break;
              case "account_update":
                roturTWEventCall("roturEXT_whenAccountUpdate");
                if (packet.payload.key === "sys.requests") {
                  if (packet.payload.value.length > this.friends.requests.length) {
                    roturTWEventCall("roturEXT_whenFriendRequestReceived");
                  } else {
                    roturTWEventCall("roturEXT_whenFriendRequestAccepted");
                  }
                }
                if (packet.payload.key === "sys.currency") {
                  roturTWEventCall("roturEXT_whenBalanceChanged");
                }
                this.user[packet.payload.key] = packet.payload.value;
                break;
              case "sync_set":
                this.syncedVariables[packet.origin] ||= {};
                this.syncedVariables[packet.origin][packet.payload.key] = packet.payload.value;
                break;
              case "sync_delete":
                delete this.syncedVariables[packet.origin][packet.payload.key];
                break;
              case "sync_get":
                if (this.syncedVariables[packet.origin]) {
                  if (this.syncedVariables[packet.origin][packet.payload.key]) {
                    packet.val = this.syncedVariables[packet.origin][packet.payload.key];
                  } else {
                    packet.val = null;
                  }
                }
                break;
              case "omail_received":
                roturTWEventCall("roturEXT_whenMailReceived");
                break;
              case "account_update":
                roturTWEventCall("roturEXT_whenAccountUpdate");
                if (packet.payload.key === "sys.requests") {
                  if (packet.payload.value.length > this.friends.requests.length) {
                    roturTWEventCall("roturEXT_whenFriendRequestReceived");
                  } else {
                    roturTWEventCall("roturEXT_whenFriendRequestAccepted");
                  }
                }
                if (packet.payload.key === "sys.currency") {
                  roturTWEventCall("roturEXT_whenBalanceChanged");
                }
            }
            this.user[packet.payload.key] = packet.payload.value;
          } else {
            console.log(packet);
            if (packet.val && packet.val.target) {
              this.packets[packet.val.target] ??= [];
              this.packets[packet.val.target].push(packet);
              roturTWEventCall("roturEXT_whenMessageReceived");
              delete packet.val;
            }
          }
        } else {
          if (packet.source_command === "sync_set") {
            this.syncedVariables[packet.origin] ||= {};
            this.syncedVariables[packet.origin][packet.payload.key] = packet.payload.value;
          }
          if (packet.source_command === "sync_delete") {
            delete this.syncedVariables[packet.origin][packet.payload.key];
          }
        }

        if (packet.listener === "handshake_cfg") {
          let username = this.designation + "-" + this.username;
          let msg = {
            cmd: "setid",
            val: username,
            listener: "set_username_cfg",
          };

          this.ws.send(JSON.stringify(msg));
        }
        if (packet.listener == "set_username_cfg") {
          this.client.username = this.username;
          let room = "roturTW";
          let msg = {
            cmd: "link",
            val: [room],
            listener: "link_cfg",
          };

          this.ws.send(JSON.stringify(msg));
        }
        if (packet.cmd === "roomlist") {
          this.client.room = packet.val[0];
        }
        if (packet.listener == "link_cfg" && !this.is_connected) {
          this.is_connected = true;
          roturTWEventCall("roturEXT_whenConnected");

        }
      }
    };

    this.ws.onclose = () => {
      console.log("Disconnected!");
      roturTWEventCall("roturEXT_whenDisconnected");
      this.is_connected = false;

      // Log out locally when disconnected
      if (this.authenticated) {
        this.authenticated = false;
        this.userToken = "";
        this.user = {};
        console.log("Logged out due to disconnection");
      }
    };
  }

  sendHandshake() {
    this.ws.send(
      JSON.stringify({
        cmd: "handshake",
        val: {
          language: "Javascript",
          version: {
            editorType: "Scratch",
            versionNumber: null,
          },
        },
        listener: "handshake_cfg",
      }),
    );
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  connected() {
    return this.is_connected;
  }

  loggedIn() {
    return this.authenticated && this.is_connected;
  }

  firstLogin() {
    return false;
  }

  login_prompt({ STYLE_URL }) {
    if (!this.is_connected) { console.error("Not Connected"); return; }
    if (this.authenticated) { console.error("Already Logged In"); return; }

    const e = document.createElement("iframe");
    e.id = "rotur-auth";
    e.src = `https://rotur.dev/auth?styles=${encodeURIComponent(STYLE_URL)}`;
    Object.assign(e.style, {
      width: "70%",
      height: "80%",
      border: "none",
      pointerEvents: "auto",
      position: "absolute",
      top: "10%",
      right: "14.5%",
      border: "var(--box-crisp)",
      borderRadius: "1em",
      zIndex: 999
    });

    document.body.appendChild(e);

    const _roturAuthHandler = (a) => {
      console.log("Rotur Auth Message Received", a);
      if ("https://rotur.dev" === a.origin && "rotur-auth-token" === a.data?.type) {
        t.remove()
        window.removeEventListener("message", _roturAuthHandler);
        this.loginToken({ TOKEN: a.data.token });
        setSetting("roturLink", JSON.stringify({
          "type": "token",
          "token": a.data.token
        }));
      }
    };

    window.addEventListener("message", _roturAuthHandler);
    return "Auth window opened";
  }

  login() { }
  loginMd5() { }

  loginToken(args) {
    return this._loginWithToken(args.TOKEN);
  }

  async _loginWithToken(token) {
    if (!this.is_connected) return "Not Connected";
    if (this.authenticated) return "Already Logged In";

    try {
      const response = await fetch(`https://social.rotur.dev/get_user?auth=${encodeURIComponent(token)}`);

      if (!response.ok) throw new Error(`Authentication failed: ${response.status}`);

      const packet = await response.json();

      this.userToken = packet.key || token;
      this.user = { ...packet };

      delete this.user.key;
      delete this.user.password;

      this.friends = {};

      // Handle if the user has no friends :P
      if (!this.user["sys.friends"]) this.user["sys.friends"] = [];
      if (!this.user["sys.requests"]) this.user["sys.requests"] = [];

      this.friends.list = this.user["sys.friends"];
      this.friends.requests = this.user["sys.requests"];

      delete this.user["sys.friends"];
      delete this.user["sys.requests"];

      this.username = this.designation + "-" + this.user.username + "Â§" + randomString(10);

      this.ws.send(
        JSON.stringify({
          cmd: "setid",
          val: this.username,
          listener: "set_username_cfg",
        })
      );

      this.my_client.username = this.username;
      this.authenticated = true;


      this.ws.send(
        JSON.stringify({
          cmd: "auth",
          val: this.userToken
        })
      );
      roturTWEventCall("roturEXT_whenAuthenticated");

      return `Logged in as ${this.user.username}`;

    } catch (error) {
      this.authenticated = false;
      throw new Error(`Failed to login: ${error.message}`);
    }
  }

  register(args) {
    if (!this.is_connected) return "Not Connected";
    if (this.authenticated) return "Already Logged In";
    return
  }

  deleteAccount() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!confirm(`Are You Sure You Want To Delete ${this.client.username}? Everything will be lost!`)) return "Cancelled";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        client: this.my_client,
        command: "delete_account",
        id: ":3",
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val?.source_command === "delete") {
        if (packet.val.payload === "Account Deleted Successfully") {
          this.userToken = "";
          this.user = {};
          this.authenticated = false;
          this.ws.close();
          resolve("Account Deleted Successfully");
        } else {
          reject("Failed to delete account: " + packet.val.payload);
        }
      }
    });
  }

  logout() {
    if (!this.is_connected) return;
    this.authenticated = false;
    this.userToken = "";
    this.user = {};
    this.disconnect();
  }

  getToken() {
    return this.userToken ?? "";
  }

  getkey(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (args.KEY in this.user) {
      let keyData = this.user[args.KEY];
      if (typeof keyData === "object") {
        return JSON.stringify(keyData);
      } else {
        return keyData;
      }
    } else {
      return "";
    }
  }

  setkey(args) {
    // this is server side, removing this does nothing other than make the server reject the request
    if (args.VALUE.length > 1000) return "Key Too Long, Limit is 1000 Characters";
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "update",
        client: this.my_client,
        id: ":3",
        payload: [args.KEY, args.VALUE],
      },
      id: this.accounts,
    },
      (packet, resolve) => {
        if (packet.val.payload === "Account Updated Successfully") {
          this.user[args.KEY] = args.VALUE;
        }
        resolve(packet.val.payload);
      });
  }

  keyExists(args) {
    if (!this.is_connected) return false;
    if (!this.authenticated) return false;
    return args.KEY in this.user;
  }

  getkeys() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(Object.keys(this.user));
  }

  getvalues() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(Object.values(this.user));
  }

  getAccount() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(this.user);
  }

  setStorageID(args) {
    if (!(this.authenticated && this.is_connected)) {
      console.error("Unable to set the storage ID: Not Logged In");
      return;
    }
    if (this.storage_id) {
      console.error("Unable to set the storage ID: Already Set");
      return;
    }
    if (window.confirm("This project would like to use the storage id: " + args.ID + ". Do you want to continue?")) {
      this.handlePromise({
        cmd: "pmsg",
        val: {
          command: "storage_getid",
          client: this.my_client,
          id: ":3",
          payload: args.ID,
        },
        id: this.accounts,
      }, (packet, resolve, reject) => {
        if (packet.val.payload !== "Not Logged In") {
          resolve("" + args.ID);
          this.storage_id = "" + args.ID;
          this.localKeys = JSON.parse(packet.val.payload);
        } else {
          console.error("Failed to set storage id: " + packet.val.payload);
          reject(packet.val.payload);
        }
      });
    }
  }

  storageIdExists() {
    return this.storage_id !== undefined;
  }

  getStorageID() {
    return this.storage_id ?? "";
  }

  getStorageKey(args) {
    if (!(this.authenticated && this.is_connected)) {
      return "Not Logged In";
    } else if (!this.storage_id) {
      return "Storage Id Not Set";
    } else {
      return this.localKeys[args.KEY] ?? "";
    }
  }

  setStorageKey(args) {
    // this is server side, removing this does nothing other than make the server reject the request
    if (args.VALUE.length > 1000) return "Key Too Long, Limit is 1000 Characters";

    if (!(this.authenticated && this.is_connected)) return "Not Logged In";
    if (!this.storage_id) return "Storage Id Not Set";

    this.localKeys[args.KEY] = args.VALUE;
    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "storage_set",
        id: ":3",
        client: this.my_client,
        payload: {
          key: args.KEY,
          value: args.VALUE,
          id: this.storage_id,
        }
      },
      id: this.accounts
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Successfully Set Key") {
        resolve("Key Set");
      } else {
        reject(packet.val.payload);
      }
    });
  }

  existsStorageKey(args) {
    if (!(this.authenticated && this.is_connected) || !this.storage_id) return false;
    return args.KEY in this.localKeys;
  }

  deleteStorageKey(args) {
    if (!(this.authenticated && this.is_connected)) return "Not Logged In";
    if (!this.storage_id) return "Storage Id Not Set";

    delete this.localKeys[args.KEY];

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "storage_delete",
        id: ":3",
        client: this.my_client,
        payload: {
          key: args.KEY,
          id: this.storage_id,
        },
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Successfully Deleted Key") {
        resolve("Key Deleted");
      } else {
        reject(packet.val.payload);
      }
    });
  }

  getStorageKeys() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!this.storage_id) return "Storage Id Not Set";
    return JSON.stringify(Object.keys(this.localKeys));
  }

  getStorageValues() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!this.storage_id) return "Storage Id Not Set";
    return JSON.stringify(Object.values(this.localKeys));
  }

  clearStorage() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!this.storage_id) return "Storage Id Not Set";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "storage_clear",
        id: ":3",
        client: this.my_client,
        payload: this.storage_id
      },
      id: this.accounts
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Successfully Cleared Storage") {
        this.localKeys = {};
        resolve("Storage Cleared");
      } else {
        reject(packet.val.payload);
      }
    });
  }

  storageUsage() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!this.storage_id) return "Storage Id Not Set";

    return JSON.stringify(this.localKeys).length + "";
  }

  storageLimit() {
    return "50000";
  }

  storageRemaining() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!this.storage_id) return "Storage Id Not Set";

    return (50000 - JSON.stringify(this.localKeys).length) + "";
  }

  accountStorageUsage() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "storage_usage",
        client: this.my_client,
        id: ":3"
      },
      id: this.accounts
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Not Logged In") {
        reject("Not Logged In");
      } else {
        resolve(packet.val.payload);
      }
    });
  }

  accountStorageLimit() {
    return "1000000";
  }

  accountStorageRemaining() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "storage_usage",
        client: this.my_client,
        id: ":3"
      },
      id: this.accounts
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Not Logged In") {
        reject("Not Logged In");
      } else {
        resolve(1000000 - Number(packet.val.payload));
      }
    });
  }

  sendMessage(args) {
    if (!this.is_connected) {
      console.error("Unable to send message: Not Connected");
      return "";
    }
    this.ws.send(
      JSON.stringify({
        cmd: "pmsg",
        val: {
          client: this.my_client,
          payload: args.PAYLOAD,
          source: args.SOURCE,
          target: args.TARGET,
          timestamp: Date.now(),
        },
        id: args.USER,
      }),
    );
  }

  whenMessageReceived() {
    return true;
  }

  getPacketsFromTarget(args) {
    return JSON.stringify(this.packets[args.TARGET] || "[]");
  }

  numberOfPacketsOnTarget(args) {
    return this.packets[args.TARGET] ? this.packets[args.TARGET].length : 0;
  }

  getFirstPacketOnTarget(args) {
    return JSON.stringify(this.packets[args.TARGET]?.[0] || "{}");
  }

  dataOfFirstPacketOnTarget(args) {
    switch (args.DATA) {
      case "origin":
        return this.packets[args.TARGET]?.[0]?.origin || "";
      case "client":
        return (
          JSON.stringify(this.packets[args.TARGET]?.[0]?.client) ||
          '{"system":"Unknown", "version":"Unknown"}'
        );
      case "source port":
        return this.packets[args.TARGET]?.[0]?.source || "Unknown";
      case "payload":
        return this.packets[args.TARGET]?.[0]?.payload || "";
      case "timestamp":
        return this.packets[args.TARGET]?.[0]?.timestamp || "0";
      default:
        return "";
    }
  }

  getAllTargets() {
    return JSON.stringify(Object.keys(this.packets));
  }

  getAllPackets() {
    return JSON.stringify(this.packets);
  }

  deleteFirstPacketOnTarget(args) {
    if (this.packets[args.TARGET]) {
      let packet = this.packets[args.TARGET]?.[0];
      this.packets[args.TARGET].shift();
      return JSON.stringify(packet);
    }
    return "{}";
  }

  deletePacketsOnTarget(args) {
    delete this.packets[args.TARGET];
  }

  deleteAllPackets() {
    this.packets = {};
  }

  clientIP() {
    if (!this.is_connected) return "Not Connected";
    return this.client.ip;
  }

  clientUsername() {
    if (!this.is_connected) return "Not Connected";
    return this.client.username;
  }

  getClient() {
    if (!this.is_connected) return "Not Connected";
    return JSON.stringify(this.client);
  }

  clientUsers() {
    if (!this.is_connected) return "Not Connected";
    return JSON.stringify(this.client.users);
  }

  getUserDesignation(args) {
    if (!this.is_connected) return "Not Connected";
    return JSON.stringify(
      this.client.users.filter((user) =>
        user.startsWith(args.DESIGNATION + "-"),
      ),
    );
  }

  usernameConnected(args) {
    if (!this.is_connected) return false;
    if (!this.authenticated) return false;
    let regexp = new RegExp('(?<=")[a-zA-Z]{3}-' + args.USER + 'Â§\\S{10}(?=")', "gi");
    return JSON.stringify(this.client.users).match(regexp) !== null;
  }

  userConnected(args) {
    if (!this.is_connected) return "Not Connected";
    if (args.DESIGNATION.length !== 3) return "Invalid Designation";
    let regexp = new RegExp('(?<=")' + args.DESIGNATION + '-' + args.USER + 'Â§\\S{10}(?=")', "gi");
    return JSON.stringify(this.client.users).match(regexp) !== null;
  }

  findID(args) {
    if (!this.is_connected) return "Not Connected";
    let regexp = new RegExp('[a-zA-Z]{3}-' + args.USER + 'Â§\\S{10}', "gi");
    return JSON.stringify(
      this.client.users.filter((user) => user.match(regexp) !== null),
    );
  }

  RAWgetAllPackets() {
    return JSON.stringify(this.packetQueue);
  }

  RAWgetFirstPacket() {
    return JSON.stringify(this.packetQueue[0] || {});
  }

  RAWdeleteFirstPacket() {
    this.packetQueue.shift();
  }

  RAWdeleteAllPackets() {
    this.packetQueue = [];
  }

  onJoinUser() {
    return this.lastJoined;
  }

  onLeaveUser() {
    return this.lastLeft;
  }

  setSyncedVariable(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    this.ws.send(
      JSON.stringify({
        cmd: "pmsg",
        val: {
          client: this.my_client,
          source_command: "sync_set",
          payload: {
            key: args.KEY,
            value: args.VALUE,
          },
        },
        id: args.USER,
      }),
    )
    this.syncedVariables[args.USER] ||= {};
    this.syncedVariables[args.USER][args.KEY] = args.VALUE;
  }

  getSyncedVariable(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(this.syncedVariables[args.USER][args.KEY] || "");
  }

  deleteSyncedVariable(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    this.ws.send(
      JSON.stringify({
        cmd: "pmsg",
        val: {
          source_command: "sync_delete",
          client: this.my_client,
          payload: {
            key: args.KEY,
          },
        },
        id: args.USER,
      }),
    )
    delete this.syncedVariables[args.USER][args.KEY];
  }

  getSyncedVariables(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(this.syncedVariables[args.USER] || {});
  }

  sendMail(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "omail_send",
        client: this.my_client,
        id: ":3",
        payload: {
          title: args.SUBJECT,
          body: args.MESSAGE,
          recipient: args.TO,
        },
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Successfully Sent Omail") {
        resolve(`Mail sent to ${args.TO}`);
      } else {
        reject(`Failed to send mail to ${args.TO}: ${packet.val.payload}`);
      }
    });
  }

  getAllMail() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "omail_getinfo",
        client: this.my_client,
        id: ":3",
      },
      id: this.accounts,
    }, (packet, resolve) => {
      resolve(JSON.stringify(packet.val.payload));
    });
  }

  getMail(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "omail_getid",
        client: this.my_client,
        payload: args.ID,
        id: ":3",
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val?.payload[0] === args.ID) {
        resolve(JSON.stringify(packet.val.payload[1]));
      } else {
        reject(`Failed to get mail with ID: ${args.ID}`);
      }
    });
  }

  deleteMail(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "omail_delete",
        client: this.my_client,
        payload: args.ID,
        id: ":3",
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Deleted Successfully") {
        resolve(`Mail with ID ${args.ID} deleted`);
      } else {
        reject(`Failed to delete mail with ID ${args.ID}: ${packet.val.payload}`);
      }
    });
  }

  deleteAllMail() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "omail_delete",
        client: this.my_client,
        payload: "all",
        id: ":3",
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Deleted Successfully") {
        resolve("All mail deleted");
      } else {
        reject(`Failed to delete all mail: ${packet.val.payload}`);
      }
    });
  }

  getFriendList() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(this.friends.list);
  }

  sendFriendRequest(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (this.friends.list.includes(args.FRIEND)) return "Already Friends";
    if (args.FRIEND === this.user.username) return "You Need Other Friends :/";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "friend_request",
        client: this.my_client,
        payload: args.FRIEND,
        id: ":3",
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Sent Successfully") {
        resolve("Sent Successfully");
      } else {
        reject(packet.val.payload);
      }
    });
  }

  removeFriend(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!this.friends.list.includes(args.FRIEND)) return "Not Friends";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "friend_remove",
        client: this.my_client,
        payload: args.FRIEND,
        id: ":3",
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Friend Removed") {
        this.friends.list = this.friends.list.filter(friend => friend !== args.FRIEND);
        resolve(`Friend removed: ${args.FRIEND}`);
      } else {
        reject(`Failed to remove friend: ${packet.val.payload}`);
      }
    });
  }

  acceptFriendRequest(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!this.friends.requests.includes(args.FRIEND)) return "No Request";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "friend_accept",
        client: this.my_client,
        payload: args.FRIEND,
        id: ":3",
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Request Accepted") {
        this.friends.list.push(args.FRIEND);
        this.friends.requests = this.friends.requests.filter(
          (user) => user != args.FRIEND,
        );
        resolve("Request Accepted");
      } else {
        reject(packet.val.payload);
      }
    });
  }

  declineFriendRequest(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!this.friends.requests.includes(args.FRIEND)) return "No Request";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "friend_decline",
        client: this.my_client,
        payload: args.FRIEND,
        id: ":3",
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Request Declined") {
        this.friends.requests = this.friends.requests.filter(
          (user) => user != args.FRIEND,
        );
        resolve("Request Declined");
      } else {
        reject(packet.val.payload);
      }
    });
  }

  getFriendStatus(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (this.friends.list.includes(args.FRIEND)) {
      return "Friend";
    } else if (this.friends.requests.includes(args.FRIEND)) {
      return "Requested";
    } else {
      return "Not Friend";
    }
  }

  getFriendRequests() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(this.friends.requests) ?? "";
  }

  getFriendCount() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return this.friends.list.length ?? "";
  }

  getBalance() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return this.user["sys.currency"] ?? 0;
  }

  tranferCurrency(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return this.handlePromise({
      cmd: "pmsg",
      val: {
        command: "currency_transfer",
        client: this.my_client,
        payload: {
          amount: args.AMOUNT,
          recipient: args.USER,
        },
        id: ":3",
        client: this.my_client,
      },
      id: this.accounts,
    }, (packet, resolve, reject) => {
      if (packet.val.payload === "Transfer Successful") {
        resolve("Success");
      } else {
        reject(packet.val.payload);
      }
    });
  }

  getTransactions() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(this.user["sys.transactions"]);
  }

  getTransactionCount() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return this.user["sys.transactions"].length;
  }

  getMyOwnedItems() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return fetch(`https://social.rotur.dev/keys/mine?auth=${this.userToken}`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        return JSON.stringify(data);
      })
      .catch(error => {
        return `Error: ${error.message}`;
      });
  }

  ownsItem(args) {
    if (!this.is_connected) return false;
    if (!this.authenticated) return false;

    const username = this.user.username;

    return fetch(`https://social.rotur.dev/keys/check/${username}?key=${args.ITEM}`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        return data.owns === true;
      })
      .catch(error => {
        console.error(`Error checking key ownership: ${error.message}`);
        return false;
      });
  }

  itemData(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return fetch(`https://social.rotur.dev/keys/get/${args.ITEM}?auth=${this.userToken}`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        return data.data || "No data available";
      })
      .catch(error => {
        return `Error: ${error.message}`;
      });
  }

  purchaseItem(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return fetch(`https://social.rotur.dev/keys/purchase/${args.ITEM}?auth=${this.userToken}`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          return "Item Purchased";
        } else {
          return data.message || "Purchase failed";
        }
      })
      .catch(error => {
        return `Error: ${error.message}`;
      });
  }

  itemInfo(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return fetch(`https://social.rotur.dev/keys/get/${args.ITEM}?auth=${this.userToken}`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        return JSON.stringify(data);
      })
      .catch(error => {
        return `Error: ${error.message}`;
      });
  }

  getPublicItems(args) {
    return "[]";
  }

  getPublicItemPages() {
    return "[]";
  }

  getMyCreatedItems() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return fetch(`https://social.rotur.dev/keys/mine?auth=${this.userToken}`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        const createdItems = data.filter(item => item.isCreator === true);
        return JSON.stringify(createdItems);
      })
      .catch(error => {
        return `Error: ${error.message}`;
      });
  }

  createItem(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    const url = `https://social.rotur.dev/keys/create?auth=${this.userToken}&data=${encodeURIComponent(args.CODE)}&price=${encodeURIComponent(args.PRICE)}`;

    return fetch(url)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          return "Item Created";
        } else {
          return data.message || "Creation failed";
        }
      })
      .catch(error => {
        return `Error: ${error.message}`;
      });
  }

  updateItem(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    let updateUrl = `https://social.rotur.dev/keys/update/${args.ITEM}?auth=${this.userToken}&key=${args.ITEM}`;

    if (args.KEY === "data") {
      updateUrl += `&data=${encodeURIComponent(args.DATA)}`;
    } else {
      return "Only data updates are supported through the API. Use the key manager for other properties.";
    }

    return fetch(updateUrl)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          return "Item Updated";
        } else {
          return data.message || "Update failed";
        }
      })
      .catch(error => {
        return `Error: ${error.message}`;
      });
  }

  deleteItem(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return fetch(`https://social.rotur.dev/keys/delete/${args.ITEM}?auth=${this.userToken}`)
      .then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          return "Item Deleted";
        } else {
          return data.message || "Deletion failed";
        }
      })
      .catch(error => {
        return `Error: ${error.message}`;
      });
  }

  hideItem(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return "Please use the key manager at https://rotur.dev/key-manager to hide keys";
  }

  showItem(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";

    return "Please use the key manager at https://rotur.dev/key-manager to show keys";
  }

  RAWgetAllPackets() {
    return JSON.stringify(this.packetQueue);
  }

  RAWgetFirstPacket() {
    return JSON.stringify(this.packetQueue[0] || "{}");
  }

  RAWdeleteFirstPacket() {
    this.packetQueue.shift();
  }

  RAWdeleteAllPackets() {
    this.packetQueue = [];
  }

  gotBadgesSuccessfully() {
    return JSON.stringify(this.badges) !== "[]";
  }

  userBadges() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(this.user["sys.badges"]);
  }

  userBadgeCount() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return this.user["sys.badges"].length;
  }

  hasBadge(args) {
    if (!this.is_connected) return false;
    if (!this.authenticated) return false;
    return this.user["sys.badges"].includes(args.BADGE);
  }

  allBadges() {
    console.log(this.badges);
    return JSON.stringify(Object.keys(this.badges));
  }

  badgeInfo(args) {
    return JSON.stringify(this.badges?.[args.BADGE] ?? {});
  }

  redownloadBadges() {
    this._initializeBadges()
  }

  callUser(args) {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (args.USERNAME === this.user.username) return "You Can't Call Yourself";

    return new Promise((resolve, reject) => {
      // Send the call request
      this.ws.send(
        JSON.stringify({
          cmd: "pmsg",
          val: {
            command: "call",
            client: this.my_client,
            id: ":3",
            payload: "request",
            peer: args.USERNAME,
            username: this.username,
          },
          id: this.accounts,
        })
      );

      // Set up timeout for 10 seconds
      const timeout = setTimeout(() => {
        this.ws.removeEventListener("message", callResponseHandler);
        resolve(JSON.stringify({
          success: false,
          message: "Call timed out - no response received"
        }));
      }, 10000);

      // Handler for the call confirmation response
      const callResponseHandler = (event) => {
        try {
          const packet = JSON.parse(event.data);

          // Check if this is a call confirmation response
          if (packet?.val?.source_command === "call" &&
            packet?.val?.payload === "confirm" &&
            packet?.origin?.username === this.accounts) {

            // Clear the timeout and remove the event listener
            clearTimeout(timeout);
            this.ws.removeEventListener("message", callResponseHandler);

            // Extract and return the call data
            const callData = {
              success: true,
              from: packet.val.from,
              from_username: packet.val.from_username,
              from_rotur: packet.val.from_rotur,
            };

            // Store the call data and resolve with it
            this.callJson = callData;
            resolve(JSON.stringify(callData));
          }
        } catch (error) {
          console.error("Error handling call response:", error);
        }
      };

      // Add the event listener for call responses
      this.ws.addEventListener("message", callResponseHandler);
    });
  }

  callData() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    return JSON.stringify(this.callJson);
  }

  acceptCall() {
    if (!this.is_connected) return "Not Connected";
    if (!this.authenticated) return "Not Logged In";
    if (!this.callJson) return "No Call Data";

    this.ws.send(
      JSON.stringify({
        cmd: "pmsg",
        val: {
          command: "call",
          client: this.my_client,
          id: ":3",
          payload: "confirm",
          peer: this.callJson.from,
          username: this.username,
        },
        id: this.accounts,
      })
    );
  }
}

var roturExtension = null;
onstartup.push(async () => {
  let localroturdata = await window.getSetting("roturLink");
  if (localroturdata) {
    await attemptConnection();
  }
});

async function attemptConnection() {
  if (roturExtension?.is_connected) {
    return true;
  } else if (!roturExtension) {
    roturExtension = new RoturExtension();
  }
  roturExtension.connectToServer({ DESIGNATION: "nva", SYSTEM: "lairOS", VERSION: "2" });
}

async function logoutofrtr() {
  remSettingKey("roturLink");
  await roturExtension.logout();
  roturExtension.disconnect();
}

function roturTWEventCall(data) {
  if (data == "roturEXT_whenAuthenticated") {
    fetch("https://social.rotur.dev/claim_daily?auth=" + roturExtension.userToken).then((response) => {
      if (response.ok) {
        notify(`Logged in as ${roturExtension.username}`, "You got the daily credit!", "RoturTW", 1)
      } else {
        notify(`Logged in as ${roturExtension.user.username}`, "Welcome back!", "RoturTW", 1)
        throw new Error('Failed to claim daily reward');
      }
    })
    eventBusWorker.deliver({
      type: "rotur",
      event: "authDone"
    });
  } else if (data == "roturEXT_whenConnected") {
    (async () => {
      let localroturdata = await window.getSetting("roturLink");
      if (localroturdata) {
        sysLog("RoturTW", `Trying to log in`);
        let targettype = JSON.parse(localroturdata).type;
        if (targettype == "pswd") {
          let targetun = JSON.parse(localroturdata).username;
          let targetpass = JSON.parse(localroturdata).password;
          await roturExtension.login({ USERNAME: targetun, PASSWORD: targetpass });
        } else if (targettype == "token") {
          await roturExtension.loginToken({ TOKEN: JSON.parse(localroturdata).token })
        }
      } else {
        roturExtension.login_prompt({ STYLE_URL: "https://lair2.vercel.app/lair-dev-repl-rl/libs/roturstyle.css" });
      }
    })();
  }
}