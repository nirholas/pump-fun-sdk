# Using myWindow

Here is an example script to close the current application.&#x20;

```javascript
function closeApp() {
  myWindow.close();
}
```

Here is an example script to return the IDs of your app.

```javascript
function whatIsMyFileId() {
  return myWindow.appID; // returns the ID of the source file
}

function whatIsMyWindowId() {
  return myWindow.windowID; // returns the ID of the current window
}
```

myWindow is also used under OLP for initiating your app as a handler, [learn how.](the-open-launch-protocol.md#using-olp-as-a-trigger)
