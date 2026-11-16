# Verificação do MVP — Ficha PL 03 (Ex. 8 e Ex. 9)

Registo das verificações da versão entregue: comandos executados, testes automáticos, os nove cenários do Ex. 8 (resultado esperado, observado e evidência), os problemas encontrados, a revisão assistida por IA, a refatoração e as limitações. O plano e o histórico de cada incremento estão em [`implementation-plan.md`](implementation-plan.md) §6; as decisões do humano, em [`review.md`](review.md).

- **Versão verificada:** commit `7196a2a` (código) e o commit que acrescenta este documento; verificação manual com o backend compilado dessa versão.
- **Data:** 2026-11-05
- **Ambiente:** Windows 11, Node.js 24.18.0, PostgreSQL 17.11, Keycloak 26.8.1 (JDK 21), Chrome; sem Docker (DT15).

As verificações são de dois tipos, sempre identificados: **automáticas** (testes que qualquer pessoa repete com `npm test`) e **manuais** (no browser, com as contas fictícias do seed, ou com pedidos diretos à API).

## 1. Comandos executados

| Comando | Para | Resultado |
|---|---|---|
| `npx tsc --noEmit -p tsconfig.json` (em `backend/` e `frontend/`) | Verificar os tipos | Sem erros |
| `npm test -w backend` | Testes de API (Jest + supertest; recriam a base `matriz_test` pelas migrations) | 201 testes a passar (17 ficheiros) |
| `npm test -w frontend` | Regras da interface (`node:test`) | 29 testes a passar |
| `npm run build` | Compilar o backend e o frontend | Sem erros |
| `curl -i http://localhost:3000/api/projects` | Pedido sem autenticação | `401`, `WWW-Authenticate: Bearer`, `application/problem+json` «Falta o token de acesso.» |
| `curl -i -H "Authorization: Bearer abc.def.ghi" http://localhost:3000/api/me` | Token mal formado | `401` |
| `git clone` + passos do README numa pasta temporária | Executar a partir de uma cópia limpa (Ex. 9.6) | Instalação, compilação e testes sem erros; API arranca (§8) |

## 2. Testes automáticos

**Backend** (`backend/test/*.e2e-spec.ts`, Jest + supertest contra PostgreSQL real; os tokens são assinados pelos próprios testes com uma chave gerada no arranque, por isso o Keycloak não é necessário). Cada teste tem no nome o critério de aceitação que verifica (p. ex. `CA03.18`).

| Ficheiro | Testes | O que cobre |
|---|---:|---|
| `auth.e2e-spec.ts` | 15 | Token em falta, mal formado, de outro emissor ou audiência, expirado (401); conta inexistente ou desativada (403); ligação da conta no primeiro acesso; `/me` |
| `projects.e2e-spec.ts` | 19 | Criar, listar, pesquisar, paginar, editar e eliminar projetos, com permissões e validação |
| `project-teams.e2e-spec.ts` | 5 | Associar equipas a projetos |
| `tasks.e2e-spec.ts` | 29 | Objetivos, épicos, tarefas e subtarefas; validação; filtros; estados; eliminação |
| `criteria-estimates.e2e-spec.ts` | 19 | Critérios de aceitação e estimativas |
| `assignment-participants.e2e-spec.ts` | 16 | Responsável pela execução e participantes (sem duplicados) |
| `comments.e2e-spec.ts` | 7 | Comentários: autor e data do servidor, validação, permissões |
| `dashboard.e2e-spec.ts` | 5 | Painel inicial e contagens por estado |
| `accounts.e2e-spec.ts`, `teams.e2e-spec.ts` | 6 + 11 | Contas, equipas e pertenças |
| `sprints.e2e-spec.ts`, `capacity.e2e-spec.ts` | 16 + 7 | Backlog, sprints e capacidade |
| `tracking.e2e-spec.ts`, `alerts.e2e-spec.ts` | 8 + 7 | Prazos, bloqueios, acompanhamento e alertas |
| `transfers.e2e-spec.ts` | 9 | Transferências entre equipas |
| `review-fixes.e2e-spec.ts` | 7 | Regressões das correções da revisão (§5) |
| `work-schema.e2e-spec.ts`, `health.e2e-spec.ts` | 7 + 1 | Restrições da base de dados; `/health` |

**Frontend** (`frontend/test/*.test.ts`, `node:test`, 29 testes): validação dos formulários (títulos e nomes só com espaços, limites, datas), estados permitidos por papel, capacidade, alertas, transferências e a regressão do bug do token (§4).

**Os três testes pedidos no Ex. 8:**

| Tipo | Teste | Ficheiro |
|---|---|---|
| Regra de validação | `CA03.18, Ex. 8 (caso 04) — título vazio, só com espaços, curto ou longo e descrição longa → 400 e nada é criado` | `backend/test/tasks.e2e-spec.ts` |
| Autorização | `Ex. 8 (caso 08) — mudar o identificador no pedido não dá acesso a projetos de outros` (e o equivalente para tarefas) | `backend/test/projects.e2e-spec.ts`, `tasks.e2e-spec.ts` |
| Criação com consulta posterior | `CA03.1, CA02.3, CA03.11 — o líder cria uma tarefa: «Em planeamento», prioridade «Média», criador do token; persiste e consta da listagem` | `backend/test/tasks.e2e-spec.ts` |

**Testes de mutação (manuais, sem ferramenta nova).** Para confirmar que os testes apanham as regras, cada regra importante foi desativada temporariamente no código (p. ex. `if (regra)` → `if (false)`) e a suite correu de novo: o teste respetivo tem de falhar. O ficheiro foi depois reposto e comparado byte a byte com a cópia. Feito em todos os incrementos (registado em `implementation-plan.md` §6); no I11, I12 e nas correções da revisão, 31 mutações, todas apanhadas.

## 3. Cenários do Ex. 8

Contas usadas na verificação manual final (fictícias, do seed — ver `README.md`): `rui` (membro da Equipa Alfa) e `ana` (líder da Equipa Alfa); os recursos «de outros» são os do projeto Arquivo Digital, da Equipa Beta.

