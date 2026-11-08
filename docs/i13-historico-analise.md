# I13 — Consulta do histórico: análise técnica

**Data:** 2026-11-08 · **Estado:** análise concluída e **decidida pelo humano a 2026-11-08 (§10, D50, F25)** — execução por iniciar · **Incremento:** I13 (`implementation-plan.md` §4, §6)

Este documento não altera a especificação. Separa o que se leu no repositório (**factos**, com o sítio onde se leu) do que se supõe (**pressupostos**), compara alternativas e termina com uma recomendação e a lista de decisões que cabem ao humano (`AGENTS.md` §2, §3). Depois da decisão, o resultado passa para os documentos respetivos (§7).

---

## 1. Âmbito

| ID | O que pede | Fonte |
|---|---|---|
| RN32 | Histórico só de acrescento; cada evento com tipo, valor anterior, valor novo, autor e data/hora; passagem por várias equipas como lista cronológica | `requirements.md` |
| RF25, RNF04 | Manter e permitir identificar o histórico de responsáveis pela execução, equipas e transferências | `requirements.md` |
| CAT03 | Alterar responsável, equipa, estado, estimativas ou critérios, ou transferir → o histórico regista alteração, autor e data/hora | `user-stories.md` |
| CAT04 | Tentar editar ou apagar o histórico pela aplicação → impossível, o histórico mantém-se | `user-stories.md` |
| CA06.6 (P0) | Ao consultar o histórico de uma tarefa transferida, identifica-se o responsável anterior e a equipa original | `user-stories.md` |
| CA09.2 | Um utilizador autorizado consulta o histórico e identifica a equipa original, o responsável e a transferência | `user-stories.md` |
| SEC04 | O histórico não pode ser editado nem apagado pelas funcionalidades comuns | `constraints.md` §3 |
| *Também dependem da consulta* | CA06.5 (o histórico anterior à reabertura «continua consultável»), CA01.11 (o histórico da equipa desativada «continua consultável»), CA01.15 / CA03.17 (o histórico mantém-se depois da eliminação) | `user-stories.md` |

---

## 2. Factos (lidos no repositório a 2026-11-08)

**Registo (já existe)**

