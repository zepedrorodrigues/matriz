# Revisão de qualidade e de segurança — Ficha PL 04 (Ex. 5)

Resultados do Code Review e do Security Review do Matriz, com a evidência de cada achado, a classificação (confirmado ou suspeita), as decisões humanas e as correções com o respetivo teste de regressão. O plano de testes está em [`test-plan.md`](test-plan.md).

- **Data:** 2026-11-05
- **Versão revista:** commit `44f1f11` (fim da Ficha 03); correções no commit que acrescenta este documento.
- **Quem fez o quê:** a revisão e a primeira classificação são da IA (Claude Code), cada uma por um agente separado. Os achados que dependiam da execução foram confirmados com testes reais. As decisões e a escolha do que corrigir são do responsável do projeto (F24).

## 1. Âmbito e método

| Revisão | Âmbito | Como |
|---|---|---|
| Code Review (Ex. 5.1) | Último incremento: o diff `1679cc6..44f1f11` (correções da revisão do I14, refatoração, documentação) | Skill `code-review` do Claude Code, nível *medium*, com foco em bugs, validações, tratamento de erros e testes em falta |
| Security Review (Ex. 5.2) | Acesso a projetos e tarefas (IDOR / Broken Access Control), exposição de dados, secrets e validação | Agente separado, só de leitura, com o prompt de apoio da ficha: mapa de todas as rotas → verificação de autorização, ids no caminho, na query e no corpo, respostas, `git grep`/`git log -S` para secrets |
| Autorização entre dois utilizadores (Ex. 5.2) | Projeto e tarefa da Equipa Beta | Teste E2E `SEC-01` com duas sessões reais do Keycloak (`bruno` e `rui`) — §3 |
| Análise estática (Ex. 5.3) | Dependências e tipos | `npm audit` e `npm audit --omit=dev`; `tsc --noEmit` (TypeScript *strict*) no backend e no frontend. ESLint, Semgrep e SonarQube **não estão configurados** no projeto (decisão: não acrescentar dependências para isso) |

**Confirmação dos achados (Ex. 5.3).** Um achado só passa a «confirmado» com evidência observada: ou no código, com a linha e o motivo, ou em execução. Para os que precisavam de execução, correu-se um teste temporário contra a base de testes isolada (`matriz_test`), não versionado, com os resultados abaixo. Os restantes ficam como «suspeita» ou «risco de desenho».

## 2. Achados e decisões

Severidade: Alta / Média / Baixa. Estado: **Corrigido** (com teste de regressão), **Pendente** (registado, sem correção agora) ou **Sem ação**.

