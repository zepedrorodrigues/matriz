# Matriz — Requisitos

> **Versão:** 0.1 · **Data:** 2026-10-22 · **Estado:** rascunho para revisão crítica (Ficha PL 01, Ex. 6)
> **Fontes:** descrição inicial do cliente; análise de requisitos assistida por IA (Ex. 1–3).
> **Relacionados:** [`user-stories.md`](user-stories.md) · [`constraints.md`](constraints.md)

## Convenções

| Estado | Significado |
|---|---|
| **Confirmado** | Validado nas respostas às perguntas de clarificação (Ex. 2–3). Prevalece sobre qualquer proposta ou pressuposto. |
| **Proposto** | Derivado pela análise (User Stories, critérios de aceitação, recomendações da IA). Ainda não validado — não tratar como facto. |
| `Dxx` | Decisão pendente que afeta o requisito — ver [`constraints.md`](constraints.md) §4. |
| `Pxx` | Pressuposto assumido — ver [`constraints.md`](constraints.md) §2. |

Prioridades: **P0** — crítica, sem ela o MVP não resolve o problema · **P1** — alta, incluída no MVP numa versão básica · **Futuro** — fora do MVP.

---

## 1. Visão e objetivos

### 1.1 Problema

Pedido inicial do cliente:

> "Precisamos de uma aplicação onde as nossas equipas possam organizar projetos, gerir tarefas e acompanhar o progresso do trabalho."

O cliente não definiu funcionalidades, regras de negócio, requisitos técnicos nem prioridades. Esta especificação resulta da clarificação desse pedido.

### 1.2 Visão

A **Matriz** é uma aplicação interna de gestão de projetos e tarefas (semelhante a Jira, Azure DevOps ou Trello) que permite a cada equipa planear o seu trabalho em sprints de acordo com a sua capacidade, e que dá às lideranças visibilidade sobre o progresso, os desvios e a responsabilidade histórica de cada entrega.

### 1.3 Objetivos

| ID | Objetivo | Suportado por |
|---|---|---|
| OBJ01 | Organizar o trabalho por equipas e projetos, com responsabilidades claras. | US01 |
| OBJ02 | Decompor o trabalho em Objetivos → Épicos → Tarefas → Subtarefas. | US02 |
| OBJ03 | Distribuir e estimar o trabalho, em horas e em story points, como métricas independentes. | US03 |
| OBJ04 | Planear o trabalho de cada equipa em sprints, respeitando a capacidade disponível. | US04, US05 |
| OBJ05 | Garantir que uma tarefa só é dada como cumprida quando satisfaz os critérios de aceitação. | US06 |
| OBJ06 | Dar visibilidade sobre progresso, desvios e alertas. | US07 |
| OBJ07 | Preservar a rastreabilidade: equipa original e responsável pela execução de cada tarefa. | US08 |

## 2. Glossário

| Termo | Definição |
|---|---|
| Equipa | Unidade organizacional que executa trabalho. Tem backlog e sprints próprios (RN01). |
| Projeto | Iniciativa com nome e objetivo, na qual participam uma ou mais equipas. |
| Objetivo · Épico · Tarefa · Subtarefa | Níveis da hierarquia de trabalho, do mais abrangente para o mais concreto (RN12). |
| Backlog | Trabalho de uma equipa ainda não incluído numa sprint ativa. **Não é uma sprint.** |
| Sprint | Período, com data de início e de fim, em que uma equipa executa as tarefas planeadas. |
| Estimativa temporal | Esforço previsto de uma tarefa, em horas. |
| Story points | Estimativa relativa de dimensão e complexidade, numa escala comum (RN07). **Não é convertível em horas** (RN06). |
| Capacidade | Trabalho que uma equipa ou indivíduo pode assumir numa sprint, em horas disponíveis e em story points, sem conversão entre ambos (RN06). |
| Critério de aceitação | Condição verificável que determina se uma tarefa está cumprida (RN13). |
| Responsável pela execução | Indivíduo que executou e entregou a tarefa; permanece identificado no histórico (RN15). |
| Alerta | Aviso apresentado na aplicação a utilizadores com responsabilidade de acompanhamento. |

## 3. Tipos de utilizadores