- F1. `backend/src/modules/history/history.module.ts`: o `HistoryRecorder` subscreve os `DomainEvents` e faz `INSERT` em `history.history_event` na transação de quem publica. Não há leitura: o próprio comentário diz «a consulta do histórico e as permissões só de inserção e leitura chegam no I13».
- F2. Tabela (`migrations/1793809094060-InitialSchema.ts`): `id bigint identity` (dá a ordem), `entity_type` (enum de 8 valores), `entity_id uuid`, `event_type text`, `old_value`/`new_value jsonb`, `author_id uuid`, `occurred_at timestamptz`. Índice `(entity_type, entity_id, id)`.
- F3. Tipos de elemento que publicam eventos: `task` (12 sítios), `project` (4), `sprint` (3), `team` (2), `acceptance_criterion` (2), `objective`, `epic`. **`team_membership` está no enum mas nunca é publicado**: as alterações de pertença vão como eventos da `team` (`member_added`, `member_removed`, `member_updated`).
- F4. Os eventos de **critérios** têm como elemento o critério e não a tarefa, mas trazem `newValue.taskId` (`criteria.service.ts:66`, `:119`). Os eventos de **sprint** que tocam numa tarefa (`task_planned`, `task_added`, `task_removed`, incluindo `reason: 'transferred'`) têm como elemento a sprint e trazem `taskId` (`sprints.service.ts:277`, `:307`, `:336`). → Uma consulta só por `entity_id = <tarefa>` **não mostra** as alterações de critérios nem as entradas e saídas de sprints dessa tarefa.
- F5. A transferência (`tasks.service.ts:597`) regista `team_transferred` com `old_value {teamId, assigneeId}` e `new_value {teamId, originalTeamId, assigneeId, participantIds, withParentTaskId?}`. Quando o responsável deixa de ser elegível, regista também `assignee_changed` com `reason: 'transferred'` (`:615`). → **Os dados de que o CA06.6 e o CA09.2 precisam já estão gravados**; só falta lê-los.
- F6. Os valores são **identificadores**, não nomes (equipas, utilizadores). Para mostrar «Ana», «Equipa Azul» é preciso resolvê-los. O autor das ações do sistema é o UUID reservado `00000000-…` («Sistema», F19).
- F7. **O SEC04 não está aplicado na base de dados.** O `database.md` §5 diz «Base de dados: permissões (só `INSERT` e `SELECT`)», mas o `scripts/db-setup.sql` cria um único role `matriz`, dono das bases; as migrations correm com esse role (`DB_USER=matriz`, `.env.example`) e ficam donas das tabelas, e não há nenhum `REVOKE`/`GRANT` nas migrations. → Hoje o role da aplicação pode fazer `UPDATE`, `DELETE` e `TRUNCATE` no histórico. *Lido no código; não medido na base (consultar a base precisa de autorização, `AGENTS.md` §6).*
- F8. Não há nenhuma rota de histórico na API nem no `openapi.yaml` (zero ocorrências de `history`). Também não há nenhum ecrã de histórico no `frontend/src`.
- F9. **A matriz de permissões (`requirements.md` §3.1) não tem nenhuma linha para «consultar o histórico».** O CA09.2 diz «utilizador autorizado» sem dizer quem é.
- F10. O responsável de outra equipa (RN03, F23, F24) vê a tarefa mas «não consulta os membros da equipa». O `team_transferred` grava `participantIds`, e o `assignee_changed` grava pessoas → mostrar-lhe o histórico completo expõe membros da equipa.
- F11. As tarefas e os projetos eliminados ficam fora de todas as leituras: `work-item-locator.service.ts` filtra `deleted_at IS NULL` na tarefa e no projeto. Um `GET /tasks/{id}` de uma tarefa eliminada não a encontra.
- F12. O padrão de listas paginadas com total já existe (comentários, I7: `listComments`) e o `AccessService` já tem a visibilidade de projeto e de tarefa (`canViewProject`, `enforceTask`).
- F13. 11 ficheiros de teste e2e já leem `history.history_event` diretamente em SQL para verificar o **registo** (CAT03 do lado da escrita). Nenhum testa a **consulta** nem a impossibilidade de editar (CAT04).

## 3. Pressupostos (não verificados ou por aprovar)

- P-a. **Escala**: até 500 utilizadores (RNF06); assume-se que o histórico de uma tarefa tem dezenas de eventos, não milhares. Não se mediu o volume (os dados de demonstração não o representam).
- P-b. **Uma consulta por `new_value->>'taskId'` é rápida o suficiente** com um índice de expressão. Não medido; medir só com a base de testes e com autorização.
- P-c. **Quem pode consultar** (F9) é decisão do humano. A hipótese de trabalho é: quem vê a tarefa, exceto o responsável de outra equipa (F10).
- P-d. **Elementos eliminados**: assume-se que no MVP o histórico de uma tarefa eliminada **não** é consultável pela interface (é conservado, RN38, mas não é mostrado). O RN38 diz «conserva-se», não «consulta-se»; ainda assim, é uma interpretação.
- P-e. O `REVOKE` de privilégios ao próprio dono funciona no PostgreSQL 17/18 (o dono pode voltar a concedê-los, mas a aplicação não o faz). Comportamento documentado do PostgreSQL; não testado neste repositório.
- P-f. As estimativas de esforço (§4) são estimativas, não medições.

## 4. Critérios (definidos antes das alternativas)

