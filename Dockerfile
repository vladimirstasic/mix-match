FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3-pip \
    python3 \
    --no-install-recommends && \
    pip3 install yt-dlp --break-system-packages && \
    rm -rf /var/lib/apt/lists/*

COPY package.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

RUN npm install --legacy-peer-deps --prefer-offline=false --no-audit --no-fund --maxsockets=3 2>&1 || true
RUN ls node_modules/.package-lock.json && echo "Install OK"

COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

RUN cd packages/shared && npx tsc && cd ../api && npx tsc

CMD ["sh", "-c", "cd packages/api && npx drizzle-kit migrate && cd /app && node packages/api/dist/index.js"]