| Papel | Responsabilidades no MVP | Base |
|---|---|---|
| **Administrador** | Cria e gere equipas e projetos; associa equipas a projetos; pode reatribuir excecionalmente tarefas a alguém de outra equipa. | US01, RN03 |
| **Gestor de projeto** | Gere projetos e a hierarquia de trabalho; cria e atribui tarefas; pode reatribuir excecionalmente tarefas a alguém de outra equipa; acompanha o progresso. | US02, US03, US07, RN03 |
| **Líder de equipa** | Cria, estima e atribui tarefas na sua equipa; gere o backlog, as sprints e a capacidade da equipa; acompanha o progresso. | US03, US04, US05, US07, RN10 |
| **Membro da equipa** | Cria tarefas no backlog, sem as colocar numa sprint; define estimativas; atualiza o estado e os critérios de aceitação das tarefas que lhe estão atribuídas. | US06, US08, RN08, RN10 |

O detalhe das permissões — incluindo o "utilizador com permissões equivalentes" (RN03), o "membro autorizado" (US02) e a possibilidade de um utilizador acumular papéis — está por definir: **D14**.

## 4. Regras de negócio

| ID | Regra | Estado |
|---|---|---|
| RN01 | Cada equipa tem a sua própria sprint. | Confirmado |
| RN02 | Uma tarefa pertence, por defeito, a uma única equipa responsável. | Confirmado — regra geral; exceções em RN03 |
| RN03 | Um gestor de projeto, administrador ou utilizador com permissões equivalentes pode, excecionalmente, atribuir uma tarefa a alguém de outra equipa. | Confirmado — "permissões equivalentes": D14 |
| RN04 | No final de uma sprint, as tarefas não concluídas transitam para o backlog. | Confirmado — o que conta como "concluída": D04 |
| RN05 | As tarefas transitam do backlog para a sprint seguinte quando esta se inicia. | Confirmado — âmbito da transição por definir: D01 |
| RN06 | A capacidade é medida em horas disponíveis e em story points, sem conversão entre as duas unidades. | Confirmado |
| RN07 | A escala de story points é comum, com estimativas fundamentadas em tempo e dificuldade/complexidade. | Confirmado como intenção — escala e procedimento: D10 |
| RN08 | Os membros podem criar tarefas no backlog, mas não as podem adicionar diretamente a uma sprint. | Confirmado |
| RN09 | A criação de uma tarefa por um membro deve alertar os responsáveis relevantes. | Confirmado — destinatários: D07 |
| RN10 | Lideranças e membros podem definir estimativas. | Confirmado — sujeito a permissões: D11, D14 |
| RN11 | Uma tarefa entregue que apresenta problemas não necessita de um estado específico de reparação. | Confirmado como orientação |
| RN12 | A hierarquia de trabalho é Objetivos → Épicos → Tarefas → Subtarefas. | Confirmado como modelo conceptual — D06, D13 |
| RN13 | Os critérios de aceitação determinam se uma tarefa está cumprida. | Confirmado — tarefas sem critérios: D08 |
| RN14 | As tarefas históricas permanecem associadas à equipa original, mesmo após migração para outra equipa. | Confirmado |
| RN15 | O responsável pela execução e entrega permanece identificado no histórico. | Confirmado |
| RN16 | O MVP destina-se inicialmente à utilização interna da empresa. | Confirmado |
| RN17 | Os estados do ciclo de vida de uma tarefa são: Em planeamento, Em análise técnica, Pronto a desenvolver, A desenvolver, Em testes, Terminada, Entregue. | Confirmado (lista de estados) — transições: D04, D18. ID atribuído no Ex. 4. |

## 5. Requisitos funcionais

### 5.1 Estrutura organizacional

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF01 | Criar, editar e consultar equipas. | US01 · RN01, RN02 | P0 | Confirmado | EC01.1, EC01.3 |
| RF02 | Criar, editar e consultar projetos, com nome e objetivo. | US01 · enunciado | P0 | Confirmado | EC01.2 |
| RF03 | Associar equipas a projetos, sem associações duplicadas, e consultar as equipas de um projeto. | US01 · CA01.3–CA01.5 | P0 | Proposto | P06 |
| RF04 | Associar utilizadores a equipas. | US01 · CA01.1, RN02 | P0 | Proposto | P07, D09 |

### 5.2 Hierarquia de trabalho

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF05 | Criar objetivos, épicos, tarefas e subtarefas, respeitando a hierarquia Objetivo → Épico → Tarefa → Subtarefa. | US02 · RN12 | P0 | Confirmado | D06, D13 |
| RF06 | Permitir tarefas sem subtarefas. | US02 · CA02.5 | P0 | Proposto | — |
| RF07 | Impedir a associação de um elemento a si próprio e relações hierárquicas circulares. | US02 · EC02.3 | P0 | Proposto | — |
| RF08 | Consultar a hierarquia de trabalho de um projeto. | US02 · CA02.6 | P0 | Proposto | — |