1. **Cobertura da especificação**: quantos dos CA do §1 ficam verificáveis.
2. **Correção e segurança**: o SEC04 passa a valer de facto; não há fugas de dados (F10, CAT06).
3. **Fronteiras**: quantos módulos passam a conhecer a forma dos eventos de outros (`architecture.md` §5).
4. **Decisões novas**: quantas decisões pendentes cria (cada uma pára o trabalho, `AGENTS.md` §3).
5. **Esforço** em sessões de trabalho, com honestidade (P-f).
6. **Reversibilidade**: se é fácil alargar ou recuar depois.

---

## 5. Alternativas

### A — Não fazer: manter o adiamento (F23)

Mantém-se o I13 «Por iniciar» e regista-se a limitação.

- **Ganha:** zero risco, zero esforço; a Ficha PL 03 não o pedia.
- **Custa:** o CA06.6 é **P0** e continua por verificar; o CA09.2, o CA06.5 e o CA01.11 também. **O F7 continua: o SEC04 está documentado como aplicado e não está.**
- **Quando é a escolha certa:** se o projeto acabar aqui (entrega da cadeira fechada). Mesmo assim, o F7 devia ser corrigido ou a documentação devia deixar de dizer que está feito.

### B — Só a correção do SEC04, sem consulta

Uma migration com `REVOKE UPDATE, DELETE, TRUNCATE ON history.history_event FROM matriz` e um teste que prove que falha.

- **Ganha:** fecha o F7 e o CAT04 com um teste que se vê falhar; muito pouco esforço (≈0,5 sessão).
- **Custa:** não resolve a consulta; o CA06.6 e o CA09.2 continuam por verificar.
- **Quando é a escolha certa:** como primeiro passo de qualquer outra alternativa, ou se o tempo só der para isto.

### C — Histórico só da tarefa, só com os eventos dela

`GET /tasks/{taskId}/history`, só `entity_type = 'task' AND entity_id = :id`, paginado, por ordem de `id`. Painel «Histórico» no detalhe da tarefa.

- **Ganha:** o mais simples; usa o índice que já existe (F2); cumpre o CA06.6 e o CA09.2 (F5).
- **Custa:** **incompleto contra o CAT03** — as alterações de critérios e as entradas e saídas de sprints não aparecem (F4). Um utilizador vê o estado mudar para «Terminada» sem ver os critérios a serem cumpridos.
- **Quando é a escolha certa:** se o humano decidir que o CAT03 só exige o *registo* (já testado, F13) e não a *consulta* dos critérios.

### D — Histórico agregado da tarefa *(recomendada)*

O mesmo endpoint de C, mas a consulta junta três origens: os eventos da tarefa, os dos seus critérios (`entity_type = 'acceptance_criterion' AND new_value->>'taskId' = :id`) e os das sprints que a referem (`entity_type = 'sprint' AND new_value->>'taskId' = :id`), por ordem de `id`. Índice de expressão sobre `(new_value->>'taskId')` (parcial nos dois tipos). Nomes resolvidos no servidor (autor, equipas, pessoas; «Sistema»). Painel no detalhe da tarefa, com cada tipo de evento formatado em pt-PT no frontend.

- **Ganha:** uma tarefa conta a sua história inteira; cobre o CAT03, o CA06.5, o CA06.6 e o CA09.2; não muda a escrita nem o esquema da tabela (só acrescenta um índice); reutiliza a paginação dos comentários e a visibilidade da tarefa (F12).
- **Custa:** o módulo Histórico passa a conhecer a forma do `new_value` de dois tipos de evento (`taskId`) — um acoplamento à forma dos dados que hoje não existe. Mitiga-se com um teste por origem: se um módulo mudar o nome do campo, o teste falha. A consulta por JSON depende do P-b.
- **Esforço:** ≈2 sessões (API, permissões, testes por CA, ecrã, verificação no browser).
- **Quando é a escolha errada:** se o volume de eventos de sprint e de critérios for grande ao ponto de o índice de expressão não chegar (P-a, P-b) — aí é melhor a variante D′.

