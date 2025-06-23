# Deployment Guide

This guide explains how to deploy the LangGraph Backend Server.

## Prerequisites

- Node.js 18+ 
- pnpm (preferred) or npm
- Environment variables configured in `.env` file

## Build and Deployment Commands

### Development
```bash
# Install dependencies
pnpm install

# Run in development mode with hot reload
pnpm run dev

# Build for production
pnpm run build

# Start production server
pnpm run start
```

### Production Deployment
```bash
# Build and start in production mode
pnpm run prod

# Or step by step:
pnpm run prod:build  # Build with NODE_ENV=production
pnpm run prod:start  # Start with NODE_ENV=production

# Simple deployment (build + start)
pnpm run deploy
```

### Docker Deployment
```bash
# Build Docker image
pnpm run docker:build

# Run Docker container
pnpm run docker:run

# Run in development mode with volume mount
pnpm run docker:dev
```

## Environment Variables

Make sure to set these in your `.env` file:

```env
NODE_ENV=production
PORT=3001
GROQ_API_KEY=your_groq_api_key
TOGETHER_AI_API_KEY=your_together_ai_key
PERPLEXITY_API_TOKEN=your_perplexity_token
NODIT_API_KEY=your_nodit_api_key
```

## Health Check

After deployment, verify the server is running:
- Health check: `http://localhost:3001/health`
- API endpoint: `http://localhost:3001/api/process`
- Stream endpoint: `http://localhost:3001/api/stream`

## Platform-Specific Deployment

### Heroku
The `heroku-postbuild` script will automatically run the build process.

### Docker
Use the provided Dockerfile for containerized deployment:
```bash
docker build -t langgraph-backend .
docker run -p 3001:3001 --env-file .env langgraph-backend
```

### Other Platforms
Most platforms that support Node.js will work with the standard npm scripts:
- Build command: `pnpm run build`
- Start command: `pnpm run start`

## Troubleshooting

### Module Not Found Error
If you see "Cannot find module '/app/dist/server.js'", ensure:
1. The build process completed successfully: `pnpm run build`
2. The `dist/server.js` file exists
3. The TypeScript compilation didn't have errors

### Port Issues
The server runs on port 3001 by default. Change the `PORT` environment variable if needed.

### API Key Issues
Ensure all required API keys are set in your environment variables.
