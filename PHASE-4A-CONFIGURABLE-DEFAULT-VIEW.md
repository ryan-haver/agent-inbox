# Phase 4A+: Configurable Default Inbox View

**Date**: October 31, 2025  
**Time**: ~1.5 hours  
**Status**: ✅ Complete

## Overview

Added a scalable, hierarchical settings system allowing users to configure which inbox view (Interrupted/Pending/All) is shown by default when switching inboxes. Supports both **global defaults** and **per-inbox overrides** for maximum flexibility.

## Problem

Previously, the application always defaulted to "Interrupted" view when switching inboxes. This was hardcoded and inflexible:
- No user control over default behavior
- Power users managing different agent types wanted different defaults per inbox
- Settings were scattered and not scalable for future enhancements

## Solution Architecture

### Hierarchical Settings System

Implemented a three-tier fallback chain for maximum flexibility:

```
1. Per-Inbox Override (highest priority)
   ↓ (if not set)
2. Global Default (medium priority)
   ↓ (if not set)
3. App Default ('interrupted' - lowest priority)
```

### Schema Design

Organized preferences hierarchically for future scalability:

```typescript
preferences?: {
  // Global inbox behavior defaults
  inboxDefaults?: {
    defaultView?: 'interrupted' | 'pending' | 'all';
    // Future: sortOrder, autoRefresh, refreshInterval...
  };
  
  // Per-inbox setting overrides
  inboxSettings?: {
    [inboxId: string]: {
      defaultView?: 'interrupted' | 'pending' | 'all';
      // Future: sortOrder, notificationsEnabled...
    };
  };
}
```

## Implementation

### Step 1: Settings Utility Helper (5 min)

**File**: `src/lib/inbox-settings-utils.ts` (NEW)

**Purpose**: Reusable helper functions for the global+override pattern

**Functions**:
1. `getInboxSetting<T>()` - Get setting with fallback chain
2. `setInboxSetting()` - Set per-inbox override
3. `clearInboxSetting()` - Remove override (revert to global)

**Example Usage**:
```typescript
const defaultView = getInboxSetting(
  inboxId,
  'defaultView',
  'interrupted', // app default
  config
);
```

**Benefits**:
- ✅ Reusable for any future setting
- ✅ Consistent pattern across codebase
- ✅ Type-safe with generics
- ✅ Clear fallback logic

---

### Step 2: Type Definitions (3 min)

**File**: `src/components/agent-inbox/types.ts`

**Added**:
```typescript
export type InboxView = 'interrupted' | 'pending' | 'all';
```

---

### Step 3: Frontend Schema Update (5 min)

**File**: `src/hooks/use-persistent-config.tsx`

**Changes**: Extended `PersistentConfig` interface

**Added Fields**:
```typescript
preferences?: {
  // ... existing fields
  
  inboxDefaults?: {
    defaultView?: 'interrupted' | 'pending' | 'all';
  };
  
  inboxSettings?: {
    [inboxId: string]: {
      defaultView?: 'interrupted' | 'pending' | 'all';
    };
  };
}
```

---

### Step 4: Backend Schema Update (5 min)

**File**: `src/lib/config-storage.ts`

**Changes**: Mirrored frontend schema in `StoredConfiguration`

**Purpose**: 
- Server-side validation
- Multi-device sync support
- Consistent data structure

---

### Step 5: Global Settings UI (15 min)

**File**: `src/components/agent-inbox/components/settings-popover.tsx`

**Added Section**: "Inbox Defaults" (after Notifications)

**UI Components**:
```tsx
<div className="space-y-3 border-t pt-4">
  <div className="flex items-center gap-2">
    <Inbox className="w-4 h-4 text-gray-700" />
    <h3>Inbox Defaults</h3>
  </div>
  
  <select
    value={config.preferences?.inboxDefaults?.defaultView || 'interrupted'}
    onChange={...}
  >
    <option value="interrupted">Interrupted</option>
    <option value="pending">Pending</option>
    <option value="all">All</option>
  </select>
  
  <p className="text-xs text-gray-500">
    Choose which inbox view to show by default. Can be overridden per inbox.
  </p>
</div>
```

