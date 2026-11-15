# Relatório da entrega e validação final — Ficha PL 05

Validação da preparação da Matriz para entrega (Ex. 6) e relatório pedido na secção *Entrega* da ficha. Tudo o que aqui se afirma foi medido a 2026-11-15, na máquina de desenvolvimento (Windows 11, Docker 29.6.1, Compose 5.3.0) ou no GitHub Actions; o que não foi verificado está dito como tal.

- **Versão:** `1.0.0-rc.1` · **Etiqueta:** `v1.0.0-rc.1` (`0e3118f`) · **Commit do código:** `e8a1d79` · **Branch:** `feat/entrega-compose-ci-e-versao-candidata` · **Pull request:** #5
- **Estado atual (2026-11-15):** a versão corrente é a `1.0.0-rc.2` (etiqueta `v1.0.0-rc.2`, commit `0a8e70b`; pull requests #7 e #8; DT20), que acrescenta os desafios opcionais B e C a esta entrega e está publicada como [pré-lançamento](https://github.com/zepedrorodrigues/matriz/releases/tag/v1.0.0-rc.2), com as duas imagens no GitHub Container Registry. Os exercícios 1 a 6 e os três desafios opcionais estão cumpridos (§1). As medições das secções 2 e 3 são as da `1.0.0-rc.1`; as da `1.0.0-rc.2` estão em `verification.md` › Observabilidade e publicação das imagens e › Publicação das imagens.
- **Decisão:** DT19 (`constraints.md` §4.3) · **Notas da versão:** [`release-notes-1.0.0-rc.1.md`](release-notes-1.0.0-rc.1.md) · **Changelog:** [`../CHANGELOG.md`](../CHANGELOG.md)

## 1. Requisitos da ficha

| Exercício | Requisito | Estado | Evidência |
|---|---|---|---|
| Ex. 1 | Análise e plano antes de alterar ficheiros | Cumprido | Plano apresentado e aprovado pelo responsável antes da primeira alteração (§5) |
| Ex. 2 | Dockerfiles, `.dockerignore`, imagens a construir e a arrancar; sem credenciais | Cumprido | `backend/Dockerfile`, `frontend/Dockerfile`, `.dockerignore`; `docker compose build` sem erros; nenhum `.env` nas imagens; nenhuma palavra-passe no histórico das camadas |
| Ex. 3 | `compose.yaml` com os serviços, rede, volumes, `.env.example`, healthchecks | Cumprido | `compose.yaml`; `docker compose config -q` sem erros; 6 serviços saudáveis e 3 passos únicos terminados com código 0 |
| Ex. 3 | Aplicação acessível, componentes a comunicar, funcionalidades operacionais | Cumprido | `GET /` 200, `GET /api/health` `{"status":"ok","database":"ok"}`; `E2E-01` e `SEC-01` a passar contra o compose |
| Ex. 3 | Dados mantêm-se depois de recriar os contentores | Cumprido | `docker compose down` e `up`: 8 tarefas e 2 eventos antes e depois; o seed, na segunda execução, acrescenta 0 linhas; o início de sessão continua a funcionar |
| Ex. 3 | Logs sem erros críticos | Cumprido | 0 linhas de erro ou aviso no backend, no frontend e no proxy; no Keycloak, só avisos de funcionalidades obsoletas do modo de desenvolvimento |
| Ex. 4 | `ci.yml` em push e pull request, dependências, testes, build, imagens | Cumprido | `.github/workflows/ci.yml`; execução `43710210612` a passar no commit `e8a1d79` |
| Ex. 4 | Falha quando um teste falha; imagens só depois das verificações | Cumprido | Execução `43709975844` (§2) |
| Ex. 4 | Permissões mínimas; sem segredos | Cumprido | `permissions: contents: read`; palavras-passe geradas em cada execução e mascaradas; nenhum segredo configurado no repositório |
| Ex. 5 | README, arquitetura com Mermaid, compose documentado, OpenAPI, changelog, notas | Cumprido | `README.md`, `architecture.md` §8 (três diagramas Mermaid no documento), `openapi.yaml` (OpenAPI 3.1, 58 operações), `CHANGELOG.md`, notas da versão |
| Ex. 6 | Validação final e este relatório | Cumprido | Este documento |
| Desafio A | Análise de dependências e de imagens na pipeline | Cumprido | `npm audit` e Trivy 0.76.2 no CI |
| Desafio B | Logs estruturados e verificações adicionais de disponibilidade | Cumprido (1.0.0-rc.2, DT20) | Registos em JSON, uma linha por pedido, `GET /api/health/live` e `GET /api/health/ready`; `verification.md` › Observabilidade e publicação das imagens; CI `43713471476` a passar (277 + 47 testes, 2 E2E) |
| Desafio C | Publicação automática de uma imagem no GitHub Container Registry, com uma release de teste | Cumprido (1.0.0-rc.2, DT20) | `.github/workflows/release.yml`; a publicação da `v1.0.0-rc.2` correu-o (execução `43742137288`, a passar) e enviou `ghcr.io/zepedrorodrigues/matriz-backend:1.0.0-rc.2` e `matriz-frontend:1.0.0-rc.2`; as duas descarregam-se sem credenciais e o compose arranca a partir delas; `verification.md` › Publicação das imagens |

## 2. Resultados dos testes e da pipeline

**Na máquina local**

| Verificação | Resultado |
|---|---|
| `docker compose config -q` | sem erros |
| `docker compose build` | `matriz-backend` (487 MB) e `matriz-frontend` (94,9 MB) construídas |
| `docker compose up -d --wait`, com os volumes vazios | saudável em 1 min 25 s; `backend-1`, `backend-2`, `db`, `frontend`, `keycloak` e `proxy` *healthy*; `migrate`, `seed` e `keycloak-setup` terminados com código 0 |
| Role da base | `matriz` não é superutilizador; `DELETE` e `TRUNCATE` sobre `history.history_event` como `matriz`: «permission denied» (SEC04) |
| `npm run test:e2e` contra o compose | 2 a passar, em três execuções (antes e depois de recriar os contentores e com as imagens corrigidas) |
| Persistência | 8 tarefas e 2 eventos antes e depois de `docker compose down` e `up` |
| Trivy 0.76.2, `--severity HIGH,CRITICAL --ignore-unfixed` | antes: backend 6, frontend 58 (1 crítica); depois das correções: 0 e 0 |
| `npm run lint`, tipos, `npm test` | sem erros; 255 testes do backend e 47 do frontend a passar (medidos na mesma data, antes desta branch; repetidos no CI em cada execução) |

**No GitHub Actions**

| Execução | Commit | Resultado |
|---|---|---|
| `43709645093` | `5246760` | Os dois jobs a passar à primeira: «Análise estática e testes» (1 min 1 s) e «Imagens Docker e testes End-to-End» (1 min 58 s): compose válido, imagens construídas, Trivy sem achados, 6 serviços saudáveis, 2 testes E2E a passar |
| `43709975844` | `09df3f0` | **Falha controlada:** limite do título alterado de 150 para 151. «Análise estática e testes» falhou a nomear os dois testes da CA03.18 (253 de 255); «Imagens Docker e testes End-to-End» ficou *skipped* — nenhuma imagem construída |
| `43710210612` | `e8a1d79` | Limite reposto (`backend/src` igual ao do `main`) e versão 1.0.0-rc.1: os dois jobs a passar |

## 3. Problemas encontrados e soluções

| Problema | Classificação | Solução |
|---|---|---|
| O compose anterior dependia de um Keycloak instalado no computador e de `host.docker.internal` no ficheiro `hosts`; o início de sessão pelo proxy só funcionava com uma regra especial no browser (`verification.md` › Pendentes da verificação) | Limitação do ambiente | Keycloak como serviço do compose, com o emissor `http://keycloak.localhost:8080`: os browsers resolvem `*.localhost` para o próprio computador e, na rede do compose, o nome é um alias do serviço. Funcionou à primeira, sem mexer no `hosts` |
| No compose anterior, o role `matriz` era o superutilizador do contentor, a quem o `REVOKE` sobre o histórico não se aplica (o mesmo que fez falhar 3 testes na primeira execução do CI da Ficha 04) | Defeito de configuração | `deploy/db-init.sh` cria o role sem privilégios, como o `scripts/db-setup.sql`; verificado com `DELETE` e `TRUNCATE` recusados |
| O seed recusa correr com `NODE_ENV=production`, o valor da imagem | Comportamento intencional | O serviço `seed` define `NODE_ENV=development`; sem ele, uma instalação nova não teria nenhuma conta com que entrar |
| O realm versionado não fixa os identificadores das contas: um Keycloak recriado com a base mantida deixaria as contas da Matriz ligadas a identidades que já não existem (RN35) | Risco de desenho; o cenário de falha não foi executado | Volume próprio para o Keycloak, documentado como inseparável do da base (`down -v` apaga os dois) |
| Trivy: 58 vulnerabilidades (1 crítica) na imagem do frontend, todas nos pacotes do Alpine do `nginx:1.29-alpine`, sem atualizações desde abril de 2026 | Confirmado (análise) | `nginx:1.30-alpine` com `apk upgrade --no-cache`: 0. Decisão do responsável |
| Trivy: 6 vulnerabilidades altas na imagem do backend, todas na CLI do npm que vem no `node:24-slim` (`undici`, `brace-expansion`), nenhuma nas dependências da Matriz | Confirmado (análise) | A CLI do npm sai da imagem final: 0. As migrations passam a chamar a CLI do TypeORM pelo `node`. Decisão do responsável |
| Um comentário dentro de um `RUN` com continuação de linha deu erro de sintaxe no `backend/Dockerfile`; como o `up` não reconstrói, a aplicação voltou a arrancar com as imagens antigas e pareceu estar bem | Erro do agente de IA | Comentário movido para antes do `RUN`; confirmado dentro do contentor que o npm já não existe e que o nginx é o 1.30.6 |
| O `nginx:1.30-alpine` usado tal e qual pelo serviço `proxy` tem 3 vulnerabilidades altas com correção, todas no `libxslt` | Por resolver | A imagem do proxy não é construída pelo projeto; em produção o proxy é do fornecedor (DT06). Fica como limitação (§5) |

## 4. Utilização dos agentes de IA

- **Agente:** Claude Code (Anthropic), com acesso ao repositório, ao Docker local e à CLI do GitHub.
- **O que fez:** a análise do estado do projeto e o plano (Ex. 1); o `compose.yaml`, o `deploy/db-init.sh`, as alterações aos Dockerfiles e ao workflow; a execução de todas as verificações deste relatório; a documentação, o changelog e as notas da versão.
- **O que o humano decidiu:** aprovou o plano antes de qualquer alteração; decidiu incluir o Keycloak no compose, pôr o compose na raiz, a versão `1.0.0-rc.1` e a análise de imagens com o Trivy; perante os resultados do Trivy, decidiu corrigir as duas imagens. Os merges são do humano; a etiqueta e a publicação da versão no GitHub foram feitas pelo agente, cada uma com autorização explícita.
- **Como se validou:** nenhum resultado é afirmado sem execução. As correções mediram-se antes e depois (Trivy 58 → 0 e 6 → 0); a pipeline viu-se falhar com um defeito introduzido de propósito e passar depois de reposto; a persistência verificou-se a recriar os contentores.
- **Onde a IA errou:** o erro de sintaxe no Dockerfile acima, apanhado pela verificação dentro do contentor; e uma primeira verificação do SEC04 com uma coluna errada, repetida com `DELETE` e `TRUNCATE`.

## 5. Limitações e pendentes

- **O compose não é a configuração de produção:** Keycloak em modo de desenvolvimento, sem TLS, contas fictícias. A implantação real depende do fornecedor (DT06) e da réplica e cópias de segurança (DT13).
- **Não verificado:** a aplicação do compose noutro sistema operativo que não o Windows com Docker Desktop e o `ubuntu-latest` do CI; a resolução de `keycloak.localhost` em browsers que não o Chrome; o cenário de apagar só um dos dois volumes; o `openapi.yaml` com uma ferramenta de *lint*.
- **Imagem do proxy:** 3 vulnerabilidades altas com correção (`libxslt`) no `nginx:1.30-alpine` original (o frontend, construído pelo projeto, tem 0).
- **Etiqueta Git `v1.0.0-rc.1`:** criada a 2026-11-15 no commit `0e3118f` do `main` (merge do pull request #5), depois de o CI passar nesse commit (execução `43711179061`), e publicada no GitHub como [pré-lançamento](https://github.com/zepedrorodrigues/matriz/releases/tag/v1.0.0-rc.1). Já não está pendente.
- **Herdados das fichas anteriores:** P12; DT09–DT12; os achados pendentes S4, S6, S7 e CR8–CR10; 3 vulnerabilidades moderadas através do `typeorm` 0.3.
- **Desafios opcionais B e C:** feitos depois desta entrega, na versão `1.0.0-rc.2` (DT20; [`release-notes-1.0.0-rc.2.md`](release-notes-1.0.0-rc.2.md)). A publicação das imagens (C) ficou verificada com a `v1.0.0-rc.2` (`verification.md` › Publicação das imagens). Continuam por fazer as métricas de tempo de resposta e a medição da disponibilidade (RNF08, RNF09).

## 6. Credenciais nos ficheiros versionados

- `git ls-files` por `.env`, chaves e certificados: só o `.env.example`, com valores fictícios («substituir»).
- `git grep` por atribuições de palavras-passe, tokens e chaves, por chaves privadas e por JWT: sem resultados.
- O workflow tem uma palavra-passe fixa (`so-para-o-ci`) para a base de testes do primeiro job, que só existe durante o job e não é acessível de fora; as do segundo job são geradas em cada execução.
- O `.env` está no `.gitignore` e no `.dockerignore`; nenhuma das duas imagens contém ficheiros `.env`.
