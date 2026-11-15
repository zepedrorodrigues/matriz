# Matriz 1.0.0-rc.2 — notas da versão candidata

- **Data:** 2026-11-15
- **Versão:** `1.0.0-rc.2` (Semantic Versioning: segunda versão candidata à 1.0.0)
- **Etiqueta Git:** `v1.0.0-rc.2`, no commit `0a8e70b` do `main` (merge do pull request #7). CI no commit etiquetado: execução `43741271761`, os dois jobs a passar.
- **Publicação no GitHub:** [v1.0.0-rc.2](https://github.com/zepedrorodrigues/matriz/releases/tag/v1.0.0-rc.2), marcada como pré-lançamento. Desencadeou o workflow `release.yml` (execução `43742137288`, a passar), que enviou as duas imagens para o registo.
- **Estado:** candidata.
- **Versão anterior:** [`1.0.0-rc.1`](release-notes-1.0.0-rc.1.md)

## O que muda

A funcionalidade da aplicação é a mesma da `1.0.0-rc.1`. Esta versão acrescenta o que faltava para operar e distribuir a Matriz (decisão DT20).

- **Registos estruturados.** Em produção, o backend escreve uma linha JSON por registo. Cada pedido fica numa linha com o identificador, o método, o caminho, o código de resposta e a duração — e nada mais: nem a query, nem o corpo, nem o token, nem dados de utilizadores.
- **Identificador do pedido.** Vai na resposta, em `X-Request-Id`, e é o mesmo nos registos do backend; o proxy do compose gera-o.
- **Verificações de disponibilidade.** `GET /api/health/live` (o processo responde) e `GET /api/health/ready` (a base de dados e o fornecedor de identidade respondem; a resposta diz qual falhou). O `GET /api/health` mantém-se.
- **Imagens publicadas.** Quando uma versão é publicada no GitHub, as duas imagens são construídas, analisadas com o Trivy e enviadas para o GitHub Container Registry:
  - `ghcr.io/zepedrorodrigues/matriz-backend:1.0.0-rc.2` (`sha256:cb2aadef7bc47b724a923a6d4d00687a9c769183a69dd21edeac8bf09de4763b`)
  - `ghcr.io/zepedrorodrigues/matriz-frontend:1.0.0-rc.2` (`sha256:500ad86a53d703f840822704db39eea8f5939f0940f9a8e7c8534bf4683a7aa1`)

  Descarregam-se sem credenciais. Por ser uma versão candidata, a etiqueta `latest` não foi publicada.

## Como executar

Como na versão anterior: `docker compose up --build -d --wait` (ver o [`README.md`](../README.md)). Para usar as imagens publicadas em vez de as construir, definir `MATRIZ_BACKEND_IMAGE` e `MATRIZ_FRONTEND_IMAGE` no `.env` e arrancar com `docker compose up -d --wait --no-build`.

## O que muda para quem já usava a 1.0.0-rc.1

| Antes | Agora |
|---|---|
| Registos do backend em texto | Em JSON nas imagens (`NODE_ENV=production`). `LOG_FORMAT=text` repõe o texto |
| O proxy do compose verificava `GET /api/health` | Verifica `GET /api/health/ready`: fica *unhealthy* também quando o Keycloak não responde |
| Contrato com 58 operações | 60: `getLiveness` e `getReadiness` |

Não há migrations novas nem alterações às respostas existentes da API.

## Verificação

Medições em [`verification.md`](verification.md) › Observabilidade e publicação das imagens. Resumo: 277 testes do backend e 47 do frontend a passar; 7 reversões apanhadas pelos testes; com a base de dados parada o `ready` responde 503 e o `live` 200; com o Keycloak parado o `ready` responde 503 e a API continua a responder.

## Limitações conhecidas

- As da [`1.0.0-rc.1`](release-notes-1.0.0-rc.1.md) mantêm-se: o compose não é a configuração de produção; P12; DT09–DT12; os achados pendentes S4, S6, S7 e CR8–CR10; as 3 vulnerabilidades moderadas através do `typeorm` 0.3; o contrato da API tem a sua própria versão (`0.3.0`) e não foi validado com uma ferramenta de *lint*.
- **Observabilidade incompleta:** não há métricas de tempo de resposta nem medição da disponibilidade (RNF08, RNF09); os registos não são enviados para nenhum sistema de recolha.
- **Registos do frontend e do proxy:** são os do nginx, em texto; só o backend escreve JSON.
- **Imagens:** publicadas só para a arquitetura do executor do GitHub (`linux/amd64`); sem assinatura nem atestado de proveniência.
