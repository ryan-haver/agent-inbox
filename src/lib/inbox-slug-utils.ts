import { AgentInbox } from "@/components/agent-inbox/types";

/**
 * Convert a string to a URL-safe slug
 * Examples:
 * - "My Inbox" → "my-inbox"
 * - "Test Inbox 123" → "test-inbox-123"
 * - "Special & Chars!" → "special-chars"
 */
export function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    // Replace spaces and underscores with hyphens
    .replace(/[\s_]+/g, '-')
    // Remove any characters that aren't alphanumeric or hyphens
    .replace(/[^a-z0-9-]/g, '')
    // Remove consecutive hyphens
    .replace(/-+/g, '-')
    // Remove leading/trailing hyphens
    .replace(/^-|-$/g, '');
}

/**
 * Get a unique slug for an inbox, handling collisions
 * If the slug already exists, append a number: my-inbox-2, my-inbox-3, etc.
 */
export function getUniqueSlug(name: string, existingInboxes: AgentInbox[], currentInboxId?: string): string {
  const baseSlug = generateSlug(name);
  
  // If no name or slug is empty, fall back to a random string
  if (!baseSlug) {
    return `inbox-${Math.random().toString(36).substring(2, 8)}`;
  }
  
  let slug = baseSlug;
  let counter = 2;
  
  // Check for collisions (excluding the current inbox if updating)
  while (existingInboxes.some(inbox => 
    inbox.slug === slug && inbox.id !== currentInboxId
  )) {
    slug = `${baseSlug}-${counter}`;
    counter++;
  }
  
  return slug;
}

/**
 * Find an inbox by slug, UUID, or name (in that order of priority)
 * Supports backward compatibility with UUID-based URLs
 */
export function findInboxByIdentifier(
  identifier: string, 
  inboxes: AgentInbox[]
): AgentInbox | undefined {
  if (!identifier || !inboxes.length) {
    return undefined;
  }
  
  // 1. Try to find by slug (new preferred method)
  const bySlug = inboxes.find(inbox => inbox.slug === identifier);
  if (bySlug) {
    return bySlug;
  }
  
  // 2. Try to find by UUID (backward compatibility)
  const byId = inboxes.find(inbox => inbox.id === identifier);
  if (byId) {
    return byId;
  }
  
  // 3. Try to find by exact name match (fallback)
  const byName = inboxes.find(inbox => 
    inbox.name?.toLowerCase() === identifier.toLowerCase()
  );
  if (byName) {
    return byName;
  }
  
  return undefined;
}

/**
 * Get the URL identifier for an inbox (slug if available, otherwise UUID)
 */
export function getInboxUrlIdentifier(inbox: AgentInbox): string {
  return inbox.slug || inbox.id;
}
