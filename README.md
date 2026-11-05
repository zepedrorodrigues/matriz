# Matriz

Aplicação interna de gestão de projetos e tarefas para equipas de trabalho, ao estilo de Jira, Azure DevOps ou Trello.

> **Estado atual:** Specification Pack v0.5 (Ficha PL 01) e Architecture Pack revisto (Ficha PL 02): arquitetura, modelo de dados, API e wireframe. Tecnologias escolhidas (`docs/constraints.md` §4.3); ainda não há código.

## Problema

O pedido inicial do cliente foi:

> "Precisamos de uma aplicação onde as nossas equipas possam organizar projetos, gerir tarefas e acompanhar o progresso do trabalho."

O cliente não definiu funcionalidades, regras de negócio, requisitos técnicos nem prioridades. A análise de requisitos (Ex. 1–3) transformou este pedido numa especificação verificável, revista criticamente no Ex. 6.

## Objetivos principais

- Organizar o trabalho por **equipas e projetos**, com responsabilidades claras.
- **Decompor o trabalho** em objetivos, épicos, tarefas e subtarefas.
- **Planear em sprints por equipa** com visibilidade sobre a capacidade disponível, medida em horas, e notificação quando esta é excedida; os story points são uma estimativa independente, sem conversão.
- Saber objetivamente **quando uma tarefa está cumprida**, com base em todos os seus critérios de aceitação.
- Dar **visibilidade** sobre progresso, desvios e alertas.
- Garantir **rastreabilidade**: quem executou cada tarefa e a que equipa pertencia, mesmo após transferências.

Detalhe em [`docs/requirements.md`](docs/requirements.md) §1.

## Funcionalidades previstas para o MVP

| ID | Funcionalidade | Prioridade |
|---|---|---|
| US01 | Gerir equipas e projetos | P0 |
| US02 | Gerir a hierarquia de trabalho (Objetivos → Épicos → Tarefas → Subtarefas) | P0 |
| US03 | Criar, estimar e atribuir tarefas | P0 |
| US04 | Gerir backlog e sprints por equipa | P0 |
| US05 | Consultar capacidade e carga de trabalho | P0 |
| US06 | Atualizar o estado e validar a conclusão das tarefas | P0 |
| US07 | Consultar progresso, desvios e alertas (versão básica) | P1 |
| US08 | Propor trabalho no backlog | P1 |
| US09 | Atribuir e transferir tarefas entre equipas, preservando o histórico | P1 |
| US10 | Comentar tarefas | P1 |

O MVP destina-se à utilização interna da empresa. Os critérios de aceitação estão em [`docs/user-stories.md`](docs/user-stories.md).

## Organização da documentação

```
matriz/
├── README.md              visão geral e estado do projeto
├── AGENTS.md              instruções para coding agents
├── openapi.yaml           contrato REST (OpenAPI 3.1) de operações do MVP (Ficha PL 02)
└── docs/
    ├── requirements.md    visão, utilizadores, regras de negócio, RF, RNF, âmbito do MVP
    ├── user-stories.md    user stories, prioridades, critérios de aceitação, casos excecionais
    ├── constraints.md     restrições, pressupostos, segurança e privacidade, decisões
    ├── review.md          revisões críticas: problemas encontrados e decisões tomadas
    ├── architecture.md    arquitetura: estilo, módulos, interação, implantação (Ficha PL 02)
    ├── database.md        modelo de dados e diagrama ER em Mermaid (Ficha PL 02)
    ├── implementation-plan.md  plano de implementação por incrementos (Ficha PL 03)
    └── ui/
        ├── wireframe.svg  wireframe do planeamento da sprint (Ficha PL 02)
        └── wireframe.md   navegação e validação do wireframe face ao MVP
```

### Utilização como contexto

1. Ordem de leitura: `requirements.md` → `user-stories.md` → `constraints.md`. O `review.md` regista a revisão crítica e não é normativo: as decisões nele tomadas estão incorporadas nos restantes documentos.
2. Precedência por estado: **Confirmado** > **Proposto** > **Pressupostos**. Dentro do conteúdo Confirmado: regras de negócio (RN) > requisitos (RF, RNF, SEC) > User Stories e CA. Conteúdo Proposto e Pressupostos só são usados depois de aprovados.
3. Comportamento que dependa de uma decisão pendente (`Dxx`) não é implementado enquanto a decisão não estiver registada.
4. Quando uma decisão é tomada, regista-se no documento respetivo e passa da lista de pendentes para a de resolvidos (`constraints.md` §4.3).

