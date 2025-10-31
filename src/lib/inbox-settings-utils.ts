import { StoredConfiguration } from './config-storage';
import { PersistentConfig } from '@/hooks/use-persistent-config';

// Accept both config types for flexibility
type ConfigType = StoredConfiguration | PersistentConfig;

/**
 * Generic helper to get inbox-specific setting with fallback chain:
 * 1. Per-inbox override (highest priority)
 * 2. Global default (medium priority)
 * 3. App default (fallback)
 * 
 * This pattern scales to any future inbox-specific settings.
 */
export function getInboxSetting<T>(
  inboxId: string,
  settingKey: string,
  appDefault: T,
  config: ConfigType
): T {
  // 1. Check per-inbox override first
  const inboxOverride = (config.preferences?.inboxSettings?.[inboxId] as any)?.[settingKey];
  if (inboxOverride !== undefined) return inboxOverride;
  
  // 2. Fall back to global default
  const globalSetting = (config.preferences?.inboxDefaults as any)?.[settingKey];
  if (globalSetting !== undefined) return globalSetting;
  
  // 3. Fall back to app default
  return appDefault;
}

/**
 * Update a per-inbox setting
 */
export function setInboxSetting(
  inboxId: string,
  settingKey: string,
  value: any,
  config: ConfigType
): ConfigType {
  return {
    ...config,
    preferences: {
      ...config.preferences,
      inboxSettings: {
        ...config.preferences?.inboxSettings,
        [inboxId]: {
          ...(config.preferences?.inboxSettings?.[inboxId] as any),
          [settingKey]: value,
        },
      },
    },
  };
}

/**
 * Clear a per-inbox setting (revert to global)
 */
export function clearInboxSetting(
  inboxId: string,
  settingKey: string,
  config: ConfigType
): ConfigType {
  const inboxSettings: any = { ...config.preferences?.inboxSettings };
  if (inboxSettings[inboxId]) {
    const currentSettings = inboxSettings[inboxId] as any;
    const { [settingKey]: _, ...rest } = currentSettings;
    if (Object.keys(rest).length === 0) {
      delete inboxSettings[inboxId];
    } else {
      inboxSettings[inboxId] = rest;
    }
  }
  
  return {
    ...config,
    preferences: {
      ...config.preferences,
      inboxSettings,
    },
  };
}
