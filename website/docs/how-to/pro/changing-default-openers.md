---
icon: circle-arrow-up-right
---

# Changing default openers

In PumpOS, file types, usually identified from the extension stored as a suffix in the name of the file, can be registered in the name of different applications. These applications can handle those file types.

The PumpOS Kernel uses the OLP to open these apps with the data about selected files that the app should respond about. The kernel uses a stored key value pair that is created during the installation of the app, in which the app IDs point to what file extensions they can handle.

This feature allows apps to register custom file types or read rare file types by default. These registered apps are called "Default openers".

## Changing default openers

On PumpOS Settings, you can change these default opener applications, only for registered file types.&#x20;

{% hint style="warning" %}
Meanwhile you can change the default openers, the default opener app decides how to handle these files, and if the app doesnt support the target file, the app would simply ignore the operation.

Apps ignoring OLP operations may cause broken workflows. If you are a developer, this can cause your app to be much less user intuitive.
{% endhint %}



{% stepper %}
{% step %}
### Open Settings app

Scroll down the side bar navigation and click on **defaults**.

<img src="../../.gitbook/assets/image (6) (1).png" alt="" data-size="original">
{% endstep %}

{% step %}
### Click to change

Click on the icons of applications associated with file type extensions you wish to change.

{% hint style="warning" %}
You must have an application in your file system that can handle the kind of file defined by its file name extension to complete this operation.
{% endhint %}
{% endstep %}

{% step %}
### Select an application to swap with

Once you have clicked the icon for the target extension from the table, you would be presented with a new file selector window that only shows .app files.

Click an application of your wish to swap the current default application with.
{% endstep %}

{% step %}
### Click open

After selecting the file in the file selector, click open button in the bottom right corner of the app or simple double click the desired item.
{% endstep %}
{% endstepper %}

To finish off your change, test PumpOS by trying to open file of that type.

{% hint style="info" %}
## Facing any issues?

Join our discord for help, [here](https://discord.gg/NhC8N2Mxta).
{% endhint %}
