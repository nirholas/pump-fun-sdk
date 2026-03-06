---
name: App Submission
about: Submit an app to the Pump Store
title: '[APP] App Name'
labels: app-submission
assignees: ''
---

## App Information

**App Name**: 
**Author/Developer**: 
**Category**: [productivity/games/utilities/social/education/other]

## Description
A clear description of what your app does.

## Screenshots
Add 1-3 screenshots of your app in action.

## Technical Details

**App Type**: 
- [ ] Local HTML (included in repo)
- [ ] External URL

**Source**: 
<!-- For local: /Pump-Store/apps/yourapp.html -->
<!-- For external: https://your-app-url.com -->

**Permissions Required**:
- [ ] File System (fileGet, fileSet)
- [ ] Settings
- [ ] Clipboard
- [ ] Notifications
- [ ] Rotur Networking
- [ ] None (basic app)

## App Entry (v2.json)

```json
{
    "name": "Your App Name",
    "author": "your-username",
    "description": "Short description of your app",
    "src": "/Pump-Store/apps/yourapp.html",
    "category": "category",
    "tags": ["tag1", "tag2"],
    "version": "1.0.0"
}
```

## Checklist

- [ ] My app follows the [Creating Apps guide](../docs/CREATING-APPS.md)
- [ ] My app works in the latest Chrome, Firefox, and Safari
- [ ] My app handles errors gracefully
- [ ] My app doesn't contain malicious code
- [ ] My app respects user privacy
- [ ] I have tested my app thoroughly
- [ ] My app has an appropriate icon (pump-icon meta tag)

## Additional Notes
Any other information about your app.