| Caso | Resultado esperado | Resultado observado | Evidência |
|---|---|---|---|
| 01 Acesso à aplicação | Credenciais válidas entram; inválidas são recusadas com mensagem; pedidos sem autenticação → 401 | Ana e Rui entram com as credenciais certas e veem o seu perfil, equipa e projetos. Com a palavra-passe errada, o Keycloak mostra «Nome de utilizador ou palavra-passe inválida» e não entra. Sem token ou com token mal formado, a API responde 401. | Automática: `auth.e2e-spec.ts` (CAT01, CAT02, 15 testes). Manual: início de sessão de `rui` com a palavra-passe errada e depois a certa, e de `ana`; `curl` sem token → 401 (§1) |
| 02 Gestão de projetos | Criar, pesquisar, editar e eliminar conforme as permissões | Como `rui` (membro): sem «Novo projeto», sem «Editar» nem «Eliminar»; com o token real, criar, editar e eliminar projetos → 403. Como `ana` (líder): nome só com espaços recusado junto do campo, com o objetivo mantido; projeto criado (Ana como gestora, a partir do token), editado, encontrado pela pesquisa «VERIFICA» (sem distinguir maiúsculas) e eliminado com confirmação; sai da listagem e do painel inicial. | Automática: `projects.e2e-spec.ts` (CA01.2, CA01.6, CA01.8, CA01.14–CA01.17, CAT06). Manual: percurso acima; na base, o projeto eliminado mantém a linha (`deleted_at` preenchido, RN38) |
| 03 Persistência de tarefas | A tarefa aparece sem recarregar e mantém-se depois de reiniciar o backend | A tarefa criada aparece na lista sem recarregar («1 tarefa»). Depois de parar e arrancar de novo o backend e recarregar a página, continua lá. O comentário do Rui (caso 07) também se manteve. | Automática: `tasks.e2e-spec.ts` (CA03.1 — cria e consulta). Manual: backend parado (`Stop-Process`) e arrancado de novo; `GET /api/health` ok; página recarregada |
| 04 Validação de dados | Vazios, só espaços e valores inválidos recusados, com a mensagem junto do campo | Título da tarefa só com espaços → «O título tem de ter entre 3 e 150 caracteres, sem contar os espaços no início e no fim.»; nome do projeto só com espaços → mensagem equivalente; comentário vazio → «O comentário tem de ter entre 1 e 2000 caracteres…». Nada é enviado e os outros campos mantêm-se. | Automática: `tasks.e2e-spec.ts` (CA03.18), `projects.e2e-spec.ts` (CA01.17), `comments.e2e-spec.ts` (CA10.3), `work-schema.e2e-spec.ts` (RN41, RN42), `frontend/test/tasks.test.ts`. Manual: os três formulários |
| 05 Estado e prioridade | A edição atualiza a tarefa, os filtros e as contagens | Prioridade alterada para «Alta» e estado para «Em análise técnica»: o detalhe atualiza-se; com os filtros «Em análise técnica» + «Alta» a lista mostra a tarefa, com «Baixa» mostra «Nenhuma tarefa corresponde aos filtros»; no painel inicial, o projeto passa a ter 1 em «Em análise técnica». | Automática: `tasks.e2e-spec.ts` (CA03.12, CA03.19, RN26), `dashboard.e2e-spec.ts` (Ex. 7 — contagens). Manual: percurso acima |
| 06 Responsáveis | Associar e remover; a mesma associação não fica duplicada | Rui e Ana associados como participantes; depois de associado, o Rui deixa de ser oferecido; repetir a associação pela API → 409 «Este utilizador já é participante da tarefa.» e a lista continua com dois; remover o Rui → sai da lista e volta a ser oferecido. | Automática: `assignment-participants.e2e-spec.ts` (CA03.13, CA03.14 → 409, CA03.16). Manual: percurso acima, com o pedido repetido feito com o token real da Ana |
| 07 Comentários | Conteúdo, autor autenticado e data guardados e visíveis | Comentário vazio recusado; comentário publicado aparece com «Rui Exemplo · 05/11/2026, 21:38» (autor do token e data do servidor) e mantém-se depois de reiniciar o backend. | Automática: `comments.e2e-spec.ts` (CA10.1, CA10.5 — autor e data indicados no pedido são ignorados). Manual: tarefa 302, como `rui`; na base, o comentário com a data 05/11 21:38 |
| 08 Autorização na API | Outro utilizador não acede nem altera recursos sem permissão, mesmo mudando os identificadores | Como `rui`, com o seu token real, mudando os identificadores nos pedidos: projeto e tarefa da Equipa Beta → 403 (consultar, alterar, eliminar, comentar, criar tarefas); editar e eliminar o projeto que vê → 403; criar projeto → 403; a pesquisa «arquivo» não devolve o projeto de outra equipa. Na base, nada foi criado nem alterado. | Automática: `projects.e2e-spec.ts` e `tasks.e2e-spec.ts` (Ex. 8, caso 08), testes `§3.1` de cada ficheiro, `review-fixes.e2e-spec.ts` (correções 1 e 2). Manual: 12 pedidos com `fetch` a partir da sessão do Rui; consulta à base |
| 09 Eliminação e erros | A eliminação respeita as dependências; um erro da API não mostra sucesso nem perde os dados do formulário | Mudar o estado para «Pronto a desenvolver» sem critério → a mensagem da API («…precisa de pelo menos um critério de aceitação»), sem mensagem de sucesso e com o estado e a escolha mantidos. Editar uma subtarefa que outra pessoa eliminou entretanto → «A tarefa não existe.», o formulário continua aberto com o texto escrito. Eliminar a tarefa principal com confirmação → «Tarefa eliminada.», a lista fica vazia e a subtarefa responde 404; eliminar o projeto com confirmação → sai da listagem e do painel. | Automática: `tasks.e2e-spec.ts` (CA03.17 — subtarefas eliminadas com a tarefa; RN38), `projects.e2e-spec.ts` (CA01.15). Manual: percurso acima; na base, as três tarefas e o projeto mantêm as linhas com `deleted_at` e há eventos `deleted` no histórico |

## 4. Problemas encontrados e corrigidos

Cada problema foi reproduzido, investigado e corrigido de forma limitada; a coluna «Regressão» indica o teste que o apanha se voltar.

| Onde | Problema | Causa | Correção | Regressão |
|---|---|---|---|---|
| I1 (Ex. 8, caso 01) | Depois de um início de sessão válido aparecia «A sua sessão expirou» | O token chegava ao cliente da API num efeito do React; o efeito do filho corria primeiro e o `GET /me` saía sem token (evidência: `/me` 401 «Falta o token de acesso.») | O cliente lê o token do armazenamento do `oidc-client-ts` no momento do pedido | `frontend/test/access-token.test.ts` |
| I4 (caso 09) | No Detalhe da tarefa, a mensagem de sucesso de uma operação anterior ficava ao lado do erro 409 de outra | Cada painel guardava a sua mensagem sem saber das outras | Cada operação apaga, ao começar, as mensagens e os erros das outras | Manual (não há testes de componentes React: não se acrescentaram dependências) |
| I3 (caso 09) | O mesmo padrão nos ecrãs Equipa e Detalhe do projeto | Idem | Componente partilhado `PageFeedback` | Manual |
| I11 | Uma falha da suite completa que não se reproduzia | O teste da tarefa diária do I9 esperava que nenhuma outra sprint terminasse, mas a base de testes é partilhada entre ficheiros: o resultado dependia da ordem | O teste verifica só a sua sprint | O próprio teste (`sprints.e2e-spec.ts`) |
| I14 (revisão) | Ver §5 | | | `review-fixes.e2e-spec.ts` |
| Vários | Problemas visuais: rótulos colados ao texto, alinhamento dos campos com erro, datas AAAA-MM-DD, «a equipa Equipa Beta» | | Corrigidos durante a verificação no browser de cada incremento | Manual |

## 5. Revisão assistida por IA e refatoração (Ex. 9.1, Ex. 9.2)

