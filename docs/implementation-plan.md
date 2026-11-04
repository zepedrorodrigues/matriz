# Matriz — Plano de implementação

> **Versão:** 0.1 · **Data:** 2026-10-29 · **Estado:** proposto para validação (Ficha PL 03, Ex. 1)
> **Relacionados:** [`requirements.md`](requirements.md) · [`user-stories.md`](user-stories.md) · [`architecture.md`](architecture.md) · [`database.md`](database.md) · [`../openapi.yaml`](../openapi.yaml) · [`ui/wireframe.md`](ui/wireframe.md)

Sequência de incrementos para implementar o MVP (D41: US01–US10 com as extensões da Ficha PL 03). O estado de cada incremento é atualizado ao longo da implementação (§6).

---

## 1. Forma de trabalho

Cada incremento segue os mesmos passos, com o humano a validar antes de se escrever código (`AGENTS.md` §4):

1. **Análise e plano** do incremento: US, CA e regras abrangidos; ficheiros; riscos.
2. **Contrato:** as operações em falta acrescentam-se ao `openapi.yaml` antes do código.
3. **Implementação** limitada ao incremento: backend, frontend e migrations.
4. **Verificações:** testes automáticos (um por CA, com o ID no nome — DT08) e verificação manual na interface.
5. **Revisão do diff** e commit, com o estado deste plano atualizado.

## 2. Decisões em que assenta

| Tema | Decisão | Registo |
|---|---|---|
| Âmbito | MVP completo, com eliminação lógica, prioridade, participantes, comentários, limites dos campos e paginação. | D41–D47, RN38–RN42 |
| Stack | TypeScript; NestJS e React (Vite); PostgreSQL 17 com um schema por módulo. | DT01–DT03 |
| Bibliotecas | TypeORM, class-validator, class-transformer, jose, Jest, supertest; react-router, TanStack Query, oidc-client-ts, react-oidc-context. | DT14 |
| Autenticação | OIDC com Keycloak local; Authorization Code + PKCE; token *bearer* validado pelo backend. | DT04 |
| Ambiente | Sem Docker: PostgreSQL 17 (winget), JDK 21 e Keycloak em zip. | DT15 |

**Confirmado pelo humano:** quem altera a prioridade (RN39) e que os participantes não ganham permissões sobre a tarefa (RN40).

**Regras do contrato (Ex. 1), confirmadas pelo humano:** a listagem de tarefas de um projeto e as contagens do painel não incluem subtarefas; os limites de RN42 contam-se depois de retirar os espaços no início e no fim; um projeto ou tarefa eliminado (RN38), e o que dele depende, responde 404, como um identificador inexistente.

## 3. Estrutura prevista

```
matriz/
├── package.json             npm workspaces: backend, frontend
├── .env.example             variáveis de ambiente com valores fictícios
├── backend/
│   ├── src/
│   │   ├── modules/         identity, organization, work, planning, tracking, history (DT03)
│   │   ├── shared/          autenticação, autorização, erros RFC 9457, paginação
│   │   └── main.ts
│   ├── migrations/          migrations TypeORM, um schema por módulo
│   ├── seed/                dados de demonstração idempotentes (SEC08)
│   └── test/                testes de API por CA (Jest + supertest)
├── frontend/
│   └── src/
│       ├── api/             cliente da API; endereço do backend centralizado
│       ├── auth/            sessão OIDC
│       ├── components/      componentes e estilos partilhados
│       └── pages/           início de sessão, painel, projetos, detalhes, sprints…
└── keycloak/
    └── realm-matriz.json    realm de desenvolvimento com contas fictícias
```

## 4. Incrementos

O mínimo da Ficha PL 03 fica completo no I8; os incrementos I9–I13 completam o MVP (D41).