### 5.3 Tarefas, estimativas e atribuição

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF09 | Criar tarefas com os campos obrigatórios definidos. | US03 · CA03.1 | P0 | Confirmado | D16 |
| RF10 | Atribuir uma tarefa a uma única equipa responsável e, dentro dela, a um indivíduo. | US03 · RN02, CA03.2–CA03.3 | P0 | Confirmado | — |
| RF11 | Registar e alterar a estimativa temporal (horas) e os story points como valores independentes. | US03 · RN06, RN07, RN10 | P0 | Confirmado | D03, D10, D11 |
| RF12 | Permitir que membros criem tarefas no backlog e impedir que as coloquem numa sprint. | US04, US08 · RN08 | P0 | Confirmado | — |
| RF13 | Alertar os responsáveis quando um membro cria uma tarefa. | US08 · RN09 | P1 | Confirmado | D07 |
| RF14 | Permitir a gestores de projeto e administradores reatribuir excecionalmente uma tarefa a alguém de outra equipa, mantendo a associação à equipa original. | US08 · RN03, RN14 | P1 | Confirmado | D12, EC03.3 |

### 5.4 Backlog e sprints

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF15 | Manter backlog e sprints próprios por equipa; criar sprints com data de início e de fim. | US04 · RN01 | P0 | Confirmado | D19 |
| RF16 | Planear tarefas do backlog numa sprint, apenas por utilizadores com permissão de gestão de sprints. | US04 · RN08, CA04.3, CA04.6 | P0 | Confirmado | D14 |
| RF17 | No fim de uma sprint, devolver ao backlog as tarefas não concluídas, preservando a informação e o histórico. | US04 · RN04 | P0 | Confirmado | D04 |
| RF18 | No início de uma sprint, transferir do backlog as tarefas abrangidas pela regra de transição. | US04 · RN05 | P0 | Confirmado | D01, P01 |

### 5.5 Capacidade

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF19 | Registar e alterar a disponibilidade, em horas, de equipas e indivíduos por sprint. | US05 · RN06 | P0 | Confirmado | D02, D09 |
| RF20 | Apresentar as horas disponíveis, as horas estimadas e a diferença entre ambas, e o total de story points planeados, sem conversão entre unidades. | US05 · RN06 | P0 | Confirmado | D03 |
| RF21 | Identificar a sobrecarga temporal da equipa e de cada indivíduo. | US05 · CA05.3–CA05.4 | P0 | Proposto | — |

### 5.6 Execução, conclusão e histórico

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF22 | Gerir o estado de cada tarefa segundo o ciclo de vida confirmado. | US06 · RN17 | P0 | Confirmado | D04, D18 |
| RF23 | Registar os critérios de aceitação de cada tarefa e o seu cumprimento; impedir a conclusão enquanto houver critérios obrigatórios por cumprir. | US06 · RN13 | P0 | Confirmado | D08 |
| RF24 | Reabrir tarefas entregues, sem estado específico de reparação, preservando o histórico. | US06 · RN11 | P0 | Confirmado | D05 |
| RF25 | Manter o histórico de responsáveis pela execução, equipas e transferências de cada tarefa. | US06, US08 · RN14, RN15 | P0 | Confirmado | D12 |

### 5.7 Acompanhamento e alertas

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF26 | Apresentar o trabalho da equipa distinguindo tarefas planeadas, em execução, concluídas e bloqueadas. | US07 · CA07.1 | P1 | Proposto | D04, D15, D18 |
| RF27 | Comparar, por sprint, o trabalho planeado com o trabalho concluído. | US07 · CA07.2 | P1 | Proposto | D11 |
| RF28 | Identificar como atrasadas as tarefas com prazo ultrapassado e não concluídas. | US07 · CA07.3 | P1 | Proposto | D16 |
| RF29 | Assinalar tarefas bloqueadas e registar o motivo do bloqueio. | US07 · CA07.4 | P1 | Proposto | D15, P02 |
| RF30 | Apresentar alertas na aplicação a utilizadores com responsabilidade de acompanhamento. | US07 · CA07.5, RN09 | P1 | Proposto | D17, P03, P04 |

## 6. Requisitos não funcionais

Os critérios transversais QT01–QT07 do Ex. 3 passam a RNF01–RNF07.

