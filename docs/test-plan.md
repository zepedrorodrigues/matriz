# Plano de testes — tarefas e permissões (Ficha PL 04)

Plano de testes da funcionalidade **tarefas** (criar, consultar, editar, eliminar, estado e prioridade) e das **permissões** sobre elas, definido a partir dos requisitos e não do comportamento atual do código (Ex. 1). Cada cenário indica a origem (critério de aceitação ou regra), as entradas, o resultado esperado, o nível de teste e o teste que o verifica. Os resultados das execuções estão no fim (§5); as revisões de código e de segurança, em [`quality-security-review.md`](quality-security-review.md).

- **Fontes:** [`requirements.md`](requirements.md) §3.1 (matriz de permissões), RN26, RN38, RN39, RN42; [`user-stories.md`](user-stories.md) US03 (CA03.1, CA03.11, CA03.12, CA03.17–CA03.19) e CAT01, CAT06; contrato `openapi.yaml` (códigos HTTP).
- **Níveis:** *Unitário* — uma regra isolada, sem base de dados (Jest, `backend/src/**/*.spec.ts`; `node:test` no frontend). *Integração* — a API real contra PostgreSQL (Jest + supertest, `backend/test/*.e2e-spec.ts`). *E2E* — o percurso no browser (Playwright, `e2e/`). *Manual* — verificação no browser ou com pedidos diretos, com contas de demonstração.

## 1. Como foi feito (IA e decisões humanas)

1. A IA (Claude Code) propôs a matriz de cenários a partir dos requisitos e do contrato (§2), com entradas, resultado esperado e nível.
2. Antes de registar, cada resultado esperado foi conferido com a especificação, não com o código. Pressupostos que a IA tinha de confirmar e como ficaram:

| Pressuposto | Verificado em | Decisão |
|---|---|---|
| Um título só com espaços conta como vazio | RN42: «os campos obrigatórios não podem ser compostos apenas por espaços» | Recusado |
| Os limites 3 e 150 contam os espaços do início e do fim | RN42 / mensagem da regra: «sem contar os espaços no início e no fim»; espaços no meio contam | Os espaços nas pontas são retirados antes de contar |
| Título inválido responde 422 (regra de negócio) | Contrato: `createTask` → **400** para campos inválidos; 422 para regras entre recursos (p. ex. equipa fora do projeto) | **400** |
| Quem não vê o projeto recebe 404, para não revelar que a tarefa existe | Contrato e CAT06: a consulta é «recusada» → **403**; 404 só para inexistente, eliminada (RN38) ou id mal formado | **403** / 404 |
| O membro não cria tarefas | §3.1: o membro cria tarefas «só no backlog» (da sua equipa) | O membro cria; para outra equipa → 403 |
| O membro altera a prioridade | RN39: só ao criar; depois, líder, gestor e administrador | Alterar depois → 403 |
| A tarefa eliminada desaparece da base | RN38: eliminação lógica; sai das listagens e consultas, a linha mantém-se | Lógica, com histórico |

3. **Seleção (Ex. 1.2):** os três cenários essenciais pedidos — título inválido (P-01), criação e consulta (P-02) e acesso de um utilizador sem autorização (P-03) — têm teste em todos os níveis aplicáveis (§3). Os restantes já tinham testes de integração dos incrementos anteriores; ficam registados para rastreabilidade.
4. **Revisão humana:** a matriz e os pressupostos acima foram apresentados ao responsável do projeto antes de serem dados como fechados (ver §4).

## 2. Matriz de cenários