> **Variante D′ — coluna de relação em vez de JSON.** Acrescentar `related_task_id uuid` à tabela, preenchido pelo `HistoryRecorder` a partir do evento. É mais limpo para consultar, mas **obriga a preencher as linhas que já existem com um `UPDATE` ao histórico** — exatamente o que o SEC04 proíbe — ou a deixá-las sem relação. Só vale se o P-b falhar.

### E — Histórico genérico de qualquer elemento

`GET /history/{entityType}/{entityId}` para os 8 tipos, com um componente de linha temporal reutilizado nos detalhes da tarefa, do projeto, da equipa e da sprint.

- **Ganha:** cumpre à letra a «consulta do histórico de cada elemento» (`implementation-plan.md` I13, `architecture.md` §5) e também o CA01.11 (equipa desativada).
- **Custa:** **cada tipo tem uma regra de visibilidade diferente e nenhuma está na §3.1** (F9) → no mínimo quatro decisões novas (projeto, equipa, sprint, objetivo e épico) antes de começar. Mais superfície para fugas (F10 em várias formas). O `team_membership` está no enum e nunca é usado (F3). ≈4–5 sessões.
- **Quando é a escolha certa:** quando a matriz de permissões tiver a linha do histórico para cada elemento. Pode vir **depois** de D, que é o caso particular da tarefa.

### F — Vista de «custódia» em vez de lista de eventos

Um endpoint que devolve um resumo derivado: equipa original, equipa atual, cadeia de transferências e responsáveis pela execução ao longo do tempo, sem a lista crua.

- **Ganha:** responde diretamente ao CA06.6, ao CA09.2 e ao RNF04, e é fácil de ler.
- **Custa:** **não cumpre o RN32**, que pede cada evento com o tipo, os valores, o autor e a data/hora; não serve o CAT03. Duplica lógica de interpretação dos eventos.
- **Quando é a escolha certa:** como complemento de D (um cabeçalho «Equipa original: X · Transferida 2×» por cima da lista), nunca em vez dela.

### G — Só API, sem ecrã

D ou C sem frontend; o ecrã fica para depois.

- **Ganha:** ≈1 sessão; os CA podem ser verificados por testes de integração.
- **Custa:** os CA falam de quem *consulta*; o `AGENTS.md` §9 pede verificação no browser quando a tarefa muda a interface — com G a tarefa não a muda, mas o utilizador também não ganha nada. Deixa o I13 a meio.
- **Quando é a escolha certa:** se o ecrã depender de uma decisão de desenho que ainda não esteja tomada.

### Comparação

| | Cobertura | SEC04 | Fronteiras | Decisões novas | Esforço | Reversível |
|---|---|---|---|---|---|---|
| A — Não fazer | nenhuma | ✗ | = | 0 | 0 | — |
| B — Só SEC04 | CAT04 | ✔ | = | 0 | ≈0,5 | sim |
| C — Tarefa simples | CA06.6, CA09.2 | só com B | = | 2 | ≈1,5 | sim |
| **D — Tarefa agregada** | **CAT03, CA06.5, CA06.6, CA09.2** | **com B** | +1 (forma do `taskId`) | **3** | **≈2** | **sim; alarga-se para E** |
| E — Genérico | todos, incl. CA01.11 | com B | +3 | ≥6 | ≈4–5 | difícil de recuar |
| F — Custódia | CA06.6, CA09.2 | com B | +1 | 2 | ≈1,5 | sim |
| G — Só API | CA por teste | com B | = | 2–3 | ≈1 | sim |

## 6. Decisões transversais (aplicam-se a C, D, E, F e G)

### 6.1 Como aplicar o SEC04 na base de dados (F7)

