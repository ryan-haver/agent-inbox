# Agent Inbox - Persistent Storage Test Plan

## Test Overview

This document provides step-by-step testing procedures for the new persistent storage feature.

## Prerequisites

- Docker installed and running
- Agent-inbox image built: `agent-inbox:test`
- Port 3000 available (or change to another port)
- Browser with DevTools access (Chrome, Firefox, Edge)

## Build the Test Image

```powershell
cd c:\scripts\unraid-templates\LangChain\agent-inbox
docker build -t agent-inbox:test .
```

**Expected Result**: Build succeeds, no compilation errors

---

## Test 1: Browser-Only Mode (Default) ✅

**Purpose**: Verify backward compatibility - original behavior works unchanged

### Step 1: Start Container (No Volumes)

```powershell
docker run --rm -d `
  --name agent-inbox-test `
  -p 3000:3000 `
  agent-inbox:test
```

### Step 2: Check Logs

```powershell
docker logs agent-inbox-test
```

**Expected Output**:
```
[Config Storage] Server storage not enabled (USE_SERVER_STORAGE=false)
Ready started on 0.0.0.0:3000
```

### Step 3: Open in Browser

Navigate to: http://localhost:3000

### Step 4: Configure an Inbox

1. Click Settings (bottom left icon)
2. Add LangSmith API Key (any test value like `test-key-123`)
3. Click "Add Inbox"
4. Fill in:
   - **Name**: Test Inbox
   - **Graph ID**: test_agent
   - **Deployment URL**: http://test:2024

### Step 5: Verify localStorage Storage

Open Browser DevTools (F12):
1. Go to **Application** tab → **Local Storage** → `http://localhost:3000`
2. Look for keys:
   - `agentInboxes` - Should contain your inbox configuration
   - `langsmithApiKey` - Should contain `test-key-123`

**Expected Result**: ✅ Configuration stored in browser localStorage only

### Step 6: Test Server Storage Detection

In browser console (F12), run:
```javascript
fetch('/api/config').then(r => r.json()).then(console.log)
```

**Expected Response**:
```json
{
  "enabled": false,
  "message": "Server-side storage is disabled. Using browser localStorage."
}
```

### Step 7: Restart Container

```powershell
docker restart agent-inbox-test
```

Refresh browser - configuration should persist (from localStorage)

### Step 8: Clear Browser Data

1. DevTools → Application → Local Storage → Right-click → Clear
2. Refresh page

**Expected Result**: ✅ Configuration is gone (expected behavior for browser-only mode)

### Step 9: Cleanup

```powershell
docker stop agent-inbox-test
```

---

## Test 2: Server Storage Mode (Persistent) ✅

**Purpose**: Verify server-side storage works and syncs correctly

### Step 1: Create Test Data Directory

```powershell
mkdir -p C:\temp\agent-inbox-test-data
```

### Step 2: Start Container with Server Storage

```powershell
docker run --rm -d `
  --name agent-inbox-test `
  -p 3000:3000 `
  -e USE_SERVER_STORAGE=true `
  -v C:\temp\agent-inbox-test-data:/app/data `
  agent-inbox:test
```

### Step 3: Check Logs

```powershell
docker logs agent-inbox-test
```

**Expected Output**:
```
[Config Storage] Server storage enabled
[Config Storage] No configuration file found (first run)
Ready started on 0.0.0.0:3000
```

### Step 4: Verify Server Storage Detection

Open http://localhost:3000

In browser console:
```javascript
fetch('/api/config').then(r => r.json()).then(console.log)
```

**Expected Response**:
```json
{
  "enabled": true,
  "config": null,
  "defaults": {}
}
```

### Step 5: Configure an Inbox

1. Click Settings
2. Add LangSmith API Key: `test-key-server-123`
3. Add Inbox:
   - **Name**: Server Storage Test
   - **Graph ID**: server_test_agent
   - **Deployment URL**: http://servertest:2024

### Step 6: Verify File Created

```powershell
cat C:\temp\agent-inbox-test-data\config.json
```

**Expected Output**:
```json
{
  "version": "1.0.0",
  "lastUpdated": "2024-10-30T...",
  "langsmithApiKey": "test-key-server-123",
  "inboxes": [
    {
      "id": "...",
      "name": "Server Storage Test",
      "graphId": "server_test_agent",
      "deploymentUrl": "http://servertest:2024",
      "selected": false,
      "createdAt": "..."
    }
  ],
  "preferences": {}
}
```

**Expected Result**: ✅ Configuration saved to file on host

### Step 7: Test Multi-Browser Sync

Option A - Same Browser, Incognito Window:
1. Open incognito/private window
2. Navigate to http://localhost:3000
3. Wait 5 seconds for sync

Option B - Different Browser:
1. Open in different browser (e.g., Firefox if you used Chrome)
2. Navigate to http://localhost:3000
3. Wait 5 seconds for sync

**Expected Result**: ✅ Configuration appears automatically (synced from server)

### Step 8: Test Browser Data Clear Protection

1. In original browser window
2. DevTools → Application → Local Storage → Clear all
3. Refresh page
4. Wait 5 seconds

**Expected Result**: ✅ Configuration reappears (synced from server)

### Step 9: Test Container Restart

```powershell
docker restart agent-inbox-test
```

Refresh browser after container restarts

**Expected Result**: ✅ Configuration persists after restart

### Step 10: Test Manual API Calls

**Load Configuration**:
```powershell
curl http://localhost:3000/api/config
```

**Save Configuration**:
```powershell
$body = @{
  inboxes = @(
    @{
      id = "api-test"
      name = "API Test Inbox"
      graphId = "api_agent"
      deploymentUrl = "http://api:2024"
      selected = $false
      createdAt = (Get-Date -Format "o")
    }
  )
  langsmithApiKey = "api-key-123"
  preferences = @{}
} | ConvertTo-Json -Depth 10