**Revisão.** O diff de toda a implementação (`d68debf..HEAD`, desde o primeiro commit de código da ficha) foi revisto com a skill `code-review` do Claude Code (nível *medium*), com foco em permissões, validação, tratamento de erros e alterações fora do âmbito. Dez achados; os mais graves foram confirmados no código e na especificação antes de qualquer alteração. Quatro dependiam de decisões do humano (F23); os restantes eram correções pequenas. Todas com teste de regressão em `review-fixes.e2e-spec.ts`, confirmado por mutação: desfeita cada correção, o teste respetivo falha (9 mutações, 9 apanhadas). Commit `0609658`.

| # | Achado | Decisão / correção |
|---|---|---|
| 1 | O responsável de outra equipa (RN03) não conseguia trabalhar na tarefa atribuída (403), e o frontend mostrava-lhe os botões | 1a: tem nessa tarefa os direitos do membro; não vê o resto do projeto |
| 2 | O gestor de um projeto via no planeamento de uma equipa partilhada as tarefas de projetos que não gere (CAT06) | 2a: só as tarefas dos projetos que vê |
| 3 | Na transferência, os participantes ficavam sem registo | 3a: mantêm-se e ficam no histórico (`participantIds`) |
| 4 | Os alertas faziam leituras com uma segunda ligação dentro da transação (risco de esgotar o pool) | 4a: leem na transação do evento; o mesmo padrão noutros serviços fica como limitação (§7) |
| 5 | Planear uma tarefa ao mesmo tempo que é transferida podia deixá-la na sprint da equipa antiga | A tarefa fica bloqueada na transação do planeamento |
| 6 | Atribuir ao mesmo tempo que a tarefa é transferida podia criar uma atribuição a outra equipa sem justificação | Elegibilidade verificada de novo sob o bloqueio (409) |
| 7 | Criar ou eliminar uma subtarefa não voltava a verificar a sobrecarga da sprint da principal (RN22) | Verificação acrescentada |
| 8 | O alerta «tarefa criada por um membro» saía quando o autor era também gestor | Só quando age como membro (§3.1) |
| 9 | Depois de transferir, o backlog e a sprint das duas equipas não se atualizavam até recarregar | Invalidação das consultas respetivas (verificação manual) |
| 10 | Uma consulta por subtarefa na transferência, com as linhas bloqueadas | Uma só consulta |

**Refatoração.** A definição de «tarefa concluída» (RN26: «Terminada» ou «Entregue») estava repetida em três constantes (`DONE_STATES`, `FINISHED_STATES`, `COMPLETED`) e em quatro literais SQL. Passou a existir uma só vez, na interface partilhada `WorkItemLocator`, ao lado de `TASK_STATES`, com a forma para SQL construída a partir dela. Benefício: uma alteração à RN26 faz-se num só sítio. Comportamento preservado: sem alteração de lógica; 201 testes de backend a passar antes e depois. Commit separado `7196a2a`.

## 6. Utilização da IA (Ex. 9.5)

Todo o código e a documentação foram produzidos com o Claude Code (coding agent), segundo o `AGENTS.md`: plano antes de cada incremento, aprovação do humano, verificação e registo. Três exemplos:

1. **Lacunas da especificação antes de implementar (I11, I12).**
   - *Pedido:* plano do incremento de alertas e do de transferências.
   - *O que a IA fez:* identificou o que a especificação não decidia (quem define o prazo, se o alerta de prazo se repete, o que acontece ao responsável e às subtarefas concluídas numa transferência) e propôs opções com uma recomendação.
   - *Decisão do programador:* escolheu as opções (F21, F22) e só depois aprovou o plano.
   - *Verificação:* testes por critério e decisão (p. ex. `RN15, decisão 1a`), testes de mutação e verificação no browser.
2. **Sugestão rejeitada e substituída (I9, F19).**
   - *Pedido:* o fim automático das sprints pela tarefa diária precisa de um autor no histórico (RN32), mas não há pessoa associada.
   - *O que a IA propôs:* autor nulo, a significar «sistema».
   - *Decisão do programador:* rejeitou e escolheu um identificador fixo «Sistema» (`00000000-0000-0000-0000-000000000000`), mantendo `author_id NOT NULL`.
   - *Verificação:* teste do fim da sprint com `author_id = SYSTEM_AUTHOR_ID`.
3. **Investigação de um bug (I11).**
   - *Problema:* uma falha da suite completa, vista uma vez, que não se reproduzia.
   - *O que a IA fez:* ao repetir-se no I11, distinguiu a hipótese (dependência da ordem dos ficheiros, que partilham a base de testes) da conclusão (o teste do I9 esperava que nenhuma outra sprint terminasse, mas a tarefa diária é global) e propôs uma correção limitada ao teste.
   - *Decisão do programador:* aceitou a correção, registada no plano.
   - *Verificação:* a suite completa passou em várias execuções seguidas.

Na revisão do Ex. 9.1 (§5), o mesmo padrão: a IA encontrou e confirmou os problemas, o humano escolheu as opções das decisões 1 a 4 e a IA aplicou-as, com testes de regressão.

## 7. Limitações e o que não foi executado

- **Consulta do histórico (I13: CAT03, CAT04, CA06.6, e a consulta do CA09.2).** Ficou para depois da ficha (decisão do humano, F23). Foi feita a 2026-11-08: ver «Consulta do histórico» no fim deste documento.
- **Ligações à base dentro das transações.** Fora do caminho dos alertas (corrigido), alguns serviços ainda fazem leituras de outro módulo com uma segunda ligação enquanto a transação está aberta. Com muitos pedidos de escrita em simultâneo (cerca do tamanho do pool, 10), os pedidos podem ficar à espera até expirar o tempo. **Corrigido a 2026-11-11:** ver «Pendentes da verificação» no fim deste documento.
- **Sem testes automáticos de componentes React.** Para não acrescentar dependências, a interface é verificada com testes das regras (`node:test`) e manualmente no browser; as mensagens e os estados de carregamento, vazio e erro foram verificados manualmente em cada incremento.
- **Falha não reproduzida.** Numa execução da suite completa durante o I14 falhou todo o ficheiro `projects.e2e-spec.ts`; não se reproduziu em cinco execuções seguidas (quatro no repositório e uma na cópia limpa) e a mensagem de erro não ficou guardada. A hipótese mais provável é outra dependência da ordem dos ficheiros na base partilhada, mas não está confirmada.
- **Não executado:** testes de carga e de alta disponibilidade (DT13); a aplicação em telemóvel (DT05: computador no MVP; as larguras de 390 px foram verificadas em vários incrementos); outros browsers além do Chrome.

## 8. Execução a partir de uma cópia limpa (Ex. 9.6)

Decisão do humano (F23, 3a): cópia limpa do repositório e os passos do README, sem criar outra base de dados (criar uma base exige a palavra-passe do `postgres`, que é do humano).

