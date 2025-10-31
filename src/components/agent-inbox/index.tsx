import React from "react";
import { useQueryParams } from "./hooks/use-query-params";
import {
  INBOX_PARAM,
  VIEW_STATE_THREAD_QUERY_PARAM,
  OFFSET_PARAM,
  LIMIT_PARAM,
} from "./constants";
import { ThreadStatusWithAll } from "./types";
import { AgentInboxView } from "./inbox-view";
import { ThreadView } from "./thread-view";
import { useScrollPosition } from "./hooks/use-scroll-position";
import { usePathname, useSearchParams } from "next/navigation";
import { logger } from "./utils/logger";
import { usePersistentConfig } from "@/hooks/use-persistent-config";

export function AgentInbox<
  ThreadValues extends Record<string, any> = Record<string, any>,
>() {
  const { searchParams, updateQueryParams, getSearchParam } = useQueryParams();
  const { config, isLoading: configLoading } = usePersistentConfig();
  
  // Phase 4A+: Initialize filter from global default view or default to "interrupted"
  const [_selectedInbox, setSelectedInbox] =
    React.useState<ThreadStatusWithAll>(
      (config.preferences?.inboxDefaults?.defaultView as ThreadStatusWithAll) || "interrupted"
    );
  const { saveScrollPosition, restoreScrollPosition } = useScrollPosition();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const selectedThreadIdParam = searchParams.get(VIEW_STATE_THREAD_QUERY_PARAM);
  const isStateViewOpen = !!selectedThreadIdParam;
  const prevIsStateViewOpen = React.useRef(false);

  // Need to track first render to avoid restoring scroll on initial page load
  const isFirstRender = React.useRef(true);
  
  // Track if inbox has been initialized (for applying global default on first load)
  const inboxInitialized = React.useRef(false);

  // Track URL changes to detect when the thread ID changes (not just appears/disappears)
  const lastThreadId = React.useRef<string | null>(null);

  // Track navigation events using pathname and search params from Next.js
  const pathname = usePathname();
  const nextSearchParams = useSearchParams();
  const navigationSignature = `${pathname}?${nextSearchParams}`;
  const prevNavigationSignature = React.useRef("");

  // Effect to handle transitions between list and thread views
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    // Skip during first render
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevIsStateViewOpen.current = isStateViewOpen;
      lastThreadId.current = selectedThreadIdParam;
      prevNavigationSignature.current = navigationSignature;
      return;
    }

    // Case 1: Going from list view to thread view
    if (!prevIsStateViewOpen.current && isStateViewOpen) {
      // Try to save scroll position
      if (window.scrollY > 0) {
        saveScrollPosition(); // Save window scroll
      } else if (containerRef.current && containerRef.current.scrollTop > 0) {
        saveScrollPosition(containerRef.current);
      }
    }

    // Update previous state for next render
    prevIsStateViewOpen.current = isStateViewOpen;
    lastThreadId.current = selectedThreadIdParam;
    prevNavigationSignature.current = navigationSignature;
  }, [
    isStateViewOpen,
    selectedThreadIdParam,
    saveScrollPosition,
    navigationSignature,
  ]);

  // Dedicated effect for handling scroll restoration when returning to list view
  React.useLayoutEffect(() => {
    if (
      typeof window === "undefined" ||
      isFirstRender.current ||
      isStateViewOpen
    ) {
      return;
    }

    // Detect navigation (including back button) by checking URL changes
    const isNavigationEvent =
      prevNavigationSignature.current !== navigationSignature;

    // Only run when switching from thread view to list view
    if (
      (prevIsStateViewOpen.current && !isStateViewOpen) ||
      isNavigationEvent
    ) {
      // Use layout effect to run synchronously after DOM mutations but before browser paint
      if (containerRef.current) {
        restoreScrollPosition(containerRef.current);
      } else {
        // Fallback to window scroll
        restoreScrollPosition();
      }
    }
  }, [isStateViewOpen, restoreScrollPosition, navigationSignature]);

  React.useEffect(() => {
    try {
      if (typeof window === "undefined" || configLoading) return;

      const currentInbox = getSearchParam(INBOX_PARAM) as
        | ThreadStatusWithAll
        | undefined;
      
      // Phase 4A+: On first load, always use global default (ignore stale URL params)
      // This ensures bookmarked URLs or browser-cached URLs don't override user preference
      if (!inboxInitialized.current) {
        inboxInitialized.current = true;
        const defaultInbox = (config.preferences?.inboxDefaults?.defaultView as ThreadStatusWithAll) || "interrupted";
        
        // Set default inbox from settings, ensuring offset, limit, and inbox are all set
        updateQueryParams(
          [INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM],
          [defaultInbox, "0", "10"]
        );
        return; // Exit early on first load
      }
      
      if (!currentInbox) {
        // If no inbox param in URL, use global default
        const defaultInbox = (config.preferences?.inboxDefaults?.defaultView as ThreadStatusWithAll) || "interrupted";
        
        // Set default inbox if none selected, and ensure offset, limit, and inbox (tab) are set
        updateQueryParams(
          [INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM],
          [defaultInbox, "0", "10"]
        );
      } else {
        setSelectedInbox(currentInbox);

        // Ensure offset and limit exist whenever inbox is changed
        const offsetParam = getSearchParam(OFFSET_PARAM);
        const limitParam = getSearchParam(LIMIT_PARAM);

        if (!offsetParam || !limitParam) {
          const paramsToUpdate = [];
          const valuesToUpdate = [];

          if (!offsetParam) {
            paramsToUpdate.push(OFFSET_PARAM);
            valuesToUpdate.push("0");
          }

          if (!limitParam) {
            paramsToUpdate.push(LIMIT_PARAM);
            valuesToUpdate.push("10");
          }

          if (paramsToUpdate.length > 0) {
            updateQueryParams(paramsToUpdate, valuesToUpdate);
          }
        }
      }
    } catch (e) {
      logger.error("Error updating query params & setting inbox", e);
    }
  }, [searchParams, configLoading]);

  if (isStateViewOpen) {
    return <ThreadView threadId={selectedThreadIdParam} />;
  }

  return (
    <AgentInboxView<ThreadValues>
      saveScrollPosition={saveScrollPosition}
      containerRef={containerRef}
    />
  );
}