| Opção | Ganha | Custa |
|---|---|---|
| **S1 — `REVOKE UPDATE, DELETE, TRUNCATE` ao role `matriz` numa migration** *(recomendada)* | É o que o `database.md` §5 já diz; uma migration; um teste prova-o | O dono pode voltar a dar-se o privilégio (P-e); não trava um superutilizador |
| S2 — Trigger que recusa `UPDATE`/`DELETE`/`TRUNCATE` | Trava também o dono, até alguém desligar o trigger | Afasta-se do texto do `database.md`; mais código na base |
| S3 — Dois roles: um dono para as migrations e outro para a aplicação, só com `INSERT`/`SELECT` | A separação verdadeira | Muda o `db-setup.sql`, o `.env`, as imagens (DT16) e a forma como os testes recriam a `matriz_test`; é uma decisão técnica nova (DT), maior do que o I13 |
| S1 + S2 | Dupla proteção | Duplica sem necessidade à escala do MVP |

### 6.2 Quem pode consultar (F9, F10) — **decisão do humano**

| Opção | Nota |
|---|---|
| Z1 — Quem vê a tarefa (administrador, gestor do projeto, membros e líder das equipas que veem o projeto) **exceto o responsável de outra equipa** *(recomendada)* | Coerente com a visibilidade (CAT06) e com a restrição F23/F24 |
| Z2 — Z1 mais o responsável de outra equipa, com as pessoas escondidas | Exige filtrar cada tipo de evento; mais código e mais formas de falhar |
| Z3 — Só administrador, gestor e líder | Lê «utilizador autorizado» (CA09.2) de forma estreita; o membro deixa de ver o histórico da sua própria tarefa |

### 6.3 Elementos eliminados (F11, P-d) — **decisão do humano**

- **E1 — Não consultáveis na interface** (como a tarefa: 404) *(recomendada para o MVP)*: o histórico conserva-se (RN38) e fica disponível para um I13-b ou para auditoria.
- E2 — Consultáveis só pelo administrador: exige uma rota que leia tarefas eliminadas, o que hoje nada faz.

### 6.4 Apresentação

- **Tipos no servidor, texto no frontend** *(recomendada)*: a API devolve `eventType`, `oldValue`, `newValue` e os nomes resolvidos; o frontend formata cada tipo em pt-PT. A API mantém-se estável e o texto muda sem migration.
- Alternativa: o servidor devolve a frase já escrita. Mais simples no ecrã, mas mistura apresentação com dados e torna a API dependente da língua.
- Tipos desconhecidos: uma linha genérica («alteração registada»), para que um evento novo nunca desapareça em silêncio.

---

## 7. Recomendação

**D (tarefa agregada) + S1, com Z1, E1 e o texto formado no frontend.** Ordem de execução:

1. **S1** — migration de `REVOKE` e teste do CAT04 (`UPDATE`/`DELETE` como `matriz` falham; a API não tem nenhuma rota que edite o histórico). Verificação por reversão: sem a migration, o teste tem de falhar.
2. **Contrato** — `listTaskHistory` no `openapi.yaml`: `GET /tasks/{taskId}/history`, paginado como os comentários, por ordem cronológica.
3. **Leitura no módulo Histórico** — consulta das três origens (F4), índice de expressão, nomes resolvidos através das portas que já existem (diretório de utilizadores, organização), autor «Sistema».
4. **Permissões** — nova linha na §3.1 (Z1) aplicada pelo `AccessService`; 403 ao responsável de outra equipa, 404 à tarefa eliminada (E1).
5. **Testes por CA** — CA06.6, CA09.2, CA06.5, CAT03 (critérios e sprints aparecem), CAT04, Z1, E1; cada um com o ID no nome e visto a falhar por reversão.
6. **Ecrã** — painel «Histórico» no detalhe da tarefa (direção B, DT17), com os estados de carregamento, vazio e erro (Ex. 7); verificação no browser.
7. **Documentação** — `implementation-plan.md` §6, `verification.md`, `README.md` (o MVP fica completo), `database.md` (índice), comentário do `history.module.ts`.

Fica para depois, se o humano o quiser: **E** (os outros elementos, incluindo o CA01.11) e **F** como cabeçalho de resumo.

## 8. O que cabe ao humano decidir