**Features**:
- Dropdown selector with three options
- Help text explaining override capability
- Immediate save on change
- Visual consistency with existing settings

---

### Step 6: Update Inbox Logic (10 min)

**File**: `src/components/agent-inbox/hooks/use-inboxes.tsx`

**Changes**:
1. Added import: `getInboxSetting` from utilities
2. Updated `changeAgentInbox()` function
3. Updated `addAgentInbox()` function
4. Added `config` to dependency arrays

**Before**:
```typescript
const newParams = new URLSearchParams({
  [AGENT_INBOX_PARAM]: id,
  [OFFSET_PARAM]: "0",
  [LIMIT_PARAM]: "10",
  [INBOX_PARAM]: "interrupted", // Hardcoded!
});
```

**After**:
```typescript
// Get the default view for this inbox (per-inbox override > global > app default)
const defaultView = getInboxSetting(
  id,
  'defaultView',
  'interrupted',
  config
);

const newParams = new URLSearchParams({
  [AGENT_INBOX_PARAM]: id,
  [OFFSET_PARAM]: "0",
  [LIMIT_PARAM]: "10",
  [INBOX_PARAM]: defaultView, // Dynamic!
});
```

---

### Step 7: Per-Inbox Settings Dialog (20 min)

**File**: `src/components/agent-inbox/components/inbox-settings-dialog.tsx` (NEW)

**Purpose**: Allow per-inbox overrides of global settings

**UI Layout**:
```
┌─ Inbox Settings: MyInbox ──────┐
│ Default View:                   │
│ ┌─────────────────────────────┐ │
│ │ Use Global Setting       ▼  │ │
│ └─────────────────────────────┘ │
│                                 │
│ Using global setting:           │
│ "Interrupted"                   │
│                                 │
│ [Future settings...]            │
└─────────────────────────────────┘
```

**Options**:
- "Use Global Setting" - Removes override
- "Interrupted" - Override to interrupted
- "Pending" - Override to pending
- "All" - Override to all

**Features**:
- Shows current setting (override or global)
- Visual feedback on which setting is active
- Informative help text
- Placeholder for future settings

**Logic**:
```typescript
const handleDefaultViewChange = (value: string) => {
  if (value === 'use-global') {
    // Clear override
    const newConfig = clearInboxSetting(inbox.id, 'defaultView', config);
    updateConfig(newConfig);
  } else {
    // Set override
    const newConfig = setInboxSetting(inbox.id, 'defaultView', value, config);
    updateConfig(newConfig);
  }
};
```

---

### Step 8: Add Menu Item (15 min)

**File**: `src/components/agent-inbox/components/dropdown-and-dialog.tsx`

**Changes**:
1. Added import: `Settings` icon and `InboxSettingsDialog`
2. Added state: `settingsOpen`
3. Added menu item: "Inbox Settings" (between Edit and Delete)
4. Added dialog component at bottom

**UI**:
```
┌─ MyInbox ──────────┐
│ ✏️  Edit Inbox      │
│ ⚙️  Inbox Settings  │  ← NEW
│ 🗑️  Delete          │
└────────────────────┘
```

**Interaction**:
- Click "Inbox Settings" → Opens dialog
- Dialog shows current settings for that specific inbox
- Changes save immediately to config

---

## Files Created

1. ✅ `src/lib/inbox-settings-utils.ts` - Reusable helper functions (83 lines)
2. ✅ `src/components/agent-inbox/components/inbox-settings-dialog.tsx` - Per-inbox UI (100 lines)

## Files Modified

