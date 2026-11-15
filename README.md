# Matriz

Aplicação interna de gestão de projetos e tarefas para equipas de trabalho, ao estilo de Jira, Azure DevOps ou Trello.

> **Estado atual:** versão candidata **1.0.0-rc.2** — MVP implementado (Ficha PL 03), com testes unitários, de integração e E2E e revisão de código e de segurança (Ficha PL 04), a consulta do histórico (I13) e a entrega em contentores com integração contínua (Ficha PL 05). Detalhe em [Estado atual](#estado-atual); alterações em [`CHANGELOG.md`](CHANGELOG.md).

**Tecnologias** (`docs/constraints.md` §4.3, DT01–DT15): TypeScript em toda a aplicação — NestJS e TypeORM no backend, React e Vite no frontend —, PostgreSQL 17 ou superior com um schema por módulo, autenticação OpenID Connect (Keycloak local em desenvolvimento). Monólito modular com API REST/JSON descrita em [`openapi.yaml`](openapi.yaml).

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

## Organização do repositório

```
matriz/
├── README.md              visão geral e estado do projeto
├── CHANGELOG.md           alterações por versão (Semantic Versioning)
├── compose.yaml           aplicação completa em contentores (Docker Compose, DT19)
├── AGENTS.md              instruções para coding agents
├── .github/workflows/     ci.yml: análise estática, testes e imagens em cada pull request (DT18, DT19);
│                          release.yml: publica as imagens quando sai uma versão (DT20)
├── eslint.config.mjs      regras da análise estática (npm run lint)
├── openapi.yaml           contrato REST (OpenAPI 3.1) de operações do MVP (Ficha PL 02)
├── package.json           npm workspaces (backend, frontend) e scripts comuns
├── .env.example           variáveis de ambiente; copiar para .env (fora do Git)
├── backend/               API NestJS; Dockerfile da imagem
│   ├── src/modules/       identity, organization, work, planning, tracking, history (DT03)
│   ├── src/shared/        base de dados, autenticação, erros, eventos, interfaces entre módulos
│   ├── migrations/        migrations TypeORM
│   ├── seed/              dados de demonstração fictícios
│   └── test/              testes de integração por CA (Jest + supertest)
├── frontend/              aplicação React (Vite); Dockerfile e docker/ (nginx)
│   ├── src/               páginas, componentes, cliente da API, autenticação
│   └── test/              regras da interface (node:test)
├── e2e/                   testes End-to-End (Playwright)
├── deploy/                proxy de entrada e criação do role da base, usados pelo compose.yaml
├── keycloak/              realm matriz versionado (contas fictícias)
├── scripts/               db-setup.sql (role e bases), keycloak-dev.ps1 e keycloak-ci.mjs (só no CI)
└── docs/
    ├── requirements.md    visão, utilizadores, regras de negócio, RF, RNF, âmbito do MVP
    ├── user-stories.md    user stories, prioridades, critérios de aceitação, casos excecionais
    ├── constraints.md     restrições, pressupostos, segurança e privacidade, decisões
    ├── review.md          revisões críticas: problemas encontrados e decisões tomadas
    ├── architecture.md    arquitetura: estilo, módulos, interação, implantação (Ficha PL 02)
    ├── database.md        modelo de dados e diagrama ER em Mermaid (Ficha PL 02)
    ├── implementation-plan.md  plano de implementação por incrementos (Ficha PL 03)
    ├── verification.md    verificação da entrega: testes, browser, casos do Ex. 8 (Ficha PL 03)
    ├── test-plan.md       plano de testes unitários, de integração e E2E (Ficha PL 04)
    ├── quality-security-review.md  revisão de código e de segurança (Ficha PL 04)
    ├── delivery-report.md validação final e relatório da entrega (Ficha PL 05)
    ├── release-notes-1.0.0-rc.1.md  notas das versões candidatas (e release-notes-1.0.0-rc.2.md)
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

## Execução com Docker Compose

A forma mais curta de pôr a Matriz a correr (DT19). Precisa só do Docker com o Compose (verificado com Docker 29.6 e Compose 5.3) e das portas 5173 e 8080 livres.

```powershell
Copy-Item .env.example .env             # preencher DB_PASSWORD, KEYCLOAK_ADMIN_USER, KEYCLOAK_ADMIN_PASSWORD e MATRIZ_DEMO_PASSWORD
docker compose up --build -d --wait     # constrói as imagens e espera que tudo esteja saudável (cerca de 1 min 30 s)
```

A aplicação fica em <http://localhost:5173>. Entra-se com as contas fictícias da tabela em [Desenvolvimento](#desenvolvimento) (`admin`, `gestor`, `ana`, `rui`, `bruno`) e a palavra-passe `MATRIZ_DEMO_PASSWORD` do `.env`.

| Serviço | O que é | Verificação de saúde |
|---|---|---|
| `db` | PostgreSQL 17, volume `db-data`. No primeiro arranque, `deploy/db-init.sh` cria o role `matriz` sem privilégios de superutilizador e a base `matriz` | `pg_isready` |
| `keycloak` | Keycloak 26.8.1 em modo de desenvolvimento, com o realm versionado (`keycloak/realm-matriz.json`), volume `keycloak-data`; porta 8080 | `/health/ready` |
| `keycloak-setup` | Passo único: define a palavra-passe das contas fictícias (`scripts/keycloak-ci.mjs`) | termina com código 0 |
| `migrate` | Passo único: migrations, com a imagem do backend | termina com código 0 |
| `seed` | Passo único: dados de demonstração fictícios; idempotente, nunca apaga | termina com código 0 |
| `backend-1`, `backend-2` | Duas instâncias da API (DT13) | `GET /api/health` |
| `frontend` | Ficheiros estáticos servidos pelo nginx | `GET /config.js` |
| `proxy` | nginx de entrada: `/api` para as duas instâncias, o resto para o frontend; porta 5173 | `GET /api/health/ready` através do proxy |

```powershell
docker compose ps -a                    # estado dos contentores
docker compose logs --tail=50           # registos
docker compose down                     # parar; os dados ficam nos volumes
docker compose down -v                  # parar e apagar a base e o Keycloak
npm run test:e2e                        # testes End-to-End contra esta aplicação (precisa de npm install)
```

- **Emissor OIDC.** O browser e o backend no contentor têm de chegar ao Keycloak pelo mesmo endereço. O compose usa `http://keycloak.localhost:8080`: os browsers resolvem `*.localhost` para o próprio computador, e na rede do compose o nome é um alias do serviço `keycloak`. Não é preciso mexer no ficheiro `hosts`.
- **Dados persistentes.** A base e o Keycloak vivem em volumes e mantêm-se depois de `docker compose down` e de recriar os contentores. Os dois volumes vivem juntos: as contas da Matriz ficam ligadas à identidade do Keycloak (RN35), por isso apagam-se os dois (`down -v`) ou nenhum.
- **Imagens publicadas.** Para usar as imagens de uma versão em vez de as construir: `MATRIZ_BACKEND_IMAGE` e `MATRIZ_FRONTEND_IMAGE` no `.env` (p. ex. `ghcr.io/zepedrorodrigues/matriz-backend:1.0.0-rc.2`) e `docker compose up -d --wait --no-build`.
- **Não é a configuração de produção.** O Keycloak corre em modo de desenvolvimento, não há TLS e as contas são fictícias. A produção depende do fornecedor (DT06) e da réplica e cópias de segurança (DT13) — ver [Implantação](#implantação).

## Desenvolvimento

Ambiente sem Docker (DT15), para trabalhar no código com recarregamento automático. Nenhuma palavra-passe é guardada no repositório (SEC08): ficam no `.env` local, fora do Git.

**Requisitos** (versões usadas): Node.js ≥ 22 (24.18.0), npm 11; PostgreSQL ≥ 17 (17.11, `winget`); JDK 21 (Temurin 21.0.12) e Keycloak 26.8.1 (zip), ambos fora do repositório.

**Preparação, uma vez:**

```powershell
npm install
# Role matriz e bases matriz e matriz_test; pede a palavra-passe do postgres e define a do role matriz
# (17 é a pasta da versão instalada: com o PostgreSQL 18, PostgreSQL\18\bin)
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
npm run lint                  # análise estática (ESLint com typescript-eslint)
```

Os testes de integração não precisam do Keycloak: assinam os próprios tokens com uma chave gerada no arranque. Os E2E (`e2e/`) entram pelo Keycloak real com as contas fictícias (palavra-passe `MATRIZ_DEMO_PASSWORD` do `.env`), criam dados com nomes únicos e eliminam o que criam; se falharem, a captura de ecrã e o trace ficam em `e2e/test-results/` (fora do Git). O Playwright usa o Chrome instalado (`channel: 'chrome'`): não é preciso `npx playwright install`. Planos e resultados: [`docs/test-plan.md`](docs/test-plan.md), [`docs/verification.md`](docs/verification.md) e [`docs/quality-security-review.md`](docs/quality-security-review.md).

**Integração contínua (DT18, DT19).** O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) corre em cada pull request e em cada push para o `main`, com os mesmos comandos: `npm run lint`, os tipos do backend e do frontend, `npm test` (contra um PostgreSQL 17 criado para o job), `npm run build` e `npm audit --omit=dev --audit-level=high`. Um segundo job, só depois de o primeiro passar, valida o `compose.yaml`, constrói as duas imagens, analisa-as com o Trivy (falha com vulnerabilidades altas ou críticas que tenham correção), arranca a aplicação completa com `docker compose up -d --wait` e corre `npm run test:e2e` contra ela; as palavras-passe são geradas em cada execução e o workflow só tem permissão de leitura do repositório. Resultados: [`docs/verification.md`](docs/verification.md) › Integração contínua e [`docs/delivery-report.md`](docs/delivery-report.md).

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
| `sem-acesso` | — (nunca tem conta) | Token válido sem conta → 403 (CAT02) |

A `sem-acesso` nunca tem conta na Matriz: serve para testar um token válido sem conta (CAT02). A `sem-conta` também não vem no seed: serve para o administrador lhe criar a conta em Administração › Contas e verificar a ligação no primeiro acesso (CA01.13); depois disso, entra normalmente.

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

## Observabilidade

Decisão DT20; corresponde à linha «Observabilidade» de `docs/architecture.md` §7.

**Registos.** O backend escreve uma linha JSON por registo quando `NODE_ENV=production` (as imagens) e texto legível no desenvolvimento; `LOG_FORMAT=json` ou `text` força um dos formatos. Cada pedido fica numa linha com o contexto `Pedido`:

```json
{"level":"log","pid":1,"timestamp":1794744758052,"message":{"requestId":"a26e95158fda07cb1bebbd1c0d62f77f","method":"GET","path":"/api/projects","status":401,"durationMs":1},"context":"Pedido"}
```

- Só estes cinco campos: nunca a query (as pesquisas podem ter nomes, SEC07), o corpo, o token ou dados de utilizadores.
- O `requestId` vai também na resposta (`X-Request-Id`); o proxy do compose gera-o e passa-o ao backend, por isso é o mesmo nos dois lados.
- Os erros do servidor (5xx) têm o nível `error`. As verificações de saúde bem-sucedidas não se registam.
- Ver os registos no compose: `docker compose logs backend-1 backend-2`.

**Verificações de disponibilidade** (sem token; no contrato `openapi.yaml`):

| Pedido | Responde 200 quando | Para quê |
|---|---|---|
| `GET /api/health` | o processo responde e chega à base de dados | `HEALTHCHECK` da imagem e do compose |
| `GET /api/health/live` | o processo responde (não consulta mais nada) | decidir se a instância tem de ser reiniciada |
| `GET /api/health/ready` | a base de dados **e** o fornecedor de identidade respondem | decidir se a instância deve receber pedidos; a resposta diz qual falhou |

O estado do fornecedor de identidade é guardado 30 segundos. Com ele em baixo, o `ready` responde 503 mas a API continua a responder: quem já tem as chaves em cache continua a validar tokens.

## Implantação

Duas imagens de contentor (DT06, `docs/architecture.md` §8, DT16), construídas a partir da raiz do repositório com as versões do `package-lock.json` (`npm ci`):

| Imagem | Build | Configuração no arranque |
|---|---|---|
| `matriz-backend` | `docker build -f backend/Dockerfile -t matriz-backend .` | `PORT`, `APP_TIME_ZONE`, `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `OIDC_ISSUER`, `OIDC_AUDIENCE` |
| `matriz-frontend` | `docker build -f frontend/Dockerfile -t matriz-frontend .` | `OIDC_AUTHORITY`, `OIDC_CLIENT_ID` (escritos em `/config.js`; sem eles o contentor não arranca) |

- O backend corre como utilizador sem privilégios, só com as dependências de produção e sem a CLI do npm (DT19), e tem `HEALTHCHECK` em `GET /api/health` (503 sem base de dados).
- **Migrations:** passo próprio de cada publicação, antes de atualizar as instâncias, com a mesma imagem: `docker run --rm <variáveis DB_*> matriz-backend node ../node_modules/typeorm/cli.js migration:run -d dist/src/shared/database/data-source.js`. Não correm no arranque: as duas instâncias (DT13) correriam em simultâneo.
- O seed de demonstração recusa correr com `NODE_ENV=production` (o da imagem).
- O proxy de entrada (TLS, `/api` para o backend, o resto para o frontend) e a base de dados com réplica e cópias de segurança são do fornecedor escolhido (DT06, DT13).
- **Imagens publicadas (DT20):** ao publicar uma versão no GitHub, o workflow [`.github/workflows/release.yml`](.github/workflows/release.yml) constrói as duas imagens a partir da etiqueta, analisa-as com o Trivy e envia-as para `ghcr.io/zepedrorodrigues/matriz-backend` e `ghcr.io/zepedrorodrigues/matriz-frontend`, com a versão como etiqueta (`latest` só nas versões finais). Usa só o `GITHUB_TOKEN` da execução, com escrita nos pacotes apenas nesse workflow.

**Verificação local:** o `compose.yaml` da raiz constrói estas imagens e arranca-as com o proxy, a base e o Keycloak — ver [Execução com Docker Compose](#execução-com-docker-compose).

## Estado atual

- [x] Ex. 1 — Prompt engineering
- [x] Ex. 2 — Análise de requisitos e âmbito do MVP
- [x] Ex. 3 — User stories e critérios de aceitação
- [x] Ex. 4 — Specification Pack v0.1
- [x] Ex. 5 — `AGENTS.md`
- [x] Ex. 6 — Revisão crítica (human-in-the-loop) — Specification Pack v0.3, ver [`docs/review.md`](docs/review.md)
- [x] Aula 2 (Ficha PL 02) — Architecture Pack: arquitetura, modelo de dados, API e wireframe, com revisão cruzada (human-in-the-loop), ver [`docs/review.md`](docs/review.md) §3
- [x] Aula 3 (Ficha PL 03) — Implementação do MVP: plano em [`docs/implementation-plan.md`](docs/implementation-plan.md), verificação em [`docs/verification.md`](docs/verification.md). O I13 (consulta do histórico), que ficou fora do âmbito da ficha, foi feito depois: histórico de cada elemento na API e no ecrã, com as permissões e os filtros de D50 ([`docs/i13-historico-analise.md`](docs/i13-historico-analise.md)).
- [x] Aula 4 (Ficha PL 04) — Testes unitários, de integração e E2E, Code Review e Security Review: [`docs/test-plan.md`](docs/test-plan.md), [`docs/quality-security-review.md`](docs/quality-security-review.md). Extensão opcional (2026-11-15): os testes e a análise estática correm num workflow de CI (DT18).
- [x] Aula 5 (Ficha PL 05) — Entrega: Docker Compose com a aplicação completa, imagens construídas e analisadas no CI, changelog e versão candidata 1.0.0-rc.1 (DT19): [`docs/delivery-report.md`](docs/delivery-report.md), [`docs/release-notes-1.0.0-rc.1.md`](docs/release-notes-1.0.0-rc.1.md). Desafios opcionais B e C (1.0.0-rc.2, DT20): registos estruturados, verificações `live` e `ready` e publicação das imagens no GitHub Container Registry, feita e verificada com o [pré-lançamento `v1.0.0-rc.2`](https://github.com/zepedrorodrigues/matriz/releases/tag/v1.0.0-rc.2) — [`docs/release-notes-1.0.0-rc.2.md`](docs/release-notes-1.0.0-rc.2.md)

**Em números:** 42 regras de negócio · 36 requisitos funcionais · 13 requisitos não funcionais · 10 user stories · 116 critérios de aceitação (110 nas US e 6 transversais), todos verificáveis · sem decisões funcionais pendentes.

**Pendentes:** P12 (validação jurídica da retenção). Revisões futuras planeadas: DT09–DT12 (alertas, microservices, eventos, erros).
