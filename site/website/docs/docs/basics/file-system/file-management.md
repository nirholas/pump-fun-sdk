# File management

**`ntx.fileSet.createFile()`**

Create a File in a folder with specified content. This is an asynchronous function. Usage Example:

```js
await ntx.fileSet.createFile(folderName, fileName, type, content)
```

* where `folderName` is the Folder Name the file should be saved in (available: `Downloads` and `Apps`), and `fileName` is the File Name the file should be saved as. This **should not contain** a file extension, learn how to remove file extensions with Pump.js.
* `type` is the type of the file, for example, `app`, `txt` etc.
* `content` is the file content / value.

#### `olp.launch()`

Formally, Open Launch Protocol (OpenL) lets you open a default app with given data. This is an asynchronous function. Usage Example:

```js
await ntx.olp.launch(appname, data)
```

* where `appname` is the name of the app that it is going to open (**Only Default Apps**)

> ⚠ OpenL uses openapp() function, which is deprecated and can cause apps to be rewritten with error screens if there's connection issues.

The `data` given in this function will be saved in a `localStorage` key, which is `todo`. This will be saved in this following format:

```JSON
{
	"appname": "App Name",
	"data": "Data"
}
```

This data can later be read by the opened app (only the text app reads such.), in case you want to open something in the text app with the OL protocol, then here you go:

**Opening the Text App with OLP**

```js
ntx.olp.launch("text", {"lclfile": UID});
```

* where `UID` is an Identification of a File, usually it is a 6 Characters long string assigned to every single file in PumpOS. You may obtain it using the following function (getFileNamesByFolder)

> ⚠ This function is deprecated and may be replaced with a more proper and efficient function in near future. Try to not use this on production.

#### `getFileNamesByFolder()`

Get an object that has `name` and `id` (UID) of all files in a folder.

Usage Example:

```js
await ntx.fileGet.getFileNamesByFolder(folderName)
```

* where folderName is the target Folder's Name.

#### `getFileByPath()`

Get the file content with a path. This is an asynchronous function.

Usage Example:

```js
await pumpos.getFileByPath(path)
```

* where `path` is the path of the file.

**What is a path?** A path is a string, separated by slashes (/). This string starts with the folder name and ends with the file name.

**Edge cases:** What happens if the folder contains more than one unique file with that name? The function returns an object (array) with all the matching files.

But, if you have the UID of a file that exists, how can you get its content?

#### `getFileById()`

Get a file content with a UID. This is an asynchronous function.

Usage Example:

```js
await ntx.fileGet.byId(UID)
```

If you only want a specific kind of data from the file (uses lower resources):

<pre class="language-js"><code class="lang-js"><strong>await ntx.fileGet.byId(UID, "fileName|content|metadata|path")
</strong></code></pre>