| ID | Achado | Evidência | Sev. | Confirmação | Decisão | Estado | Teste de regressão |
|---|---|---|---|---|---|---|---|
| S1 | Quem sai de uma equipa mantinha acesso (ver, bloquear, mudar o estado) às tarefas da equipa que lhe continuavam atribuídas | `access.service.ts` dava o papel de membro a qualquer responsável; `replaceMemberships` não mexe nas atribuições. Em execução: membro retirado da equipa → `GET /tasks/{id}` **200**, bloquear **200** (o projeto, 403) | Média | Confirmado (execução) | 1a: só a atribuição por exceção (RN03) dá esse acesso — a tarefa guarda a marca `assignee_cross_team`; quem sai da equipa perde o acesso; a atribuição mantém-se (RN15) e o líder atribui de novo | Corrigido | `quality-review.e2e-spec.ts` «S1» |
| S2 | O responsável de outra equipa podia editar o título, a descrição e as estimativas (que entram na capacidade da equipa) e listar os membros da equipa — mais do que a nota F23 da §3.1 | Em execução: `PATCH {title}` **200**, `PATCH {estimateHours: 99}` **200**, `GET eligible-users` **200** | Baixa | Confirmado (execução) | 2a: só o estado, os critérios, os bloqueios e os comentários | Corrigido | «S2» |
| S3 | Os alertas mostravam o título, o estado e o motivo do bloqueio atuais de uma tarefa que o destinatário deixou de ver (contorna a CAT06) | Em execução: depois de deixar de estar atribuído, `GET /tasks/{id}` **403** mas `GET /alerts` devolvia `task.title` | Baixa | Confirmado (execução) | Corrigir: o alerta mantém-se, com `task: null` | Corrigido | «S3» |
| S4 | Um líder pode criar um projeto (D48) e associar-lhe qualquer equipa ativa, sem acordo dessa equipa; passa a ver o planeamento dela (datas das sprints, capacidade agregada, nomes dos membros). Os totais da capacidade incluem tarefas de projetos que um gestor de fora da equipa não vê (só números agregados) | `projects.service.ts` (`addTeam` só verifica se a equipa está ativa) | Baixa | Risco de desenho, coerente com a especificação (§3.1, D48, F20) | Registar | Pendente | — (depois de uma decisão) |
| S5 | `?page=1e21` → **500** (o OFFSET ultrapassa o `bigint`) | Em execução: `/projects`, `/projects/{id}/tasks`, `/alerts` → **500** | Baixa | Confirmado (execução) | Corrigir: máximo 100000 → 400, também no contrato | Corrigido | «S5» |
| S6 | Títulos de objetivos e épicos e descrições de critérios sem limite de tamanho | `ElementInputDto`, `CriterionInputDto` sem `MaxLength`; colunas `text`; contrato só com `minLength` | Baixa | Confirmado (código) | Precisa de valores novos na especificação (RN42) | Pendente | — |
| S7 | O realm de desenvolvimento tem um cliente público com *password grant* (`matriz-dev-cli`) e sem proteção contra força bruta | `keycloak/realm-matriz.json` | Baixa | Confirmado (configuração; só desenvolvimento) | Registar; não usar este realm fora do desenvolvimento | Pendente | — |
| CR1 | Planear uma tarefa e transferi-la ao mesmo tempo podia entrar em *deadlock* (500): o planeamento bloqueava a sprint e depois a tarefa; a transferência, a tarefa e depois a sprint | `sprints.service.ts` `planTask` vs `releaseTransferred` | Média | Confirmado (código; a mutação com a ordem antiga faz o teste falhar) | Corrigir: o planeamento bloqueia primeiro a tarefa | Corrigido | «CR1» |
| CR2 | A correção 4a (leituras na transação) estava incompleta: `projectNames` ainda usava outra ligação na capacidade e no planeamento | `capacity.service.ts`, `sprints.service.ts` | Média | Confirmado (código) | Corrigir | Corrigido | Sem teste direto (o esgotamento do pool não é reproduzível de forma fiável); coberto pelos testes de capacidade e de alertas |
| CR3 | = S2 | | | | | | |
| CR4 | Eliminar uma tarefa com N subtarefas verificava a sobrecarga N+1 vezes | `alerts.service.ts` + evento `deleted` das subtarefas | Baixa | Confirmado (código) | Corrigir (eficiência) | Corrigido | Comportamento coberto por `tasks.e2e-spec.ts` (CA03.17) e `review-fixes.e2e-spec.ts` (correção 7) |
| CR5 | Faltava teste: o administrador que também é membro não gera o alerta RN09 | `alerts.service.ts` | Baixa | Teste em falta | Acrescentar o teste | Corrigido | «CR5» |
| CR6 | Uma consulta de participantes por tarefa na transferência | `tasks.service.ts` `transfer` | Baixa | Confirmado (código) | Corrigir (uma só consulta) | Corrigido | Coberto por `review-fixes.e2e-spec.ts` (correção 3) |
| CR7 | A mensagem do 409 da atribuição afirmava «a equipa mudou» mesmo quando a causa podia ser outra (p. ex. o utilizador saiu da equipa) | `tasks.service.ts` | Baixa | Confirmado (código) | Mensagem neutra | Corrigido | `review-fixes.e2e-spec.ts` «Correção 6» (verifica a mensagem) |
| CR8 | As funções de permissões do frontend (`current-user.ts`) não têm testes | — | Baixa | Teste em falta | Exige mover as funções para um módulo testável sem dependências | Pendente | — |
| CR9 | `projectScope` repete consultas a cada vista de planeamento | — | Baixa | Eficiência | — | Pendente | — |
| CR10 | Depois de uma transferência, o frontend invalida todas as vistas de planeamento, não só as das duas equipas | — | Baixa | Eficiência | — | Pendente | — |

**Correção feita durante a correção.** O primeiro teste da S2 encontrou um defeito na própria correção: retirar o responsável (`assigneeId: null`) dava **500**, porque a nova restrição da base (`assignee_cross_team` só com responsável) era verificada antes de a marca ser apagada. Corrigido no mesmo `UPDATE` (a marca só se mantém se o responsável não mudar) e coberto pelos testes «S2» e `review-fixes` «Correção 1».

**Testes de mutação.** Cada correção foi desfeita de propósito e o teste respetivo falhou (8 mutações, 8 apanhadas): a exceção sem a marca (S1), editar tudo e listar os membros (S2), o alerta sem filtro (S3), a página sem máximo (S5), a ordem antiga dos bloqueios (CR1), o administrador a gerar o alerta (CR5) e a marca que não sai ao mudar o responsável.

