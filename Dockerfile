FROM node:22-slim

WORKDIR /app

RUN apt-get update && apt-get install -y \
    ffmpeg \
    python3-pip \
    python3 \
    --no-install-recommends && \
    pip3 install yt-dlp --break-system-packages && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY packages/api/package.json ./packages/api/
COPY packages/shared/package.json ./packages/shared/
COPY packages/web/package.json ./packages/web/

ENV NODE_OPTIONS="--max-old-space-size=4096"
RUN npm install -w packages/shared -w packages/api --legacy-peer-deps --ignore-scripts

COPY packages/shared ./packages/shared
COPY packages/api ./packages/api

RUN cd packages/shared && npx tsc && cd ../api && npx tsc

CMD ["node", "packages/api/dist/index.js"]
