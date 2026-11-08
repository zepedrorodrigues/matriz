# Matriz — Revisão crítica do Specification Pack

> **Data:** 2026-10-29 · **Âmbito:** Specification Pack v0.1 (Ficha PL 01, Ex. 6), Architecture Pack (Ficha PL 02, Ex. 5) e conciliação com a Ficha PL 03 (Ex. 1) · **Resultado:** Specification Pack v0.2 (1.ª ronda), v0.3 (2.ª ronda), v0.4 (3.ª ronda), v0.5 com o Architecture Pack revisto (§3) e v0.6 (§6)
> **Relacionados:** [`requirements.md`](requirements.md) · [`user-stories.md`](user-stories.md) · [`constraints.md`](constraints.md) · [`architecture.md`](architecture.md) · [`database.md`](database.md) · [`../openapi.yaml`](../openapi.yaml) · [`ui/wireframe.md`](ui/wireframe.md)

Revisão da documentação produzida com apoio de IA, feita por um agente e decidida pelo humano responsável (*human-in-the-loop*). Procuraram-se requisitos ambíguos ou contraditórios, funcionalidades sem justificação, pressupostos apresentados como factos, CA não verificáveis, riscos de segurança e privacidade e inconsistências entre documentos.

Este documento não é normativo: as decisões estão incorporadas nos restantes documentos, onde prevalecem. As referências da 1.ª ronda usam os IDs da v0.2; a renumeração da v0.3 está em `user-stories.md` §5.2.

---

## 1. Problemas e decisões

### 1.1 Pressupostos apresentados como factos

| ID | Problema | Decisão | Registo |
|---|---|---|---|
| F1 | O estado «Confirmado» resulta de validação pela equipa de projeto em representação do cliente; as respostas de origem não estão no repositório. | **Rejeitado** — a validação pela equipa de projeto em representação do cliente equivale a validação pelo cliente. | L02 reformulada |
| F2 | As prioridades P0/P1 não tinham fonte indicada. | Fonte: análise de requisitos, validada pelo cliente. | `requirements.md` — Convenções |
| F3 | Confirmações qualificadas (RN07, RN11, RN12, RN17) davam origem a requisitos totalmente confirmados. | Qualificadores removidos; RF22 passa a referir os estados de RN17. | RN07, RN11, RN12, RF22 |
| F4 | Backlog por equipa e capacidade individual apareciam como Confirmados sem regra de origem. | Confirmados (decorrem das decisões C2 e C5). | RN06, RN21 |
| F5 | P03 (alertas só na aplicação) aparecia como facto no glossário, em RF30 e no CA08.2. | Confirmado: alertas apenas na aplicação no MVP; e-mail e outros canais ficam para o futuro. | RN18; `requirements.md` §8; P03 resolvido |
| F6 | EC02.3 afirmava uma regra firme a partir de um requisito Proposto (RF07). | Regra absoluta: é sempre impedido. RF07 confirmado. | RF07, EC02.3, CA02.7 |
| F7 | «Critérios obrigatórios» (RF23, CA06.4) sugeria critérios opcionais sem fonte. | Todos os critérios têm de estar cumpridos; não existem critérios opcionais. | RN13, RF23, CA06.3, CA06.4 |

### 1.2 Contradições e ambiguidades

| ID | Problema | Decisão | Registo |
|---|---|---|---|
| C1 | Não era claro se a atribuição a alguém de outra equipa muda a equipa da tarefa. | A equipa só muda por transferência explícita (gestor de projeto ou administrador); atribuir a alguém de outra equipa, ou a mudança de equipa de quem executa, não a altera. | RN20, RF14, RF31, CA08.4, CA08.6, CA08.7 |
| C2 | Uma tarefa criada por um membro não tinha equipa definida. | Cada membro pertence a pelo menos uma equipa; a tarefa fica no backlog da sua equipa (escolhe uma, se tiver várias). | RN21, RF04, RF12, CA03.6, CA08.1, CA08.8 |
| C3 | Duas definições de backlog (glossário vs CA04.2). | Adotada a do glossário («não incluído numa sprint ativa»), coerente com RN05 e P01; CA04.2 e CA04.3 reformulados. | Glossário, CA04.2, CA04.3 |
| C4 | Os objetivos diziam "sem ultrapassar a capacidade", mas nenhuma regra o impunha. | A sobrecarga não é impedida, é notificada: na equipa, ao líder e aos membros; individual, ao próprio e ao líder. | RN19, OBJ04, RF21, CA05.8, SEC07 |
| C5 | Capacidade em story points sem requisito que a suportasse. | Capacidade apenas em horas: 8 h por dia útil (segunda a sexta) da data de início à de fim da sprint; equipa = soma dos membros; ajustável por sprint. Os story points são apenas estimativa. | RN06, R02, RF19, CA05.1, CA05.5–CA05.7; D02 resolvido |
| C6 | A relação entre projeto e hierarquia de trabalho não estava definida. | Cada elemento pertence a um único projeto, herdado do superior; os objetivos são o topo; a equipa responsável tem de estar associada ao projeto. | RN23, RF05, RF10, CA01.2, CA02.1–CA02.4, CA03.7 |
| C7 | Subtarefas sem regras próprias. | Uma subtarefa é uma tarefa dentro de outra. Estimativa temporal da tarefa = soma das subtarefas; a conclusão da tarefa não depende das subtarefas; as subtarefas podem estar noutra sprint. | RN22, CA02.4, CA03.8, EC06.4; D28–D30 |
| C8 | Não era claro quem cria projetos. | Administrador e gestor de projeto criam e gerem projetos; as equipas são do administrador, que tem permissões de administração adicionais. | RN25, papéis, RF01, RF02, CA01.2, CA01.6 |

