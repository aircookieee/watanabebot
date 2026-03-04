FROM node:22-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY resources ./resources
COPY discordAniListMap.json ./

USER node

CMD ["node", "dist/index.js"]
