import { v4 as uuidv4 } from "uuid";
import { useToast } from "@/hooks/use-toast";
import { useQueryParams } from "./use-query-params";
import {
  AGENT_INBOX_PARAM,
  AGENT_INBOXES_LOCAL_STORAGE_KEY,
  NO_INBOXES_FOUND_PARAM,
  OFFSET_PARAM,
  LIMIT_PARAM,
  INBOX_PARAM,
} from "../constants";
import { useLocalStorage } from "./use-local-storage";
import { useState, useCallback, useEffect, useRef } from "react";
import { AgentInbox } from "../types";
import { useRouter } from "next/navigation";
import { logger } from "../utils/logger";
import { runInboxBackfill } from "../utils/backfill";
import { usePersistentConfig } from "@/hooks/use-persistent-config";
import { getInboxSetting } from "@/lib/inbox-settings-utils";
import {
  findInboxByIdentifier,
  getInboxUrlIdentifier,
  getUniqueSlug,
} from "@/lib/inbox-slug-utils";

/**
 * Hook for managing agent inboxes
 *
 * Provides functionality to:
 * - Load agent inboxes from local storage
 * - Add new agent inboxes
 * - Delete agent inboxes
 * - Change the selected agent inbox
 * - Update an existing agent inbox
 *
 * @returns {Object} Object containing agent inboxes and methods to manage them
 */
