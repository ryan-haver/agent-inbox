# Phase 4A: Draft Auto-Save Implementation

**Feature**: #1 - Draft Auto-Save (Most Critical)  
**Date**: October 31, 2025  
**Status**: ✅ Implementation Complete, Testing In Progress  
**Time Invested**: ~1.5 hours (implementation)

---

## 🎯 Problem Statement

Users were losing their typed responses when:
- Browser crashed
- Accidentally navigated away
- Page refreshed
- Switched to different thread

This caused frustration and lost work, especially for lengthy responses.

---

## 📋 Solution Overview

Implemented automatic draft saving with:
- **5-second debounce** - Saves 5 seconds after user stops typing
- **Per-thread storage** - Each conversation has its own draft
- **Auto-restore** - Drafts load automatically when returning to thread
- **Visual feedback** - "Draft saved at HH:MM:SS" indicator
- **Manual discard** - Reset button clears draft

---

## 🏗️ Architecture

### 1. **Hook Layer** (`use-draft-storage.tsx`)
Created dedicated hook for draft management:

```typescript
export function useDraftStorage(): UseDraftStorageReturn {
  const { config, updateConfig } = usePersistentConfig();
  const autoSaveTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  return {
    loadDraft,      // Retrieve saved draft for thread
    saveDraft,      // Save draft with 5-second debounce
    discardDraft,   // Remove draft and cancel pending saves
    hasDraft,       // Check if draft exists
    getLastSaved,   // Get last save timestamp
  };
}
```

**Key Features**:
- Debounced saves prevent excessive writes
- Map tracks pending timeouts per thread
- Cleanup on unmount prevents memory leaks
- Console logging for debugging

### 2. **Schema Layer**
Extended persistent configuration to store drafts:

**Frontend** (`use-persistent-config.tsx`):
```typescript
export interface PersistentConfig {
  // ... existing fields
  drafts?: {
    [threadId: string]: {
      content: string;
      lastSaved: string; // ISO timestamp
    };
  };
}
```

**Backend** (`config-storage.ts`):
```typescript
export interface StoredConfiguration {
  // ... existing fields
  drafts?: {
    [threadId: string]: {
      content: string;
      lastSaved: string;
    };
  };
}
```

### 3. **UI Layer** (`inbox-item-input.tsx`)
Integrated draft storage into response textarea:

**Changes Made**:
1. Added `threadId` prop to `InboxItemInputProps`
2. Updated `ResponseComponent` to use draft storage:
   - Load draft on mount (if response empty)
   - Save draft on change (debounced)
   - Discard draft on reset
   - Discard draft on successful submit
   - Show "Draft saved at HH:MM" indicator

**Code Snippet**:
```typescript
function ResponseComponent({ threadId, ... }) {
  const { loadDraft, saveDraft, discardDraft, hasDraft, getLastSaved } = useDraftStorage();
  
  // Load draft on mount
  React.useEffect(() => {
    const draft = loadDraft(threadId);
    if (draft && res && typeof res.args === "string" && !res.args) {
      onResponseChange(draft, res);
    }
  }, [threadId, loadDraft]);

  // Save draft on change
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    onResponseChange(newValue, res);
    saveDraft(threadId, newValue); // 5-second debounce
  };

  // Discard draft after submission
  const handleSubmitAndDiscardDraft = async (e) => {
    await handleSubmit(e);
    discardDraft(threadId);
  };

  // Show draft indicator
  const lastSaved = getLastSaved(threadId);
  const showDraftIndicator = hasDraft(threadId) && lastSaved;

  return (
    <div>
      {showDraftIndicator && (
        <span>Draft saved at {lastSaved.toLocaleTimeString()}</span>
      )}
      <Textarea
        value={res.args}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <Button onClick={handleSubmitAndDiscardDraft}>Send Response</Button>
    </div>
  );
}
```

### 4. **Parent Component** (`thread-actions-view.tsx`)
Updated to pass `threadId` to `InboxItemInput`:

```typescript
<InboxItemInput
  threadId={threadData.thread.thread_id}  // ← NEW
  // ... other props
/>
```

---

## 📁 Files Modified

1. ✅ **src/hooks/use-draft-storage.tsx** (NEW - 155 lines)
   - Complete draft storage hook implementation
   - 5 public functions (load, save, discard, hasDraft, getLastSaved)
   - Debounced auto-save logic
   - Cleanup on unmount

2. ✅ **src/hooks/use-persistent-config.tsx** (lines 38-48)
   - Extended `PersistentConfig` interface
   - Added `drafts?: { [threadId: string]: { content, lastSaved } }`