### 1.3 Funcionalidades sem justificação

| ID | Problema | Decisão | Registo |
|---|---|---|---|
| J1 | A US07 estava no MVP com todos os requisitos Propostos. | Todos os requisitos Propostos já tinham sido aprovados: RF, RNF, SEC e recomendações de âmbito passam a Confirmado. | `requirements.md` §5–§8, `constraints.md` §3 |
| J2 | Requisitos sem CA (RF01/RF02 editar e consultar, RF04, RF07, RF29). | CA acrescentados. | CA01.6–CA01.9, CA02.7, CA07.6 |

### 1.4 CA não verificáveis

| ID | Problema | Decisão | Registo |
|---|---|---|---|
| V1 | CA classificados como verificáveis, mas dependentes de decisões (CA06.3, CA08.1, CA04.2, CA05.3–CA05.5). | Reclassificados; CA04.2 e CA05.x passaram a verificáveis com C3 e C5. | `user-stories.md` §4 |
| V2 | Resultados não observáveis (CA01.1, CA01.2, CA02.1, CA03.1, CA04.4, CA06.5, CA07.2). | Reescritos com resultado observável. | CA respetivos |
| V3 | A regra "usar o papel da US" era circular na US02. | Os testes usam o utilizador principal do resumo do backlog. | `user-stories.md` — Como ler |
| V4 | Casos excecionais "Por definir" sem decisão pendente associada. | Atribuídas as decisões D22–D27; EC02.2 e EC05.1 resolvidos. | `constraints.md` §4 |

### 1.5 Segurança e privacidade

| ID | Problema | Decisão | Registo |
|---|---|---|---|
| S1 | Nenhum requisito de segurança confirmado nem testado. | SEC01–SEC09 confirmados; criados critérios transversais. | CAT01–CAT05 |
| S2 | Não estava definido quem define e altera critérios de aceitação. | Define quem cria a tarefa; após «A desenvolver», só líder ou gestor de projeto, com registo. Membros registam apenas o cumprimento. | RN24, CA06.7–CA06.9, SEC03 |
| S3 | O motivo de bloqueio (texto livre) podia registar motivos de indisponibilidade. | SEC06 aplica-se ao motivo de bloqueio e a qualquer texto livre. | SEC06, RF29 |
| S4 | Sem retenção definida para os registos de auditoria; conflito potencial entre histórico inalterável e direito de retificação. | Âmbito de D21 alargado; decisão continua pendente. | SEC09, D21 |

### 1.6 Inconsistências entre documentos

| ID | Problema | Decisão | Registo |
|---|---|---|---|
| I1 | A precedência do README colocava CA de requisitos Propostos acima desses requisitos. | Precedência por estado e, dentro do Confirmado, RN > requisitos > US/CA. | `README.md`, `AGENTS.md` |
| I2 | CA06.6 e RF25 (P0) dependem da transferência (US08, P1). | Dependência assinalada para o desenvolvimento. | `user-stories.md` §1, RF25 |
| I3 | O número inicial de utilizadores (QT06) foi referido mas não registado. | Resolvido na 2.ª ronda: 100 utilizadores iniciais. | RNF06 |
| I4 | A US07 não indicava regras de negócio. | Acrescentadas. | US07 |

### 1.7 Segunda ronda

