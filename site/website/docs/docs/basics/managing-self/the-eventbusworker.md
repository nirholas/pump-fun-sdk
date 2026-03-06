# The EventBusWorker

## What is PumpOS `EventBusWorker`?

PumpOS EventBusWorker is system for all of PumpOS and its apps to know what is being updated in real time, and possibly with more context.

## How to access the event bus?

{% hint style="warning" %}
Apps can access this feature through the `myWindow` method. To use the myWindow method, you have to use the `greenflag()` function. Otherwise, it will return undefined. This is due to the fact that the `myWindow` object is only defined after the app document is loaded.

More: [greenflag](../timing.md), [mywindow](./).
{% endhint %}

### Basic syntax

```javascript
eventBus.listen("EVENT_TYPE", (event) => {
  // your code here
});
```

### Example

```javascript
eventBus.listen("memory", (event) => {
  // your code here
});
```

Here, the parameter `"memory"` is used as event type. Therefore, this worker will only listen for memory events.

## System Events

There are multiple types of system events, including:

### `memory`

A system event that provides updates about a change in the file system.

The memory event has this default syntax:

```javascript
{
  "event":EVENT_TITLE,
  "id":EVENT_ID,
  "key":AFFECTED_REGION
}
```

#### Event titles

Event titles are titles assigned for each kind of operation. Here is a list of all default event titles for the `memory` event:

* `update`: after a file has been updated in an AFFECTED\_REGION. (Affected region contains the folder, or the path of the file updated.)

{% hint style="info" %}
#### When files get moved:

The event bus will provide the folder name of the target folder or the folder where the file gets moved to.
{% endhint %}

### `settings`

A system event that provides updates about a change in the system settings, set through the settings application.

The settings event has this default syntax:

```javascript
{
  "event":EVENT_TITLE,
  "key":CODE_OF_SETTING
}
```

{% hint style="info" %}
Here is a list of all settings codes and how to get the values of them: [Settings Descriptions](https://github.com/nirholas/pumpOS/wiki/Settings-Descriptions)
{% endhint %}

#### Event titles

Here is a list of all default event titles for the `settings` event:

* `set`: When the user sets a setting (key available).
* `remove`: When the user removes a setting (key available).
* `reset`: When the user resets all settings to defaults.

{% hint style="info" %}
**Tip**

Settings update will also mean a file update in the `System/` folder; you can do something like this to get a settings update with memory events:

```javascript
myWindow.eventBusWorker.listen("memory", (event) => {
	if (event?.key.includes("System/")) {
		// your scripts here
	}
});
```
{% endhint %}

## Delivering events

Not only that you can listen to events, but the event bus also has a function to deliver your events too. Making a multi-window application, a real thing.

### Basic syntax:

```
eventBus.deliver({
  "type":EVENT_TYPE, // must be specified on listening
  "event":EVENT_TITLE, // optional event title
  "key":key  // optional event key data
  // add more params up to your requirements.
});
```

{% hint style="info" %}
Events that have no listeners, will not get broadcasted.
{% endhint %}

## Use cases

Whether you want to show a reflection of the virtual memory system, or you wanted to mirror the contents of an updating file while its being saved per every change, the PumpOS event bus could be used as an efficient updates system that lets you remotely do things, without spamming unwanted calls.
