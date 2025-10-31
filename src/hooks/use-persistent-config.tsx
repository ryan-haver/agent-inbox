/**
 * Client-Side Persistent Configuration Hook
 * 
 * Provides seamless synchronization between browser localStorage and server storage.
 * Falls back gracefully to browser-only mode if server storage is unavailable.
 * 
 * Features:
 * - Automatic server detection
 * - Periodic sync (every 30 seconds)
 * - Conflict resolution (server precedence)
 * - Backward compatible (works without server storage)
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { AgentInbox } from '@/components/agent-inbox/types';

/**
 * Storage keys for browser localStorage
 */
const STORAGE_KEYS = {
  INBOXES: 'agentInboxes',
  LANGSMITH_API_KEY: 'langsmithApiKey',
  PREFERENCES: 'agentInboxPreferences',
  DRAFTS: 'agentInboxDrafts', // Phase 4A: Draft auto-save
  LAST_SYNC: 'lastServerSync',
} as const;

/**
 * Sync interval (30 seconds)
 */
const SYNC_INTERVAL_MS = 30_000;

/**
 * Configuration structure matching StoredConfiguration from config-storage.ts
 */
export interface PersistentConfig {
  version?: string;
  lastUpdated?: string;
  langsmithApiKey?: string;
  inboxes: AgentInbox[];
  preferences?: {
    theme?: string;
    defaultInbox?: string;
    lastSelectedFilter?: string; // Phase 4A: Filter persistence (interrupted, idle, error, all)
    inboxOrder?: string[]; // Phase 4A: Inbox ordering (array of inbox IDs)
    
    // Phase 4A+: Global inbox behavior defaults (scalable structure)
    inboxDefaults?: {
      defaultView?: 'interrupted' | 'idle' | 'busy' | 'error' | 'all';
      // Future: sortOrder, autoRefresh, refreshInterval, etc.
    };
    
    // Phase 4A+: Per-inbox setting overrides (scalable structure)
    inboxSettings?: {
      [inboxId: string]: {
        defaultView?: 'interrupted' | 'idle' | 'busy' | 'error' | 'all';
        // Future: inbox-specific sortOrder, notificationsEnabled, etc.
      };
    };
    
    notifications?: { // Phase 4A: Notification settings (UI only, functionality in Phase 5)
      enabled: boolean;
      sound: boolean;
      desktop: boolean;
      emailOnInterrupt?: boolean; // Future: Phase 5
    };
  };
  drafts?: { // Phase 4A: Draft auto-save
    [threadId: string]: {
      content: string;
      lastSaved: string;
    };
  };
}

/**
 * Hook return type
 */
export interface UsePersistentConfigReturn {
  config: PersistentConfig;
  serverEnabled: boolean;
  isLoading: boolean;
  lastSync: Date | null;
  isSaving: boolean; // Phase 4A+: Track save status
  saveToServer: () => Promise<boolean>;
  loadFromServer: () => Promise<boolean>;
  updateConfig: (updates: Partial<PersistentConfig>, immediate?: boolean) => void; // Phase 4A+: immediate flag
}

/**
 * Load configuration from browser localStorage
 */
function loadFromLocalStorage(): PersistentConfig {
  // Check if we're in a browser environment (not SSR)
  if (typeof window === 'undefined') {
    return { inboxes: [] };
  }
  
  try {
    const inboxesStr = localStorage.getItem(STORAGE_KEYS.INBOXES);
    const apiKey = localStorage.getItem(STORAGE_KEYS.LANGSMITH_API_KEY);
    const prefsStr = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    const draftsStr = localStorage.getItem(STORAGE_KEYS.DRAFTS);
    
    return {
      inboxes: inboxesStr ? JSON.parse(inboxesStr) : [],
      langsmithApiKey: apiKey || undefined,
      preferences: prefsStr ? JSON.parse(prefsStr) : {},
      drafts: draftsStr ? JSON.parse(draftsStr) : {},
    };
  } catch (error) {
    console.error('[Persistent Config] Error loading from localStorage:', error);
    return { inboxes: [] };
  }
}

