# Browser Console Test Commands

Open the Agent Inbox in your browser at http://localhost:3000

Then open DevTools (F12) and paste these commands in the Console tab:

## Test 1: Check if server config loaded via API

```javascript
fetch('/api/config')
  .then(r => r.json())
  .then(data => {
    console.log('=== SERVER CONFIG ===');
    console.log('Enabled:', data.enabled);
    console.log('LangSmith Key:', data.config?.langsmithApiKey);
    console.log('Inboxes:', data.config?.inboxes);
    console.log('Preferences:', data.config?.preferences);
  });
```

**Expected Output**:
- Enabled: `true`
- LangSmith Key: `lsv2_pt_backend_test_key_12345`
- Inboxes: Array with "Backend Configured Inbox"
- Preferences: `{theme: "dark"}`

---

## Test 2: Check browser localStorage (after sync)

```javascript
console.log('=== BROWSER LOCALSTORAGE ===');
console.log('LangSmith Key:', localStorage.getItem('langsmithApiKey'));
console.log('Inboxes:', localStorage.getItem('agentInboxes'));
console.log('Preferences:', localStorage.getItem('agentInboxPreferences'));
```

**Expected Output**:
- LangSmith Key: `lsv2_pt_backend_test_key_12345`
- Inboxes: JSON string with "Backend Configured Inbox"
- Preferences: `{"theme":"dark"}`

**Note**: If localStorage is empty, wait 5 seconds for the `usePersistentConfig` hook to sync from server, then run again.

---

## Test 3: Watch for sync logs

Look for these console messages (from `usePersistentConfig` hook):
- `[Persistent Config] Server storage enabled`
- `[Persistent Config] Loaded from server`
- `[Persistent Config] Saved to localStorage`
- `[Persistent Config] Pushing local config to server` (if browser had data first)

---

## Test 4: Verify API key shows in UI

1. Click the **Settings icon** (bottom left, gear/cog icon)
2. Check if the **LangSmith API Key** field contains: `lsv2_pt_backend_test_key_12345`
3. Check if there's an inbox named: **"Backend Configured Inbox"**

If you see the API key and inbox in the UI, **the sync is working perfectly!** ✅

---

## Test 5: Modify config in UI, check if it saves to file

1. In the Settings, **edit the LangSmith API key** to something new (e.g., `modified-in-ui-12345`)
2. Add a new inbox or modify the existing one
3. Wait 1 second (debounced save)
4. Check the file on host:

```powershell
cat C:\temp\agent-inbox-test-data\config.json
```

**Expected**: File should contain your UI modifications!

---

## What This Proves

✅ **Server → Browser Sync**: Config file loads into API, React hook syncs to localStorage, UI displays it
✅ **Browser → Server Sync**: UI changes trigger hook updates, which POST to API, which saves to file
✅ **Bidirectional Sync**: Full round-trip works in both directions
✅ **Persistence**: Changes survive container restarts (file-based storage)