1. `git clone` do repositório para uma pasta temporária (commit `7196a2a`); o `.env` local copiado para a cópia (o `.env` não está no Git, SEC08; na primeira instalação cria-se a partir do `.env.example`, que a cópia inclui).
2. `npm install` → sem erros. Aviso do npm 11: `@parcel/watcher` tem um script de instalação ainda não aprovado (`allowScripts`); não impede a compilação nem os testes.
3. `npm run build` → backend e frontend compilados.
4. `npm test` → 201 testes de backend (recriam a base `matriz_test` pelas migrations) e 29 de frontend a passar.
5. API da cópia arrancada noutra porta (`PORT=3101 node backend/dist/src/main.js`) contra a base `matriz` → `GET /api/health` `{"status":"ok","database":"ok"}`.

**Não executado na cópia:** `npm run db:migrate` e `npm run db:seed` numa base nova (ficaram executados na base `matriz` ao longo dos incrementos; o seed é idempotente). **Observação:** o `package-lock.json` não era então versionado (decisão do humano), por isso a cópia resolveu as versões das dependências no momento da instalação, dentro dos intervalos do `package.json`. Passou a ser versionado em 2026-11-07 (DT16).

## Implantação (2026-11-07, DT06, DT13, DT16)

Ambiente: Docker 29.6.1 (Docker Desktop), `deploy/compose.yaml` com PostgreSQL 17 próprio (base nova), duas instâncias do backend, frontend e proxy nginx em `localhost:5173`; Keycloak 26.8.1 local na porta 8180.

| Verificação | Resultado |
|---|---|
| Build das duas imagens com `npm ci` | Ambas construídas; backend sem `jest`, `@nestjs/cli`, `vite` nem `react` (ficam `typescript` e `ts-node`, dependências *peer*); `multer` 2.5.0 (o *override* aplica-se); processo como `node` (uid 1000) |
| `migration:run:dist` numa base nova | 6 migrations executadas; segunda execução: «No migrations are pending» |
| Seed (`node dist/seed/seed.js`) | Recusado com `NODE_ENV=production`; com `NODE_ENV=development`, na base de verificação: dados criados e, na segunda execução, 0 inseridos |
| `GET /api/health` pelo proxy | 200 `{"status":"ok","database":"ok"}`; com a base parada, 503 `unavailable` |
| Rota da aplicação (`/projetos/x`) | 200 com o `index.html` e `<script src="/config.js">` |
| `/config.js` | Valores do ambiente do contentor, `Cache-Control: no-store` |
| Frontend sem `OIDC_AUTHORITY` | Contentor termina com código 2 e a mensagem «Falta OIDC_AUTHORITY»; o bundle não contém nenhum emissor fixado |
| `GET /api/me` sem token / com token adulterado | 401 / 401 |
| Token do Keycloak (`matriz-dev-cli`) para `ana` | 200 com a conta da Ana Exemplo (descoberta OIDC feita de dentro do contentor) |
| Token válido de `sem-acesso` (CAT02) | 403 «Não existe uma conta ativa na Matriz para este utilizador.» |
| `backend-1` parado / `backend-2` parado | 20/20 pedidos 200 em cada caso (DT13) |
| Fins de linha (`.gitattributes`) | Checkout limpo com `core.autocrlf=true`: `40-matriz-config.sh` em LF e a imagem construída dessa cópia escreve o `/config.js`. Reversão: o mesmo script em CRLF termina com «not found», código 127 |
| `npm run test:unit` e tipos (`tsc --noEmit`) | 20 testes do backend e 29 do frontend a passar; tipos sem erros |
| `npm test` (PostgreSQL 18 local, DT15) | 227 testes do backend e 29 do frontend a passar. Antes, o PostgreSQL 18 desta máquina ainda não tinha o role `matriz` (o `.env` vinha de outro sistema): criado com `scripts/db-setup.sql`; `npm run db:migrate` executou as 6 migrations na base `matriz` e o seed, executado duas vezes, acrescentou dados na primeira e 0 linhas na segunda |

**Não verificado:**

- **Início de sessão no browser através do proxy.** *Verificado a 2026-11-11 (ver «Pendentes da verificação»).* O emissor tem de ser o mesmo para o browser e para o backend no contentor (`host.docker.internal`). Nesta máquina, o ficheiro `hosts` aponta `host.docker.internal` para `192.168.1.230`, um endereço antigo (o atual é `192.168.1.176`), e o Keycloak só escuta em `127.0.0.1`. Dentro dos contentores o nome funciona, porque o Docker Desktop o encaminha para o computador.
- O primeiro teste da falha de `backend-2` deu 6/20, porque a instância `backend-1` tinha acabado de ser reiniciada e ainda não estava pronta; repetido à espera do estado `healthy`, deu 20/20.

## Reformulação visual (2026-11-07, DT17)

Branch `feat/reformulacao-visual`. Chrome, sessões da Ana Exemplo (líder) e da Alice Admin (administradora); Keycloak, API e frontend locais.

| Verificação | Resultado |
|---|---|
| Tipos, `npm test -w frontend`, build | Sem erros; 40 testes (8 das regras do quadro, 3 do papel no cabeçalho); nenhum ficheiro acima de 500 kB (entrada da aplicação 27,6 kB) |
| E2E (SEC-01, E2E-01) | 2 a passar, no fim de cada fase. Na fase 3 o SEC-01 falhou: a mensagem acordada do 403 tinha sido reformulada; reposta palavra por palavra |
| Regras do quadro, por mutação | Aceitar qualquer coluna faz falhar exatamente os 3 testes de RN26 |
| Quadro (Ana) | Arrasto recusado com o motivo («Já está concluída.»); arrasto que planeia e atualiza a capacidade; menu «Mover para…» com os destinos de RN26; «Devolver ao backlog» |
| Administradora | «Administração» no menu; capacidade só com os totais (SEC07); sem coluna de backlog (não é líder) |
| Diálogo da tarefa | Abre sobre o quadro com endereço próprio; Escape na confirmação de «Eliminar» cancela só a confirmação; o fundo da confirmação cobre a janela (958×854) |
| Largura da página | Sem deslocamento horizontal (antes da correção, 1345 px numa janela de 958) |
| Datas | Calendário em português, semana a começar à segunda |
| Todos os ecrãs sem o `styles.css` | Início, Projetos, detalhe do projeto, Alertas, Contas, Equipas, detalhe da equipa, Sprint, Planeamento e detalhe da tarefa vistos no browser; corrigidos os controlos nativos sem borda (pesquisa) e os distintivos esticados |

**Incidente:** num teste do menu por teclado, a tarefa «Implementar a pesquisa de ferramentas» passou de «A desenvolver» para «Em planeamento» na base `matriz` local (tecla a menos). Foi reposta em três passos (RN26) e devolvida ao backlog; as mudanças de estado ficaram registadas.

**Não verificado:** a vista do membro; a submissão de cada painel do detalhe (bloquear, critérios, participantes, transferir, comentar) no browser — a lógica não mudou, só a apresentação.

## Correções da auditoria (2026-11-07)

Branch `fix/concorrencia-alertas-equipas`, sobre a `feat/reformulacao-visual`. PostgreSQL local (base `matriz_test` para os testes; `matriz` só em leitura no browser), Keycloak na porta 8180, API e frontend locais.

