---
description: How to deploy the application to Netlify as an SPA
---

# Deploying to Netlify

This project is configured to deploy as a Single Page Application (SPA) on Netlify.

## Prerequisites
- Netlify CLI installed (`npm install -g netlify-cli`)
- Authenticated with Netlify (`netlify login`)
- Linked to the Netlify project (`netlify link`)

## Deployment Steps

1. **Build the Application**
   // turbo
   ```bash
   npm run build
   ```

2. **Deploy Preview**
   Run this to get a preview URL before going to production.
   ```bash
   netlify deploy
   ```

3. **Deploy to Production**
   Run this to deploy directly to the production site.
   ```bash
   netlify deploy --prod
   ```

## Configuration Note
The project uses `netlify.toml` for configuration:
- **Build Command**: `vite build`
- **Publish Directory**: `dist/client`