| ID | Requisito | Finalidade | Estado |
|---|---|---|---|
| RNF01 | As permissões são aplicadas de forma consistente em todas as operações relevantes. | Evitar alterações não autorizadas. | Proposto |
| RNF02 | As alterações às tarefas preservam a integridade das associações a projetos e equipas. | Evitar inconsistências organizacionais. | Proposto |
| RNF03 | Horas e story points são apresentados como métricas distintas. | Evitar interpretações incorretas. | Confirmado (decorre de RN06) |
| RNF04 | O histórico permite identificar alterações relevantes de responsáveis e equipas. | Garantir rastreabilidade. | Confirmado (decorre de RN14, RN15) |
| RNF05 | Os indicadores de progresso refletem os dados operacionais registados. | Evitar discrepâncias entre a execução e a informação de gestão. | Proposto |
| RNF06 | A aplicação suporta o volume inicial previsto de utilizadores e permite crescimento sem impor um limite funcional artificial. | Utilização interna e evolução. | Confirmado como necessidade — valores: D20 |
| RNF07 | As tarefas não concluídas no fim de uma sprint conservam a informação necessária ao planeamento seguinte. | Evitar perda de contexto. | Confirmado (decorre de RN04) |

Os requisitos de **segurança e privacidade** estão em [`constraints.md`](constraints.md) §3 (SEC01–SEC09).

Ainda **não foram levantados** requisitos de desempenho, disponibilidade, acessibilidade, idioma ou dispositivos suportados — ver D20.

## 7. Âmbito do MVP

O MVP é composto pelas oito User Stories detalhadas em [`user-stories.md`](user-stories.md).

| US | Funcionalidade | Justificação | Prior. |
|---|---|---|---|
| US01 | Gerir equipas e projetos | Sem equipas e projetos não há onde organizar o trabalho; é a base de todas as outras US. | P0 |
| US02 | Gerir a hierarquia de trabalho | Liga o trabalho executável aos objetivos que o justificam (RN12). | P0 |
| US03 | Criar, estimar e atribuir tarefas | Núcleo do "gerir tarefas" pedido pelo cliente; define a responsabilidade (RN02). | P0 |
| US04 | Gerir backlog e sprints por equipa | Cada equipa planeia em sprints próprias (RN01, RN04, RN05). | P0 |
| US05 | Consultar capacidade e carga de trabalho | Crítica para validar o problema central: planear de acordo com a capacidade (RN06). | P0 |
| US06 | Atualizar o estado e validar a conclusão | Garante que o progresso reflete trabalho efetivamente cumprido (RN13). | P0 |
| US07 | Consultar progresso, desvios e alertas (versão básica) | Responde ao "acompanhar o progresso" do pedido inicial, sem análise tarefa a tarefa. | P1 |
| US08 | Propor trabalho e preservar histórico entre equipas | Membros sinalizam trabalho sem poderes de gestão (RN08, RN09); rastreabilidade entre equipas (RN14, RN15). | P1 |

**Critério de conclusão do MVP** *(Proposto)*: todas as US01–US08 cumprem os respetivos critérios de aceitação, depois de resolvidas as decisões pendentes que os bloqueiam ([`user-stories.md`](user-stories.md) §3).

## 8. Funcionalidades fora do âmbito inicial

| Funcionalidade | Motivo | Estado |
|---|---|---|
| Estado autónomo «Em reparação» | O retrabalho faz-se reabrindo a tarefa (RN11). | Confirmado |
| Conversão entre horas e story points, ou soma das duas métricas | Métricas independentes (RN06). | Confirmado |
| Acesso de utilizadores externos à empresa (clientes, parceiros) | O MVP é para utilização interna (RN16). | Confirmado |
| Previsões automáticas e avaliação de risco | Exigem dados históricos que ainda não existem. | Proposto (recomendação da análise) |
| Modelos avançados de produtividade | A separação entre horas e story points é suficiente para o MVP. | Proposto (recomendação da análise) |
| Integrações com ferramentas externas (repositórios de código, chat, e-mail, calendário) | Não discutido. | Pressuposto P10 |
| Registo do tempo efetivamente gasto (timesheets) | Não discutido; a US05 usa estimativas e disponibilidade. | Pressuposto P10 |
| Aplicação móvel nativa | Não discutido. | Pressuposto P10 |
| Relatórios exportáveis e dashboards configuráveis | Não discutido; a US07 cobre a consulta básica. | Pressuposto P10 |
