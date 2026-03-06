# Introduction

Applications in PumpOS are singular HTML files saved with an `.app` extension. The syntax and functionality are similar to that of native web development, but with certain additions that let the app perform natively with PumpOS features.

App files can be launched from anywhere and will follow the same method. In PumpOS, the launching of apps is controlled by the PumpOS Kernel

## NTX

{% hint style="info" %}
From PumpOS 2.1, NTX has become the heart of PumpOS applications. Even though it's optional, features like NTX and Pump.CSS give access to a library of native features in the system.
{% endhint %}

Inter-app and other communications are controlled by a centralized transaction system, the Pump Transaction Exchange (or NTX). NTX also deals with application-system communication. NTX is separated into many namespaces, like utility, fileGet, settings, etc.

Each NTX namespace requires permission from the user to resolve correctly. If required permissions aren't granted on app install, namespace permissions would be asked one at a time.

Applications can function as packagers or installers, which can be done via the JavaScript native fetch API and NTX's file management namespaces. Applications require user permissions to manipulate any directories or items in them.&#x20;

## App permissions

App permissions are also managed by the NTX, which provides numerous API functions that applications can use, operating similarly to Remote Procedure Calls. Here's a list of all namespaces:

* Tools and utility functions: utility
* File management: fileGet, fileSet
* Directory management: dir
* Handler management and trigger app launches: olp
* Settings management: settings
* User management: accounts
* Application management: apps
* System UI management: sysUI
* System management: system
* Specific system functions and sequences: specific
* Run Unsandboxed \[_deprecated_]: unsandboxed&#x20;

{% hint style="warning" %}
The user can turn off any of these namespaces for your application; this will cause ntx actions to return _undefined_. Some namespaces, if enabled, can let the application prevent further limiting of permissions (by effectively 'escaping the cage'). These namespaces include `fileSet`, `settings`, `system`, and `unsandboxed`.
{% endhint %}

## Future

{% hint style="info" %}
The upcoming PumpOS Panels in Pump Nav would have a different syntax from the applications, which would allow them to function best in a widget-like fashion.
{% endhint %}