| ID | Questão | Decisão | Registo |
|---|---|---|---|
| C5 | Contagem dos dias da sprint. | Confirmado: dias úteis, de segunda a sexta. | RN06 |
| P05 | Pressuposto sobre capacidade disponível, trabalho planeado e realizado. | Confirmado como resolvido pelos requisitos RF19, RF20 e RF27. | `constraints.md` §4.3 |
| D28–D30 | Subtarefas: story points, equipa e capacidade. | Story points = soma das subtarefas; a subtarefa tem sempre a equipa da tarefa principal e é transferida com ela; na capacidade contam só as subtarefas, cada uma na sua sprint. | RN22, CA02.8, CA03.8, CA05.9, CA09.5 |
| D31 | Feriados na capacidade. | Não são descontados automaticamente; ajusta-se a disponibilidade. | RN06 |
| D20 | Requisitos não funcionais quantitativos. | 100 utilizadores (até 500), ≤ 2 s em 95 % das operações, 99 % em horário de trabalho, pt-PT, computador, WCAG 2.1 AA. | RNF06, RNF08–RNF12 |
| D14 | Matriz de permissões. | Papéis fixos e acumuláveis; administrador global, gestor por projeto, líder e membro por equipa; visibilidade por participação. | `requirements.md` §3.1, CAT05, CAT06 |
| US08 | A US juntava dois papéis e dois objetivos. | Dividida em US08 (propor trabalho) e US09 (atribuir e transferir entre equipas). | `user-stories.md` §2, §5.2 |

### 1.8 Terceira ronda (preparação da Ficha PL 02)

Todas as decisões pendentes foram propostas pelo agente e aprovadas pelo humano, com uma alteração (D05).

| ID | Decisão | Registo |
|---|---|---|
| DT02–DT08 | PostgreSQL; monólito modular com API REST/OpenAPI 3.1; OpenID Connect; aplicação web para computador (móvel no futuro); contentores na UE; alertas na base de dados, criados na mesma transação e consultados periodicamente; um teste automático por CA. | `constraints.md` §4.3 |
| DT01 | TypeScript (NestJS + React), depois de uma comparação com Go e Rust pedida pelo humano. Rust descartado (custo desproporcionado); Go viável, mas com duas linguagens. Escolhido para simplificar deployments e atualizações de versões. | `constraints.md` §4.3 |
| DT09, DT10 | Revisões futuras planeadas: peso dos alertas na base de dados; extração de módulos para microservices quando houver sinais concretos (o número de utilizadores, por si só, não obriga). | `constraints.md` §4.2 |
| D05 | Reabertura → «A desenvolver». **Alterado pelo humano** (a proposta era «Em análise técnica»). | RN26 |
| D01, D03, D04, D06–D13, D15–D19, D21–D27 | Aprovados como propostos. | RN03–RN12, RN20, RN26–RN33, SEC09; `constraints.md` §4.3 |
| P01, P02, P04, P07, P11 | Confirmados. P08 **rejeitado** (RN27). | `constraints.md` §4.3 |
| P12 | Novo: a política de retenção (SEC09) carece de validação jurídica. | `constraints.md` §2 |
| D32 | Nova: equipa sem líder. Resolvida: uma equipa ativa tem sempre pelo menos um líder. | RN34, CA01.12 |
| CA | 16 CA novos para os comportamentos criados pelas decisões; os 19 CA dependentes passaram a verificáveis. | `user-stories.md` |

### 1.9 Decisões durante a elaboração do Architecture Pack (Ficha PL 02, Ex. 1–4)

Propostas pelo agente ao elaborar os artefactos e decididas pelo humano.

| ID | Decisão | Registo |
|---|---|---|
| ADR-001 | Monólito modular com seis módulos; eventos de domínio internos entregues na mesma transação; erros no formato RFC 9457; o Planeamento é dono do planeamento tarefa–sprint e da estimativa no início da sprint. Aprovado. | `architecture.md` §3, §5–§7 |
| DT06 | **Alterado pelo humano:** pelo menos duas imagens de contentor, uma para o frontend e outra para o backend. | `constraints.md` §4.3, `architecture.md` §8 |
| DT11–DT13 | Novas revisões futuras, pedidas pelo humano: gestão de eventos e plataforma de eventos (p. ex. Kafka), gestão de erros, alta disponibilidade. | `constraints.md` §4.2, `architecture.md` §9 |
| P06 | Confirmado pelo humano: equipas e projetos em relação N:M. | `constraints.md` §2, `database.md` |
| D33, D34 | O líder conta para a capacidade da equipa; as contas são criadas pelo administrador a partir do e-mail profissional. Identificadas ao modelar os dados. | RN06, RN35 |
| D35 | Identificada ao desenhar a API: uma tarefa transferida sai da sprint da equipa de origem e passa para o backlog da equipa de destino. | RN20, CA09.8 |

## 2. Critérios de validação (Ficha PL 01)

