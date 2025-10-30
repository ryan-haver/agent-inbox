# Agent Inbox - Docker Deployment

Docker image for the Agent Inbox web interface - a modern UI for interacting with LangGraph agents.

## Quick Start

### Using Docker Compose (Recommended)

```bash
# Build and start
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

Access the Agent Inbox at: http://localhost:3000

### Using Docker CLI

```bash
# Build the image
docker build -t ghcr.io/ryan-haver/agent-inbox:latest .

# Run the container
docker run -d \
  --name agent-inbox \
  -p 3000:3000 \
  --restart unless-stopped \
  ghcr.io/ryan-haver/agent-inbox:latest
```

## Configuration

The Agent Inbox is **stateless** and requires **no volumes**. All configuration is done through the web interface and stored in your browser's local storage.

### Environment Variables

All environment variables are **optional**. Configuration is typically done in the browser UI.

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Node environment |
| `NEXT_TELEMETRY_DISABLED` | `1` | Disable Next.js telemetry |
| `PORT` | `3000` | Port to listen on |
| `HOSTNAME` | `0.0.0.0` | Hostname to bind to |

### Browser Configuration

After starting the container, open http://localhost:3000 and:

1. **Add LangSmith API Key** (Settings → LangSmith API Key)
   - Get your key from: https://smith.langchain.com/settings
   - Used for authentication with LangGraph deployments

2. **Create an Inbox** (Settings → Add Inbox)
   - **Assistant/Graph ID**: Your LangGraph graph name
   - **Deployment URL**: URL of your LangGraph deployment
     - Local: `http://executive-ai-assistant:2024`
     - Unraid: `http://YOUR_UNRAID_IP:2024`
     - LangGraph Cloud: `https://your-deployment.langchain.com`
   - **Name**: Friendly name for this inbox (optional)

## Connecting to Executive AI Assistant

### Docker Compose Stack

To run both containers together:

```yaml
services:
  executive-ai-assistant:
    image: ghcr.io/ryan-haver/executive-ai-assistant:latest
    ports:
      - "2024:2024"
    environment:
      - GMAIL_SECRET=...
      - GMAIL_TOKEN=...
      - LLM_PROVIDER=auto
    # ... other config
  
  agent-inbox:
    image: ghcr.io/ryan-haver/agent-inbox:latest
    ports:
      - "3000:3000"
    depends_on:
      - executive-ai-assistant
```

Then configure Agent Inbox to use: `http://executive-ai-assistant:2024`

### Unraid

1. Install **Executive AI Assistant** container first
2. Install **Agent Inbox** container
3. In Agent Inbox UI, set Deployment URL to: `http://YOUR_UNRAID_IP:2024`

## Health Check

The container includes a built-in health check that verifies:
- HTTP server is responding on port 3000
- Application returns HTTP 200 status

Check health status:
```bash
docker ps  # Shows health status
docker inspect agent-inbox | grep Health -A 10
```

## Image Details

- **Base**: `node:20-alpine` (minimal Linux distribution)
- **Size**: ~250MB (multi-stage build optimization)
- **Architecture**: Multi-stage build (deps → builder → runner)
- **User**: Runs as non-root user `nextjs` (UID 1001)
- **Build Mode**: Standalone output (optimized for Docker)

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs agent-inbox

# Check if port 3000 is already in use
docker ps | grep 3000
```

### Can't connect to LangGraph deployment

1. **Check network connectivity**:
   ```bash
   docker exec agent-inbox wget -O- http://executive-ai-assistant:2024
   ```

2. **Verify deployment URL**:
   - For container-to-container: Use container name (e.g., `executive-ai-assistant`)
   - For Unraid: Use Unraid server IP
   - For cloud: Use full HTTPS URL

3. **Check LangSmith API key**:
   - Verify key is valid at https://smith.langchain.com/settings
   - Re-enter key in Agent Inbox settings

### Configuration not persisting

- Configuration is stored in **browser local storage**
- Clearing browser data will reset configuration
- Each browser/device needs separate configuration
- No server-side configuration storage

### Health check failing

```bash
# Test manually
docker exec agent-inbox node -e "require('http').get('http://localhost:3000', (r) => {console.log(r.statusCode)})"

# Should output: 200
```

### Build failures

```bash
# Clear build cache
docker builder prune

# Rebuild without cache
docker compose build --no-cache
```

## Development

### Local Development (without Docker)

```bash
# Install dependencies
yarn install

# Run development server
yarn dev

# Open http://localhost:3000
```

### Building for Production

```bash
# Build Next.js app
yarn build

# Test production build
yarn start
```

## Security

- **No secrets in container**: All auth tokens stored in browser local storage
- **Non-root user**: Container runs as `nextjs` user (UID 1001)
- **Stateless**: No persistent data, no volume mounts required
- **Minimal base**: Alpine Linux for reduced attack surface
- **No telemetry**: Next.js telemetry disabled by default

## Resource Requirements

**Recommended Resources**:
- CPU: 0.25-1.0 cores
- RAM: 128MB-512MB
- Disk: ~300MB (image + temporary files)
- Network: Internet access for LangSmith API

**Typical Usage**:
- Idle: ~50MB RAM, minimal CPU
- Active: ~150MB RAM, moderate CPU during page loads

## Integration Examples

### nginx Reverse Proxy

```nginx
server {
    listen 80;
    server_name inbox.example.com;
    
    location / {
        proxy_pass http://agent-inbox:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Traefik Labels

```yaml
services:
  agent-inbox:
    image: ghcr.io/ryan-haver/agent-inbox:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.inbox.rule=Host(`inbox.example.com`)"
      - "traefik.http.services.inbox.loadbalancer.server.port=3000"
```

## License

See [LICENSE](LICENSE) file in the repository root.

## Support

- **GitHub Issues**: https://github.com/langchain-ai/agent-inbox/issues
- **Documentation**: https://github.com/langchain-ai/agent-inbox
- **LangGraph Docs**: https://langchain-ai.github.io/langgraph/

## Links

- **Upstream Repository**: https://github.com/langchain-ai/agent-inbox
- **LangGraph Platform**: https://langchain.com/langgraph
- **LangSmith**: https://smith.langchain.com/