1. ✅ `src/components/agent-inbox/types.ts` - Added `InboxView` type
2. ✅ `src/hooks/use-persistent-config.tsx` - Extended schema with nested structure
3. ✅ `src/lib/config-storage.ts` - Mirrored frontend schema
4. ✅ `src/components/agent-inbox/components/settings-popover.tsx` - Added global UI section
5. ✅ `src/components/agent-inbox/hooks/use-inboxes.tsx` - Updated logic to use settings
6. ✅ `src/components/agent-inbox/components/dropdown-and-dialog.tsx` - Added menu item + dialog

**Total**: 2 new files, 6 modified files

---

## Testing Checklist

### Global Default Tests
- [ ] 1. Open Settings → change global default to "All"
- [ ] 2. Switch between inboxes → should show "All" view
- [ ] 3. Refresh page → should persist "All"
- [ ] 4. Change global to "Pending" → verify it updates
- [ ] 5. Check localStorage → verify saved correctly

### Per-Inbox Override Tests
- [ ] 6. Open inbox dropdown → click "Inbox Settings"
- [ ] 7. Set inbox to "Interrupted" (override global "All")
- [ ] 8. Switch to that inbox → should show "Interrupted"
- [ ] 9. Switch to different inbox → should show global default ("All")
- [ ] 10. Return to overridden inbox → should show "Interrupted" again

### Revert to Global Tests
- [ ] 11. Open inbox settings → select "Use Global Setting"
- [ ] 12. Verify reverts to global default
- [ ] 13. Check localStorage → override should be removed

### Edge Cases
- [ ] 14. Delete inbox with override → verify no errors
- [ ] 15. Add new inbox → should use global default (no override)
- [ ] 16. Multiple overrides → each inbox remembers its setting
- [ ] 17. Reload page → all settings persist correctly

### Backward Compatibility
- [ ] 18. Clear localStorage → app works with defaults
- [ ] 19. Old config files → still work (no migration needed)
- [ ] 20. No global setting → defaults to "interrupted"

---

## Data Flow

### When User Changes Global Setting

```
Settings UI
  ↓ onChange
updateConfig({ preferences: { inboxDefaults: { defaultView: 'all' }}})
  ↓ 
localStorage + Server Sync
  ↓
All inbox switches use new default
```

### When User Sets Per-Inbox Override

```
Inbox Settings Dialog
  ↓ onChange
setInboxSetting(inboxId, 'defaultView', 'pending', config)
  ↓
Returns new config with nested structure
  ↓
updateConfig(newConfig)
  ↓
localStorage + Server Sync
  ↓
That specific inbox now shows 'pending'
```

### When User Switches Inbox

```
Click Inbox in Sidebar
  ↓
changeAgentInbox(id)
  ↓
getInboxSetting(id, 'defaultView', 'interrupted', config)
  ↓ checks in order:
1. config.preferences?.inboxSettings?.[id]?.defaultView
2. config.preferences?.inboxDefaults?.defaultView
3. 'interrupted' (app default)
  ↓
router.push() with computed defaultView
  ↓
Smooth navigation to correct view
```

---

## Storage Structure

### localStorage Example

```json
{
  "preferences": {
    "inboxDefaults": {
      "defaultView": "all"
    },
    "inboxSettings": {
      "inbox-abc-123": {
        "defaultView": "interrupted"
      },
      "inbox-xyz-789": {
        "defaultView": "pending"
      }
    }
  }
}
```

### Result
- Most inboxes → show "all" (global default)
- inbox-abc-123 → shows "interrupted" (override)
- inbox-xyz-789 → shows "pending" (override)

---

## Architecture Benefits

### ✅ Scalable
Adding new settings is trivial:

```typescript
// Future: Add sort order setting
inboxDefaults?: {
  defaultView?: 'interrupted' | 'pending' | 'all';
  sortOrder?: 'newest' | 'oldest';  // ← Just add here
}

inboxSettings?: {
  [inboxId: string]: {
    defaultView?: 'interrupted' | 'pending' | 'all';
    sortOrder?: 'newest' | 'oldest';  // ← And here
  };
}

// Use existing helper - no new code needed!
const sortOrder = getInboxSetting(id, 'sortOrder', 'newest', config);
```

