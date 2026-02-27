# Managing self

In PumpOS, apps are provided with an object to let the manage themselves. For example, closing your app window or changing to title in the window navigation bar.

Developers can use the `myWindow` object to handle these.  The `myWindow` object is injected to all application windows and can be accessed within a [`greenflag` function](../timing.md).

{% hint style="warning" %}
An application cannot run scripts without an opened window in PumpOS2. Be sure to save important data while closing your application by itself.

It is highly unrecommended to block the user from managing aspects of your application.
{% endhint %}
