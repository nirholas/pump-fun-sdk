# File system

The core file system of LairOS is saved in a low-level local browser API called the IndexedDB. This can safely store large amounts of data right in your browser's storage.

The file system is a collection of linked folders and files, which form a tree.

The LairOS Memory is simply a JS Object. This JS object contains keys and values which make up different Items.

The core file system, as mentioned above, is saved in IDB, but inside indexedDB, we open a domain-wide IDB database. This database has a store for every user. This store contains a set of keys and values which are tree and `contentpool`.

The `tree` is the virtual folder structure of the memory. In LairOS, these folders either contain an array of arrays or objects, which are subfolders or files, respectively. Whereas the `contentpool` contains the file contents as values with file IDs as their keys.

## Rules

* Folder names should end with a slash (/)
* Every file must have a file name with a file extension.
* The file name can only contain a period (.) symbol, which will separate the file name and its type/extension. If more than one period (.) symbol is present, the system will treat the last occurrence as the file name terminator.
* Every file must have a defined Unique ID, which is a string with 12 characters.
* There are no special rules for folders or subfolders. Both should be treated equally as much as possible.

Based on that, we could make this diagram of the filesystem:

```json
"root":{
	"Downloads/": {
		"Welcome.txt": {
			"id": "sibq81"
		},
		"Subfolder/": {
			"Subfile.txt": {
				"id": "1283jh"
			}
		}
	},
	"Apps/": {}
},
"contentpool":{
	'1283jh': '',
	'sibq81': ''
}
```

## For a more efficient filesystem

We are putting in efforts to create the best filesystem on the web. Balancing speed and simplicity, we may create new filesystems that are better at doing what they should.
