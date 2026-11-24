FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci || npm install

COPY . .
RUN npm run build

FROM node:22-alpine

WORKDIR /app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/public ./public

ENV NODE_ENV=production
ENV PORT=4004
ENV HOST=0.0.0.0
ENV DATA_DIR=/data

EXPOSE 4004
CMD ["node", "server/index.js"]