Os coding agents seguem, além disto, as instruções de [`AGENTS.md`](AGENTS.md).

### Identificadores

| Prefixo | Significado | Documento |
|---|---|---|
| OBJ | Objetivo do produto | requirements.md |
| RN | Regra de negócio | requirements.md |
| RF / RNF | Requisito funcional / não funcional | requirements.md |
| US / CA / EC | User story / critério de aceitação / caso excecional | user-stories.md |
| CAT | Critério de aceitação transversal | user-stories.md |
| R / P / L | Restrição / pressuposto / limitação de âmbito | constraints.md |
| SEC | Requisito de segurança e privacidade | constraints.md |
| D / DT | Decisão pendente funcional / técnica | constraints.md |

## Desenvolvimento

Ambiente sem Docker (DT15). Nenhuma palavra-passe é guardada no repositório (SEC08): ficam no `.env` local, fora do Git.

**Requisitos** (versões usadas): Node.js ≥ 22 (24.18.0), npm 11; PostgreSQL 17 (17.11, `winget`); JDK 21 (Temurin 21.0.12) e Keycloak 26.8.1 (zip), ambos fora do repositório.

**Preparação, uma vez:**

```powershell
npm install
# Role matriz e bases matriz e matriz_test; pede a palavra-passe do postgres e define a do role matriz
& 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -h localhost -f scripts\db-setup.sql
Copy-Item .env.example .env   # preencher DB_PASSWORD, as pastas do Keycloak/JDK e as palavras-passe do Keycloak
npm run db:migrate            # schemas e tabelas (backend/migrations)
npm run db:seed               # dados de demonstração fictícios; idempotente
```

**Execução** (um terminal para cada):

```powershell
./scripts/keycloak-dev.ps1    # Keycloak em http://localhost:8080 (realm matriz); define as palavras-passe das contas fictícias
npm run dev:backend           # API em http://localhost:3000/api (GET /api/health)
npm run dev:frontend          # aplicação em http://localhost:5173; /api encaminhado para o backend
```

**Testes:**

```powershell
npm test                      # unitários e de integração: backend e frontend
npm run test:unit             # só unitários, sem base de dados (backend src/**/*.spec.ts e frontend)
npm test -w backend           # integração: API real (Jest + supertest); recria a base matriz_test com as migrations
npm test -w frontend          # regras da interface (node:test), sem browser
npx jest test/tasks.e2e-spec.ts   # um ficheiro, a partir de backend/
npm run test:e2e              # End-to-End (Playwright no Chrome instalado); precisa do Keycloak, da API e do frontend a correr
```

Os testes de integração não precisam do Keycloak: assinam os próprios tokens com uma chave gerada no arranque. Os E2E (`e2e/`) entram pelo Keycloak real com as contas fictícias (palavra-passe `MATRIZ_DEMO_PASSWORD` do `.env`), criam dados com nomes únicos e eliminam o que criam; se falharem, a captura de ecrã e o trace ficam em `e2e/test-results/` (fora do Git). O Playwright usa o Chrome instalado (`channel: 'chrome'`): não é preciso `npx playwright install`. Planos e resultados: [`docs/test-plan.md`](docs/test-plan.md), [`docs/verification.md`](docs/verification.md) e [`docs/quality-security-review.md`](docs/quality-security-review.md).

**Outros comandos:** `npm run build` (backend e frontend), `npm start -w backend` (API compilada, a partir de `backend/dist`), `npm run migration:revert -w backend`.

As contas fictícias do Keycloak (`admin`, `gestor`, `ana`, `rui`, `bruno`, `sem-conta`, `sem-acesso`, com e-mail `@matriz.example`) usam a palavra-passe `MATRIZ_DEMO_PASSWORD` do `.env`.

| Conta (Keycloak) | Na Matriz (seed) | Serve para |
|---|---|---|
| `admin` | Alice Admin — papel de administrador; gere o projeto Arquivo Digital | Administração (contas, equipas); todas as permissões de gestor |
| `gestor` | Gonçalo Gestor — gere o projeto Portal Interno, sem equipa | Gestor de projeto (transferências, atribuição a outras equipas) |
| `ana` | Ana Exemplo — líder da Equipa Alfa (Portal Interno) | Líder: sprints, capacidade, atribuição, alertas |
| `rui` | Rui Exemplo — membro da Equipa Alfa | Membro: tarefas atribuídas, bloqueios, comentários |
| `bruno` | Bruno Beta — líder da Equipa Beta (Arquivo Digital) | Segundo utilizador com acessos distintos (Ex. 8, caso 08) |
| `sem-conta` | — (criada pelo administrador) | Ligação da conta no primeiro acesso (CA01.13) |
| `sem-acesso` | — (nunca tem conta) | Token válido sem conta → 403 (CAT02) | A `sem-acesso` nunca tem conta na Matriz: serve para testar um token válido sem conta (CAT02). A `sem-conta` também não vem no seed: serve para o administrador lhe criar a conta em Administração › Contas e verificar a ligação no primeiro acesso (CA01.13); depois disso, entra normalmente.

