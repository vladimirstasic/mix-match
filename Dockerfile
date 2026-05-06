FROM node:22.22.2

# Install system dependencies required by the API
RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3-pip \
    python3 \
    --no-install-recommends && \
    pip3 install yt-dlp --break-system-packages && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy monorepo root manifests
COPY package.json package-lock.json ./

# Copy per-package manifests (preserves workspace structure for npm install)
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

# Install all dependencies, bypassing peer-dep conflicts
RUN npm install --legacy-peer-deps

# Copy the rest of the source code
COPY . .

# Build shared package first (api depends on it), then api
RUN npm run build -w packages/shared && npm run build -w packages/api

# Start the API server
CMD ["node", "packages/api/dist/index.js"]
