# Timing

### Green Flag Request

The `greenflag` serves as a prompt dispatched precisely during post-application launch. It functions as an app instigator, managing the initial execution of the application. On a more pragmatic level, `greenflag` it is simply a function dedicated to running the script content of the application during app launch. Every app has its unique `greenflag` broadcast; they will not interfere.

The `greenflag` function is not required for an application, and orphaned scripts will get executed in order.

Sample code:

```js
function greenflag() {
  initialiseUI();
}
```

## Using MyWindow

The default `myWindow` object (learn about myWindow) also gets loaded only when the `greenflag` is triggered. You cannot use `myWindow` before the `greenflag` function gets called.&#x20;
