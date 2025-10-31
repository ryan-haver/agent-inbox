"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AgentInbox } from "../types";
import { usePersistentConfig } from "@/hooks/use-persistent-config";
import { getInboxSetting, setInboxSetting, clearInboxSetting } from "@/lib/inbox-settings-utils";

interface InboxSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inbox: AgentInbox;
}

export function InboxSettingsDialog({
  open,
  onOpenChange,
  inbox,
}: InboxSettingsDialogProps) {
  const { config, updateConfig } = usePersistentConfig();
  
  // Get current values
  const currentDefaultView = config.preferences?.inboxSettings?.[inbox.id]?.defaultView;
  const globalDefaultView = config.preferences?.inboxDefaults?.defaultView || 'interrupted';
  
  const handleDefaultViewChange = (value: string) => {
    if (value === 'use-global') {
      // Clear the override (revert to global)
      const newConfig = clearInboxSetting(inbox.id, 'defaultView', config);
      updateConfig(newConfig, true); // Phase 4A+: Immediate save for settings
    } else {
      // Set the override
      const newConfig = setInboxSetting(
        inbox.id,
        'defaultView',
        value,
        config
      );
      updateConfig(newConfig, true); // Phase 4A+: Immediate save for settings
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Inbox Settings</DialogTitle>
          <DialogDescription>
            Customize settings for <strong>{inbox.name}</strong>
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Default View Setting */}
          <div className="space-y-2">
            <label htmlFor="inbox-default-view" className="text-sm font-medium text-gray-900">
              Default View
            </label>
            <select
              id="inbox-default-view"
              value={currentDefaultView || 'use-global'}
              onChange={(e) => handleDefaultViewChange(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="use-global">Use Global Setting</option>
              <option value="all">All</option>
              <option value="interrupted">Interrupted</option>
              <option value="idle">Idle</option>
              <option value="busy">Busy</option>
              <option value="error">Error</option>
            </select>
            
            <p className="text-xs text-gray-500">
              {currentDefaultView 
                ? `This inbox will show "${currentDefaultView}" by default.`
                : `Using global setting: "${globalDefaultView}"`
              }
            </p>
          </div>
          
          {/* Future settings will go here */}
          <div className="pt-2 border-t border-gray-200">
            <p className="text-xs text-gray-400 italic">
              More inbox-specific settings coming soon...
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