3. ✅ **src/lib/config-storage.ts** (lines 27-37)
   - Extended `StoredConfiguration` interface
   - Mirrored frontend schema for backend validation

4. ✅ **src/components/agent-inbox/components/inbox-item-input.tsx** (multiple sections)
   - Added `useDraftStorage` import (line 18)
   - Added `threadId` to `InboxItemInputProps` (line 59)
   - Updated `ResponseComponent` signature (line 88)
   - Added draft loading effect (lines 103-110)
   - Added draft saving handler (lines 118-122)
   - Added draft discard handler (lines 124-127)
   - Added submit + discard handler (lines 129-134)
   - Added draft indicator UI (lines 143-147)
   - Updated textarea handler (line 151)
   - Updated submit button (line 157)
   - Added `threadId` destructuring (line 352)
   - Passed `threadId` to Response component (line 566)

5. ✅ **src/components/agent-inbox/components/thread-actions-view.tsx** (line 537)
   - Added `threadId={threadData.thread.thread_id}` prop to InboxItemInput

---

## 🧪 Testing Checklist

### Test 1: Basic Auto-Save (5 seconds)
**Steps**:
1. Open Agent Inbox at http://localhost:3001
2. Navigate to any interrupted thread
3. Type a response in the textarea
4. Wait 5 seconds without typing
5. Check for "Draft saved at HH:MM:SS" indicator

**Expected**: Draft indicator appears after 5 seconds  
**Status**: ⏳ Pending

---

### Test 2: Page Refresh Persistence
**Steps**:
1. Type a response (e.g., "This is a test draft")
2. Wait for "Draft saved" indicator
3. Refresh the page (F5 or Ctrl+R)
4. Navigate back to same thread

**Expected**: Typed response restores automatically  
**Status**: ⏳ Pending

---

### Test 3: Thread Switching
**Steps**:
1. Open Thread A, type response "Response for Thread A"
2. Wait for draft save
3. Switch to Thread B, type response "Response for Thread B"
4. Wait for draft save
5. Switch back to Thread A

**Expected**: Each thread maintains its own draft independently  
**Status**: ⏳ Pending

---

### Test 4: Browser Close/Reopen
**Steps**:
1. Type response "Testing persistence across sessions"
2. Wait for draft save
3. Close browser completely
4. Reopen browser, navigate to Agent Inbox
5. Open same thread

**Expected**: Draft restores from local storage  
**Status**: ⏳ Pending

---

### Test 5: Reset Button (Discard Draft)
**Steps**:
1. Type response "Draft to be discarded"
2. Wait for draft save indicator
3. Click "Reset" button (Undo icon)

**Expected**: 
- Textarea clears
- Draft indicator disappears
- Draft removed from storage

**Status**: ⏳ Pending

---

### Test 6: Successful Submission (Draft Cleanup)
**Steps**:
1. Type response "This will be submitted"
2. Wait for draft save
3. Click "Send Response" button
4. Verify submission succeeds
5. Check if draft was discarded

**Expected**: 
- Response submits successfully
- Draft removed from storage
- No draft indicator when returning to thread

**Status**: ⏳ Pending

---

### Test 7: Multiple Drafts (Storage Efficiency)
**Steps**:
1. Create drafts in 5 different threads
2. Check browser localStorage size
3. Navigate between threads
4. Verify each draft loads correctly

**Expected**: 
- All drafts store independently
- No interference between threads
- Reasonable storage usage

**Status**: ⏳ Pending

---

### Test 8: Debounce Behavior (Rapid Typing)
**Steps**:
1. Type rapidly: "The quick brown fox jumps over the lazy dog"
2. Observe console logs (should see debounced saves)
3. Wait 5 seconds after last keystroke
4. Verify only one final save occurs

**Expected**: 
- Multiple saves are debounced
- Only saves 5 seconds after typing stops
- No excessive writes to storage

**Status**: ⏳ Pending

---

### Test 9: Empty Draft Handling
**Steps**:
1. Type response "Test"
2. Wait for save
3. Delete all text (empty textarea)
4. Wait 5 seconds

**Expected**: 
- Empty draft still saves (allows intentional clearing)
- Draft indicator updates or disappears
- Reset button still works

**Status**: ⏳ Pending

---

### Test 10: Server Storage Sync (if enabled)
**Steps**:
1. Enable `USE_SERVER_STORAGE` in configuration
2. Type draft on Device A
3. Wait for save + server sync
4. Open same inbox on Device B
5. Navigate to same thread

