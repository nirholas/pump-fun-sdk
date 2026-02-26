---
icon: hammer
---

# Data recovery

In scenarios like where the LairOS files exists and are mis-formatted or saved in an undiscoverable location, there are still ways to 'recover' the data lost.

## Directory search

Using the LairOS smartsearch feature, you can simply search for the file name on the Lair Nav. This will search in all directories in your root.

## Browsing the file system in text

Head to [https://lair2.vercel.app/bios.html](https://lair2.vercel.app/bios.html), this page is a CLI interface for your LairOS system. It's able to access all your files and data **if your password is not set.**

{% hint style="warning" %}
This only works with the account named 'Admin' with no password set.
{% endhint %}

{% hint style="success" %}
You can either use the browser inspect window, or the terminal in the Lair Setup options menu to access the command interface of a select account with a password.

Contact experts in our discord if you require better chances of recovery.
{% endhint %}

## LairOS file system: Cheat Sheet

* The LairOS file system or 'memory' is a JS Object with two keys, 'memory' and 'contentpool'.
* The 'memory' key has a value with another nested object, 'root'.
* 'root' has the structure of the entire filesystem, in which, subfolders are nested objects.
* every key in root, and its child objects are called 'items'
* 'items' can either be a folder or a file. You can tell them apart by looking at the end of its name
* folders, having nested items, will have a slash symbol (/) at its end.
* the names of files are file names, which has an extension at its end.
* The file extension defines its file type, it starts with a period symbol (.). (ex: .txt)
* These file items have more keys in them, they are 'id', 'metadata'.
* The ID, or the unique identifier string, is a random 12-character string used to tell files apart.
* Metadata includes more keys that the creator or the editor of the file defines.
* By default, LairOS saves a 'dateTime' metadata with a UNIX timestamp.
* The 'contentpool' object, stores the more vital, content data of the file items in the file system.
* It contains keys that reference file IDs and values representing their content.
* The values are a string with two parts, the MIME part and the content seperated by a comma symbol (,).
* The MIME part starts with 'data:' followed by the abstract file type ('text', 'image' etc) followed by a slash symbol (/), followed by the specific file type ('json', 'png', 'webp' etc), followed by 'base64'.
*   eg. MIME part:&#x20;

    ```
    data:application/json;base64,
    ```
* The content part is a base64 encoded string of the raw file content.

## Using the CLI to browse files

* use `memory` to view the tree
*   use this snippet to view file contents using file ID

    ```javascript
    await getFileContents(FILE_ID);
    ```
* use `decodeBase64Content(FILE_CONTENTS);` function to decode the base64 content of the file with the MIME part.