export function useInboxes() {
  const { getSearchParam, updateQueryParams } = useQueryParams();
  const router = useRouter();
  const { getItem, setItem } = useLocalStorage();
  const { toast } = useToast();
  const [agentInboxes, setAgentInboxes] = useState<AgentInbox[]>([]);
  const initialLoadComplete = useRef(false);

  // Get persistent config to check for server-side inboxes
  const { config, serverEnabled, isLoading } = usePersistentConfig();

  /**
   * Run backfill and load initial inboxes on mount
   */
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    // Wait for persistent config to load before initializing inboxes
    if (isLoading) {
      logger.log(
        "Waiting for persistent config to load before initializing inboxes..."
      );
      return;
    }

    const initializeInboxes = async () => {
      try {
        // Check if there are inboxes from server config first
        if (serverEnabled && config.inboxes && config.inboxes.length > 0) {
          logger.log(
            "Found inboxes in server config, using those:",
            config.inboxes
          );
          // Sync server inboxes to localStorage for backward compatibility
          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(config.inboxes)
          );
          setAgentInboxes(config.inboxes);
          getAgentInboxes(config.inboxes);
          return;
        }

        // Run the backfill process first
        const backfillResult = await runInboxBackfill();
        if (backfillResult.success) {
          // Set the state with potentially updated inboxes from backfill
          setAgentInboxes(backfillResult.updatedInboxes);
          logger.log(
            "Initialized inboxes state after backfill:",
            backfillResult.updatedInboxes
          );
          // Now trigger the selection logic based on current URL param
          // This reuses the logic to select based on param or default
          getAgentInboxes(backfillResult.updatedInboxes);
        } else {
          // If backfill failed, try a normal load
          logger.error("Backfill failed, attempting normal inbox load");
          getAgentInboxes();
        }
      } catch (e) {
        logger.error("Error during initial inbox loading and backfill", e);
        // Attempt normal load as fallback
        getAgentInboxes();
      }
    };
    initializeInboxes();
    // Run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, serverEnabled]); // Added dependencies

  /**
   * Load agent inboxes from local storage and set up proper selection state
   * Accepts optional preloaded inboxes to avoid re-reading localStorage immediately after backfill.
   */
  const getAgentInboxes = useCallback(
    async (preloadedInboxes?: AgentInbox[]) => {
      if (typeof window === "undefined") {
        return;
      }

      let currentInboxes: AgentInbox[] = [];
      if (preloadedInboxes) {
        currentInboxes = preloadedInboxes;
        logger.log("Using preloaded inboxes for selection logic");
      } else {
        const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);
        logger.log(
          "Reading inboxes from localStorage for selection logic:",
          agentInboxesStr
        );
        if (agentInboxesStr && agentInboxesStr !== "[]") {
          try {
            currentInboxes = JSON.parse(agentInboxesStr);
          } catch (error) {
            logger.error(
              "Error parsing agent inboxes for selection logic",
              error
            );
            // Handle error state appropriately
            setAgentInboxes([]);
            updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
            return;
          }
        } else {
          logger.log("No inboxes in localStorage for selection logic");
          setAgentInboxes([]);
          updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
          return;
        }
      }

      if (!currentInboxes.length) {
        logger.log("No current inboxes to process selection logic");
        setAgentInboxes([]);
        updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
        return;
      }

      // Ensure each agent inbox has an ID, and if not, add one
      currentInboxes = currentInboxes.map((inbox) => {
        return {
          ...inbox,
          id: inbox.id || uuidv4(),
          // Generate slug if missing and name exists
          slug:
            inbox.slug ||
            (inbox.name
              ? getUniqueSlug(inbox.name, currentInboxes, inbox.id)
              : undefined),
        };
      });

      const agentInboxSearchParam = getSearchParam(AGENT_INBOX_PARAM);
      logger.log(
        "Agent inbox search param for selection:",
        agentInboxSearchParam
      );

      // If there is no agent inbox search param, or the search param does not match any inbox
      // update search param and local storage
      if (!agentInboxSearchParam) {
        const selectedInbox = currentInboxes.find((inbox) => inbox.selected);
        if (!selectedInbox) {
          currentInboxes[0].selected = true;
          // Phase 4A+: Check for per-inbox override, then global default
          const currentInboxParam = getSearchParam(INBOX_PARAM);
          const defaultView = getInboxSetting(
            currentInboxes[0].id,
            "defaultView",
            "interrupted",
            config
          );
          updateQueryParams(
            [AGENT_INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM, INBOX_PARAM],
            [
              getInboxUrlIdentifier(currentInboxes[0]),
              "0",
              "10",
              currentInboxParam || defaultView,
            ]
          );
          setAgentInboxes(currentInboxes);
          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(currentInboxes)
          );
        } else {
          // Phase 4A+: Check for per-inbox override, then global default
          const currentInboxParam = getSearchParam(INBOX_PARAM);
          const defaultView = getInboxSetting(
            selectedInbox.id,
            "defaultView",
            "interrupted",
            config
          );
          updateQueryParams(
            [AGENT_INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM, INBOX_PARAM],
            [
              getInboxUrlIdentifier(selectedInbox),
              "0",
              "10",
              currentInboxParam || defaultView,
            ]
          );
          setAgentInboxes(currentInboxes);
          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(currentInboxes)
          );
        }

        // Mark initial load as complete
        if (!initialLoadComplete.current) {
          initialLoadComplete.current = true;
        }

        return;
      }

      let finalSelectedInboxId: string | null = null;

      // Param exists: Find inbox by slug, UUID, or name (in that order)
      const selectedByParam = findInboxByIdentifier(
        agentInboxSearchParam,
        currentInboxes
      );

      if (selectedByParam) {
        finalSelectedInboxId = selectedByParam.id;
        logger.log("Found inbox by search param:", finalSelectedInboxId);

        // Update URL to use slug if the URL currently has UUID
        const urlIdentifier = getInboxUrlIdentifier(selectedByParam);
        if (urlIdentifier !== agentInboxSearchParam) {
          logger.log(
            `Updating URL from ${agentInboxSearchParam} to slug: ${urlIdentifier}`
          );
          updateQueryParams(AGENT_INBOX_PARAM, urlIdentifier);
        }
      } else {
        // Param exists but inbox not found: Select first
        finalSelectedInboxId = currentInboxes[0]?.id || null;
        logger.log(
          "Inbox for search param not found, selecting first inbox:",
          finalSelectedInboxId
        );
        if (finalSelectedInboxId) {
          // Update URL to reflect the actual selection (use slug if available)
          const firstInbox = currentInboxes[0];
          updateQueryParams(
            AGENT_INBOX_PARAM,
            getInboxUrlIdentifier(firstInbox)
          );
        }
      }

      // Apply the selection to the inboxes array
      const updatedInboxes = currentInboxes.map((inbox) => ({
        ...inbox,
        selected: inbox.id === finalSelectedInboxId,
      }));

      // Update state only if it has changed to avoid loops
      if (JSON.stringify(updatedInboxes) !== JSON.stringify(agentInboxes)) {
        logger.log(
          "Updating agentInboxes state with selection:",
          updatedInboxes
        );
        setAgentInboxes(updatedInboxes);
      }
    },
    [
      getSearchParam,
      getItem,
      agentInboxes, // Include agentInboxes state to compare against
      updateQueryParams,
    ]
  );

  /**
   * Add a new agent inbox
   * @param {AgentInbox} agentInbox - The agent inbox to add
   */
  const addAgentInbox = useCallback(
    (agentInbox: AgentInbox) => {
      const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);
      const existingInboxes: AgentInbox[] =
        agentInboxesStr && agentInboxesStr !== "[]"
          ? JSON.parse(agentInboxesStr)
          : [];

      const newInbox = {
        ...agentInbox,
        id: agentInbox.id || uuidv4(),
        // Generate slug from name if provided
        slug:
          agentInbox.slug ||
          (agentInbox.name
            ? getUniqueSlug(agentInbox.name, existingInboxes)
            : undefined),
      };

      // Handle empty inboxes
      if (!agentInboxesStr || agentInboxesStr === "[]") {
        setAgentInboxes([newInbox]);
        setItem(AGENT_INBOXES_LOCAL_STORAGE_KEY, JSON.stringify([newInbox]));

        // Get the default view for this new inbox
        const defaultView = getInboxSetting(
          newInbox.id,
          "defaultView",
          "interrupted",
          config
        );

        // Set agent inbox, offset, and limit (use slug if available)
        updateQueryParams(
          [AGENT_INBOX_PARAM, OFFSET_PARAM, LIMIT_PARAM, INBOX_PARAM],
          [getInboxUrlIdentifier(newInbox), "0", "10", defaultView]
        );
        return;
      }

      try {
        const parsedAgentInboxes: AgentInbox[] = JSON.parse(agentInboxesStr);

        // Add the new inbox and mark as selected
        const updatedInboxes = parsedAgentInboxes.map((inbox) => ({
          ...inbox,
          selected: false,
        }));

        updatedInboxes.push({
          ...newInbox,
          selected: true,
        });

        setAgentInboxes(updatedInboxes);
        setItem(
          AGENT_INBOXES_LOCAL_STORAGE_KEY,
          JSON.stringify(updatedInboxes)
        );

        // Update URL to show the new inbox (use slug if available)
        updateQueryParams(AGENT_INBOX_PARAM, getInboxUrlIdentifier(newInbox));

        // Use router refresh to update the UI without full page reload
        router.refresh();
      } catch (error) {
        logger.error("Error adding agent inbox", error);
        toast({
          title: "Error",
          description: "Failed to add agent inbox. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    [getItem, setItem, updateQueryParams, router, config]
  );

  /**
   * Delete an agent inbox by ID
   * @param {string} id - The ID of the agent inbox to delete
   */
  const deleteAgentInbox = useCallback(
    (id: string) => {
      const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);

      if (!agentInboxesStr || agentInboxesStr === "[]") {
        return;
      }

      try {
        const parsedAgentInboxes: AgentInbox[] = JSON.parse(agentInboxesStr);
        const wasSelected =
          parsedAgentInboxes.find((inbox) => inbox.id === id)?.selected ||
          false;
        const updatedInboxes = parsedAgentInboxes.filter(
          (inbox) => inbox.id !== id
        );

        // Handle empty result
        if (!updatedInboxes.length) {
          updateQueryParams(NO_INBOXES_FOUND_PARAM, "true");
          setAgentInboxes([]);
          setItem(AGENT_INBOXES_LOCAL_STORAGE_KEY, JSON.stringify([]));

          // Use router.push with just the current path
          router.push("/");
          return;
        }

        // Update state
        setAgentInboxes(updatedInboxes);

        // If we deleted the selected inbox, select the first one
        if (wasSelected && updatedInboxes.length > 0) {
          const firstInbox = updatedInboxes[0];
          const selectedInboxes = updatedInboxes.map((inbox) => ({
            ...inbox,
            selected: inbox.id === firstInbox.id,
          }));

          setAgentInboxes(selectedInboxes);
          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(selectedInboxes)
          );
          updateQueryParams(
            AGENT_INBOX_PARAM,
            getInboxUrlIdentifier(firstInbox)
          );
        } else {
          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(updatedInboxes)
          );
        }

        // Refresh data without full page reload
        router.refresh();
      } catch (error) {
        logger.error("Error deleting agent inbox", error);
        toast({
          title: "Error",
          description: "Failed to delete agent inbox. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    [getItem, setItem, updateQueryParams, router]
  );

  /**
   * Change the selected agent inbox
   * @param {string} id - The ID of the agent inbox to select
   * @param {boolean} replaceAll - Whether to replace all query parameters
   */
  const changeAgentInbox = useCallback(
    (id: string, _replaceAll?: boolean) => {
      // Find the inbox being selected to get its URL identifier
      const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);
      let selectedInbox: AgentInbox | undefined;

      if (agentInboxesStr && agentInboxesStr !== "[]") {
        try {
          const parsedInboxes: AgentInbox[] = JSON.parse(agentInboxesStr);
          selectedInbox = parsedInboxes.find((inbox) => inbox.id === id);
        } catch (error) {
          logger.error("Error parsing inboxes for changeAgentInbox", error);
        }
      }

      // Update React state
      setAgentInboxes((prevInboxes) =>
        prevInboxes.map((inbox) => ({
          ...inbox,
          selected: inbox.id === id,
        }))
      );

      // Update localStorage
      if (agentInboxesStr && agentInboxesStr !== "[]") {
        try {
          const parsedInboxes: AgentInbox[] = JSON.parse(agentInboxesStr);
          const updatedInboxes = parsedInboxes.map((inbox) => ({
            ...inbox,
            selected: inbox.id === id,
          }));

          setItem(
            AGENT_INBOXES_LOCAL_STORAGE_KEY,
            JSON.stringify(updatedInboxes)
          );
        } catch (error) {
          logger.error("Error updating selected inbox in localStorage", error);
        }
      }

      // Get the default view for this inbox (per-inbox override > global > app default)
      const defaultView = getInboxSetting(
        id,
        "defaultView",
        "interrupted", // app default
        config
      );

      // Update URL parameters using client-side routing (no page reload)
      const url = new URL(window.location.href);
      const urlIdentifier = selectedInbox
        ? getInboxUrlIdentifier(selectedInbox)
        : id;
      const newParams = new URLSearchParams({
        [AGENT_INBOX_PARAM]: urlIdentifier,
        [OFFSET_PARAM]: "0",
        [LIMIT_PARAM]: "10",
        [INBOX_PARAM]: defaultView, // Use computed default view
      });
      const newUrl = url.pathname + "?" + newParams.toString();

      // Use Next.js router for smooth client-side navigation (no flash)
      router.push(newUrl, { scroll: false });
    },
    [getItem, setItem, router, config]
  );

  /**
   * Update an existing agent inbox
   * @param {AgentInbox} updatedInbox - The updated agent inbox
   */
  const updateAgentInbox = useCallback(
    (updatedInbox: AgentInbox) => {
      const agentInboxesStr = getItem(AGENT_INBOXES_LOCAL_STORAGE_KEY);

      if (!agentInboxesStr || agentInboxesStr === "[]") {
        return;
      }

      try {
        const parsedInboxes: AgentInbox[] = JSON.parse(agentInboxesStr);
        const currentInbox = parsedInboxes.find(
          (inbox) => inbox.id === updatedInbox.id
        );

        if (!currentInbox) {
          logger.error("Inbox not found for update:", updatedInbox.id);
          return;
        }

        const wasSelected = currentInbox.selected;

        const updatedInboxes = parsedInboxes.map((inbox) =>
          inbox.id === updatedInbox.id
            ? { ...updatedInbox, selected: wasSelected }
            : inbox
        );

        setAgentInboxes(updatedInboxes);
        setItem(
          AGENT_INBOXES_LOCAL_STORAGE_KEY,
          JSON.stringify(updatedInboxes)
        );

        // Refresh data without full page reload
        router.refresh();
      } catch (error) {
        logger.error("Error updating agent inbox", error);
        toast({
          title: "Error",
          description: "Failed to update agent inbox. Please try again.",
          variant: "destructive",
          duration: 3000,
        });
      }
    },
    [getItem, setItem, router]
  );

  return {
    agentInboxes,
    getAgentInboxes,
    addAgentInbox,
    deleteAgentInbox,
    changeAgentInbox,
    updateAgentInbox,
  };
}