### ✅ Consistent
Same pattern for all global+override settings:
- Same UI structure
- Same helper functions
- Same storage format
- Same testing approach

### ✅ Clean
Organized hierarchically, not flat:
- `preferences` contains all user settings
- `inboxDefaults` groups global inbox behaviors
- `inboxSettings` groups per-inbox overrides
- Clear separation of concerns

### ✅ Reusable
`getInboxSetting()` works for any setting:
```typescript
// Works for any setting type
const view = getInboxSetting(id, 'defaultView', 'interrupted', config);
const sort = getInboxSetting(id, 'sortOrder', 'newest', config);
const refresh = getInboxSetting(id, 'autoRefresh', true, config);
```

### ✅ Future-Proof
Ready for expansion:
- Notifications per inbox
- Sort order preferences
- Auto-refresh intervals
- Display density
- Color themes
- Custom filters

### ✅ Backward Compatible
- Works without server storage (localStorage only)
- Missing settings use app defaults
- No migration required
- Graceful degradation

---

## User Experience

### Before
- ❌ Always defaults to "Interrupted"
- ❌ No user control
- ❌ Not flexible for different workflows

### After
- ✅ User controls global default
- ✅ Can override per inbox
- ✅ Settings persist across sessions
- ✅ Intuitive UI in familiar locations
- ✅ Clear feedback on active settings

---

## Performance Impact

- **Negligible** - Settings lookup is O(1) hash map access
- **No network calls** - All client-side computation
- **Minimal storage** - ~50 bytes per override
- **Fast rendering** - No additional re-renders

---

## Future Enhancements

### Phase 5 Candidates

1. **Sort Order Preferences**
   ```typescript
   inboxDefaults?: {
     defaultView?: 'interrupted' | 'pending' | 'all';
     sortOrder?: 'newest' | 'oldest';  // NEW
   }
   ```

2. **Auto-Refresh Settings**
   ```typescript
   inboxSettings?: {
     [inboxId: string]: {
       autoRefresh?: boolean;
       refreshInterval?: number;  // seconds
     };
   }
   ```

3. **Per-Inbox Notifications**
   ```typescript
   inboxSettings?: {
     [inboxId: string]: {
       notificationsEnabled?: boolean;
       notificationSound?: string;
     };
   }
   ```

4. **Display Preferences**
   ```typescript
   inboxDefaults?: {
     density?: 'compact' | 'comfortable' | 'spacious';
     showTimestamps?: boolean;
   }
   ```

---

## Lessons Learned

### What Went Well
- ✅ Hierarchical schema made future expansion clear
- ✅ Helper functions eliminated code duplication
- ✅ UI placement was intuitive (Settings for global, dropdown for per-inbox)
- ✅ Type system caught potential bugs early

### What Could Be Improved
- Type compatibility between frontend/backend schemas (minor casting needed)
- Could add setting migration utilities for future schema changes
- Could add setting validation/sanitization

### Best Practices Established
- Always use helper functions for setting access
- Keep global and per-inbox UI separate
- Provide clear help text explaining behavior
- Show which setting is active (override vs global)

---

## Summary

**Total Time**: ~1.5 hours  
**Lines Added**: ~400 lines  
**Lines Modified**: ~50 lines  
**Files Created**: 2  
**Files Modified**: 6  
**Tests Required**: 20  
**Impact**: High - Significantly improved flexibility and UX  

**Status**: ✅ Ready for testing and deployment

---

## Related Documentation

- `PHASE-4A-COMPLETE-SUMMARY.md` - Overview of all Phase 4A features
- `PHASE-4A-INBOX-RELOAD-FIX.md` - Related UX enhancement
- `README.md` - User-facing documentation (needs update)

## Next Steps

1. Complete testing checklist (20 tests)
2. Update user documentation
3. Git commit with descriptive message
4. Consider Phase 5 enhancements
