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
- **Ligações à base dentro das transações.** Fora do caminho dos alertas (corrigido), alguns serviços ainda fazem leituras de outro módulo com uma segunda ligação enquanto a transação está aberta. Com muitos pedidos de escrita em simultâneo (cerca do tamanho do pool, 10), os pedidos podem ficar à espera até expirar o tempo. Fica para uma revisão própria.
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

- **Início de sessão no browser através do proxy.** O emissor tem de ser o mesmo para o browser e para o backend no contentor (`host.docker.internal`). Nesta máquina, o ficheiro `hosts` aponta `host.docker.internal` para `192.168.1.230`, um endereço antigo (o atual é `192.168.1.176`), e o Keycloak só escuta em `127.0.0.1`. Dentro dos contentores o nome funciona, porque o Docker Desktop o encaminha para o computador.
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

`main` em `5f2d7a9`. Chrome pelo Playwright (teste temporário, só pedidos GET, apagado no fim), sessão do Rui Exemplo (membro da Equipa Alfa); Keycloak na porta 8180, API e frontend locais, base `matriz`.

| Verificação | Resultado |
|---|---|
| Vista do membro (pendente da reformulação visual) | Início, Projetos, Planeamento, Alertas e quadro da sprint «07/11/2026 a 20/11/2026»: todos os `GET /api` com 2xx, nenhum pedido de escrita. Quadro sem a coluna do backlog (não é líder). Diálogo da tarefa 302: «Editar», «Mudar estado», «Nova subtarefa», «Publicar comentário», «Assinalar bloqueio»; sem «Transferir» nem «Eliminar» (§3.1) |
| Largura de 390 px (pendente do I11) | As mesmas cinco páginas e o diálogo: `scrollWidth − innerWidth` = 0 em todas; o quadro desloca-se dentro da sua área |
| Achado | O botão de fechar dos diálogos e dos painéis laterais anuncia «Close» aos leitores de ecrã (`components/ui/dialog.tsx:76`, `sheet.tsx:77`), em inglês |

**Não verificado:** a submissão de cada painel do detalhe (escreve na base `matriz`, à espera de autorização); o fim automático de uma sprint real no browser; o início de sessão através do proxy (o ficheiro `hosts` continua a apontar `host.docker.internal` para um endereço antigo).
