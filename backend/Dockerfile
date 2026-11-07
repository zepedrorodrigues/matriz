# Imagem do backend (DT06, architecture.md §8). Build a partir da raiz do repositório:
#   docker build -f backend/Dockerfile -t matriz-backend .
# Sem .env na imagem: as variáveis (DB_*, OIDC_*, PORT, APP_TIME_ZONE) vêm do ambiente do contentor.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w backend
COPY backend/ backend/
RUN npm run build -w backend

FROM node:24-slim
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w backend --omit=dev && npm cache clean --force
COPY --from=build /app/backend/dist backend/dist
WORKDIR /app/backend
USER node
EXPOSE 3000
# Verificação de saúde (DT13): GET /api/health devolve 503 se a base de dados não responder.
HEALTHCHECK --interval=10s --timeout=3s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"]
# As migrations não correm no arranque (duas instâncias correriam em simultâneo): são um passo
# próprio da publicação, com o mesmo contentor: npm run migration:run:dist
CMD ["node", "dist/src/main.js"]
