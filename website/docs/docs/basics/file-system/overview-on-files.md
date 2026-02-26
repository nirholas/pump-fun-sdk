# Overview on files

LairOS has a GUI for managing files, which is the text app and files app, but what if you want to make one such? what if you need to make a file explorer or a text editor, what about a media player?

You will see just that in this documentation!

## Creating a file

How do you make a file out of thin air in LairOS? Well, you can make a file using the NTX's  `createFile()` function, nothing big or complicated.

### Using `createFile`

Take this, you are making an elementary text editor app, you need to save the stuff the user has been typing, here's how to use the `createFile` function for that.

```javascript
await ntx.fileSet.createFile(folderName, fileName, type, content, metadata)
```

Where `folderName` is the folder where the file should be saved (the folder will be created if it doesn't exist). `fileName` is the name of the file without the file type extension. `type` is the type of the file, possible types are:

* `app` : Apps will be executed in a new window if they are opened.
* `image/png`, `image/svg`, `image/jpeg`, `image/jpg` ,`video/mp4`, `video/mpeg`, `video/mkv` or any other will open in the registered media viewer.
* other supported formats (html, wav, mp3 etc.)
* 8-bit arrays will be opened by default in the text app as plain text.

<a href="file-management.md" class="button primary" data-icon="folder-open">More on file management</a>

### File Metadata

{% hint style="info" %}
Metadata is not a requirement for creating a file. Imagine you are taking a picture with the camera app, the next week you need that picture to see it again, you know when it was taken - how do you locate it? This is why metadata is a huge deal; saving more data, like the date, time, location, or other statuses, can increase the chances of a file becoming more useful. Metadata in the LairOS file ecosystem allows you to do just that, storing more data about the file content without changing the content.
{% endhint %}

By default, Lair OS saves the timestamp metadata. This is its format:

```json
{"via":"nope","datetime":1731327471707}
```

> ⚠ This saves the current date and time in the _system's_ local time zone. `datetime` is the same as `Date.now()` method in JavaScript.