1. **Alternativa**: D (recomendada), C, E ou outra.
2. **SEC04**: S1 (recomendada), S2 ou S3.
3. **Quem consulta** (nova linha da §3.1): Z1, Z2 ou Z3.
4. **Elementos eliminados**: E1 ou E2.
5. **CA01.11** (histórico da equipa desativada): fica no I13 (puxa parte da E) ou num incremento seguinte.
6. **Autorizações** (`AGENTS.md` §6) necessárias à execução: aplicar migrations à `matriz` (`npm run db:migrate`), E2E e a verificação no browser.

## 9. Discrepâncias encontradas (`AGENTS.md` §3)

| # | Discrepância | Onde | Impacto |
|---|---|---|---|
| X1 | O SEC04 está documentado como aplicado na base de dados («permissões só `INSERT` e `SELECT`») e não está | `database.md` §5 vs `scripts/db-setup.sql` e migrations | O CAT04 só vale ao nível da API |
| X2 | A §3.1 não diz quem consulta o histórico; o CA09.2 diz «utilizador autorizado» | `requirements.md` §3.1, `user-stories.md` CA09.2 | Bloqueia a implementação até haver decisão |
| X3 | O tipo `team_membership` está no enum e no contrato dos eventos mas nunca é publicado | `domain-events.ts`, migration inicial, `database.md` §2.6 | Inofensivo; documentação a mais |
| X4 | O CA01.11 e o CA06.5 exigem histórico «consultável» e não estão na lista do I13 | `implementation-plan.md` §4 | O âmbito do I13 está subdeclarado |
| X5 | A linha `I12–I14 · Por iniciar` contradizia as linhas I12 e I14 «Concluído» | `implementation-plan.md` §6 | Corrigida a 2026-11-08 (passou a linha do I13) |

---

## 10. Decisão do humano (2026-11-08)

Registada como **D50** (`constraints.md` §2), **F25** (`review.md` §6) e na §3.1 do `requirements.md`. **Difere da recomendação do §7** na alternativa (E em vez de D), no alcance para membros nos históricos de equipa e de sprint e nos elementos eliminados.

| # | Questão (§8) | Decisão |
|---|---|---|
| 1 | Alternativa | **E — histórico de cada elemento**: projeto, objetivo, épico, tarefa (com os eventos dos seus critérios e as entradas e saídas de sprints, como em D), sprint e equipa. Inclui o CA01.11. |
| 2 | SEC04 | **S1** — migration que retira `UPDATE`, `DELETE` e `TRUNCATE` sobre `history.history_event` ao role `matriz`. |
| 3 | Quem consulta a tarefa | **Z1** — quem vê a tarefa; **não** o responsável de outra equipa (RN03, F23, F24). |
| 3a | Projeto, objetivo, épico | Quem vê o projeto (CAT06). |
| 3b | Equipa e sprint | Administrador, líder e membros da equipa e gestor de um projeto a que a equipa está associada (como no planeamento, F20). **Dados individuais de capacidade** (`allocationPct`, `availableHours`; SEC07, CAT05): o administrador e o líder veem todos; o membro só os seus; o gestor nenhum. O evento continua visível sem esses valores. **Tarefas referidas** em eventos da sprint (`task_planned`, `task_added`, `task_removed`, `closed`) só se forem de projetos que a pessoa vê (CAT06, F20); as outras são retiradas do evento. |
| 4 | Elementos eliminados | **Só o administrador**, para os projetos (com a sua hierarquia) e as tarefas (com as subtarefas) eliminados (RN38). Os outros recebem 404, como hoje. |
| 4a | Como o administrador lá chega | **Ligação direta**: abrir o endereço de um projeto ou de uma tarefa eliminados mostra um aviso «Eliminado» e só o histórico. Não há listagem de eliminados. |
| 5 | CA01.11 | Entra no I13 (decorre de E). |

### 10.1 Pressupostos que ficam (a confirmar no plano de execução)

