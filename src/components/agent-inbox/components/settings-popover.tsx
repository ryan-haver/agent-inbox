"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Settings, RefreshCw, Cloud, HardDrive, Bell, Inbox } from "lucide-react";
import React from "react";
import { PillButton } from "@/components/ui/pill-button";
import { Label } from "@/components/ui/label";
import { useLocalStorage } from "../hooks/use-local-storage";
import { INBOX_PARAM, LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY } from "../constants";
import { useThreadsContext } from "../contexts/ThreadContext";
import { useQueryParams } from "../hooks/use-query-params";
import { ThreadStatusWithAll, InboxView } from "../types";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { forceInboxBackfill, isBackfillCompleted } from "../utils/backfill";
import { useToast } from "@/hooks/use-toast";
import { logger } from "../utils/logger";
import { cn } from "@/lib/utils";
import { usePersistentConfig } from "@/hooks/use-persistent-config";

export function SettingsPopover() {
  const langchainApiKeyNotSet = React.useRef(true);
  const [open, setOpen] = React.useState(false);
  const [langchainApiKey, setLangchainApiKey] = React.useState("");
  const { getItem, setItem } = useLocalStorage();
  const { getSearchParam } = useQueryParams();
  const { fetchThreads } = useThreadsContext();
  const [isRunningBackfill, setIsRunningBackfill] = React.useState(false);
  const [backfillCompleted, setBackfillCompleted] = React.useState(true);
  const { toast } = useToast();
  
  // Persistent storage hook for server-side sync
  const { config, serverEnabled, isLoading, updateConfig } = usePersistentConfig();

  React.useEffect(() => {
    setBackfillCompleted(isBackfillCompleted());

    try {
      if (typeof window === "undefined") {
        return;
      }
      if (langchainApiKey) return;

      // Try persistent config first (server storage), then fall back to localStorage
      if (config.langsmithApiKey) {
        langchainApiKeyNotSet.current = false;
        setLangchainApiKey(config.langsmithApiKey);
      } else {
        const langchainApiKeyLS = getItem(LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY);
        if (langchainApiKeyLS) {
          langchainApiKeyNotSet.current = false;
          setLangchainApiKey(langchainApiKeyLS);
          // Sync to persistent config if server storage is enabled
          if (serverEnabled) {
            updateConfig({ langsmithApiKey: langchainApiKeyLS });
          }
        }
      }
    } catch (e) {
      logger.error("Error getting/setting LangSmith API key", e);
    }
  }, [langchainApiKey, config.langsmithApiKey, serverEnabled, getItem, updateConfig]);

  const handleChangeLangChainApiKey = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const newKey = e.target.value;
    setLangchainApiKey(newKey);
    
    // Save to localStorage (for backward compatibility)
    setItem(LANGCHAIN_API_KEY_LOCAL_STORAGE_KEY, newKey);
    
    // Also update persistent config if server storage is enabled
    if (serverEnabled) {
      updateConfig({ langsmithApiKey: newKey });
    }
  };

  const handleRunBackfill = async () => {
    setIsRunningBackfill(true);
    try {
      const result = await forceInboxBackfill();

      if (result.success) {
        toast({
          title: "Success",
          description:
            "Your inbox IDs have been updated. Please refresh the page to see your inboxes.",
          duration: 5000,
        });
        window.location.reload();
      } else {
        toast({
          title: "Error",
          description: "Failed to update inbox IDs. Please try again.",
          variant: "destructive",
          duration: 5000,
        });
      }
    } catch (error) {
      logger.error("Error running backfill:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
        duration: 5000,
      });
    } finally {
      setIsRunningBackfill(false);
    }
  };

  return (
    <Popover
      open={open}
      onOpenChange={(c) => {
        if (!c && langchainApiKey && langchainApiKeyNotSet.current) {
          langchainApiKeyNotSet.current = false;
          const inboxParam = getSearchParam(INBOX_PARAM) as
            | ThreadStatusWithAll
            | undefined;
          if (inboxParam) {
            void fetchThreads(inboxParam);
          }
        }
        setOpen(c);
      }}
    >
      <PopoverTrigger asChild>
        <PillButton
          variant="outline"
          className="flex gap-2 items-center justify-center text-gray-800 w-fit"
          size="lg"
        >
          <Settings />
          <span>Settings</span>
        </PillButton>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Settings</h4>
            <p className="text-sm text-muted-foreground">
              Configuration settings for Agent Inbox
            </p>
            {!isLoading && (
              <div className={cn(
                "flex items-center gap-2 text-xs px-2 py-1 rounded-md",
                serverEnabled 
                  ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400" 
                  : "bg-gray-50 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400"
              )}>
                {serverEnabled ? (
                  <>
                    <Cloud className="h-3 w-3" />
                    <span>Server storage enabled</span>
                  </>
                ) : (
                  <>
                    <HardDrive className="h-3 w-3" />
                    <span>Browser storage only</span>
                  </>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-col items-start gap-4 w-full">
            <div className="flex flex-col items-start gap-2 w-full">
              <div className="flex flex-col gap-1 w-full items-start">
                <Label htmlFor="langchain-api-key">
                  LangSmith API Key <span className="text-red-500">*</span>
                </Label>
                <p className="text-xs text-muted-foreground">
                  {serverEnabled 
                    ? "Synced to server storage. Changes will be saved to /app/data/config.json and accessible from all devices."
                    : "This value is stored in your browser's local storage and is only used to authenticate requests sent to your LangGraph server."
                  }
                </p>
              </div>
              <PasswordInput
                id="langchain-api-key"
                placeholder="lsv2_pt_..."
                className="min-w-full"
                required
                value={langchainApiKey}
                onChange={handleChangeLangChainApiKey}
              />
            </div>
            
            {/* Phase 4A: Notification Settings */}
            <div className="flex flex-col items-start gap-2 w-full border-t pt-4">
              <div className="flex flex-col gap-1 w-full items-start">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4" />
                  <Label>Notifications</Label>
                </div>
                <p className="text-xs text-muted-foreground">
                  Configure notification preferences. Full notification functionality will be implemented in a future update.
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full pl-6">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notifications-enabled"
                    checked={config.preferences?.notifications?.enabled ?? true}
                    onCheckedChange={(checked) => {
                      updateConfig({
                        preferences: {
                          ...config.preferences,
                          notifications: {
                            enabled: checked === true,
                            sound: config.preferences?.notifications?.sound ?? true,
                            desktop: config.preferences?.notifications?.desktop ?? true,
                          },
                        },
                      });
                    }}
                  />
                  <label
                    htmlFor="notifications-enabled"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                  >
                    Enable notifications
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notifications-sound"
                    checked={config.preferences?.notifications?.sound ?? true}
                    disabled={!(config.preferences?.notifications?.enabled ?? true)}
                    onCheckedChange={(checked) => {
                      updateConfig({
                        preferences: {
                          ...config.preferences,
                          notifications: {
                            ...config.preferences?.notifications,
                            enabled: config.preferences?.notifications?.enabled ?? true,
                            sound: checked === true,
                            desktop: config.preferences?.notifications?.desktop ?? true,
                          },
                        },
                      });
                    }}
                  />
                  <label
                    htmlFor="notifications-sound"
                    className={cn(
                      "text-sm leading-none cursor-pointer",
                      !(config.preferences?.notifications?.enabled ?? true) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Play sound
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="notifications-desktop"
                    checked={config.preferences?.notifications?.desktop ?? true}
                    disabled={!(config.preferences?.notifications?.enabled ?? true)}
                    onCheckedChange={(checked) => {
                      updateConfig({
                        preferences: {
                          ...config.preferences,
                          notifications: {
                            ...config.preferences?.notifications,
                            enabled: config.preferences?.notifications?.enabled ?? true,
                            sound: config.preferences?.notifications?.sound ?? true,
                            desktop: checked === true,
                          },
                        },
                      });
                    }}
                  />
                  <label
                    htmlFor="notifications-desktop"
                    className={cn(
                      "text-sm leading-none cursor-pointer",
                      !(config.preferences?.notifications?.enabled ?? true) && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    Desktop notifications
                  </label>
                </div>
              </div>
            </div>

            {/* Inbox Defaults Section */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center gap-2">
                <Inbox className="w-4 h-4 text-gray-700" />
                <h3 className="text-sm font-semibold text-gray-900">Inbox Defaults</h3>
              </div>
              
              <div className="space-y-2 pl-6">
                <div className="flex items-center justify-between">
                  <label htmlFor="default-view" className="text-sm text-gray-700">
                    Default view when switching inboxes
                  </label>
                  <select
                    id="default-view"
                    value={config.preferences?.inboxDefaults?.defaultView || 'interrupted'}
                    onChange={(e) => {
                      updateConfig({
                        preferences: {
                          ...config.preferences,
                          inboxDefaults: {
                            ...config.preferences?.inboxDefaults,
                            defaultView: e.target.value as InboxView,
                          },
                        },
                      });
                    }}
                    className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All</option>
                    <option value="interrupted">Interrupted</option>
                    <option value="idle">Idle</option>
                    <option value="busy">Busy</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                
                <p className="text-xs text-gray-500">
                  Choose which inbox view to show by default. Can be overridden per inbox.
                </p>
              </div>
            </div>

            {!backfillCompleted && (
              <div className="flex flex-col items-start gap-2 w-full border-t pt-4">
                <div className="flex flex-col gap-1 w-full items-start">
                  <Label>Update Inbox IDs</Label>
                  <p className="text-xs text-muted-foreground">
                    Update your inbox IDs to the new format that supports
                    sharing links across machines.
                  </p>
                </div>
                <Button
                  onClick={handleRunBackfill}
                  disabled={isRunningBackfill}
                  className="flex items-center gap-2"
                >
                  <RefreshCw
                    className={cn(
                      isRunningBackfill ? "animate-spin h-4 w-4" : "h-4 w-4"
                    )}
                  />
                  {isRunningBackfill ? "Updating..." : "Update Inbox IDs"}
                </Button>
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