## 3. Autorização entre dois utilizadores de demonstração (IDOR)

**Teste automático `e2e/access-control.spec.ts` (SEC-01)**, com sessões reais do Keycloak em dois contextos de browser:

1. `bruno` (líder da Equipa Beta) entra e obtém, pela API, os ids do projeto «Arquivo Digital» e de uma tarefa.
2. `rui` (membro da Equipa Alfa) entra noutro contexto. O projeto não aparece nas listagens nem nas pesquisas dele.
3. Com os ids do Bruno, o Rui tenta 12 operações: consultar, alterar e eliminar o projeto; listar as suas tarefas; criar uma tarefa nele; consultar, alterar, mudar o estado e eliminar a tarefa; consultar e criar comentários; consultar os participantes. Todas → **403**, e nenhuma resposta contém o título da tarefa.
4. Pela interface, os endereços diretos da tarefa e do projeto mostram «Não tem acesso a esta tarefa.» e «Não tem acesso a este projeto.».
5. O Bruno confirma no fim que a tarefa e o projeto ficaram iguais.

Controlo negativo: com o próprio Bruno no papel do «outro» utilizador, o teste falha (vê o projeto), o que mostra que o teste deteta acesso indevido. Na Ficha 03 fez-se a mesma verificação à mão (12 pedidos com o token real do Rui; `verification.md`, caso 08).

**Testes de integração** que cobrem o mesmo risco em todos os recursos: os testes «§3.1» e «Ex. 8 (caso 08)» de cada ficheiro (`projects`, `tasks`, `comments`, `assignment-participants`, `sprints`, `capacity`, `alerts`…) e as correções S1–S3.

**Mapa de rotas.** A revisão de segurança percorreu as 52 rotas: todas têm uma verificação adequada ao recurso, e os ids no corpo (`teamId`, `epicId`, `parentTaskId`, `assigneeId`, `userId`, `taskId`, `targetTeamId`) são verificados contra quem pede, no guarda ou dentro da transação do serviço. Não foi encontrado nenhum IDOR de severidade alta.

## 4. Exposição de dados, secrets e dependências

- **E-mails:** só em `/me` (o próprio) e `/users` (administrador). Nas outras respostas, só `{id, name}`.
- **Capacidade individual:** segue a SEC07.
- **Erros 500:** sem detalhes internos.
- **Secrets:** nenhum. `git grep` e `git log --all -S` por palavras-passe, tokens, chaves privadas e JWT só encontram exemplos e documentação; o `.env` nunca foi versionado; o realm não tem credenciais; o frontend só lê valores públicos (`VITE_OIDC_*`); os testes E2E leem a palavra-passe das contas fictícias do `.env` local.
- **SQL:** todas as consultas são parametrizadas. As únicas interpolações são constantes do código (`DONE_STATES_SQL`, listas de colunas) e o fuso horário, validado por expressão regular.
- **`npm audit`:** sem vulnerabilidades altas ou críticas.

| Âmbito | Resultado | Avaliação |
|---|---|---|
| Produção (`--omit=dev`) | 3 moderadas, todas através do `typeorm` 0.3 (`glob`, `minimatch`) | Os padrões *glob* vêm da configuração (caminhos das entidades e das migrations), não de pedidos: não exploráveis por um utilizador. A correção exige o `typeorm` 1.x (incompatível). **Pendente.** |
| Desenvolvimento | 20 (5 baixas, 15 moderadas) — cadeia do Jest, `@nestjs/cli`, `ts-jest` | Só no ambiente de desenvolvimento |

O `package-lock.json` não é versionado (decisão do humano), por isso o resultado do `npm audit` depende das versões resolvidas em cada instalação.

## 5. Verificações executadas e por validar

**Executadas:**
- os comandos da §1;
- o teste temporário de confirmação de S1, S2, S3 e S5;
- os testes de regressão (`quality-review.e2e-spec.ts`, 6 testes);
- as mutações;
- a suite completa: 227 testes de backend (unitários e de integração) e 29 de frontend;
- os 2 testes E2E.

**Por validar:**
- o esgotamento real do pool de ligações (CR2);
- os cabeçalhos de segurança, TLS e limitação de pedidos no proxy (architecture.md §8);
- se a consola de conta do Keycloak deixa um utilizador mudar o e-mail para um já verificado (risco para a ligação de contas por e-mail, RN35);
- o comportamento do Keycloak sob força bruta;
- pedidos com chaves repetidas ou em lista no corpo e na query (analisado no código, não executado).