- P-g. «Membros da equipa» são os membros **atuais**; quem saiu da equipa deixa de ver o histórico dela. Uma equipa desativada mantém as pertenças (RN33), por isso o histórico continua consultável pelos mesmos (CA01.11). **Corrigido na execução (passo 5, 2026-11-08):** confirmado só em parte no passo 0 — o `teamRole` do `OrganizationReader` conta só equipas ativas, e o líder e os membros de uma equipa desativada recebiam 403 no histórico dela (medido). **Decisão do humano (opção 1):** só no histórico, contam as pertenças da equipa mesmo desativada (`historyTeamRole`), para o acesso e para os filtros SEC07/CAT06; o planeamento da equipa desativada continua fechado.
- P-h. O gestor vê o histórico de uma equipa associada a um projeto que gere, mesmo nos eventos de pertença (`member_*`), sem os valores de alocação.
- P-i. As rotas seguem o estilo do contrato atual, uma por recurso (`GET /tasks/{id}/history`, `/projects/{id}/history`, `/objectives/{id}/history`, `/epics/{id}/history`, `/sprints/{id}/history`, `/teams/{id}/history`), todas servidas pelo módulo Histórico, paginadas como os comentários (D46) e por ordem cronológica (`id`). É uma proposta técnica: aprova-se com o plano.
- P-j. O `TRUNCATE` é retirado mas a recriação da `matriz_test` pelos testes faz `DROP SCHEMA`, que o dono continua a poder fazer. Verifica-se no passo 1.

### 10.2 Plano de execução, passo a passo

Cada passo termina com tipos sem erros e `npm test` a passar; os testes levam o ID do critério no nome (`AGENTS.md` §9) e cada correção é vista a falhar por reversão.

| # | Passo | Ficheiros | Verificação |
|---|---|---|---|
| 1 | **SEC04 na base de dados (S1)** | `backend/migrations/<ts>-HistoryAppendOnly.ts` | Teste `CAT04`: `UPDATE`, `DELETE` e `TRUNCATE` como `matriz` falham com `permission denied`; `INSERT` e `SELECT` continuam. Reversão: sem a migration, o teste falha |
| 2 | **Contrato** | `openapi.yaml` | Seis operações `list*History` e o esquema comum da página de eventos (evento, autor com nome, nomes das referências, marca de valores omitidos) |
| 3 | **Leitura no módulo Histórico** | `backend/src/modules/history/*` (leitor, controlador), portas de leitura em `work`, `organization`, `planning`, `identity` só se faltarem; migration com o índice de expressão sobre `new_value->>'taskId'` | Testes por origem: os eventos de critérios e de sprints aparecem no histórico da tarefa (CAT03); um campo renomeado faz falhar o teste |
| 4 | **Permissões e filtros** | `backend/src/modules/identity/access.service.ts`; filtros SEC07 e CAT06 no leitor | Testes: Z1 (403 ao responsável de outra equipa), 3a, 3b (membro vê só a sua alocação; gestor nenhuma; tarefa de projeto invisível retirada), 4 (eliminado: 200 ao administrador, 404 aos outros) |
| 5 | **Testes por CA** | `backend/test/history.e2e-spec.ts` | CA06.6, CA09.2, CA06.5, CA01.11, CAT03, CAT04 |
| 6 | **Interface** | componente de linha temporal partilhado; painéis no detalhe da tarefa, do projeto, da equipa e da sprint; página «Eliminado» com o histórico para o administrador | Testes `node:test` da formatação de cada tipo de evento (e do tipo desconhecido); verificação no browser com as contas de demonstração (autorização, `AGENTS.md` §6) |
| 7 | **Documentação** | `implementation-plan.md` §6, `verification.md`, `README.md`, `database.md` §2.6 e §5, comentário do `history.module.ts` | Revisão do diff |

**Autorizações a pedir antes de executar** (`AGENTS.md` §6): aplicar as migrations à `matriz` (`npm run db:migrate`), os testes E2E e a verificação no browser, o commit e o push da branch, e o PR.