| Verificação | Resultado |
|---|---|
| Tipos (`tsc --noEmit`, backend e frontend) | Sem erros |
| `npm test` | 230 testes do backend e 40 do frontend a passar (3 testes novos) |
| Reversão da correção 1 (alerta de sobrecarga) | O teste novo falha: 2 alertas `team_overload` para a mesma sprint, esperado 1 |
| Reversão da correção 2 (desativação da equipa) | O teste novo falha: a desativação responde 200, esperado 409 — a equipa fica desativada com uma tarefa aberta |
| Correção 4 (backlog na base de dados) | Sem reversão que falhe: o resultado não muda, só onde se calcula. O teste novo fixa o total e as páginas de 2 sem a sprint ativa nem os projetos eliminados. O ganho de desempenho não foi medido |
| Browser (Chrome pelo Playwright, só leitura), sessões da Ana Exemplo e da Alice Admin | Planeamento, quadro da sprint, Alertas, Projetos, detalhe do projeto, detalhe da tarefa e Contas: todos os pedidos `GET /api` com 200. O quadro pede `/backlog` e mostra 4 das 5 tarefas devolvidas (a quinta está planeada nesta sprint); a tarefa «Terminada» continua no backlog. Única mensagem de erro na consola: `favicon.ico` 404 no servidor do Vite, anterior a estas correções |
| Vista de trabalho da equipa (`/teams/{id}/work`) na base de dados | Teste novo (ordem bloqueadas → atrasadas → recentes ao longo de três páginas de 2, grupos `planned` e `overdue`, projeto eliminado fora das contagens) a passar no código antigo e no novo: o resultado é o mesmo. `npm test`: 231 do backend e 40 do frontend. O ganho de desempenho não foi medido |
| Revisão da vista de trabalho (branch `fix/revisao-trabalho-equipa`) | A página escolhe-se antes das somas das subtarefas (`row_number()` numa subconsulta com o `LIMIT`; as somas só para as tarefas da página); `forTeam` faz as consultas independentes em paralelo (3 idas à base em vez de 5); `teamTaskCounts` e `countTeamTasks` respondem 0 sem consultar quando não há projetos; a regra de atraso (RF28) passa a estar só em `overdueSql`, na porta, usada também pelo detalhe da tarefa e pelos alertas de prazo; o teste de ordenação fixa o `created_at`. `npm test`: 231 do backend. O ganho de desempenho não foi medido (sem `EXPLAIN`) |
| Reversões da vista de trabalho e do backlog | Ordem `recent` em vez de `attention`: 2 testes da vista de trabalho falham. Sem o filtro das atrasadas: falham o da vista paginada e o de RF28. Sem o filtro dos projetos: falham o da vista paginada e o do backlog paginado (projetos eliminados contados). Somas das subtarefas sem a ligação à tarefa: falham 8 testes (comparação da sprint, backlog, início e fim de sprint) |
| Cabeçalho `frame-ancestors` (correção 5) | `nginx -t` aceita a configuração; servida num nginx 1.29, `/`, uma rota da aplicação, `/config.js` e `/assets/*` respondem com `Content-Security-Policy: frame-ancestors 'none'` e mantêm o `Cache-Control` de antes |

**Não verificado:** a paginação no browser com mais de uma página — os dados de demonstração têm menos de 20 elementos em cada lista, e o `Pager` não se mostra com uma só página (a regra é a mesma de antes; o `Pagination` removido só a reencaminhava); o cabeçalho através das imagens construídas pelo `deploy/compose.yaml`.

## Consulta do histórico (2026-11-08, I13)

Branch `feat/consulta-historico`. Plano e decisões em [`i13-historico-analise.md`](i13-historico-analise.md) §10; passo a passo em [`implementation-plan.md`](implementation-plan.md) §6. PostgreSQL local (`matriz_test` para os testes; `migration:run` na `matriz`, autorizada), Keycloak na porta 8180, API e frontend locais.

| Verificação | Resultado |
|---|---|
| Tipos (`tsc --noEmit`, backend e frontend) | Sem erros |
| `npm test` | 252 testes do backend (21 em `history.e2e-spec.ts`) e 47 do frontend (7 em `history.test.ts`) a passar |
| SEC04 na base de dados (`HistoryAppendOnly`) | `UPDATE`, `DELETE` e `TRUNCATE` sobre `history.history_event` recusados com `permission denied`; `INSERT` e `SELECT` continuam. Sem a migration, os três testes CAT04 falham. Num contentor `postgres` com `POSTGRES_USER: matriz` (como no `deploy/compose.yaml`) o `matriz` é superutilizador e o `REVOKE` não tem efeito (database.md §5) |
| Leitura (passo 3) | 7 reversões (sem critérios, sem fim de sprint, sem reduzir a lista devolvida ao backlog, ordem inversa, `taskId` e `returnedToBacklog` renomeados): cada uma faz falhar 1 a 4 testes |
| Permissões e filtros (passo 4) | 8 reversões (sem o 403 ao responsável de outra equipa, sem SEC07, membro sem as suas horas, sem CAT06, CAT06 só no `taskId`, administrador sem eliminados, eliminados para todos, projeto sem `viewHistory`): cada uma faz falhar o teste da regra |
| Critérios de aceitação (passo 5) | 7 reversões, cada uma apanhada pelo critério certo; a «reabertura que apaga o histórico» é recusada pelo `REVOKE` (500). A transferência foi reforçada com uma segunda passagem (B → C, original A), porque com uma só a equipa anterior e a original eram iguais |
| Interface (passo 6) | 5 reversões em `domain/history.ts`, cada uma apanhada; um tipo de evento desconhecido mostra «Alteração registada (tipo).» |
| Browser (Chrome pelo Playwright, só pedidos GET) | Gestor: tarefa com 14 eventos, projeto e épico vazios. Ana (líder): sprint e separador «Histórico» do planeamento. Rui (membro): sprint; a tarefa eliminada dá só «não existe», sem pedir o histórico. Alice Admin: equipa na administração e tarefa eliminada com o aviso «Eliminado» e os 2 eventos. Todos os pedidos `/history` com 200. A captura mostrou «foi eliminado(a)» no aviso, corrigido para a concordância certa |

**Não verificado:** SEC07 e CAT06 no browser (a `matriz` não tem eventos de capacidade nem de tarefas de outros projetos; estão cobertos pelos testes da API); um projeto eliminado no browser (não há nenhum na `matriz`); o desempenho dos índices com volume real; `npm run test:e2e` (não autorizado). A vista «Eliminado» pede duas vezes a primeira página do histórico.

## Pendentes da verificação (2026-11-11)

`main` em `5f2d7a9`. Chrome pelo Playwright (testes temporários, apagados no fim): a vista do membro e os 390 px só com pedidos GET, na sessão do Rui Exemplo (membro da Equipa Alfa); os painéis e a transferência com escritas autorizadas pelo humano; Keycloak na porta 8180, API e frontend locais, base `matriz`.