/**
 * Save configuration to browser localStorage
 */
function saveToLocalStorage(config: PersistentConfig): void {
  // Check if we're in a browser environment (not SSR)
  if (typeof window === 'undefined') {
    return;
  }
  
  try {
    localStorage.setItem(STORAGE_KEYS.INBOXES, JSON.stringify(config.inboxes));
    
    if (config.langsmithApiKey) {
      localStorage.setItem(STORAGE_KEYS.LANGSMITH_API_KEY, config.langsmithApiKey);
    } else {
      localStorage.removeItem(STORAGE_KEYS.LANGSMITH_API_KEY);
    }
    
    if (config.preferences) {
      localStorage.setItem(STORAGE_KEYS.PREFERENCES, JSON.stringify(config.preferences));
    } else {
      localStorage.removeItem(STORAGE_KEYS.PREFERENCES);
    }
    
    if (config.drafts) {
      localStorage.setItem(STORAGE_KEYS.DRAFTS, JSON.stringify(config.drafts));
    } else {
      localStorage.removeItem(STORAGE_KEYS.DRAFTS);
    }
    
    console.log('[Persistent Config] Saved to localStorage');
  } catch (error) {
    console.error('[Persistent Config] Error saving to localStorage:', error);
  }
}

/**
 * Get the last sync timestamp from localStorage
 */
function getLastSyncTime(): Date | null {
  try {
    const timestamp = localStorage.getItem(STORAGE_KEYS.LAST_SYNC);
    return timestamp ? new Date(timestamp) : null;
  } catch {
    return null;
  }
}

/**
 * Update the last sync timestamp in localStorage
 */
function setLastSyncTime(date: Date): void {
  try {
    localStorage.setItem(STORAGE_KEYS.LAST_SYNC, date.toISOString());
  } catch (error) {
    console.error('[Persistent Config] Error saving sync timestamp:', error);
  }
}

/**
 * Persistent Configuration Hook
 * 
 * Manages configuration synchronization between browser and server.
 * 
 * @returns Configuration state and sync functions
 */
