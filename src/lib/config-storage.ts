/**
 * Server-Side Configuration Storage Service
 *
 * Provides optional persistent storage for Agent Inbox configuration.
 * Falls back gracefully to browser localStorage if disabled or unavailable.
 *
 * Features:
 * - File-based JSON storage (no database required)
 * - Docker volume support
 * - Optional (backward compatible)
 * - Multi-device/browser sync
 */

import fs from "fs/promises";
import path from "path";
import { AgentInbox } from "@/components/agent-inbox/types";

// Configuration file path (from environment or default)
const CONFIG_FILE = process.env.CONFIG_FILE_PATH || "/app/data/config.json";
const CONFIG_DIR = path.dirname(CONFIG_FILE);

// Feature flag: enable server-side storage (default: false for backward compatibility)
const USE_SERVER_STORAGE = process.env.USE_SERVER_STORAGE === "true";

/**
 * Stored Configuration Schema
 */
export interface StoredConfiguration {
  version: string;
  lastUpdated: string;
  langsmithApiKey?: string;
  inboxes: AgentInbox[];
  preferences?: {
    theme?: string;
    defaultInbox?: string;
    lastSelectedFilter?: string; // Phase 4A: Filter persistence
    inboxOrder?: string[]; // Phase 4A: Inbox ordering

    // Phase 4A+: Global inbox behavior defaults (scalable structure)
    inboxDefaults?: {
      defaultView?: "interrupted" | "pending" | "all";
      // Future: sortOrder, autoRefresh, refreshInterval, etc.
    };

    // Phase 4A+: Per-inbox setting overrides (scalable structure)
    inboxSettings?: {
      [inboxId: string]: {
        defaultView?: "interrupted" | "pending" | "all";
        // Future: inbox-specific sortOrder, notificationsEnabled, etc.
      };
    };

    notifications?: {
      // Phase 4A: Notification settings (UI only, functionality in Phase 5)
      enabled: boolean;
      sound: boolean;
      desktop: boolean;
      emailOnInterrupt?: boolean; // Future: Phase 5
    };
  };
  drafts?: {
    // Phase 4A: Draft auto-save
    [threadId: string]: {
      content: string;
      lastSaved: string;
    };
  };
}

/**
 * Check if server storage is enabled and available
 */
export function isServerStorageEnabled(): boolean {
  return USE_SERVER_STORAGE;
}

/**
 * Ensure the configuration directory exists
 */
async function ensureConfigDir(): Promise<void> {
  try {
    await fs.access(CONFIG_DIR);
  } catch {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  }
}

/**
 * Load configuration from server storage
 *
 * @returns Configuration object or null if not available
 */
export async function loadConfig(): Promise<StoredConfiguration | null> {
  if (!USE_SERVER_STORAGE) {
    return null;
  }

  try {
    const data = await fs.readFile(CONFIG_FILE, "utf-8");
    const config = JSON.parse(data) as StoredConfiguration;

    console.log("[Config Storage] Configuration loaded from", CONFIG_FILE);
    return config;
  } catch (error) {
    // File doesn't exist yet or can't be read
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      console.log("[Config Storage] No configuration file found (first run)");
      return null;
    }

    console.error("[Config Storage] Error loading configuration:", error);
    return null;
  }
}

/**
 * Save configuration to server storage
 *
 * @param config Configuration object to save
 * @returns Saved configuration or null if save failed
 */
export async function saveConfig(
  config: StoredConfiguration
): Promise<StoredConfiguration | null> {
  if (!USE_SERVER_STORAGE) {
    return null;
  }

  try {
    // Ensure directory exists
    await ensureConfigDir();

    // Add metadata
    const configWithMeta = {
      ...config,
      version: config.version || "1.0.0",
      lastUpdated: new Date().toISOString(),
    };

    // Write atomically (write to temp file, then rename)
    const tempFile = `${CONFIG_FILE}.tmp`;
    await fs.writeFile(
      tempFile,
      JSON.stringify(configWithMeta, null, 2),
      "utf-8"
    );
    await fs.rename(tempFile, CONFIG_FILE);

    console.log("[Config Storage] Configuration saved to", CONFIG_FILE);
    return configWithMeta;
  } catch (error) {
    console.error("[Config Storage] Error saving configuration:", error);
    return null;
  }
}

/**
 * Delete configuration from server storage
 *
 * @returns true if deleted successfully, false otherwise
 */
export async function deleteConfig(): Promise<boolean> {
  if (!USE_SERVER_STORAGE) {
    return false;
  }

  try {
    await fs.unlink(CONFIG_FILE);
    console.log("[Config Storage] Configuration deleted");
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      // File doesn't exist, that's fine
      return true;
    }
    console.error("[Config Storage] Error deleting configuration:", error);
    return false;
  }
}

/**
 * Export configuration as JSON string (for backup)
 *
 * @returns JSON string or null if unavailable
 */
export async function exportConfig(): Promise<string | null> {
  const config = await loadConfig();
  if (!config) {
    return null;
  }

  return JSON.stringify(config, null, 2);
}

/**
 * Import configuration from JSON string (for restore)
 *
 * @param jsonData JSON string containing configuration
 * @returns Imported configuration or null if import failed
 */
export async function importConfig(
  jsonData: string
): Promise<StoredConfiguration | null> {
  try {
    const config = JSON.parse(jsonData) as StoredConfiguration;

    // Validate basic structure
    if (!config.inboxes || !Array.isArray(config.inboxes)) {
      throw new Error("Invalid configuration structure: missing inboxes array");
    }

    return await saveConfig(config);
  } catch (error) {
    console.error("[Config Storage] Error importing configuration:", error);
    return null;
  }
}

/**
 * Get default configuration from environment variables
 *
 * This allows admins to pre-configure Agent Inbox via env vars
 *
 * @returns Partial configuration from environment
 */
export function getEnvDefaultConfig(): Partial<StoredConfiguration> {
  const config: Partial<StoredConfiguration> = {
    inboxes: [],
    preferences: {},
  };

  // LangSmith API key from environment
  if (process.env.LANGSMITH_API_KEY) {
    config.langsmithApiKey = process.env.LANGSMITH_API_KEY;
  }

  // Default inbox from environment
  if (process.env.DEFAULT_INBOX_ENABLED === "true") {
    const defaultInbox: AgentInbox = {
      id: "default",
      name: process.env.DEFAULT_INBOX_NAME || "Default Inbox",
      deploymentUrl: process.env.DEFAULT_DEPLOYMENT_URL || "",
      graphId: process.env.DEFAULT_ASSISTANT_ID || "",
      selected: false,
      createdAt: new Date().toISOString(),
    };
    config.inboxes = [defaultInbox];
  }

  // Additional inboxes from JSON environment variable
  if (process.env.ADDITIONAL_INBOXES) {
    try {
      const additional = JSON.parse(
        process.env.ADDITIONAL_INBOXES
      ) as AgentInbox[];
      config.inboxes = [...(config.inboxes || []), ...additional];
    } catch (error) {
      console.error("[Config Storage] Invalid ADDITIONAL_INBOXES JSON:", error);
    }
  }

  // Theme preference
  if (process.env.DEFAULT_THEME) {
    config.preferences = {
      ...config.preferences,
      theme: process.env.DEFAULT_THEME,
    };
  }

  return config;
}
