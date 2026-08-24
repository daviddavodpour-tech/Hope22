FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src ./src
COPY openapi ./openapi
RUN addgroup -S hope && adduser -S -G hope hope \
    && mkdir -p /app/data /app/storage \
    && chown -R hope:hope /app
USER hope
EXPOSE 3000
CMD ["node", "src/server.js"]
