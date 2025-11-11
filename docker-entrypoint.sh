#!/bin/sh
# =============================================================================
# Agent Inbox - Docker Entrypoint
# =============================================================================
# Provides helpful startup information including actual accessible URLs
# Automatically detects: Bridge, MACVLAN, Host networking modes
# =============================================================================

set -e

echo "=================================================="
echo "🚀 Agent Inbox - Starting..."
echo "=================================================="
echo ""

# Detect container IP addresses (may have multiple interfaces)
CONTAINER_IPS=$(hostname -i 2>/dev/null || echo "unavailable")

# Try to detect the default gateway (usually the Docker host in bridge mode)
GATEWAY_IP=$(ip route | grep default | awk '{print $3}' 2>/dev/null || echo "")

# Get all network interfaces and IPs for MACVLAN detection
ALL_IPS=$(ip -4 addr show | grep -oP '(?<=inet\s)\d+(\.\d+){3}' | grep -v '^127\.' || echo "")

# Detect network mode
NETWORK_MODE="unknown"
if [ -n "$GATEWAY_IP" ] && [ "$GATEWAY_IP" != "0.0.0.0" ]; then
    # Check if we're in a typical Docker bridge network (172.x, 10.x ranges)
    case "$CONTAINER_IPS" in
        172.17.*|172.18.*|172.19.*|172.2*.*|172.3*.*)
            NETWORK_MODE="bridge"
            ;;
        10.*)
            NETWORK_MODE="bridge"
            ;;
        192.168.*)
            # Could be MACVLAN if IP is in typical LAN range
            NETWORK_MODE="macvlan"
            ;;
        *)
            NETWORK_MODE="bridge"
            ;;
    esac
elif [ -z "$GATEWAY_IP" ] || [ "$GATEWAY_IP" = "0.0.0.0" ]; then
    NETWORK_MODE="host"
fi

# Get network mode based on container networking
# Docker host IP detection for displaying helpful access URLs

echo "📍 Container Information:"
echo "   - Container IP(s): ${CONTAINER_IPS}"
echo "   - Network Mode: ${NETWORK_MODE}"
echo "   - Internal Port: 3000"
echo "   - Environment: ${NODE_ENV:-production}"
echo ""

echo "🌐 Access Agent Inbox:"
echo ""

# Provide URLs based on detected network mode
case "$NETWORK_MODE" in
    "macvlan")
        echo "   ✅ MACVLAN DETECTED - Container has real network IP"
        echo ""
        for IP in $ALL_IPS; do
            echo "   🔗 http://${IP}:3000"
        done
        echo ""
        echo "   💡 Use any of the above URLs from any device on your network"
        ;;
    
    "host")
        echo "   ✅ HOST MODE DETECTED - Container uses host networking"
        echo ""
        echo "   🔗 http://YOUR_SERVER_IP:3000"
        echo ""
        echo "   💡 Access via your server's IP address on port 3000"
        ;;
    
    "bridge"|*)
        echo "   ✅ BRIDGE MODE DETECTED - Standard Docker networking"
        echo ""
        echo "   📍 From inside Docker network:"
        echo "      http://${CONTAINER_IPS}:3000"
        echo ""
        if [ -n "$GATEWAY_IP" ] && [ "$GATEWAY_IP" != "0.0.0.0" ]; then
            echo "   📍 From host/external:"
            echo "      http://${GATEWAY_IP}:${HOST_PORT:-3000}"
            echo ""
        fi
        
        # Display complete URL if both HOST_IP and HOST_PORT are provided
        if [ -n "$HOST_IP" ] && [ -n "$HOST_PORT" ]; then
            echo "   💡 Access at: http://${HOST_IP}:${HOST_PORT}"
        elif [ -n "$HOST_IP" ]; then
            echo "   💡 Access at: http://${HOST_IP}:${HOST_PORT:-3000}"
        else
            echo "   💡 Access at: http://YOUR_SERVER_IP:${HOST_PORT:-3000}"
            echo "      (Replace YOUR_SERVER_IP with your server's IP address)"
        fi
        ;;
esac

echo ""
echo "⚙️  Next Steps:"
echo "   1. Open the web UI in your browser"
echo "   2. Click Settings (gear icon)"
echo "   3. Add your LangSmith API key"
echo "   4. Connect to Executive AI Assistant deployment"
echo ""
echo "=================================================="
echo "📋 Starting Next.js server..."
echo "=================================================="
echo ""

# Execute the original command (node server.js)
exec "$@"