| Verificação | Resultado |
|---|---|
| Vista do membro (pendente da reformulação visual) | Início, Projetos, Planeamento, Alertas e quadro da sprint «07/11/2026 a 20/11/2026»: todos os `GET /api` com 2xx, nenhum pedido de escrita. Quadro sem a coluna do backlog (não é líder). Diálogo da tarefa 302: «Editar», «Mudar estado», «Nova subtarefa», «Publicar comentário», «Assinalar bloqueio»; sem «Transferir» nem «Eliminar» (§3.1) |
| Largura de 390 px (pendente do I11) | As mesmas cinco páginas e o diálogo: `scrollWidth − innerWidth` = 0 em todas; o quadro desloca-se dentro da sua área |
| Painéis do detalhe (pendente da reformulação visual; escritas na `matriz` autorizadas pelo humano) | Numa tarefa criada para isto pela Ana (líder) no Portal Interno: assinalar o bloqueio com motivo (visível depois de recarregar) e retirá-lo; acrescentar um critério e marcá-lo como cumprido («registado por Ana Exemplo»); associar o Rui como participante; publicar um comentário. Cada passo com a mensagem de sucesso e o pedido com 200/201. No fim, o gestor eliminou a tarefa pela interface (eliminação lógica; os eventos ficam no histórico, SEC04). As execuções interrompidas deixaram mais três tarefas iguais, também eliminadas pelo gestor |
| Transferência | O Portal Interno só tinha a Equipa Alfa («O projeto não tem outra equipa ativa»). **Com autorização do humano**, o gestor associou a Equipa Beta ao Portal Interno pela interface (201; não há como desassociar, por isso fica nos dados de demonstração da `matriz`). Numa tarefa criada pela Ana, o gestor transferiu para a Beta: a confirmação lista as duas consequências (equipa original registada; sai da sprint em aberto), `POST /transfer` 200, e depois de recarregar o detalhe mostra «Equipa: Equipa Beta» e «Equipa original: Equipa Alfa». A Ana (líder da origem) passa a ver só «Publicar comentário»; o Bruno (líder da Beta) tem os controlos de líder (editar, eliminar, estado, critérios, bloqueio, responsável, participantes). As duas tarefas de verificação foram eliminadas pelo gestor |
| Ligações do pool (§7, «ligações à base dentro das transações») | 4 leituras com uma segunda ligação do pool dentro da transação: papel na equipa em `setAvailability` e em `add` dos participantes, estado da equipa na criação da sprint, nomes dos membros no cálculo da capacidade (pelo alerta de sobrecarga). Passaram a usar a ligação da transação. Teste novo `pool-connections.e2e-spec.ts` (conta as ligações pedidas enquanto há uma transação aberta): antes da correção falham os 3 casos (2, 1 e 1 ligações a mais, esperado 0), depois passam. Medição única com o mesmo detector em toda a suite (255 testes): não restam leituras destas dentro da transação do próprio pedido |
| Tipos e `npm test` | Sem erros; 255 testes do backend e 47 do frontend a passar |
| Achado, corrigido | O botão de fechar dos diálogos e dos painéis laterais anunciava «Close» aos leitores de ecrã (`components/ui/dialog.tsx`, `sheet.tsx`); passou a «Fechar» |
| Início de sessão através do proxy (pendente da Implantação) | `deploy/compose.yaml` com imagens construídas a partir deste código, base própria nova com o seed (`NODE_ENV=development`), Keycloak local na porta 8180. O `/config.js` serve `oidcAuthority: "http://host.docker.internal:8180/realms/matriz"`. A Ana entrou pelo Keycloak em `host.docker.internal:8180` e voltou a `localhost:5173`; `/api/me`, `/api/dashboard`, `/api/alerts` e `/api/projects` com 200 pelo proxy: o emissor é o mesmo para o browser e para o backend no contentor. O compose foi parado e o volume removido no fim |

A causa registada na Implantação mudou: o `hosts` aponta `host.docker.internal` para `192.168.1.230`, que voltou a ser o IP desta máquina; o que impede o browser de chegar ao Keycloak é ele escutar só em `127.0.0.1`. Para não o expor na rede local, o Chrome do teste resolveu `host.docker.internal` para o loopback (`--host-resolver-rules`). Num browser sem essa regra, o início de sessão pelo proxy continua a exigir o Keycloak a escutar no IP da rede.

**Não verificado:** o fim automático de uma sprint real no browser (exigia mexer nas datas de uma sprint na `matriz`; coberto pelos testes da API).

## Integração contínua (2026-11-15, DT18)

Branch `chore/ci-testes-e-analise-estatica`, pull request #3. Workflow `.github/workflows/ci.yml` no GitHub Actions (`ubuntu-latest`, Node 24, PostgreSQL 17 e Keycloak 26.8.1 em contentores do job).

| Verificação | Resultado |
|---|---|
| Passos do workflow na máquina local, antes do primeiro push | `npm run lint` sem erros; tipos sem erros no backend e no frontend; 255 testes do backend (22 ficheiros) e 47 do frontend a passar; `npm run build` concluído, com os chunks `react` e `vendor`; `npm audit --omit=dev --audit-level=high` com código 0 (3 moderadas, do `typeorm`) |
| Primeira execução (`43706187429`, commit `c33d075`) | **Falhou:** 3 de 255 testes, os «CAT04» do histórico. Causa: no workflow o role `matriz` era superutilizador (limitação do ambiente, não defeito). Corrigido no workflow em `d6ad296` |
| Segunda execução (`43706370309`, commit `d6ad296`) | Os dois jobs a passar. «Análise estática e testes»: 255 e 47 testes, 2 min 8 s. «Testes End-to-End»: `SEC-01` e `E2E-01` a passar (16,1 s de testes), 1 min 25 s no total |
| Reversão (`43706694497`, commit `b7a52fa`): limite do título 150 → 151 | **Falhou, como esperado,** em «Testes unitários e de integração»: `work.dto.spec.ts` «151 caracteres (acima do máximo)» e `tasks.e2e-spec.ts` «CA03.18, Ex. 8 (caso 04)»; 253 de 255. O job dos E2E não correu |
| Depois de repor o limite (`43706904915`, commit `01a007f`) | Os dois jobs a passar; `backend/src` igual ao do `main` |
| Pacotes acrescentados | 76 entradas novas no `package-lock.json` (ESLint e dependências); nenhuma das existentes mudou de versão |

**Não verificado:** os testes E2E não foram repetidos na máquina local (escreveriam na base `matriz`); o resultado de 2026-11-15 é o do CI, numa base criada para a execução. O workflow no `main` (o gatilho `push`) só corre depois do merge. O comportamento do workflow com um pull request vindo de um fork não foi testado.

## Entrega em contentores (2026-11-15, DT19, Ficha PL 05)

Branch `feat/entrega-compose-ci-e-versao-candidata`, pull request #5, versão `1.0.0-rc.1`. O relatório completo, com os requisitos da ficha, os problemas e as limitações, está em [`delivery-report.md`](delivery-report.md); aqui fica o resumo das medições.

