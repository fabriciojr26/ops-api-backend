
FROM node:18-alpine
WORKDIR /app
COPY package.json package-lock.json* yarn.lock* pnpm-lock.yaml* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev;     elif [ -f yarn.lock ]; then yarn --production;     elif [ -f pnpm-lock.yaml ]; then corepack enable && pnpm i --prod;     else npm i --omit=dev; fi
COPY . .
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