export function usePersistentConfig(): UsePersistentConfigReturn {
  const [config, setConfig] = useState<PersistentConfig>(() => loadFromLocalStorage());
  const [serverEnabled, setServerEnabled] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [lastSync, setLastSync] = useState<Date | null>(getLastSyncTime());
  const [isSaving, setIsSaving] = useState<boolean>(false); // Phase 4A+: Track save status
  
  // Use ref to track if initial sync has happened
  const hasInitialSynced = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout>();
  const saveTimeoutRef = useRef<NodeJS.Timeout>(); // Phase 4A+: Track debounced save timer
  const hasPendingSave = useRef(false); // Phase 4A+: Track if we have unsaved changes

  /**
   * Check if server storage is enabled
   */
  const checkServerStatus = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/config');
      const data = await response.json();
      
      return data.enabled === true;
    } catch (error) {
      console.log('[Persistent Config] Server storage not available:', error);
      return false;
    }
  }, []);

  /**
   * Load configuration from server
   */
  const loadFromServer = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/config');
      
      if (!response.ok) {
        console.error('[Persistent Config] Server load failed:', response.status);
        return false;
      }
      
      const data = await response.json();
      
      if (!data.enabled) {
        console.log('[Persistent Config] Server storage disabled');
        return false;
      }
      
      if (data.config) {
        // Server has configuration, use it
        console.log('[Persistent Config] Loaded from server');
        setConfig(data.config);
        saveToLocalStorage(data.config);
        setLastSync(new Date());
        setLastSyncTime(new Date());
        return true;
      }
      
      // No config available
      return false;
    } catch (error) {
      console.error('[Persistent Config] Error loading from server:', error);
      return false;
    }
  }, [config]);

  /**
   * Save configuration to server
   */
  const saveToServer = useCallback(async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        console.error('[Persistent Config] Server save failed:', response.status);
        return false;
      }
      
      const data = await response.json();
      
      if (!data.enabled) {
        console.log('[Persistent Config] Server storage disabled');
        return false;
      }
      
      console.log('[Persistent Config] Saved to server');
      setLastSync(new Date());
      setLastSyncTime(new Date());
      return true;
    } catch (error) {
      console.error('[Persistent Config] Error saving to server:', error);
      return false;
    }
  }, [config]);

  /**
   * Update configuration (both in state and localStorage)
   * @param updates - Partial configuration to merge
   * @param immediate - If true, save to server immediately (for user settings). If false, debounce (for auto-saves)
   */
  const updateConfig = useCallback((updates: Partial<PersistentConfig>, immediate: boolean = false) => {
    setConfig((prev: PersistentConfig) => {
      const updated = { ...prev, ...updates };
      saveToLocalStorage(updated);
      return updated;
    });
    
    // Phase 4A+: Mark that we have unsaved changes
    hasPendingSave.current = true;
    
    // Phase 4A+: If immediate save requested (e.g., Settings UI), trigger save now
    if (immediate && serverEnabled) {
      // Clear any pending debounced save
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
        saveTimeoutRef.current = undefined;
      }
      
      // Trigger immediate save (will be handled by useEffect)
      setIsSaving(true);
    }
  }, [serverEnabled]);

  /**
   * Periodic sync with server
   */
  const syncWithServer = useCallback(async () => {
    if (!serverEnabled) return;
    
    // Phase 4A+: Don't load from server if we have unsaved changes (avoid overwriting)
    if (hasPendingSave.current || isSaving) {
      console.log('[Persistent Config] Skipping sync - pending save in progress');
      return;
    }
    
    try {
      // Load from server (server has precedence)
      await loadFromServer();
    } catch (error) {
      console.error('[Persistent Config] Sync error:', error);
    }
  }, [serverEnabled, loadFromServer, isSaving]);

  /**
   * Initial setup: check server status and perform first sync
   */
  useEffect(() => {
    let mounted = true;
    
    async function initialize() {
      try {
        // Check if server storage is enabled
        const enabled = await checkServerStatus();
        
        if (!mounted) return;
        
        setServerEnabled(enabled);
        
        if (enabled && !hasInitialSynced.current) {
          // First sync: load from server (server is source of truth)
          await loadFromServer();
          hasInitialSynced.current = true;
        }
      } catch (error) {
        console.error('[Persistent Config] Initialization error:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }
    
    initialize();
    
    return () => {
      mounted = false;
    };
  }, [checkServerStatus, loadFromServer, saveToServer, config.inboxes.length]);

  /**
   * Set up periodic sync if server is enabled
   */
  useEffect(() => {
    if (!serverEnabled || isLoading) return;
    
    // Sync every 30 seconds
    syncIntervalRef.current = setInterval(syncWithServer, SYNC_INTERVAL_MS);
    
    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }
    };
  }, [serverEnabled, isLoading, syncWithServer]);

  /**
   * Save to server whenever config changes
   * - Immediate save if isSaving is true (user-initiated settings changes)
   * - Debounced save otherwise (auto-saves like drafts)
   */
  useEffect(() => {
    if (!serverEnabled || isLoading || !hasInitialSynced.current) return;
    if (!hasPendingSave.current) return; // No changes to save
    
    // Phase 4A+: Immediate save if requested
    if (isSaving) {
      saveToServer().then((success) => {
        if (success) {
          hasPendingSave.current = false;
          setIsSaving(false);
        }
      });
      return;
    }
    
    // Phase 4A+: Otherwise debounce: wait 1 second after last change before saving
    saveTimeoutRef.current = setTimeout(() => {
      setIsSaving(true);
      saveToServer().then((success) => {
        if (success) {
          hasPendingSave.current = false;
          setIsSaving(false);
        }
      });
    }, 1000);
    
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [config, serverEnabled, isLoading, saveToServer, isSaving]);

  return {
    config,
    serverEnabled,
    isLoading,
    lastSync,
    isSaving, // Phase 4A+: Save status
    saveToServer,
    loadFromServer,
    updateConfig,
  };
}