curl -X POST http://localhost:3000/api/config `
  -H "Content-Type: application/json" `
  -d $body
```

**Expected Result**: ✅ Configuration updated via API

### Step 11: Verify File Updated

```powershell
cat C:\temp\agent-inbox-test-data\config.json
```

**Expected Result**: ✅ File contains API-added inbox

### Step 12: Cleanup

```powershell
docker stop agent-inbox-test
rm -r C:\temp\agent-inbox-test-data
```

---

## Test 3: Pre-Configuration Mode ✅

**Purpose**: Verify environment variable pre-configuration works

### Step 1: Start Container with Pre-Configuration

```powershell
mkdir -p C:\temp\agent-inbox-preconfig

docker run --rm -d `
  --name agent-inbox-test `
  -p 3000:3000 `
  -e USE_SERVER_STORAGE=true `
  -e DEFAULT_INBOX_ENABLED=true `
  -e DEFAULT_INBOX_NAME="Pre-Configured Inbox" `
  -e DEFAULT_DEPLOYMENT_URL="http://executive-ai-assistant:2024" `
  -e DEFAULT_ASSISTANT_ID="email_assistant" `
  -e LANGSMITH_API_KEY="preconfigured-key-789" `
  -v C:\temp\agent-inbox-preconfig:/app/data `
  agent-inbox:test
```

### Step 2: Check Logs

```powershell
docker logs agent-inbox-test
```

### Step 3: Open Browser

Navigate to: http://localhost:3000

**Expected Result**: ✅ Inbox already configured!
- Settings should show "Pre-Configured Inbox"
- LangSmith API Key should be set
- No manual configuration needed

### Step 4: Verify Config File

```powershell
cat C:\temp\agent-inbox-preconfig\config.json
```

**Expected Output**:
```json
{
  "version": "1.0.0",
  "langsmithApiKey": "preconfigured-key-789",
  "inboxes": [
    {
      "id": "default",
      "name": "Pre-Configured Inbox",
      "graphId": "email_assistant",
      "deploymentUrl": "http://executive-ai-assistant:2024",
      ...
    }
  ]
}
```

### Step 5: Cleanup

```powershell
docker stop agent-inbox-test
rm -r C:\temp\agent-inbox-preconfig
```

---

## Test 4: Fallback Behavior ✅

**Purpose**: Verify graceful fallback when server storage fails

### Step 1: Start with Read-Only Volume

```powershell
mkdir C:\temp\agent-inbox-readonly
# Create an empty config file
echo "{}" > C:\temp\agent-inbox-readonly\config.json
# Make it read-only
Set-ItemProperty C:\temp\agent-inbox-readonly\config.json -Name IsReadOnly -Value $true

docker run --rm -d `
  --name agent-inbox-test `
  -p 3000:3000 `
  -e USE_SERVER_STORAGE=true `
  -v C:\temp\agent-inbox-readonly:/app/data:ro `
  agent-inbox:test