Se o Keycloak correr noutra porta (`./scripts/keycloak-dev.ps1 -Port 8180`), `OIDC_ISSUER` e `VITE_OIDC_AUTHORITY` no `.env` têm de usar essa porta.

O ecrã de início de sessão está em português (`defaultLocale: pt` no `keycloak/realm-matriz.json`). O Keycloak só importa o realm quando ele ainda não existe: uma alteração posterior ao `realm-matriz.json` não chega a um Keycloak já configurado e tem de ser aplicada pela consola ou pela API de administração (ou apagando o realm `matriz` e arrancando de novo o script, que volta a definir as palavras-passe).

### Sessão e autenticação (DT04)

1. **Início de sessão.** Sem sessão, a aplicação encaminha para o Keycloak (Authorization Code + PKCE, cliente público `matriz-web`). As palavras-passe só existem no Keycloak, guardadas como hash (argon2); a Matriz nunca as recebe.
2. **Pedidos à API.** A aplicação envia `Authorization: Bearer <token de acesso>`. O backend valida a assinatura (chaves públicas do Keycloak, obtidas pela descoberta OIDC), o emissor (`OIDC_ISSUER`), a audiência (`matriz-api`) e a validade; não há sessão no servidor.
3. **Conta da Matriz.** A identidade vem só do token. No primeiro acesso, a conta criada para o e-mail profissional fica ligada à identidade do Keycloak (`sub`), se o e-mail estiver verificado (RN35); depois, a ligação faz-se pelo `sub`. Sem conta ativa, a API responde 403.
4. **Renovação.** O token de acesso dura 5 minutos e é renovado antes de expirar com o refresh token, enquanto a sessão do Keycloak estiver ativa (30 minutos sem atividade, 10 horas no máximo).
5. **Sessão inválida.** Se a renovação falhar, o token expirar ou a API responder 401, a aplicação termina a sessão local e mostra «A sua sessão expirou ou deixou de ser válida», com o botão para iniciar sessão de novo.
6. **Fim de sessão.** «Terminar sessão» termina a sessão no Keycloak e regressa à aplicação.

Erros da API: *problem details* (RFC 9457, `application/problem+json`); o 401 inclui `WWW-Authenticate: Bearer`.

Pedidos diretos à API em desenvolvimento: o cliente `matriz-dev-cli` do realm aceita utilizador e palavra-passe (*direct grant*) para obter um token, só no Keycloak local.

## Estado atual

- [x] Ex. 1 — Prompt engineering
- [x] Ex. 2 — Análise de requisitos e âmbito do MVP
- [x] Ex. 3 — User stories e critérios de aceitação
- [x] Ex. 4 — Specification Pack v0.1
- [x] Ex. 5 — `AGENTS.md`
- [x] Ex. 6 — Revisão crítica (human-in-the-loop) — Specification Pack v0.3, ver [`docs/review.md`](docs/review.md)
- [x] Aula 2 (Ficha PL 02) — Architecture Pack: arquitetura, modelo de dados, API e wireframe, com revisão cruzada (human-in-the-loop), ver [`docs/review.md`](docs/review.md) §3
- [x] Aula 3 (Ficha PL 03) — Implementação do MVP: plano em [`docs/implementation-plan.md`](docs/implementation-plan.md), verificação em [`docs/verification.md`](docs/verification.md). Fica por fazer o I13 (consulta do histórico), fora do âmbito da ficha.
- [x] Aula 4 (Ficha PL 04) — Testes unitários, de integração e E2E, Code Review e Security Review: [`docs/test-plan.md`](docs/test-plan.md), [`docs/quality-security-review.md`](docs/quality-security-review.md)

**Em números:** 42 regras de negócio · 36 requisitos funcionais · 13 requisitos não funcionais · 10 user stories · 116 critérios de aceitação (110 nas US e 6 transversais), todos verificáveis · sem decisões funcionais pendentes.

**Pendentes:** P12 (validação jurídica da retenção). Revisões futuras planeadas: DT09–DT12 (alertas, microservices, eventos, erros).
