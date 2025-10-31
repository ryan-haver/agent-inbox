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
  saveToServer: () => Promise<boolean>;
  loadFromServer: () => Promise<boolean>;
  updateConfig: (updates: Partial<PersistentConfig>) => void;
}

/**
 * Load configuration from browser localStorage
 */
function loadFromLocalStorage(): PersistentConfig {
  try {
    const inboxesStr = localStorage.getItem(STORAGE_KEYS.INBOXES);
    const apiKey = localStorage.getItem(STORAGE_KEYS.LANGSMITH_API_KEY);
    const prefsStr = localStorage.getItem(STORAGE_KEYS.PREFERENCES);
    
    return {
      inboxes: inboxesStr ? JSON.parse(inboxesStr) : [],
      langsmithApiKey: apiKey || undefined,
      preferences: prefsStr ? JSON.parse(prefsStr) : {},
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
  
  // Use ref to track if initial sync has happened
  const hasInitialSynced = useRef(false);
  const syncIntervalRef = useRef<NodeJS.Timeout>();

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
      
      if (data.defaults) {
        // Server has defaults from environment, merge with local config
        console.log('[Persistent Config] Merging server defaults');
        const mergedConfig: PersistentConfig = {
          ...config,
          ...data.defaults,
          inboxes: [...(data.defaults.inboxes || []), ...config.inboxes],
        };
        setConfig(mergedConfig);
        saveToLocalStorage(mergedConfig);
        return true;
      }
      
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
   */
  const updateConfig = useCallback((updates: Partial<PersistentConfig>) => {
    setConfig((prev: PersistentConfig) => {
      const updated = { ...prev, ...updates };
      saveToLocalStorage(updated);
      return updated;
    });
  }, []);

  /**
   * Periodic sync with server
   */
  const syncWithServer = useCallback(async () => {
    if (!serverEnabled) return;
    
    try {
      // Load from server (server has precedence)
      await loadFromServer();
    } catch (error) {
      console.error('[Persistent Config] Sync error:', error);
    }
  }, [serverEnabled, loadFromServer]);

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
          // First sync: try to load from server
          const loaded = await loadFromServer();
          
          if (!loaded && config.inboxes.length > 0) {
            // Server has no config but we have local data: push to server
            console.log('[Persistent Config] Pushing local config to server');
            await saveToServer();
          }
          
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
   * Save to server whenever config changes (debounced via useEffect)
   */
  useEffect(() => {
    if (!serverEnabled || isLoading || !hasInitialSynced.current) return;
    
    // Debounce: wait 1 second after last change before saving
    const timeoutId = setTimeout(() => {
      saveToServer();
    }, 1000);
    
    return () => clearTimeout(timeoutId);
  }, [config, serverEnabled, isLoading, saveToServer]);

  return {
    config,
    serverEnabled,
    isLoading,
    lastSync,
    saveToServer,
    loadFromServer,
    updateConfig,
  };
}
