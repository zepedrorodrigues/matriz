# Matriz — Revisão crítica do Specification Pack

> **Data:** 2026-10-29 · **Âmbito:** Specification Pack v0.1 (Ficha PL 01, Ex. 6) e Architecture Pack (Ficha PL 02, Ex. 5) · **Resultado:** Specification Pack v0.2 (1.ª ronda), v0.3 (2.ª ronda), v0.4 (3.ª ronda) e v0.5 com o Architecture Pack revisto (§3)
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