| Critério | Estado | Evidência |
|---|---|---|
| O MVP está claramente definido. | Cumprido | `requirements.md` §7–§8; todos os requisitos do MVP confirmados. |
| Existem pelo menos 5 User Stories. | Cumprido | 9 US (`user-stories.md` §2). |
| Existem critérios de aceitação verificáveis. | Cumprido | 86 de 86 CA verificáveis (`user-stories.md` §4). |
| Os pressupostos estão separados dos requisitos confirmados. | Cumprido | `constraints.md` §2; pressupostos resolvidos em §4.3. |
| A documentação apresenta consistência. | Cumprido | Problemas C, I e V corrigidos. |
| O AGENTS.md contém instruções claras e adequadas. | Cumprido | `AGENTS.md`. |
| Foram analisadas criticamente as respostas da IA. | Cumprido | Este documento. |
| O projeto está preparado para a próxima fase. | Cumprido | Requisitos não funcionais quantitativos (D20) e matriz de permissões (D14) definidos na 2.ª ronda; as decisões técnicas DT01–DT06 têm agora as entradas de que dependem. |

## 3. Revisão cruzada do Architecture Pack (Ficha PL 02, Ex. 5)

O agente comparou requisitos, arquitetura, modelo de dados, API e wireframe à procura de omissões e contradições, e apresentou as conclusões com propostas. Nenhuma alteração foi aplicada sem decisão do humano.

### 3.1 Omissões: decisões funcionais

As três primeiras foram encontradas ao validar o wireframe: o agente tinha desenhado ações que nenhum requisito definia e retirou-as (`ui/wireframe.md` §3).

| ID | Omissão | Proposta do agente | Decisão do humano | Registo |
|---|---|---|---|---|
| D36 | Como e por quem se inicia uma sprint. | — (perguntado ao humano) | Início manual. A primeira resposta («administrador ou gestor») contrariava a matriz de permissões, em que só o líder gere sprints, e o gestor é de um projeto, não da equipa; reportado ao humano, que decidiu: **líder de equipa ou administrador**. | RN36, §3.1, CA04.5, CA04.9–CA04.11 |
| D37 | Alteração das datas de uma sprint (RF15 só previa a criação). | Alteráveis enquanto «Planeada» e no momento do início; depois, não. | Aceite. | RN36, RF15, CA04.12, CA04.13 |
| D38 | Retirar uma tarefa de uma sprint (RF16 só previa planear). | Pelo líder. Numa sprint ativa, a tarefa volta ao backlog, fica registada e continua a contar como planeada no início. | Aceite. O humano sublinhou que retirar uma tarefa de uma sprint ativa revela que se planeou mais do que a capacidade permitia, e que isso deve ficar visível. | RN37, RF16, RF27, CA04.14, CA04.15, CA07.2 |
| D39 | Com o início manual, como termina a sprint. | Automaticamente, no fim do dia da data de fim. | Aceite. | RN36, RF17, CA04.4 |
| D40 | Acrescentar tarefas a uma sprint já iniciada. | Permitido ao líder, com a tarefa identificada como acrescentada depois do início. | Aceite. | RN37, RF16, CA04.16 |

### 3.2 Contradições e omissões entre artefactos

Todas aprovadas pelo humano.

| ID | Problema | Correção | Registo |
|---|---|---|---|
| I1 | A D35 obriga a transferência (módulo Trabalho) a retirar a tarefa da sprint (módulo Planeamento), mas o Trabalho não depende do Planeamento e o evento *tarefa transferida* só era subscrito pelo Acompanhamento e pelo Histórico. | O Planeamento subscreve *tarefa transferida*, na mesma transação; o sentido das dependências mantém-se. | `architecture.md` §5, §6 |
| I2 | O modelo de dados não registava a saída de uma tarefa a meio da sprint (D35, D38) nem o início e o fim da sprint. | `sprint.started_at`, `sprint.closed_at`; `sprint_task.left_at` e `left_reason` em vez de `returned_to_backlog_at`. Ao corrigir, o agente verificou que o índice único parcial previsto para «uma tarefa em no máximo uma sprint em aberto» não o podia garantir, porque o estado da sprint está noutra tabela; a regra passou para a aplicação. | `database.md` §2.4, §4–§6 |
| I3 | A resposta da transferência não mostrava o efeito da D35. | Campo `removedFromSprintId`, que pode ser nulo. | `openapi.yaml` (v0.2.0) |
| I4 | A tarefa diária só verificava prazos. | Passa também a terminar as sprints (D39). | `architecture.md` §4, §7, §8 |
| I5 | O wireframe não tinha as ações sobre a sprint. | Repostas «Editar datas», «Iniciar sprint» e «↩ Backlog», coerentes com D36–D38. Ao rever as posições, o agente corrigiu também uma sobreposição entre o motivo de bloqueio e o indicador «Bloqueada». | `ui/wireframe.svg`, `ui/wireframe.md` |
| I6 | Este documento não registava as decisões da Ficha PL 02. | §1.9 e §3. | Este documento |

### 3.3 Verificações

