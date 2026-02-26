# Choose files

This page is all about letting a user choose a file from their file system. LairOS lets users select files from the registered app, which has its capabilities as  '`file_manager`'.

## Requesting a file selector window

Here is the method to summon a choose file window with the default files app in LairOS.

```javascript
await ntx.olp.useHandler("file_manager", { 
 "opener": "any", 
 "dir": "Downloads/" 
});
```

This returns the selected file ID once the user has selected it.

Here, we use the [OL protocol](../managing-self/the-open-launch-protocol.md) to launch the application with the data, which has some parameters.

{% hint style="warning" %}
Apps can access this feature through the `myWindow` method. To use the myWindow method, you have to use the `greenflag()` function. Otherwise, it will return undefined. This is due to the fact that the `myWindow` object is only defined after the app document is loaded.

More: [greenflag](../timing.md), [mywindow](../managing-self/).
{% endhint %}

### Opener params

| Opener param | description                                            | examples                                   |
| ------------ | ------------------------------------------------------ | ------------------------------------------ |
| opener       | A file type to filter with.                            | <p>"opener":"json"<br>"opener":"app"</p>   |
| dir          | A directory to initialize the choose file window with. | <p>"dir":"Downloads/"<br>"dir":"Apps/"</p> |