**Expected**: 
- Draft syncs to server
- Device B loads draft from server
- Cross-device persistence works

**Status**: ⏳ Pending (requires server storage setup)

---

## 🎨 UI/UX Enhancements

### Current Implementation:
```tsx
{showDraftIndicator && (
  <span className="text-xs text-gray-500">
    Draft saved at {lastSaved.toLocaleTimeString()}
  </span>
)}
```

### Future Improvements (Optional):
- **Saving indicator**: Show spinner while saving
- **Error handling**: Display warning if save fails
- **Discard confirmation**: "Are you sure?" dialog
- **Draft age**: "Draft saved 5 minutes ago"
- **Keyboard shortcut**: Ctrl+S to force save

---

## 🐛 Known Issues / Edge Cases

### 1. **Pre-existing TypeScript Errors**
File `inbox-item-input.tsx` has pre-existing errors:
- `Cannot find module 'react'` (line 9)
- Parameter type errors (lines 337, 434, 462, etc.)

**Impact**: None - these are workspace-wide issues, not related to draft auto-save  
**Resolution**: Will be fixed in "Dependency Modernization" task

### 2. **Draft Loading Race Condition**
If user starts typing immediately after thread loads, draft loading might overwrite their new input.

**Mitigation**: Draft only loads if response is empty (`!res.args`)  
**Future**: Add "Restore draft?" prompt if both exist

### 3. **localStorage Quota**
Browsers limit localStorage to ~5-10MB. Many large drafts could exceed this.

**Current**: No limit on number of drafts  
**Future**: Implement LRU eviction (keep last 50 drafts)

---

## 📊 Performance Considerations

### Storage Impact:
- **Per Draft**: ~100 bytes (typical response)
- **50 Drafts**: ~5 KB
- **Negligible**: Well within localStorage limits

### Memory Impact:
- **Map of Timeouts**: O(n) where n = active threads
- **Typical**: <10 threads = minimal memory
- **Cleanup**: All timeouts cleared on unmount

### Network Impact:
- **Local Storage**: No network calls for saves
- **Server Storage**: Optional sync (if enabled)
- **Debounced**: Max 1 save per 5 seconds per thread

---

## 🔄 Integration with Existing Features

### Filter Persistence (Feature #2)
✅ **Compatible** - Both use `usePersistentConfig` hook, no conflicts

### Inbox Ordering (Feature #3 - Pending)
✅ **Compatible** - Draft storage independent of inbox order

### Notification Settings (Feature #4 - Pending)
✅ **Compatible** - Separate configuration domains

---

## 📝 Developer Notes

### Why 5-Second Debounce?
- **Too short** (1s): Excessive saves, poor performance
- **Too long** (10s): Risk of data loss if crash before save
- **5 seconds**: Sweet spot - responsive + efficient

### Why Per-Thread Storage?
- **Alternative**: Single global draft (last response only)
- **Problem**: User loses draft when switching threads
- **Solution**: Map of threadId → draft (better UX)

### Why Auto-Cleanup on Unmount?
- **Problem**: Memory leaks from pending timeouts
- **Solution**: Clear all timeouts in useEffect cleanup
- **Impact**: Ensures no orphaned timers

---

## 🚀 Next Steps

1. **Complete Testing** - Run all 10 tests above
2. **Document Results** - Update this file with test outcomes
3. **Fix Any Bugs** - Address issues discovered during testing
4. **Update TODO.md** - Mark Draft Auto-Save as complete
5. **Move to Feature #3** - Begin Inbox Ordering implementation

---

## ✅ Completion Checklist

- [x] Hook implementation (use-draft-storage.tsx)
- [x] Schema extension (PersistentConfig + StoredConfiguration)
- [x] UI integration (inbox-item-input.tsx)
- [x] Parent component update (thread-actions-view.tsx)
- [x] Draft loading on mount
- [x] Draft saving on change (debounced)
- [x] Draft discarding on reset
- [x] Draft cleanup on submit
- [x] Visual feedback (saved indicator)
- [ ] Testing (10 tests)
- [ ] Documentation complete
- [ ] Production ready

---

## 📚 Related Files

- **Implementation Plan**: `PHASE-4A-DETAILED-IMPLEMENTATION-PLAN.md`
- **Filter Persistence**: `PHASE-4A-FILTER-PERSISTENCE-IMPLEMENTATION.md`
- **Testing Strategy**: `TESTING-STRATEGY.md`
- **Task List**: `TODO.md`