| Verificação | Resultado |
|---|---|
| Contagem dos CA por script | 97 CA (91 nas US e 6 transversais), todos verificáveis. |
| Referências a IDs e campos removidos (`returned_to_backlog_at`, «por decidir») | Nenhuma referência pendente. |
| SVG do wireframe | XML válido (agente); renderização confirmada pelo humano. |
| `openapi.yaml` | Não validado com um parser pelo agente (sem dependências novas); o humano verifica o contrato. |
| Diagramas Mermaid | Renderização confirmada pelo humano. |

### 3.4 Alta disponibilidade (DT13)

Pedida pelo humano depois da revisão cruzada. O agente analisou as falhas possíveis face à margem de RNF09 (cerca de 2,5 h de indisponibilidade por mês em horário de trabalho) e propôs três opções: A — uma instância e cópias de segurança; B — duas instâncias do backend, réplica e cópias de segurança; C — cluster com mudança automática em várias zonas.

| Decisão | Registo |
|---|---|
| Opção B, com duas variantes conforme o fornecedor: mudança automática para a réplica numa cloud, manual em infraestrutura interna. | DT13 (`constraints.md` §4.3), `architecture.md` §7–§9 |
| Objetivos de recuperação: RPO 5 min, RTO 1 h. | RNF13 |
| Cópias de segurança conservadas durante 30 dias, proposto pelo agente e aceite. | DT13 |

## 4. Critérios de validação (Ficha PL 02)

| Critério | Estado | Evidência |
|---|---|---|
| A arquitetura está justificada e é adequada ao MVP. | Cumprido | `architecture.md` §1–§3: características determinantes, comparação de três estilos e ADR-001. |
| O modelo de dados identifica as principais entidades e relações. | Cumprido | `database.md` §2–§3: 15 tabelas em seis schemas, com relações e cardinalidades. |
| O diagrama ER é coerente com o modelo. | Cumprido | `database.md` §4, revisto com o modelo (I2); renderização confirmada pelo humano. |
| A especificação OpenAPI tem pelo menos duas operações REST. | Cumprido | `openapi.yaml`: `GET /sprints/{sprintId}/capacity` e `POST /tasks/{taskId}/transfer`. |
| Existe um wireframe de um ecrã relevante. | Cumprido | `ui/wireframe.svg` e `ui/wireframe.md`: planeamento e capacidade da sprint, validado face ao MVP. |
| Os pressupostos e as decisões pendentes estão identificados. | Cumprido | `constraints.md` §2 e §4; `architecture.md` §10; `database.md` §6; D33–D40 decididas pelo humano. |
| Os artefactos foram revistos e versionados em Git. | Cumprido | Este documento (§1.9, §3) e o histórico Git. |

## 5. Pendente após a revisão

- **P12:** validação jurídica da política de retenção. Mantida em aberto pelo humano: não é relevante no âmbito do projeto; necessária antes de uma entrada em produção.
- **Revisões futuras:** DT09 (alertas na base de dados; até lá, sem apagar nem arquivar alertas, por decisão do humano), DT10 (extração para microservices), DT11 (gestão de eventos) e DT12 (gestão de erros).

## 6. Conciliação com o âmbito da Ficha PL 03 (Ex. 1)

O agente comparou o âmbito funcional da Ficha PL 03 com o MVP aprovado e reportou as diferenças antes de qualquer implementação. O humano decidiu cada ponto.