| ID | Cenário | Origem | Entradas | Resultado esperado | Nível | Teste |
|---|---|---|---|---|---|---|
| **P-01** | **Título inválido** | CA03.18, RN42 | Título vazio, só espaços, 2 ou 151 caracteres (também depois de retirar as pontas), não texto | Recusado com a mensagem da regra; nada criado | Unitário + Integração + Manual | `work.dto.spec.ts`; `tasks.e2e-spec.ts` «CA03.18, Ex. 8 (caso 04)»; Ficha 03, caso 04 |
| P-01b | Título nos limites | CA03.18, RN42 | 3 e 150 caracteres; 3 depois de retirar as pontas | Aceite; guardado sem os espaços das pontas | Unitário | `work.dto.spec.ts` «valores-limite» |
| **P-02** | **Criar e consultar uma tarefa** | CA03.1, CA03.11 | Líder: título, épico, equipa | 201; «Em planeamento», prioridade «Média», criador do token; a consulta devolve os mesmos dados; consta da listagem; persiste | Integração + E2E | `tasks.e2e-spec.ts` «CA03.1, CA02.3, CA03.11»; `e2e/create-task.spec.ts` «E2E-01» |
| **P-03** | **Utilizador sem autorização** | CAT06, §3.1 | Utilizador de outra equipa: consultar, editar, eliminar, comentar uma tarefa de um projeto que não vê; mudar ids no pedido | 403, nada alterado | Integração + Manual (2 contas) | `tasks.e2e-spec.ts` «Ex. 8 (caso 08)» e «§3.1 — consultar a tarefa…»; `comments.e2e-spec.ts` «CA10.4»; manual em `quality-security-review.md` §3 |
| P-04 | Tarefa inexistente | RN38, contrato | Id que não existe, id mal formado, tarefa eliminada | 404 | Integração | `tasks.e2e-spec.ts` «§3.1 — consultar a tarefa…», «RN38 — as tarefas de um projeto eliminado» |
| P-05 | Sem autenticação | CAT01 | Sem token, token expirado, de outro emissor | 401 com `WWW-Authenticate: Bearer` | Integração | `auth.e2e-spec.ts` (CAT01), `tasks.e2e-spec.ts` «CAT01» |
| P-06 | Membro cria no backlog da sua equipa | §3.1, RN21, RN39 | Membro, a sua equipa, com prioridade | 201 | Integração | `tasks.e2e-spec.ts` «RN39, RN21 — o membro cria no backlog…» |
| P-07 | Membro ou líder cria para outra equipa | §3.1, RN21 | Membro com `teamId` de outra equipa | 403, nada criado | Integração | `tasks.e2e-spec.ts` «RN21, §3.1 — membro e líder não criam tarefas para outra equipa» |
| P-08 | Campos que o cliente não pode impor | Ficha 03 Ex. 3.3 | `createdBy`, `id`, campos fora do contrato | 400; o criador vem sempre do token | Integração | `tasks.e2e-spec.ts` «Ex. 3.3 — o criador não pode ser indicado» |
| P-09 | Alterar a prioridade | CA03.12, RN39 | Líder: «Alta»; membro: «Alta» | Líder 200 e listagem filtrada reflete; membro 403 | Integração + Manual | `tasks.e2e-spec.ts` «CA03.12, Ex. 8 (caso 05)», «RN39, D49 — o membro não altera a prioridade» |
| P-10 | Mudar o estado | RN26, RN27 | Avançar um estado; saltar; «Pronto a desenvolver» sem critério | 200; saltar → 409; sem critério → 409; nada muda nas recusas | Integração + Manual | `tasks.e2e-spec.ts` «RN26 — avança um estado…», «RN27, RN13…» |
| P-11 | Membro move só as tarefas atribuídas | §3.1, RN26 | Membro, tarefa de outro | 403 | Integração | `tasks.e2e-spec.ts` «RN26, §3.1 — o membro move só…» |
| P-12 | Filtrar por estado e prioridade | CA03.19, D46 | `state`, `priority`, ambos, paginação | Só as correspondentes; total do conjunto filtrado | Integração + Manual | `tasks.e2e-spec.ts` «CA03.19, D46 — filtros…» |
| P-13 | Eliminar com subtarefas | CA03.17, RN38 | Líder elimina tarefa com subtarefas | 204; tarefa e subtarefas saem das listagens e consultas; linhas e histórico mantêm-se | Integração + Manual | `tasks.e2e-spec.ts` «CA03.17, Ex. 8 (caso 09)» |
| P-14 | Quem não pode eliminar | RN38, §3.1 | Membro; quem só vê o projeto | 403, tarefa mantém-se | Integração | `tasks.e2e-spec.ts` «RN38, §3.1 — o membro e quem só vê o projeto não eliminam» |
| P-15 | Responsável de outra equipa (RN03) | F23 | Atribuído por exceção: ver, mudar estado, bloquear; ver o projeto; mudar prioridade | 200 nas da tarefa; 403 no projeto e na prioridade | Integração | `review-fixes.e2e-spec.ts` «Correção 1» |

## 3. Testes associados aos cenários essenciais