| # | Incremento | US / CA | Componentes | Verificação |
|---|---|---|---|---|
| I0 | **Ambiente e esqueleto** (Ex. 2) | — | Workspaces; NestJS com `GET /api/health`; React com Vite e encaminhamento de `/api`; configuração TypeORM; migrations: schemas, `user`, `team`, `team_membership`, `project`, `project_manager`, `project_team`, `history_event` e, como pede o Ex. 2, as tabelas do módulo Trabalho (`objective`, `epic`, `task`, `acceptance_criterion`, `task_participant`, `comment`); seed idempotente com pelo menos dois utilizadores, projetos com acessos distintos e tarefas de demonstração; realm Keycloak com as mesmas contas; comandos no README. | A aplicação arranca; a migration cria o esquema; o seed executado duas vezes não duplica nem apaga dados; `health` responde 200. |
| I1 | **Acesso à aplicação** (Ex. 3) | CAT01, CAT02, CA01.13 (ligação no primeiro acesso) | Validação do token (jose); `GET /me`; ligação da conta pelo e-mail (RN35); avaliação da matriz de permissões (§3.1); início e fim de sessão, redirecionamento e mensagem de sessão expirada na interface. | Testes: sem token → 401; token sem conta → 403; dois utilizadores com acessos diferentes. Manual: credenciais válidas e inválidas no Keycloak. |
| I2 | **Projetos** (Ex. 4) | CA01.2, CA01.6, CA01.8, CA01.14–CA01.17, CAT06 | `/projects` (criar, listar, pesquisar, paginar, consultar, editar, eliminar logicamente); histórico; ecrãs Projetos e Detalhe do projeto, com confirmação antes de eliminar. | Primeiro percurso completo: iniciar sessão, criar um projeto, vê-lo na listagem e consultá-lo depois de recarregar e de reiniciar o backend. Testes de validação, de autorização e de persistência. |
| I3 | **Equipas e associações** | US01: CA01.1, CA01.3–CA01.5, CA01.7, CA01.9–CA01.12; CA01.13 (criação da conta) | Operações de contas (`POST /users`), equipas, pertenças e associação a projetos (acrescentadas ao contrato); ecrãs de administração. A criação de contas saiu do I1 por decisão do humano (2026-11-04): a Ficha PL 03 não a pede no Ex. 3 e admite contas de demonstração criadas pelo seed. | Testes por CA; regras RN33, RN34. |
| I4 | **Hierarquia e tarefas** (Ex. 5) | US02; CA03.1–CA03.3, CA03.7, CA03.11, CA03.12, CA03.17–CA03.19 | Objetivos, épicos, tarefas e subtarefas (tabelas criadas no I0); prioridade; filtros e paginação; eliminação lógica; detalhe da tarefa. | Testes por CA; a tarefa aparece sem recarregar e mantém-se depois de reiniciar o backend. |
| I5 | **Estados, critérios e estimativas** | US06; CA03.4–CA03.6, CA03.8–CA03.10 | Transições de RN26; critérios de aceitação (RN13, RN24, RN27); reabertura; estimativas (RN07, RN10, RN22). | Testes por CA, incluindo transições inválidas (409). |
| I6 | **Responsável e participantes** (Ex. 6) | CA03.13–CA03.16, CA09.1, CA09.6 | Utilizadores elegíveis; responsável pela execução; participantes sem repetições (tabela criada no I0). | Testes: associação repetida → 409; utilizador não elegível → 422. |
| I7 | **Comentários** (Ex. 6) | US10 | Comentários com autor e data/hora do sistema (tabela criada no I0). | Testes por CA; o autor vem do token mesmo que o pedido indique outro. |
| I8 | **Painel inicial** (Ex. 7) | CA07.9 | `GET /dashboard`; ecrã do painel; sincronização de listagens e contagens após cada operação. | Contagens coerentes com os filtros e com o conjunto completo, não só com a página. |
| I9 | **Backlog e sprints** | US04, US08 | Sprints (criar, datas, iniciar, terminar pela tarefa diária com trinco no PostgreSQL); planear, retirar e acrescentar tarefas; tarefas criadas por membros e alerta ao líder (RN09); ecrã do wireframe. | Testes por CA, incluindo o fim automático. |
| I10 | **Capacidade** | US05 | `GET /sprints/{sprintId}/capacity` (já no contrato); ajustes de disponibilidade; sobrecarga e alertas (RN19). | Testes com os totais do wireframe (160 h, 172 h, 34 SP). |
| I11 | **Acompanhamento e alertas** | US07: CA07.1–CA07.8 | Progresso e desvios por sprint; bloqueios; tarefa diária de prazos; alertas na aplicação. | Testes por CA; CAT05. |
| I12 | **Transferências** | US09: CA09.2–CA09.5, CA09.7, CA09.8 | `POST /tasks/{taskId}/transfer` (já no contrato); saída da sprint (RN20). | Testes por CA. |
| I13 | **Histórico** | CAT03, CAT04, CA06.6 | Consulta do histórico de cada elemento; permissões só de inserção e leitura (SEC04). | Testes por CA. |
| I14 | **Verificação e entrega** (Ex. 8, Ex. 9) | Todos | `docs/verification.md` com os 9 cenários da ficha e três exemplos de utilização da IA; revisão do diff; uma refatoração, se trouxer benefício; OpenAPI, AGENTS.md e README atualizados; execução a partir de uma cópia limpa. | Critérios de conclusão da Ficha PL 03. |

