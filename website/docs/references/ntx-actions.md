---
icon: arrow-up-arrow-down
---

# NTX Actions

## fileGet

Actions that deal with reading files.

| Function        | Description                              |
| --------------- | ---------------------------------------- |
| getFileById     | get a file using the ID                  |
| getFileNameByID | get the file's name by using the ID      |
| findFileDetails | get the details of the file using the ID |
| getFileByPath   | get a file using a path                  |

## fileSet

Actions that deal with creating and writing files.

| Function   | Description                       |
| ---------- | --------------------------------- |
| createFile | create a file that does not exist |
| updateFile | update an existing file           |
| removeFile | remove a file and its content     |
| moveFile   | move a file to a path             |

## dir

Actions that deal with directory management

| Function       | Description                                     |
| -------------- | ----------------------------------------------- |
| getFolderNames | get surface level directoy names in root folder |
| remove         | remove a folder and its contents                |
| create         | create a new folder with its path               |

## olp

Actions that deal with creating and writing files.

| Function   | Description                                |
| ---------- | ------------------------------------------ |
| openFile   | open a file with its ID                    |
| launch     | launch an app using the classic OLP method |
| useHandler | use a default handler application          |

## ctntMgr

Actions that deal with setting and getting raw content data in the database

| Function | Description                          |
| -------- | ------------------------------------ |
| get      | read a file's content using its ID   |
| set      | write a file's content using its ID  |
| remove   | remove a file's content using its ID |

## settings

Actions that deal with creating and writing settings keys.

| Function              | Description                      |
| --------------------- | -------------------------------- |
| get                   | get the value of a settings key  |
| set                   | set the value of a settings key  |
| remove                | remove a settings key            |
| resetAll              | reset all settings with defaults |
| ensurePreferencesFile | ensure a file in System/ exists  |

## accounts

Actions that deal with users

| Function                  | Description                                |
| ------------------------- | ------------------------------------------ |
| removeUser                | open a file with its ID                    |
| removeInvalidMagicStrings | launch an app using the classic OLP method |
| changePassword            | use a default handler application          |
