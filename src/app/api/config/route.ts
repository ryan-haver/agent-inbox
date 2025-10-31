/**
 * Configuration API Endpoint
 * 
 * Provides REST API for synchronizing configuration between browser and server.
 * Supports GET (load) and POST (save) operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  loadConfig,
  saveConfig,
  isServerStorageEnabled,
  getEnvDefaultConfig,
  type StoredConfiguration,
} from '@/lib/config-storage';

/**
 * GET /api/config - Load configuration from server
 * 
 * Returns stored configuration if available, or defaults from environment.
 * Falls back gracefully if server storage is disabled.
 */
export async function GET() {
  try {
    // Check if server storage is enabled
    if (!isServerStorageEnabled()) {
      return NextResponse.json(
        {
          enabled: false,
          message: 'Server-side storage is disabled. Using browser localStorage.',
        },
        { status: 200 }
      );
    }

    // Try to load existing configuration
    let config = await loadConfig();
    
    if (config) {
      return NextResponse.json({
        enabled: true,
        config,
      });
    }

    // No configuration exists yet, initialize with defaults from environment
    const envDefaults = getEnvDefaultConfig();
    const initialConfig: StoredConfiguration = {
      inboxes: envDefaults.inboxes || [],
      langsmithApiKey: envDefaults.langsmithApiKey,
      preferences: envDefaults.preferences || {},
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
    };
    
    // Save the initial config so it's not created multiple times
    config = await saveConfig(initialConfig);
    
    return NextResponse.json({
      enabled: true,
      config: config || initialConfig,
    });
  } catch (error) {
    console.error('[API /api/config GET] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to load configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/config - Save configuration to server
 * 
 * Accepts configuration object and persists to server storage.
 * Returns saved configuration with metadata (version, lastUpdated).
 */
export async function POST(request: NextRequest) {
  try {
    // Check if server storage is enabled
    if (!isServerStorageEnabled()) {
      return NextResponse.json(
        {
          enabled: false,
          message: 'Server-side storage is disabled. Configuration not saved.',
        },
        { status: 200 }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate basic structure
    if (!body.inboxes || !Array.isArray(body.inboxes)) {
      return NextResponse.json(
        {
          error: 'Invalid configuration structure',
          details: 'Missing or invalid "inboxes" array',
        },
        { status: 400 }
      );
    }

    // Validate inbox structure
    for (const inbox of body.inboxes) {
      if (!inbox.id || !inbox.name) {
        return NextResponse.json(
          {
            error: 'Invalid inbox structure',
            details: 'Each inbox must have "id" and "name" fields',
          },
          { status: 400 }
        );
      }
    }

    // Save configuration
    const savedConfig = await saveConfig(body as StoredConfiguration);
    
    if (!savedConfig) {
      return NextResponse.json(
        {
          error: 'Failed to save configuration',
          details: 'Storage operation returned null',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      enabled: true,
      config: savedConfig,
      message: 'Configuration saved successfully',
    });
  } catch (error) {
    console.error('[API /api/config POST] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to save configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/config - Delete configuration from server
 * 
 * Removes stored configuration file. Browser localStorage remains unchanged.
 */
export async function DELETE() {
  try {
    // Check if server storage is enabled
    if (!isServerStorageEnabled()) {
      return NextResponse.json(
        {
          enabled: false,
          message: 'Server-side storage is disabled. Nothing to delete.',
        },
        { status: 200 }
      );
    }

    // Delete configuration
    const { deleteConfig } = await import('@/lib/config-storage');
    const success = await deleteConfig();
    
    if (!success) {
      return NextResponse.json(
        {
          error: 'Failed to delete configuration',
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      enabled: true,
      message: 'Configuration deleted successfully',
    });
  } catch (error) {
    console.error('[API /api/config DELETE] Error:', error);
    
    return NextResponse.json(
      {
        error: 'Failed to delete configuration',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