A interface de cada funcionalidade é feita no respetivo incremento (Ex. 7), com os estados de carregamento, lista vazia, sucesso e erro, sem submissões repetidas e preservando os dados do formulário quando a submissão falha.

## 5. Preparação do ambiente (pedido de autorização)

**Software a instalar pelo humano** (DT15): PostgreSQL 17 e JDK 21 (Temurin), com o `winget`; Keycloak 26 em zip, numa pasta fora do repositório. As versões exatas ficam registadas no README.

**Dependências npm** (DT14), instaladas pelo agente depois de autorizadas:

| Projeto | Dependências | Desenvolvimento |
|---|---|---|
| `backend/` | `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express`, `@nestjs/typeorm`, `@nestjs/config`, `typeorm`, `pg`, `class-validator`, `class-transformer`, `jose`, `reflect-metadata`, `rxjs` | `@nestjs/cli`, `@nestjs/testing`, `typescript`, `ts-node`, `jest`, `ts-jest`, `@types/jest`, `supertest`, `@types/supertest`, `@types/node` |
| `frontend/` | `react`, `react-dom`, `react-router`, `@tanstack/react-query`, `oidc-client-ts`, `react-oidc-context` | `vite`, `@vitejs/plugin-react`, `typescript`, `@types/react`, `@types/react-dom` |

`@nestjs/config`, `pg`, `reflect-metadata`, `rxjs` e `ts-node` não constam explicitamente da DT14, mas são exigidos pelo NestJS e pelo TypeORM (configuração, driver PostgreSQL e execução das migrations).

**Base de dados de testes:** os testes de API usam uma base de dados própria (`matriz_test`), recriada pelas migrations antes de cada execução, para nunca tocar nos dados de demonstração.

## 6. Estado