| Verificação | Resultado |
|---|---|
| `docker compose config -q` e `docker compose build` | Sem erros; `matriz-backend` 487 MB, `matriz-frontend` 94,9 MB |
| `docker compose up -d --wait`, volumes vazios | Saudável em 1 min 25 s: 6 serviços *healthy*, `migrate`, `seed` e `keycloak-setup` com código 0 |
| Início de sessão com o Keycloak do compose | `E2E-01` e `SEC-01` a passar contra `http://localhost:5173`, com o emissor `http://keycloak.localhost:8080`; sem alterações ao ficheiro `hosts` (fecha a limitação registada em «Pendentes da verificação») |
| Role da base no compose | `matriz` sem privilégios de superutilizador; `DELETE` e `TRUNCATE` sobre `history.history_event` recusados com «permission denied» (SEC04, CAT04) |
| Persistência | `docker compose down` e `up`: 8 tarefas e 2 eventos antes e depois; o seed acrescenta 0 linhas na segunda execução; o início de sessão continua a funcionar |
| Logs | 0 linhas de erro ou aviso no backend, no frontend e no proxy; no Keycloak, só avisos de funcionalidades obsoletas |
| Trivy 0.76.2 (`HIGH,CRITICAL`, com correção) | Backend 6 → 0 (CLI do npm retirada da imagem final); frontend 58 → 0 (`nginx:1.30-alpine` com `apk upgrade`) |
| Imagens corrigidas em execução | No contentor do backend não existe `npm` e o processo corre como `node`; o frontend responde com o nginx 1.30.6; migrations pela CLI do TypeORM: «No migrations are pending» |
| CI, execução `43709645093` (commit `5246760`) | Os dois jobs a passar à primeira |
| CI, falha controlada, execução `43709975844` (commit `09df3f0`) | Limite do título 150 → 151: «Análise estática e testes» falha a nomear os dois testes da CA03.18 (253 de 255); «Imagens Docker e testes End-to-End» não corre |
| CI, execução `43710210612` (commit `e8a1d79`) | Limite reposto e versão 1.0.0-rc.1: os dois jobs a passar |
| Credenciais | Sem resultados no `git grep`; só o `.env.example` versionado; nenhum `.env` nas imagens; nenhum segredo configurado no repositório |

**Não verificado:** o compose fora do Windows com Docker Desktop e do `ubuntu-latest`; `keycloak.localhost` em browsers que não o Chrome; apagar só um dos dois volumes; o `openapi.yaml` com uma ferramenta de *lint*. O serviço `proxy` usa o `nginx:1.30-alpine` original, com 3 vulnerabilidades altas com correção (`libxslt`).

## Observabilidade e publicação das imagens (2026-11-15, DT20)

Branch `feat/observabilidade-e-publicacao-de-imagens`, pull request #7, versão `1.0.0-rc.2`.

| Verificação | Resultado |
|---|---|
| Tipos, `npm run lint`, `npm test` | Sem erros; 277 testes do backend em 24 ficheiros (37 unitários) e 47 do frontend a passar |
| Reversões (7), cada regra desfeita e reposta byte a byte | 7 apanhadas, cada uma pelo teste que a nomeia: a query registada (SEC07); as verificações de saúde registadas; os 5xx como informação; o identificador do proxy aceite sem validar; o `ready` a ignorar o fornecedor de identidade; a sonda sem cache; JSON fora de produção |
| Registos no compose | 0 linhas que não sejam JSON nos dois backends; uma linha por pedido com `requestId`, `method`, `path`, `status` e `durationMs`; 0 ocorrências de `search=`, `Bearer`, e-mails ou nomes nas linhas dos pedidos, depois dos testes E2E |
| `X-Request-Id` | `GET /api/projects?search=Ana` pelo proxy: 401 com `X-Request-Id`, e o mesmo identificador na linha do backend, com o caminho `/api/projects` sem a query |
| `GET /api/health/ready`, tudo a correr | 200 `{"status":"ok","database":"ok","identityProvider":"ok"}` |
| Base de dados parada (`docker compose stop db`) | `ready` 503 com `"database":"unavailable"`; `live` 200 |
| Keycloak parado, depois dos 30 s de cache | `ready` 503 com `"identityProvider":"unavailable"`; `/api/health` 200, `live` 200 e `/api/projects` 401 — a API continua a responder |
| Depois de arrancar outra vez os dois | `ready` 200; `E2E-01` e `SEC-01` a passar |

**Defeito encontrado e corrigido antes do merge.** Na primeira versão, com o Keycloak parado, o `ready` e também o `/api/health` responderam **502** pelo proxy: o nginx contava o 503 do `ready` como falha da instância (`proxy_next_upstream … http_503`, `max_fails=1`), retirava as duas de serviço («no live upstreams», 5 ocorrências no registo do proxy) e a própria verificação de saúde do proxy, de 5 em 5 segundos, mantinha-as fora. Corrigido com uma `location /api/health` sem o 503 nas falhas; repetido o cenário: 0 ocorrências de «no live upstreams».

**Não verificado nesta branch:** a publicação das imagens (`release.yml`), que só corre quando uma versão é publicada — verificada depois do merge, na secção seguinte. O `ready` não foi experimentado com um fornecedor de identidade lento (o limite de 2 s está coberto só pelo caso de falha do pedido, nos testes unitários).

## Publicação das imagens (2026-11-15, DT20)

Depois do merge do pull request #7: etiqueta `v1.0.0-rc.2` no commit `0a8e70b` do `main` e publicação da versão no GitHub como pré-lançamento.

| Verificação | Resultado |
|---|---|
| CI no commit etiquetado | Execução `43741271761`, os dois jobs a passar |
| Workflow `release.yml`, desencadeado pela publicação | Execução `43742137288` a passar: versão a partir da etiqueta, construção, análise com o Trivy, início de sessão, publicação e fim de sessão |
| Imagens no registo | `matriz-backend:1.0.0-rc.2` com o resumo `sha256:cb2aadef7bc47b724a923a6d4d00687a9c769183a69dd21edeac8bf09de4763b`; `matriz-frontend:1.0.0-rc.2` com o resumo `sha256:500ad86a53d703f840822704db39eea8f5939f0940f9a8e7c8534bf4683a7aa1` |
| Pedido do manifesto sem credenciais | 200 para a etiqueta `1.0.0-rc.2` das duas imagens; 404 para `latest` (não se publica numa versão candidata) |
| `docker pull` das duas imagens, sem sessão iniciada no registo | Descarregadas; rótulos `org.opencontainers.image.version` = `1.0.0-rc.2` e `revision` = `0a8e70b8d1d4690ac9ee1fdbe86d2a537db4a97c` nas duas |
| Compose com `MATRIZ_sha256:cb2aadef7bc47b724a923a6d4d00687a9c769183a69dd21edeac8bf09de4763bEND_IMAGE` e `MATRIZ_sha256:500ad86a53d703f840822704db39eea8f5939f0940f9a8e7c8534bf4683a7aa1END_IMAGE` a apontar para o registo, `docker compose up -d --wait --no-build` | Os dois backends, o frontend, a migração e o seed a correr com as imagens publicadas; todos os serviços *healthy*; `ready` 200 `{"status":"ok","database":"ok","identityProvider":"ok"}`, `live` 200, `/api/projects` 401, `/` 200 |