| Cenário | Unitário | Integração | E2E | Manual |
|---|---|---|---|---|
| P-01 Título inválido | `backend/src/modules/work/work.dto.spec.ts` — 20 testes: válido, espaços nas pontas e no meio, limites 2/3/150/151 (também depois de retirar as pontas), vazio, só espaços, tabulações, número, null, em falta; descrição 2000/2001; edição | `tasks.e2e-spec.ts` — POST com título vazio, só espaços, curto, longo e descrição longa → 400 **e a tarefa não é criada** (consulta à base) | — (a validação na interface foi verificada manualmente, Ficha 03 caso 04) | Ficha 03, caso 04 |
| P-02 Criar e consultar | — | `tasks.e2e-spec.ts` «CA03.1…»: 201 com os campos do contrato, `GET /tasks/{id}` com os mesmos dados, linha na base, consta da listagem; a base de testes é recriada a cada execução | `e2e/create-task.spec.ts` «E2E-01»: autenticar como `ana` → abrir «Portal Interno» → criar tarefa com título único → aparece na listagem sem recarregar e depois de recarregar → eliminada pela interface | Ficha 03, caso 03 |
| P-03 Sem autorização | — | `tasks.e2e-spec.ts` «Ex. 8 (caso 08)»: outro utilizador muda os ids no pedido → 403 em consultar, editar, mudar o estado, eliminar; nada muda | — | Duas contas reais (`rui` e `bruno`/`ana`) e pedidos diretos à API: [`quality-security-review.md`](quality-security-review.md) §3 |

**Isolamento dos dados.** Integração: a base `matriz_test` é recriada pelas migrations antes de cada execução (`backend/test/global-setup.ts`) e cada ficheiro cria os seus utilizadores, equipas e projetos com nomes únicos. Unitário: sem base de dados. E2E: corre no ambiente de desenvolvimento (Keycloak, API e frontend locais, base `matriz`), com um título único por execução (data e hora) e a eliminação da tarefa no fim, pela interface; as linhas ficam na base com `deleted_at` (eliminação lógica, RN38), sem efeito nas listagens.

## 4. Decisões humanas

- Plano da Ficha 04 aprovado pelo responsável (2026-11-05): Playwright como dependência de desenvolvimento, no Chrome instalado (sem descarregar browsers); o teste E2E lê a palavra-passe das contas fictícias do `.env` local e elimina o que cria; análise estática com o que existe no projeto (`npm audit`, `tsc`), sem ESLint nem Semgrep; revisão de código limitada ao diff desde a última revisão (`1679cc6..HEAD`).
- Pressupostos da §1: [revisão humana: por confirmar pelo responsável]
- Revisões de código e de segurança: decisões 1a e 2a e a triagem dos achados (F24), em [`quality-security-review.md`](quality-security-review.md).

## 5. Execuções

| Comando | Nível | Resultado |
|---|---|---|
| `npm run test:unit -w backend` | Unitário (backend) | 20 testes a passar |
| `npm test -w frontend` | Unitário (frontend) | 29 testes a passar |
| `npm test -w backend` | Integração (e os unitários do backend) | 227 testes a passar em 20 ficheiros (201 de antes, 20 unitários e 6 de regressão da revisão) |
| `npm run test:e2e` | E2E | 2 testes a passar: `E2E-01` (criar tarefa) e `SEC-01` (autorização entre dois utilizadores); o `E2E-01` correu também sozinho três vezes seguidas (3,4 s, 2,9 s, 2,8 s) |

**Testes não executados:** nenhum dos previstos. O E2E precisa do Keycloak, da API e do frontend a correr; não corre sem eles (falha com uma mensagem a dizê-lo, em vez de um erro confuso).

**Os testes verificam a regra, não só o código (mutação).** Com a regra alterada de propósito, os testes têm de falhar: limite máximo 150 → 151: 2 testes unitários falham; mínimo 3 → 2: 2 falham; sem retirar os espaços das pontas: 5 falham. No E2E, com um projeto que não existe (`E2E_PROJECT="Projeto inexistente"`), o teste falha a procurar a ligação e guarda a captura de ecrã em `e2e/test-results/` (fora do Git). O ficheiro de produção foi reposto e comparado byte a byte.

**Problemas durante a escrita dos testes** (Ex. 2.3: distinguir defeito da aplicação, problema do teste e limitação do ambiente):

| Sintoma | Classificação | Resolução |
|---|---|---|
| O teste unitário não arrancava: `TypeError: Reflect.getMetadata is not a function` | Problema do teste | Os decoradores dos DTO precisam do polyfill `reflect-metadata`, que a aplicação carrega no arranque; o teste unitário importa-o (já era dependência). A regra não foi alterada. |
| A primeira tentativa de mutação «sem retirar os espaços» não alterou o ficheiro | Problema da verificação (`sed` não faz substituições em várias linhas) | Repetida com um script; 5 testes falham, como esperado |