| # | Estado | Notas |
|---|---|---|
| I0 | Concluído | **Commits:** `9800716` (esqueleto) e o seguinte (esquema do módulo Trabalho). Esqueleto do backend (`GET /api/health`, acrescentado ao contrato como `getHealth`, sem autenticação), configuração TypeORM partilhada, migrations `InitialSchema` (seis schemas; identidade, organização e histórico) e `WorkSchema` (objetivos, épicos, tarefas e subtarefas, critérios, participantes e comentários, com os `CHECK` de database.md §5), seed idempotente (5 utilizadores, 2 equipas, 2 projetos, 7 tarefas das quais 1 subtarefa, 3 critérios, 1 participante, 2 comentários), testes do `health` e das regras do esquema (8 testes), frontend Vite com encaminhamento de `/api`, `scripts/db-setup.sql`, `.env.example` e comandos no README. **Verificado (2026-11-04):** build do backend e do frontend; migrations, reversão e nova execução na base `matriz`; seed executado duas vezes sem duplicar; 8 testes a passar; `health` 200 direto e através do Vite; Keycloak arrancado com `scripts/keycloak-dev.ps1 -Port 8180` (a 8080 está ocupada noutra aplicação local), realm importado, palavras-passe definidas para as 6 contas e tokens emitidos com a audiência `matriz-api`; palavra-passe errada recusada. **Decidido pelo humano (2026-11-04):** nenhuma palavra-passe nos ficheiros do repositório (SEC08) — o realm não tem credenciais e `scripts/keycloak-dev.ps1` define-as pela API de administração a partir do `.env`; o administrador do realm master é criado no primeiro arranque (`KC_BOOTSTRAP_ADMIN_*`); a porta por omissão do Keycloak mantém-se 8080; as tabelas do módulo Trabalho entram no I0, como pede o Ex. 2 (F11 em review.md §6); o `package-lock.json` não é versionado. **Pressuposto:** e-mail profissional único sem distinguir maiúsculas (índice sobre `lower(work_email)`), coerente com a ligação por e-mail de RN35. TypeScript fixado em 6.0.3 (o 7 não traz a API do compilador usada pelo `ts-node`, `ts-jest` e `@nestjs/cli`). **Decidido pelo humano:** NestJS 11 + TypeORM 0.3, em CommonJS, em vez do NestJS 12 (só ESM); o humano cria o role `matriz` e as bases `matriz` e `matriz_test` e põe a palavra-passe num `.env` local; o agente fica autorizado a correr as migrations e o seed na base `matriz` e os testes que recriam a `matriz_test`. **Versões fixadas** (2026-11-04): `@nestjs/common`, `core`, `platform-express` e `testing` 11.2.8; `@nestjs/cli` 11.0.24; `@nestjs/typeorm` 11.0.3; `@nestjs/config` 4.0.4; `typeorm` 0.3.31. **Decidido pelo humano (2026-11-04):** o `@nestjs/platform-express` 11.2.8 fixa o `multer` 2.4.0, com uma vulnerabilidade alta (DoS, GHSA-q7qp-rjg7-q26m, corrigida no 2.5.0), e não há versão 11 mais recente; corrige-se com `overrides: { multer: 2.5.0 }` no `package.json` da raiz, e o `package-lock.json` foi regenerado para o override ter efeito (atualizações *patch*/*minor* dentro dos intervalos declarados). **Risco aceite:** `npm audit --omit=dev` mantém 3 vulnerabilidades moderadas (`glob` e `minimatch`, via `typeorm` 0.3; GHSA-3g3m-2fjr-6pw4, GHSA-g3hv-75wg-m249), que só recebem os caminhos de entidades e migrations da configuração, nunca dados de utilizadores; a correção exige o TypeORM 1.x. As restantes (4 baixas, 16 moderadas) estão só nas ferramentas de desenvolvimento (Jest, `@nestjs/cli`). |
| I1 | Concluído | **Feito (2026-11-04):** guarda global com validação do token pelo `jose` (assinatura, emissor, audiência `matriz-api`, validade; chaves obtidas pela descoberta OIDC); `@Public()` só no `health`; erros RFC 9457 e validação na fronteira; módulo Identidade (conta, ligação no primeiro acesso por e-mail verificado e depois pelo `sub` — RN35, CA01.13; `GET /me`; avaliação da visibilidade de projetos — §3.1, CAT06) e módulo Organização (interface de leitura); frontend com `react-oidc-context` (encaminhamento para o Keycloak, perfil, fim de sessão, mensagem de sessão inválida, ecrã sem conta); ciclo da sessão no README; 401 com `WWW-Authenticate` no contrato. **Verificado:** 23 testes automáticos a passar (15 do I1: sem token, assinatura, emissor, audiência e validade inválidos → 401; sem conta, conta desativada e e-mail não verificado → 403; ligação no primeiro acesso e acessos seguintes pelo `sub`; conta já ligada a outra identidade → 403; `/me` de dois utilizadores; visibilidade de projetos de líder, gestor, utilizador sem acesso e administrador, e projeto eliminado); contra o Keycloak real e o backend compilado: sem token 401, `ana`, `rui`, `gestor`, `bruno` e `admin` 200 com os papéis do seed, `sem-conta` 403, token da `ana` com o conteúdo alterado 401, palavra-passe errada recusada pelo Keycloak (no formulário e no *direct grant*); palavras-passe guardadas no Keycloak como hash argon2 (API de administração); browser: encaminhamento para o Keycloak com PKCE S256, mensagem «Invalid username or password.», ecrã de sessão expirada e regresso ao início de sessão; nenhum segredo do `.env` no bundle do frontend. browser (Chrome, contas fictícias): início de sessão da `ana` mostra o perfil (Equipa Alfa, Líder, 100%); «Terminar sessão» termina a sessão no Keycloak (o regresso pede de novo as credenciais); a `sem-conta` vê o ecrã sem conta com «Terminar sessão»; depois de terminar as sessões da `ana` no Keycloak (API de administração, 18:19:55), a aplicação mostrava às 18:25:15 a mensagem de sessão inválida e já não guardava a sessão. **Bug encontrado e corrigido (Ex. 8):** após um início de sessão válido aparecia a mensagem de sessão expirada. Evidência: troca do código por token 200 seguida de `GET /api/me` 401 com «Falta o token de acesso.» e registo temporário `token attached: false`. Causa: o token chegava ao cliente da API num efeito do `AuthGate`, e o React executa primeiro os efeitos do filho (`App`), cuja consulta partia sem token. Correção limitada: o cliente lê o token do armazenamento do oidc-client-ts no momento do pedido (`auth/access-token.ts`); a chave foi confirmada no código da biblioteca. Teste de regressão: `frontend/test/access-token.test.ts` (node:test, sem dependências novas); `npm test` corre agora backend e frontend. Repetida a verificação no browser: o primeiro `/api/me` após o regresso do Keycloak responde 200. **Decidido pelo humano (2026-11-04):** a criação de contas (`POST /users`, CA01.13) passa para o I3. **Conhecido:** o `jose` 6 só existe em ESM; nos testes, o ts-jest transpila-o para CommonJS (`tsconfig.spec.json`). O formulário do Keycloak está em inglês. |
| I2–I14 | Por iniciar | |