**Observado.** Logo a seguir à troca das imagens, a API respondeu **502** pelo proxy durante cerca de 5 segundos (7 ocorrências de «no live upstreams», das 17:40:05 às 17:40:10): o compose recriou os dois backends ao mesmo tempo e o proxy ficou sem instâncias até passar o `fail_timeout` de 10 s. Recuperou sem intervenção. O compose não substitui as instâncias uma de cada vez; não é a configuração de produção (DT19).

**Não verificado:** os testes E2E sobre as imagens publicadas (escreveriam na base `matriz` do compose local; os do CI correm sobre imagens construídas do mesmo commit); a visibilidade dos dois pacotes nas definições do GitHub — o token local não tem o âmbito `read:packages`, pelo que se mediu o efeito (o manifesto e o `docker pull` sem credenciais) e não a definição.

## Ambiente de avaliação público (2026-11-16, DT21)

A `1.0.0-rc.2` em <https://matriz-app.duckdns.org> (no primeiro arranque, `https://34-175-175-67.sslip.io`, o nome com que a tabela seguinte foi medida): máquina virtual `e2-medium` (2 vCPU, 4 GB) com Debian 12 no Google Cloud, região `europe-southwest1` (Madrid), Docker 29.9.3 com Compose 5.7.1, endereço IP fixo e regra de firewall só para as portas 80 e 443. Corre `compose.yaml` e `compose.publico.yaml` com as imagens do GitHub Container Registry (`--no-build`). Medido a partir do computador de desenvolvimento, de fora da máquina, salvo indicação.

| Verificação | Resultado |
|---|---|
| `docker compose -f compose.yaml -f compose.publico.yaml up -d --wait --no-build`, com os volumes vazios | Saudável em 2 min 26 s, incluindo descarregar as imagens: `db`, `keycloak`, `backend-1`, `backend-2`, `frontend` e `proxy` *healthy*, `caddy` a correr; `migrate`, `seed` e `keycloak-setup` terminados com código 0 |
| `GET /api/health/ready` pelo endereço público | 200, `{"status":"ok","database":"ok","identityProvider":"ok"}` — o backend chega ao emissor OIDC por HTTPS, pelo nome público |
| Certificado TLS | Emitido pela Let's Encrypt, válido até 2027-02-14; `openssl s_client`: «Verify return code: 0 (ok)» |
| `GET http://…/` | 308 para `https://…/` |
| `GET /config.js` | `oidcAuthority` = `https://34-175-175-67.sslip.io/auth/realms/matriz` |
| `GET /api/projects` sem token | 401 |
| `GET /auth/admin/master/console/` | 403 (administração do Keycloak fechada a quem vem de fora) |
| Portas 8080, 5173 e 5432 no endereço IP | Sem resposta |
| `npm run test:e2e` com `E2E_BASE_URL` no endereço público | 2 a passar (`SEC-01` e `E2E-01`), 16,2 s: início de sessão pelo Keycloak, criação de uma tarefa e recusa de acesso (403) |
| `backend-1` parado | 12 pedidos seguidos pelo endereço público (6 a `/api/health`, 6 a `/api/projects`): 6 × 200 e 6 × 401, nenhum 502 |
| Role da base, dentro da máquina | `matriz` não é superutilizador; `DELETE` e `TRUNCATE` sobre `history.history_event`: «permission denied» (SEC04) |
| Reinício da máquina (`sudo reboot`) | Sem intervenção, `GET /api/health/ready` voltou a 200 cerca de 112 s depois; os seis serviços e o Caddy a correr; os E2E voltaram a passar (2 em 19,1 s) |
| Recursos, com tudo a correr | 1,5 GB de 3,9 GB de memória em uso; 4,6 GB de 20 GB de disco |

Antes de chegar à máquina, o `compose.publico.yaml` foi experimentado no computador de desenvolvimento com o nome `matriz.localhost` (certificado interno do Caddy), só com o Keycloak, o `keycloak-setup` e o Caddy, num projeto do compose à parte, apagado no fim.

| Reversão ou defeito | Resultado |
|---|---|
| Primeira versão do `deploy/Caddyfile`: o `respond 403` fora do `handle /auth/*` | `GET /auth/admin/master/console/` respondeu **200** — a regra não era aplicada. Com o `respond` dentro do `handle`: 403 em `/auth/admin`, `/auth/admin/`, na consola e em `/auth/admin/realms/matriz/users`; 200 nas chaves públicas e na página de início de sessão |
| `MATRIZ_PUBLIC_URL` definido | Pedido de autorização com `redirect_uri=http://localhost:5173/`: 400; com o endereço público: 200. Pedido de token com utilizador e palavra-passe pelo `matriz-dev-cli`: `invalid_client` |

**Não verificado:** o início de sessão num browser que não o Chrome do Playwright; a renovação do certificado (só acontece daqui a cerca de 60 dias, e o ambiente é apagado antes); o `compose.yaml` sozinho com o `scripts/keycloak-ci.mjs` alterado, no computador de desenvolvimento — fica para o CI do pull request, que arranca o compose e corre os E2E. A máquina depende de um serviço de nomes de terceiros (o DuckDNS): se ele falhar, o endereço deixa de resolver.

**Mudança do nome público** para `matriz-app.duckdns.org` (subdomínio gratuito do DuckDNS), no mesmo dia: `MATRIZ_PUBLIC_HOST` alterado, `MATRIZ_REDIRECT_FROM` com o nome anterior e o mesmo `up -d --wait --no-build`.

| Verificação, no nome novo | Resultado |
|---|---|
| Certificado TLS | Let's Encrypt, `CN=matriz-app.duckdns.org`, «Verify return code: 0 (ok)» |
| `GET /api/health/ready` | 200, base de dados e fornecedor de identidade `ok` |
| `keycloak-setup` | «Cliente matriz-web limitado a https://matriz-app.duckdns.org» |
| `GET /auth/admin/master/console/` · `GET /api/projects` sem token | 403 · 401 |
| `GET https://34-175-175-67.sslip.io/projects?x=1` | 301 para `https://matriz-app.duckdns.org/projects?x=1` |
| `npm run test:e2e` | 2 a passar, 15,4 s — depois de corrigido o defeito abaixo |

**Defeito encontrado na mudança.** O `up` recriou o frontend (configuração nova) mas não o `proxy`; o nginx do `proxy` resolve os nomes só no arranque e ficou com o endereço antigo do frontend: `GET /config.js` respondeu **502** e os 2 testes E2E falharam, com a API a responder 200. O `up --wait` tinha terminado com «container matriz-proxy-1 is unhealthy». Com `docker compose restart proxy`: `/config.js` 200 e os E2E a passar. Não acontece no primeiro arranque nem no reinício da máquina (todos os contentores arrancam de novo); fica documentado no README como passo da mudança de nome.

**Não é a produção** (DT21): um só PostgreSQL, sem réplica nem cópias de segurança; Keycloak em modo de desenvolvimento; contas fictícias com a mesma palavra-passe.