```

### Step 2: Check Logs

```powershell
docker logs agent-inbox-test -f
```

**Expected Output**: Should see errors about unable to write but container still runs

### Step 3: Test Browser Access

Open http://localhost:3000

Try to add an inbox in the UI

**Expected Result**: ✅ Falls back to browser localStorage, UI still works

### Step 4: Cleanup

```powershell
docker stop agent-inbox-test
Set-ItemProperty C:\temp\agent-inbox-readonly\config.json -Name IsReadOnly -Value $false
rm -r C:\temp\agent-inbox-readonly
```

---

## Test 5: Export/Import (Backup/Restore) ✅

**Purpose**: Verify backup and restore functionality

### Step 1: Start Container with Data

```powershell
mkdir C:\temp\agent-inbox-backup

docker run --rm -d `
  --name agent-inbox-test `
  -p 3000:3000 `
  -e USE_SERVER_STORAGE=true `
  -v C:\temp\agent-inbox-backup:/app/data `
  agent-inbox:test
```

### Step 2: Create Test Configuration

Use browser to add:
- LangSmith API Key: `backup-test-key`
- 2 inboxes with different configurations

### Step 3: Export Configuration

```powershell
# Export to backup file
curl http://localhost:3000/api/config > C:\temp\backup.json

# Verify backup
cat C:\temp\backup.json
```

### Step 4: Delete Configuration

```powershell
curl -X DELETE http://localhost:3000/api/config
```

Refresh browser - configuration should be gone

### Step 5: Import Configuration

```powershell
# Restore from backup
curl -X POST http://localhost:3000/api/config `
  -H "Content-Type: application/json" `
  -d (Get-Content C:\temp\backup.json -Raw)
```

### Step 6: Verify Restore

Refresh browser

**Expected Result**: ✅ Configuration restored from backup

### Step 7: Cleanup

```powershell
docker stop agent-inbox-test
rm -r C:\temp\agent-inbox-backup
rm C:\temp\backup.json
```

---

## Quick Test Commands

### Check if build succeeded:
```powershell
docker images | Select-String agent-inbox
```

### View all container logs:
```powershell
docker logs agent-inbox-test -f
```

### Execute commands inside container:
```powershell
docker exec agent-inbox-test ls -la /app/data
docker exec agent-inbox-test cat /app/data/config.json
```

### Check container health:
```powershell
docker inspect agent-inbox-test | Select-String Health -A 10
```

### Monitor file changes (host):
```powershell
Get-Content C:\temp\agent-inbox-test-data\config.json -Wait
```

---

## Troubleshooting

### Build fails with TypeScript errors
**Fix**: This shouldn't happen - TypeScript errors should resolve during build
**Debug**: Check build output for specific error messages

### Container won't start
**Check**:
```powershell
docker logs agent-inbox-test
```

### Configuration not saving
**Check**:
1. Is USE_SERVER_STORAGE=true?
2. Is volume mounted correctly?
3. Does /app/data have correct permissions?

**Debug**:
```powershell
docker exec agent-inbox-test ls -la /app/data
docker exec agent-inbox-test whoami  # Should be: nextjs
```

### Browser console errors
**Check**: Browser DevTools → Console tab
**Look for**: "[Persistent Config]" log messages

### File not created on host
**Check**:
```powershell
# Verify mount
docker inspect agent-inbox-test | Select-String Mounts -A 20

# Check permissions
docker exec agent-inbox-test stat /app/data
```

---

## Success Criteria

### Test 1 (Browser-Only): ✅
- [ ] Container starts without errors
- [ ] Configuration stored in localStorage
- [ ] Server storage reports as disabled
- [ ] Configuration lost on browser clear (expected)

### Test 2 (Server Storage): ✅
- [ ] Container starts with server storage enabled
- [ ] config.json file created on host
- [ ] Configuration syncs to server automatically
- [ ] Multi-browser sync works
- [ ] Survives browser data clear
- [ ] Survives container restart

### Test 3 (Pre-Configuration): ✅
- [ ] Default inbox created from environment variables
- [ ] Configuration appears without manual setup
- [ ] File contains pre-configured values

### Test 4 (Fallback): ✅
- [ ] Container runs even with storage errors
- [ ] UI still functional with localStorage fallback

### Test 5 (Backup/Restore): ✅
- [ ] Export creates valid JSON backup
- [ ] Import restores configuration correctly

---

## Final Validation

After all tests pass:

```powershell
# Clean up test containers
docker ps -a | Select-String agent-inbox-test
docker rm -f agent-inbox-test

# Clean up test directories
rm -r C:\temp\agent-inbox-*

# Tag image for production (optional)
docker tag agent-inbox:test agent-inbox:latest
```

**Status**: Ready for production deployment! 🎉