| # | Diferença | Proposta do agente | Decisão do humano | Registo |
|---|---|---|---|---|
| F1 | A ficha pede projetos, tarefas, responsáveis, comentários, pesquisa e painel; o MVP tem 9 US. | Mínimo da ficha sobre o modelo da Matriz; restantes US em incrementos posteriores. | **Diferente da proposta:** MVP completo, com as extensões da ficha. | D41 |
| F2 | Início de sessão local vs. OIDC com o fornecedor da empresa (DT04). | Login local como "fornecedor local" da DT04. | **Diferente da proposta:** OIDC real, com Keycloak local. | DT04, DT15 |
| F3 | A ficha pede eliminar projetos e tarefas; o MVP não previa eliminação e o histórico é inalterável. | Eliminação lógica. | Aceite. | RN38, D42 |
| F4 | Estados TODO/IN_PROGRESS/DONE e prioridade, que o MVP não tinha. | Manter os 7 estados e acrescentar a prioridade. | Aceite. | RN39, D43 |
| F5 | Vários responsáveis por tarefa vs. um responsável pela execução (RN15), base da capacidade. | Um responsável pela execução e vários participantes. | Aceite. | RN40, D44 |
| F6 | Comentários, inexistentes no MVP. | RF e US novos. | Aceite. | RN41, RF35, US10, D45 |
| F7 | Limites dos campos e paginação não definidos. | Limites do exemplo da ficha; paginação com total. | Aceite. | RN42, D46 |
| F8 | Ecrãs da ficha diferentes do wireframe aprovado. | Seguir a navegação e a linguagem visual do wireframe. | Aceite. | D47 |
| F9 | Bibliotecas por escolher. | Drizzle para o acesso à base de dados; restantes como em DT14. | **Alterado:** TypeORM; restantes aceites. | DT14 |
| F10 | Sem PostgreSQL nem Docker na máquina de desenvolvimento. | PostgreSQL 17 instalado com o winget. | Aceite. | DT15 |
| F12 | Quem cria projetos: RN25 e C8 indicavam «administrador e gestor de projeto», mas o gestor é um papel obtido ao criar o projeto (circular). Identificada no plano do I2. | Administrador e quem já gere um projeto. | **Diferente da proposta:** administrador e líderes de equipa; quem cria passa a ser gestor, sem associação automática de equipas. Na edição, um objetivo vazio remove o objetivo (fica nulo). A criação e a edição de projetos também ficam no histórico (RN32). | RN25, D48, CA01.2 |
| F11 | O Ex. 2 pede o esquema de utilizadores, projetos, tarefas, comentários e atribuições; o plano criava as tabelas do módulo Trabalho só nos incrementos I4, I6 e I7. Identificada depois do I0. | Migration do módulo Trabalho no I0, conforme database.md §2.3, e tarefas no seed; I4, I6 e I7 só acrescentam o código. | Aceite (2026-11-04). | implementation-plan.md §6 |
| F13 | O Ex. 5 pede alterar o estado das tarefas, que o plano deixava no I5 com os critérios de aceitação; a matriz (§3.1) não dizia quem edita o título e a descrição; o CA03.3 (responsável pela execução) estava no I4 e os utilizadores elegíveis no I6. Identificada no plano do I4. | Estado no I4 com todas as regras de RN26, RN27 e RN13, e critérios no I5; edição pelo administrador, gestor e líder; CA03.3 no I6. | **Aceite, com uma diferença:** editam o título e a descrição o administrador, o gestor e qualquer membro da equipa responsável (D49). | RN26, D49, CA03.3 |
| F14 | Lacunas identificadas no plano do I5: (1) «depois de entrar em A desenvolver» (RN10, RN24, CA03.10, CA06.8) não dizia o que acontece quando a tarefa recua de estado; (2) RN24 diz que os critérios são «definidos por quem cria a tarefa» e que «os membros registam apenas o cumprimento», sem dizer quem os altera antes de «A desenvolver»; (3) numa tarefa com subtarefas, a estimativa é a soma das subtarefas (RN22), sem regra para quem a tenta definir diretamente; (4) acrescentar um critério ou desmarcar o cumprimento numa tarefa «Terminada» ou «Entregue» contrariava RN13; (5) o CA03.6 (atribuições não autorizadas) estava no I5, mas trata do responsável e da equipa. | (1) Conta o estado atual: a proteção vale em «A desenvolver», «Em testes», «Terminada» e «Entregue»; (2) definem e alteram os critérios o administrador, o gestor, o líder da equipa responsável e, antes de «A desenvolver», quem criou a tarefa; (3) 422, a estimativa altera-se nas subtarefas; (4) 409, a tarefa tem primeiro de recuar de estado (alterar só o texto continua permitido ao líder, ao gestor e ao administrador); (5) CA03.6 no I6. | Aceite (2026-11-05). | RN10, RN13, RN22, RN24, openapi.yaml, implementation-plan.md §4 |
| F15 | Lacunas identificadas no plano do I6: (1) o código de erro de uma atribuição a alguém fora da equipa responsável (CA03.15, CA09.6 dizem só «recusada»); (2) se o responsável pela execução pode ser também participante; (3) se o líder remove um participante de outra equipa associado por um gestor (§3.1: «só a sua equipa»); (4) o `TaskCreate` tem `assigneeId`, mas não tem justificação. | (1) 422 — utilizador não elegível ou justificação em falta; (2) sim, são associações independentes; (3) sim, a tarefa é da sua equipa — só associar alguém de fora exige gestor ou administrador; (4) na criação, só um membro da equipa responsável; alguém de outra equipa atribui-se na edição, com justificação. | Aceite (2026-11-05). | RN03, RN40, CA03.15, CA09.6, openapi.yaml |
| F16 | Identificada no plano do I7: o CA10.5 e o contrato (`addComment`) dizem que um comentário com outro autor indicado é guardado e os outros campos ignorados, mas a API recusa campos desconhecidos (400) em todas as operações. | Seguir o CA10.5 e o contrato: nesta operação, os outros campos são ignorados e o autor vem sempre do token; exceção documentada à regra geral. | Aceite (2026-11-05). | CA10.5, openapi.yaml |
| F17 | Identificada no plano do I8: o Ex. 7 pede o início de sessão com formulário, validação e mensagens de erro, e o formulário do Keycloak estava em inglês (conhecido desde o I1). | Pôr o realm em português (`messages_pt` existe no Keycloak 26.8.1) e aplicar a alteração ao Keycloak local só nas três definições de idioma, pela API de administração. | Aceite (2026-11-05). | keycloak/realm-matriz.json, README |
| F18 | Lacunas identificadas no plano do I3: (1) a soma das alocações é «sempre 100 %» (RN06), o que torna impossível juntar alguém a uma segunda equipa ou criar uma equipa com um líder que já tem outra, com operações por equipa; (2) desativar uma equipa deixa os membros com a soma abaixo de 100 nas equipas ativas; (3) remover a associação de uma equipa a um projeto não tem CA e deixaria tarefas a violar RN23. | (1) Cada alteração às pertenças de um utilizador envia o conjunto completo dessa pessoa numa só operação (`PUT /users/{userId}/memberships`), também na criação da equipa (o líder com as alocações em todas as suas equipas); soma 100 ou conjunto vazio; (2) a soma conta só as equipas ativas; a desativação é permitida, os membros afetados ficam assinalados para realocação e as pertenças mantêm-se para o histórico; sem reativação; (3) fora do I3: só se associa. | Aceite (2026-11-05). | RN06, RN21, RN23, RN33, RN34 |
| F19 | Lacunas identificadas no plano e na implementação do I9: (1) o «fim do dia da data de fim» (RN36) não indicava o fuso horário; (2) o alerta ao líder quando um membro cria uma tarefa (RN09, CA08.2) precisa da tabela e do ecrã de alertas, previstos no I11; (3) o histórico exige um autor (RN32, `author_id NOT NULL`), mas o fim automático da sprint é feito pela tarefa diária, sem pessoa associada. | (1) Europe/Lisbon, configurável em `APP_TIME_ZONE`; (2) CA08.2 no I11; (3) autor nulo, a significar «sistema». | (1) e (2) aceites; **(3) diferente da proposta:** um identificador fixo «Sistema» (`00000000-0000-0000-0000-000000000000`), mantendo `author_id NOT NULL` (2026-11-05). | RN09, RN32, RN36, CA08.2, database.md §2.6, implementation-plan.md §4 |
| F20 | Lacunas identificadas no plano do I10: (1) o alerta de sobrecarga (CA05.8) precisa dos alertas, previstos no I11; (2) a §3.1 dá ao gestor «Consultar a capacidade da equipa», mas o I9 deixou o planeamento só aos membros e ao administrador. | (1) CA05.8 no I11; (2) os gestores dos projetos em que a equipa participa consultam o seu planeamento (sprints, backlog e capacidade), só em leitura e sem dados individuais (SEC07). | Aceite (2026-11-05). | CA05.8, §3.1, SEC07, implementation-plan.md §4 |
| F21 | Lacunas identificadas no plano do I11: (1) a RN29 diz que o prazo «pode ser alterado pelo líder de equipa ou pelo gestor de projeto», sem dizer quem o define na criação nem o papel do administrador; (2) o alerta de sobrecarga (CA05.8) deve sair quando a carga «passa a exceder», o que pode resultar de operações de planeamento e de mudanças nas tarefas; (3) o alerta de prazo ultrapassado (CA07.7) não dizia se se repete; (4) o I11 é o incremento mais largo que resta. | (1) Quem cria indica o prazo; depois alteram-no o líder, o gestor e o administrador, com registo; (2) alerta na passagem de não sobrecarregado a sobrecarregado, por operações de planeamento e por mudanças de estimativa ou de responsável de tarefas numa sprint em aberto (eventos de domínio), sem repetir enquanto durar; (3) um alerta por tarefa e por prazo (coluna `due_date` em `tracking.alert`); (4) dois passos — acompanhamento e alertas. | Aceite (2026-11-05). | RN19, RN29, RN30, CA05.8, CA07.7, database.md §2.5 |
| F22 | Lacunas identificadas no plano do I12: (1) a RN20 não diz o que acontece ao responsável quando a tarefa muda de equipa; (2) a RN22 transfere as subtarefas com a principal, mas a RN20 proíbe transferir tarefas concluídas — e as subtarefas concluídas?; (3) o CA09.2 pede a consulta do histórico, cujo ecrã e API são do I13. | (1) Mantém-se se for membro da equipa de destino; senão a atribuição é retirada e fica no histórico (RN15, CA06.6); (2) passam todas (a subtarefa tem sempre a equipa da principal), mas só as não concluídas saem da sprint — as concluídas ficam na sprint em que foram feitas, como no fim da sprint (RN04); (3) o I12 regista a transferência (`team_transferred`, com a equipa anterior, a nova, a original e o responsável) e mostra a equipa original no Detalhe da tarefa; a consulta do histórico é verificada no I13. | Aceite (2026-11-05). | RN15, RN20, RN22, CA09.2, CA06.6, implementation-plan.md §6 |
| F23 | Plano do I14 (verificação e entrega) e achados da revisão assistida por IA do Ex. 9.1 (skill `code-review` sobre `d68debf..HEAD`): (1) o I13 (consulta do histórico) não faz parte da ficha; (2) que refatoração fazer (Ex. 9.2); (3) como verificar a execução a partir de uma cópia limpa; (4) o responsável de outra equipa (RN03) não conseguia trabalhar na tarefa atribuída, e a matriz §3.1 só fala do «membro (da sua equipa)»; (5) o gestor de um projeto via, no planeamento de uma equipa partilhada (F20), as tarefas de projetos que não gere (CAT06); (6) na transferência, os participantes da equipa de origem ficavam sem registo (RN40, RN32; a F22 só decidiu o responsável); (7) leituras com uma segunda ligação dentro das transações (alertas e outros serviços). | (1) I14 primeiro, I13 depois da ficha; (2) uma só definição de «concluída» (RN26); (3) clonar e seguir o README, sem criar outra base; (4) tem nessa tarefa os direitos do membro, não vê o resto do projeto; (5) só as tarefas dos projetos que vê; (6) mantêm-se e ficam registados; (7) corrigir o caminho dos alertas e registar o resto como limitação. | Aceite (2026-11-05). Também autorizada a secção «Comandos de execução e verificação» do `AGENTS.md` (§6). | RN03, RN26, RN32, RN40, CAT06, §3.1, `verification.md` §5 e §7 |
| F24 | Ficha PL 04, revisões de código e de segurança (`quality-security-review.md`): (1) quem sai de uma equipa mantinha acesso às tarefas que lhe continuavam atribuídas, porque a exceção do responsável de outra equipa (F23) se aplicava a qualquer responsável; (2) esse responsável podia editar o título, a descrição e as estimativas e listar os membros da equipa, mais do que a nota da §3.1; (3) que achados corrigir. | (1) Só a atribuição por exceção (RN03) dá esse acesso — a tarefa guarda a marca (`assignee_cross_team`); quem sai da equipa deixa de ter acesso, a atribuição mantém-se (RN15) e o líder atribui de novo; (2) só o estado, os critérios, os bloqueios e os comentários; (3) corrigir S3, S5, CR1, CR2, CR4–CR7, cada um com teste de regressão; ficam pendentes S4, S6, S7, a atualização do `typeorm` e CR8–CR10. | Aceite (2026-11-05). | RN03, RN15, RN42, CAT06, §3.1, database.md §2.3, `quality-security-review.md` |
| F25 | Análise do I13 (`i13-historico-analise.md`): (1) o SEC04 está documentado como aplicado na base de dados e não está — o role `matriz` é dono do histórico; (2) a §3.1 não diz quem consulta o histórico («utilizador autorizado», CA09.2); (3) os eventos dos critérios e das sprints de uma tarefa estão noutros elementos; (4) os históricos da equipa e da sprint contêm dados individuais de capacidade (SEC07) e referem tarefas de outros projetos (CAT06); (5) o CA01.11 e o CA06.5 também exigem o histórico consultável. | Histórico só da tarefa, agregado com os critérios e as sprints (alternativa D); SEC04 por `REVOKE`; consulta por quem vê a tarefa, exceto o responsável de outra equipa; eliminados fora; CA01.11 depois. | **Diferente da proposta:** histórico de cada elemento (alternativa E, com o CA01.11); equipa e sprint também para os membros e para o gestor dos projetos associados, com os filtros de SEC07 e CAT06; eliminados só para o administrador, por ligação direta. Aceites o `REVOKE` e a exclusão do responsável de outra equipa (2026-11-08). | D50, §3.1, `i13-historico-analise.md` §10 |

**Discrepância reportada depois das respostas:** o Keycloak (F2) precisa de Docker ou de Java 17/21, mas F10 excluía o Docker e só existia o Java 8. O humano decidiu: JDK 21 com a distribuição zip do Keycloak. Decidiu também a forma da sessão (aplicação React com Authorization Code + PKCE e token *bearer*, coerente com `architecture.md` §7) e que o contrato OpenAPI se completa por incremento, antes do código de cada um.

**Propostas do agente, confirmadas pelo humano:** ao redigir as regras novas, o agente propôs que a prioridade seja alterada pelo líder de equipa, pelo gestor de projeto e pelo administrador (RN39) e que os participantes não ganhem permissões sobre a tarefa (RN40). Propôs também três pressupostos do contrato: a listagem de tarefas de um projeto e as contagens do painel não incluem subtarefas; os limites de RN42 contam-se depois de retirar os espaços no início e no fim; um projeto ou tarefa eliminado (RN38), e o que dele depende, responde 404, como um identificador inexistente. O humano confirmou tudo.