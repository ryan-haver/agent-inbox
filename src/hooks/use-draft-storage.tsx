/**
 * Draft Storage Hook
 *
 * Provides automatic draft saving for email responses.
 *
 * Features:
 * - Auto-save every 5 seconds when user is typing
 * - Debounced save to avoid excessive writes
 * - Load draft on thread view mount
 * - Sync across devices (if server storage enabled)
 * - Discard draft functionality
 *
 * Phase 4A: Critical UX Fix - Users losing typed work
 */

import { useCallback, useEffect, useRef } from "react";
import { usePersistentConfig } from "./use-persistent-config";

const DRAFT_AUTOSAVE_INTERVAL_MS = 5000; // 5 seconds

export interface UseDraftStorageReturn {
  loadDraft: (threadId: string) => string | undefined;
  saveDraft: (threadId: string, content: string) => void;
  discardDraft: (threadId: string) => void;
  hasDraft: (threadId: string) => boolean;
  getLastSaved: (threadId: string) => Date | null;
}

/**
 * Draft Storage Hook
 *
 * Manages draft responses with automatic saving and loading.
 *
 * @returns Draft storage functions and state
 */
export function useDraftStorage(): UseDraftStorageReturn {
  const { config, updateConfig } = usePersistentConfig();
  const autoSaveTimeouts = useRef<Map<string, NodeJS.Timeout>>(new Map());

  /**
   * Load draft for a thread
   *
   * @param threadId - Thread ID to load draft for
   * @returns Draft content or undefined if no draft exists
   */
  const loadDraft = useCallback(
    (threadId: string): string | undefined => {
      return config.drafts?.[threadId]?.content;
    },
    [config.drafts]
  );

  /**
   * Save draft with auto-save debouncing
   *
   * Waits 5 seconds after last keystroke before saving to avoid
   * excessive writes while user is actively typing.
   *
   * @param threadId - Thread ID to save draft for
   * @param content - Draft content to save
   */
  const saveDraft = useCallback(
    (threadId: string, content: string) => {
      // Clear existing timeout for this thread
      const existingTimeout = autoSaveTimeouts.current.get(threadId);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      // Set new timeout
      const timeout = setTimeout(() => {
        console.log("[Draft Storage] Saving draft for thread:", threadId);

        updateConfig({
          drafts: {
            ...config.drafts,
            [threadId]: {
              content,
              lastSaved: new Date().toISOString(),
            },
          },
        });

        autoSaveTimeouts.current.delete(threadId);
      }, DRAFT_AUTOSAVE_INTERVAL_MS);

      autoSaveTimeouts.current.set(threadId, timeout);
    },
    [config.drafts, updateConfig]
  );

  /**
   * Discard draft for a thread
   *
   * Removes draft from storage and cancels any pending auto-save.
   *
   * @param threadId - Thread ID to discard draft for
   */
  const discardDraft = useCallback(
    (threadId: string) => {
      if (!config.drafts) return;

      console.log("[Draft Storage] Discarding draft for thread:", threadId);

      const { [threadId]: _, ...remainingDrafts } = config.drafts;
      updateConfig({ drafts: remainingDrafts });

      // Clear any pending auto-save
      const timeout = autoSaveTimeouts.current.get(threadId);
      if (timeout) {
        clearTimeout(timeout);
        autoSaveTimeouts.current.delete(threadId);
      }
    },
    [config.drafts, updateConfig]
  );

  /**
   * Check if draft exists for a thread
   *
   * @param threadId - Thread ID to check
   * @returns True if draft exists with content
   */
  const hasDraft = useCallback(
    (threadId: string): boolean => {
      const draft = config.drafts?.[threadId]?.content;
      return !!draft && draft.trim().length > 0;
    },
    [config.drafts]
  );

  /**
   * Get last saved timestamp for a draft
   *
   * @param threadId - Thread ID to get timestamp for
   * @returns Date object or null if no draft exists
   */
  const getLastSaved = useCallback(
    (threadId: string): Date | null => {
      const timestamp = config.drafts?.[threadId]?.lastSaved;
      return timestamp ? new Date(timestamp) : null;
    },
    [config.drafts]
  );

  /**
   * Cleanup timeouts on unmount
   */
  useEffect(() => {
    return () => {
      autoSaveTimeouts.current.forEach((timeout) => clearTimeout(timeout));
      autoSaveTimeouts.current.clear();
    };
  }, []);

  return {
    loadDraft,
    saveDraft,
    discardDraft,
    hasDraft,
    getLastSaved,
  };
}
