#!/bin/sh
# =============================================================================
# Agent Inbox - Docker Entrypoint
# =============================================================================
# Provides helpful startup information including actual accessible URLs
# =============================================================================

set -e

echo "=================================================="
echo "🚀 Agent Inbox - Starting..."
echo "=================================================="
echo ""

# Detect host IP addresses (may have multiple interfaces)
HOST_IPS=$(hostname -i 2>/dev/null || echo "unavailable")

# Try to detect the default gateway (usually the Docker host)
GATEWAY_IP=$(ip route | grep default | awk '{print $3}' 2>/dev/null || echo "")

# Get the mapped port from environment (if provided by Docker)
MAPPED_PORT="${PORT:-3000}"

echo "📍 Container Information:"
echo "   - Container IP: ${HOST_IPS}"
echo "   - Internal Port: 3000"
echo "   - Environment: ${NODE_ENV:-production}"
echo ""

echo "🌐 Access Agent Inbox at:"
echo "   - Local (in container): http://localhost:3000"
echo "   - Container network: http://${HOST_IPS}:3000"

if [ -n "$GATEWAY_IP" ]; then
    echo "   - Docker host (likely): http://${GATEWAY_IP}:${MAPPED_PORT}"
fi

echo ""
echo "💡 If you mapped to a different host port (e.g., 3006),"
echo "   use: http://YOUR_SERVER_IP:YOUR_MAPPED_PORT"
echo ""
echo "⚙️  Configuration:"
echo "   - Open Settings (gear icon) in the web UI"
echo "   - Add your LangSmith API key"
echo "   - Connect to your Executive AI Assistant deployment"
echo ""
echo "=================================================="
echo "📋 Starting Next.js server..."
echo "=================================================="
echo ""

# Execute the original command (node server.js)
exec "$@"
