# Imagem do frontend (DT06, architecture.md §8): ficheiros estáticos servidos pelo nginx.
# Build a partir da raiz do repositório:
#   docker build -f frontend/Dockerfile -t matriz-frontend .
# A mesma imagem serve qualquer ambiente: OIDC_AUTHORITY e OIDC_CLIENT_ID são lidos no arranque do
# contentor e escritos em /config.js (docker/40-matriz-config.sh), não fixados no build.

FROM node:24-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
RUN npm ci -w frontend
COPY frontend/ frontend/
RUN npm run build -w frontend

FROM nginx:1.29-alpine
COPY frontend/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chmod=755 frontend/docker/40-matriz-config.sh /docker-entrypoint.d/40-matriz-config.sh
COPY --from=build /app/frontend/dist /usr/share/nginx/html
