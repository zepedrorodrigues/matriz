# Matriz — Requisitos

> **Versão:** 0.3 · **Data:** 2026-10-29 · **Estado:** revisto na revisão crítica (Ficha PL 01, Ex. 6)
> **Fontes:** descrição inicial do cliente; análise de requisitos assistida por IA (Ex. 1–3); decisões da revisão crítica (Ex. 6, [`review.md`](review.md)).
> **Relacionados:** [`user-stories.md`](user-stories.md) · [`constraints.md`](constraints.md)

## Convenções

| Estado | Significado |
|---|---|
| **Confirmado** | Validado nas respostas às perguntas de clarificação (Ex. 2–3) ou na revisão crítica (Ex. 6). Prevalece sobre qualquer proposta ou pressuposto. |
| **Proposto** | Derivado pela análise e ainda não validado — não tratar como facto. |
| `Dxx` | Decisão pendente que afeta o requisito — ver [`constraints.md`](constraints.md) §4. |
| `Pxx` | Pressuposto assumido — ver [`constraints.md`](constraints.md) §2. |

Prioridades: **P0** — crítica, sem ela o MVP não resolve o problema · **P1** — alta, incluída no MVP numa versão básica · **Futuro** — fora do MVP. As prioridades resultam da análise de requisitos e foram validadas pelo cliente.

Salvo indicação em contrário, o que se aplica a tarefas aplica-se também a subtarefas (RN22).

---

## 1. Visão e objetivos

### 1.1 Problema

Pedido inicial do cliente:

> "Precisamos de uma aplicação onde as nossas equipas possam organizar projetos, gerir tarefas e acompanhar o progresso do trabalho."

O cliente não definiu funcionalidades, regras de negócio, requisitos técnicos nem prioridades. Esta especificação resulta da clarificação desse pedido.

### 1.2 Visão

A **Matriz** é uma aplicação interna de gestão de projetos e tarefas (semelhante a Jira, Azure DevOps ou Trello) que permite a cada equipa planear o seu trabalho em sprints com visibilidade sobre a sua capacidade, e que dá às lideranças visibilidade sobre o progresso, os desvios e a responsabilidade histórica de cada entrega.

### 1.3 Objetivos

| ID | Objetivo | Suportado por |
|---|---|---|
| OBJ01 | Organizar o trabalho por equipas e projetos, com responsabilidades claras. | US01 |
| OBJ02 | Decompor o trabalho em Objetivos → Épicos → Tarefas → Subtarefas. | US02 |
| OBJ03 | Distribuir e estimar o trabalho, em horas e em story points, como métricas independentes. | US03 |
| OBJ04 | Planear o trabalho de cada equipa em sprints, com visibilidade sobre a capacidade disponível e notificação quando esta é excedida. | US04, US05 |
| OBJ05 | Garantir que uma tarefa só é dada como cumprida quando satisfaz todos os critérios de aceitação. | US06 |
| OBJ06 | Dar visibilidade sobre progresso, desvios e alertas. | US07 |
| OBJ07 | Preservar a rastreabilidade: equipa original e responsável pela execução de cada tarefa. | US06, US09 |

## 2. Glossário

| Termo | Definição |
|---|---|
| Equipa | Unidade organizacional que executa trabalho. Tem backlog e sprints próprios (RN01). |
| Projeto | Iniciativa com nome e objetivo, na qual participam uma ou mais equipas. Contém a hierarquia de trabalho, a partir dos objetivos (RN23). |
| Objetivo · Épico · Tarefa · Subtarefa | Níveis da hierarquia de trabalho, do mais abrangente para o mais concreto (RN12). |
| Subtarefa | Tarefa contida noutra tarefa, sujeita às mesmas regras (RN22). |
| Backlog | Trabalho de uma equipa ainda não incluído numa sprint ativa. **Não é uma sprint.** |
| Sprint | Período, com data de início e de fim, em que uma equipa executa as tarefas planeadas. |
| Estimativa temporal | Esforço previsto de uma tarefa, em horas. |
| Story points | Estimativa relativa de dimensão e complexidade, numa escala comum (RN07). **Não é convertível em horas nem é uma medida de capacidade** (RN06). |
| Capacidade | Horas de trabalho de que um indivíduo ou uma equipa dispõe numa sprint, calculadas segundo RN06. É uma referência de planeamento, não um limite (RN19). |
| Sobrecarga | Situação em que a estimativa temporal do trabalho planeado excede a capacidade. |
| Transferência | Mudança explícita da equipa responsável por uma tarefa (RN20). |
| Critério de aceitação | Condição verificável que determina se uma tarefa está cumprida (RN13). |
| Responsável pela execução | Indivíduo que executou e entregou a tarefa; permanece identificado no histórico (RN15). |
| Alerta | Aviso apresentado na aplicação (RN18) a utilizadores com responsabilidade de acompanhamento ou diretamente afetados. |

## 3. Tipos de utilizadores

| Papel | Responsabilidades no MVP | Base |
|---|---|---|
| **Administrador** | Papel global. Gere utilizadores, papéis e equipas e associa utilizadores a equipas; tem, em todos os projetos, as permissões do gestor de projeto. | US01, US09, RN03, RN20, RN25 |
| **Gestor de projeto** | Papel por projeto: quem cria um projeto passa a ser o seu gestor. Gere os seus projetos, as equipas associadas e a hierarquia de trabalho; cria e atribui tarefas; atribui excecionalmente tarefas a alguém de outra equipa e transfere tarefas entre equipas; altera critérios de aceitação de tarefas em desenvolvimento; acompanha o progresso. | US01, US02, US03, US07, US09, RN03, RN20, RN24, RN25 |
| **Líder de equipa** | Papel por equipa. Cria objetivos, épicos, tarefas e subtarefas nos projetos da sua equipa; estima e atribui tarefas na sua equipa; gere o backlog, as sprints e a capacidade da equipa; altera critérios de aceitação de tarefas em desenvolvimento; acompanha o progresso. | US02, US03, US04, US05, US07, RN10, RN24 |
| **Membro da equipa** | Papel por equipa. Pertence a pelo menos uma equipa; cria tarefas no backlog da sua equipa, sem as colocar numa sprint; define estimativas; atualiza o estado das tarefas que lhe estão atribuídas e regista o cumprimento dos respetivos critérios de aceitação. | US06, US08, RN08, RN10, RN21, RN24 |

### 3.1 Matriz de permissões

Decidida na revisão crítica (Ex. 6, D14).

- Os quatro papéis são **fixos** no MVP. As "permissões equivalentes" de RN03 correspondem a ter o papel de administrador ou de gestor de projeto.
- Um utilizador pode **acumular papéis**; as suas permissões são a união das permissões de cada papel.
- O administrador tem um papel **global**; o gestor de projeto, **por projeto**; o líder e o membro, **por equipa**.
- **Visibilidade:** cada utilizador vê os projetos em que participa uma das suas equipas e os projetos de que é gestor; o administrador vê todos. Os dados individuais de capacidade seguem SEC07.

| Operação | Administrador | Gestor (dos seus projetos) | Líder (da sua equipa) | Membro (da sua equipa) |
|---|:-:|:-:|:-:|:-:|
| Gerir utilizadores, papéis e equipas; associar utilizadores a equipas | ✔ | | | |
| Criar e editar projetos; associar equipas a projetos | ✔ | ✔ | | |
| Criar objetivos e épicos | ✔ | ✔ | ✔ | |
| Criar tarefas e subtarefas | ✔ | ✔ | ✔ | só no backlog |
| Definir estimativas | ✔ | ✔ | ✔ | ✔ (alterações posteriores: D11) |
| Atribuir a equipa responsável e o indivíduo dentro dela | ✔ | ✔ | só a sua equipa | |
| Atribuir a alguém de outra equipa (RN03); transferir entre equipas (RN20) | ✔ | ✔ | | |
| Gerir sprints e planear tarefas; ajustar a disponibilidade | | | ✔ | |
| Atualizar o estado; registar o cumprimento de critérios; assinalar bloqueios | ✔ | ✔ | ✔ | só tarefas atribuídas |
| Alterar critérios após «A desenvolver» (RN24); reabrir tarefas entregues | ✔ | ✔ | ✔ | |
| Consultar a capacidade e a sobrecarga de um indivíduo | | | ✔ | só os próprios dados |
| Consultar a capacidade da equipa | ✔ | ✔ | ✔ | ✔ |

## 4. Regras de negócio

| ID | Regra | Estado |
|---|---|---|
| RN01 | Cada equipa tem a sua própria sprint. | Confirmado |
| RN02 | Uma tarefa pertence, por defeito, a uma única equipa responsável. | Confirmado — regra geral; exceções em RN03 |
| RN03 | Um gestor de projeto, administrador ou utilizador com permissões equivalentes pode, excecionalmente, atribuir uma tarefa a alguém de outra equipa. | Confirmado — "permissões equivalentes": papel de administrador ou gestor de projeto (§3.1) |
| RN04 | No final de uma sprint, as tarefas não concluídas transitam para o backlog. | Confirmado — o que conta como "concluída": D04 |
| RN05 | As tarefas transitam do backlog para a sprint seguinte quando esta se inicia. | Confirmado — âmbito da transição por definir: D01 |
| RN06 | A capacidade mede-se apenas em horas. A capacidade de um indivíduo numa sprint é de 8 horas por cada dia útil (segunda a sexta) da data de início à data de fim da sprint (p. ex. 2 semanas = 10 dias úteis = 80 horas) e pode ser ajustada por sprint (os feriados não são descontados automaticamente: ajusta-se a disponibilidade); a capacidade de uma equipa é a soma da dos seus membros. Os story points são uma estimativa independente: nunca são convertidos em horas nem somados a elas. | Confirmado — revisto no Ex. 6; D09 |
| RN07 | A escala de story points é comum, com estimativas fundamentadas em tempo e dificuldade/complexidade. | Confirmado — escala e procedimento: D10 |
| RN08 | Os membros podem criar tarefas no backlog, mas não as podem adicionar diretamente a uma sprint. | Confirmado |
| RN09 | A criação de uma tarefa por um membro deve alertar os responsáveis relevantes. | Confirmado — destinatários: D07 |
| RN10 | Lideranças e membros podem definir estimativas. | Confirmado — alterações posteriores: D11 |
| RN11 | Uma tarefa entregue que apresenta problemas não necessita de um estado específico de reparação. | Confirmado |
| RN12 | A hierarquia de trabalho é Objetivos → Épicos → Tarefas → Subtarefas. | Confirmado — D06, D13 |
| RN13 | Uma tarefa só está cumprida quando **todos** os seus critérios de aceitação estão cumpridos. Não existem critérios de aceitação opcionais. | Confirmado — revisto no Ex. 6; tarefas sem critérios: D08 |
| RN14 | As tarefas históricas permanecem associadas à equipa original, mesmo após migração para outra equipa. | Confirmado |
| RN15 | O responsável pela execução e entrega permanece identificado no histórico. | Confirmado |
| RN16 | O MVP destina-se inicialmente à utilização interna da empresa. | Confirmado |
| RN17 | Os estados do ciclo de vida de uma tarefa são: Em planeamento, Em análise técnica, Pronto a desenvolver, A desenvolver, Em testes, Terminada, Entregue. | Confirmado — transições: D04, D18 |
| RN18 | No MVP, os alertas são apresentados apenas dentro da aplicação. | Confirmado (Ex. 6) — outros canais: §8 |
| RN19 | Exceder a capacidade não é impedido. Quando a estimativa temporal planeada excede a capacidade, são notificados: na sobrecarga de uma equipa, o líder e os membros dessa equipa; na sobrecarga de um indivíduo, o próprio e o seu líder de equipa. | Confirmado (Ex. 6) |
| RN20 | Uma tarefa só muda de equipa por transferência explícita, efetuada por um gestor de projeto ou administrador. Atribuir a tarefa a alguém de outra equipa (RN03), ou a mudança de equipa de quem a executa, não altera a equipa responsável. | Confirmado (Ex. 6) — registo: D12 |
| RN21 | Cada membro pertence a pelo menos uma equipa. Uma tarefa criada por um membro fica no backlog da sua equipa; se pertencer a várias, escolhe uma delas. | Confirmado (Ex. 6) — várias equipas: P07, D09 |
| RN22 | Uma subtarefa é uma tarefa contida noutra tarefa, com os mesmos campos, estados, estimativas e critérios de aceitação. Quando uma tarefa tem subtarefas, a sua estimativa temporal e os seus story points são a soma dos das subtarefas; essa soma é informativa e, na capacidade, contam apenas as subtarefas, cada uma na sprint em que está planeada. Uma subtarefa tem sempre a equipa responsável da tarefa principal (pode ser atribuída a alguém de outra equipa segundo RN03), e transferir a tarefa principal transfere as suas subtarefas. A conclusão da tarefa principal não depende da conclusão das subtarefas, e as subtarefas podem ser planeadas em sprints diferentes da tarefa principal. | Confirmado (Ex. 6) |
| RN23 | Cada elemento da hierarquia de trabalho pertence a um único projeto, herdado do elemento superior; os objetivos são o nível de topo de um projeto. Uma tarefa só pode ter como equipa responsável uma equipa associada ao seu projeto. | Confirmado (Ex. 6) |
| RN24 | Os critérios de aceitação são definidos por quem cria a tarefa. Depois de a tarefa entrar em «A desenvolver», só o líder de equipa ou o gestor de projeto os pode alterar, e cada alteração fica registada. Os membros registam apenas o seu cumprimento. | Confirmado (Ex. 6) |
| RN25 | As equipas são criadas e geridas pelo administrador. Os projetos são criados e geridos pelo administrador e pelo gestor de projeto. | Confirmado (Ex. 6) — matriz completa em §3.1 |

## 5. Requisitos funcionais

### 5.1 Estrutura organizacional

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF01 | Criar, editar e consultar equipas. | US01 · RN01, RN25 | P0 | Confirmado | D22, D24 |
| RF02 | Criar, editar e consultar projetos, com nome e objetivo. | US01 · RN25 | P0 | Confirmado | D23 |
| RF03 | Associar equipas a projetos, sem associações duplicadas, e consultar as equipas de um projeto. | US01 · CA01.3–CA01.5 | P0 | Confirmado | P06 |
| RF04 | Associar utilizadores a equipas; cada membro pertence a pelo menos uma equipa. | US01 · CA01.9, RN21 | P0 | Confirmado | P07, D09 |

### 5.2 Hierarquia de trabalho

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF05 | Criar objetivos, épicos, tarefas e subtarefas, respeitando a hierarquia Objetivo → Épico → Tarefa → Subtarefa; cada elemento pertence ao projeto do elemento superior. | US02 · RN12, RN22, RN23 | P0 | Confirmado | D06, D13 |
| RF06 | Permitir tarefas sem subtarefas. | US02 · CA02.5 | P0 | Confirmado | — |
| RF07 | Impedir sempre a associação de um elemento a si próprio e relações hierárquicas circulares. | US02 · CA02.7 | P0 | Confirmado | — |
| RF08 | Consultar a hierarquia de trabalho de um projeto. | US02 · CA02.6 | P0 | Confirmado | — |

### 5.3 Tarefas, estimativas e atribuição

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF09 | Criar tarefas com os campos obrigatórios definidos. | US03 · CA03.1 | P0 | Confirmado | D16 |
| RF10 | Atribuir uma tarefa a uma única equipa responsável, associada ao projeto da tarefa, e, dentro dela, a um indivíduo. | US03 · RN02, RN23, CA03.2, CA03.3, CA03.7 | P0 | Confirmado | — |
| RF11 | Registar e alterar a estimativa temporal (horas) e os story points como valores independentes; numa tarefa com subtarefas, ambas são a soma das subtarefas. | US03 · RN06, RN07, RN10, RN22 | P0 | Confirmado | D03, D10, D11 |
| RF12 | Permitir que membros criem tarefas no backlog da sua equipa e impedir que as coloquem numa sprint. | US04, US08 · RN08, RN21 | P0 | Confirmado | — |
| RF13 | Alertar os responsáveis quando um membro cria uma tarefa. | US08 · RN09 | P1 | Confirmado | D07 |
| RF14 | Permitir a gestores de projeto e administradores atribuir excecionalmente uma tarefa a alguém de outra equipa, sem alterar a equipa responsável. | US09 · RN03, RN20 | P1 | Confirmado | D25 |
| RF31 | Permitir a gestores de projeto e administradores transferir uma tarefa para outra equipa, mantendo no histórico a equipa original e transferindo as subtarefas. | US09 · RN14, RN20, RN22 | P1 | Confirmado | D12, D27 |

### 5.4 Backlog e sprints

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF15 | Manter backlog e sprints próprios por equipa; criar sprints com data de início e de fim. | US04 · RN01 | P0 | Confirmado | D19 |
| RF16 | Planear tarefas do backlog numa sprint, apenas por utilizadores com permissão de gestão de sprints. | US04 · RN08, CA04.3, CA04.6, §3.1 | P0 | Confirmado | — |
| RF17 | No fim de uma sprint, devolver ao backlog as tarefas não concluídas, preservando a informação e o histórico. | US04 · RN04 | P0 | Confirmado | D04 |
| RF18 | No início de uma sprint, transferir do backlog as tarefas abrangidas pela regra de transição. | US04 · RN05 | P0 | Confirmado | D01, P01 |

### 5.5 Capacidade

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF19 | Calcular a capacidade de cada indivíduo e de cada equipa por sprint segundo RN06, e permitir ajustar a de cada indivíduo. | US05 · RN06 | P0 | Confirmado | D09 |
| RF20 | Apresentar as horas disponíveis, as horas estimadas e a diferença entre ambas, e o total de story points planeados, sem conversão entre unidades e contabilizando as subtarefas segundo RN22. | US05 · RN06, RN22 | P0 | Confirmado | D03 |
| RF21 | Identificar a sobrecarga temporal da equipa e de cada indivíduo, sem impedir o planeamento, e notificar segundo RN19. | US05 · RN19, CA05.3, CA05.4, CA05.8 | P0 | Confirmado | — |

### 5.6 Execução, conclusão e histórico

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF22 | Gerir o estado de cada tarefa entre os estados de RN17. | US06 · RN17 | P0 | Confirmado | D04, D18 |
| RF23 | Registar os critérios de aceitação de cada tarefa e o seu cumprimento; impedir a conclusão enquanto algum critério estiver por cumprir; controlar a alteração dos critérios segundo RN24. | US06 · RN13, RN24 | P0 | Confirmado | D08 |
| RF24 | Reabrir tarefas entregues, sem estado específico de reparação, preservando o histórico. | US06 · RN11 | P0 | Confirmado | D05 |
| RF25 | Manter o histórico de responsáveis pela execução, equipas e transferências de cada tarefa. | US06, US09 · RN14, RN15 | P0 | Confirmado | D12 — depende de RF14 e RF31 (P1), ver `user-stories.md` §1 |

### 5.7 Acompanhamento e alertas

| ID | Requisito | Base | Prior. | Estado | Pendências |
|---|---|---|---|---|---|
| RF26 | Apresentar o trabalho da equipa distinguindo tarefas planeadas, em execução, concluídas e bloqueadas. | US07 · CA07.1 | P1 | Confirmado | D04, D15, D18 |
| RF27 | Comparar, por sprint, o trabalho planeado com o trabalho concluído. | US07 · CA07.2 | P1 | Confirmado | D11 |
| RF28 | Identificar como atrasadas as tarefas com prazo ultrapassado e não concluídas. | US07 · CA07.3 | P1 | Confirmado | D16 |
| RF29 | Assinalar tarefas bloqueadas e registar o motivo do bloqueio, que descreve o impedimento ao trabalho e nunca motivos pessoais (SEC06). | US07 · CA07.4, CA07.6 | P1 | Confirmado | D15, P02 |
| RF30 | Apresentar alertas na aplicação a utilizadores com responsabilidade de acompanhamento ou diretamente afetados. | US07 · CA07.5, RN09, RN18, RN19 | P1 | Confirmado | D17, P04 |

## 6. Requisitos não funcionais

Os critérios transversais QT01–QT07 do Ex. 3 passam a RNF01–RNF07.

| ID | Requisito | Finalidade | Estado |
|---|---|---|---|
| RNF01 | As permissões são aplicadas de forma consistente em todas as operações relevantes. | Evitar alterações não autorizadas. | Confirmado |
| RNF02 | As alterações às tarefas preservam a integridade das associações a projetos e equipas. | Evitar inconsistências organizacionais. | Confirmado |
| RNF03 | Horas e story points são apresentados como métricas distintas. | Evitar interpretações incorretas. | Confirmado (decorre de RN06) |
| RNF04 | O histórico permite identificar alterações relevantes de responsáveis e equipas. | Garantir rastreabilidade. | Confirmado (decorre de RN14, RN15) |
| RNF05 | Os indicadores de progresso refletem os dados operacionais registados. | Evitar discrepâncias entre a execução e a informação de gestão. | Confirmado |
| RNF06 | A aplicação suporta 100 utilizadores iniciais, todos em simultâneo, e o crescimento até 500 utilizadores sem alterações de arquitetura. | Utilização interna e evolução. | Confirmado (Ex. 6, D20) |
| RNF07 | As tarefas não concluídas no fim de uma sprint conservam a informação necessária ao planeamento seguinte. | Evitar perda de contexto. | Confirmado (decorre de RN04) |
| RNF08 | As operações de consulta e de atualização respondem em 2 segundos ou menos em 95 % dos casos, com 100 utilizadores em simultâneo. | Desempenho. | Confirmado (Ex. 6, D20) |
| RNF09 | Disponibilidade de 99 % em horário de trabalho (dias úteis, 08:00–20:00); a manutenção planeada decorre fora desse horário. | Disponibilidade. | Confirmado (Ex. 6, D20) |
| RNF10 | A interface está em português (pt-PT) no MVP. | Idioma. | Confirmado (Ex. 6, D20) |
| RNF11 | A utilização principal é em computadores de secretária e portáteis; uma versão dedicada a dispositivos móveis está fora do MVP. | Dispositivos suportados. | Confirmado (Ex. 6, D20) |
| RNF12 | A interface cumpre as WCAG 2.1, nível AA. | Acessibilidade. | Confirmado (Ex. 6, D20) |

Os requisitos de **segurança e privacidade** estão em [`constraints.md`](constraints.md) §3 (SEC01–SEC09); os respetivos critérios de aceitação transversais estão em [`user-stories.md`](user-stories.md) §3.
## 7. Âmbito do MVP

O MVP é composto pelas nove User Stories detalhadas em [`user-stories.md`](user-stories.md).

| US | Funcionalidade | Justificação | Prior. |
|---|---|---|---|
| US01 | Gerir equipas e projetos | Sem equipas e projetos não há onde organizar o trabalho; é a base de todas as outras US. | P0 |
| US02 | Gerir a hierarquia de trabalho | Liga o trabalho executável aos objetivos que o justificam (RN12). | P0 |
| US03 | Criar, estimar e atribuir tarefas | Núcleo do "gerir tarefas" pedido pelo cliente; define a responsabilidade (RN02). | P0 |
| US04 | Gerir backlog e sprints por equipa | Cada equipa planeia em sprints próprias (RN01, RN04, RN05). | P0 |
| US05 | Consultar capacidade e carga de trabalho | Crítica para validar o problema central: planear com visibilidade sobre a capacidade (RN06, RN19). | P0 |
| US06 | Atualizar o estado e validar a conclusão | Garante que o progresso reflete trabalho efetivamente cumprido (RN13). | P0 |
| US07 | Consultar progresso, desvios e alertas (versão básica) | Responde ao "acompanhar o progresso" do pedido inicial, sem análise tarefa a tarefa. | P1 |
| US08 | Propor trabalho no backlog | Membros sinalizam trabalho sem poderes de gestão (RN08, RN09, RN21). | P1 |
| US09 | Atribuir e transferir tarefas entre equipas | Exceções à responsabilidade da equipa sem perder a rastreabilidade (RN03, RN14, RN15, RN20). | P1 |

**Critério de conclusão do MVP** *(Confirmado)*: todas as US01–US09 e os critérios transversais cumprem os respetivos critérios de aceitação, depois de resolvidas as decisões pendentes que os bloqueiam ([`user-stories.md`](user-stories.md) §4).

## 8. Funcionalidades fora do âmbito inicial

| Funcionalidade | Motivo | Estado |
|---|---|---|
| Estado autónomo «Em reparação» | O retrabalho faz-se reabrindo a tarefa (RN11). | Confirmado |
| Conversão entre horas e story points, ou soma das duas métricas | Métricas independentes (RN06). | Confirmado |
| Impedir o planeamento quando a capacidade é excedida | A capacidade é uma referência; a sobrecarga é notificada (RN19). | Confirmado |
| Alertas por e-mail ou outros canais de mensagens | No MVP, os alertas são apresentados apenas na aplicação (RN18). A considerar numa fase futura. | Confirmado — Futuro |
| Acesso de utilizadores externos à empresa (clientes, parceiros) | O MVP é para utilização interna (RN16). | Confirmado |
| Previsões automáticas e avaliação de risco | Exigem dados históricos que ainda não existem. | Confirmado |
| Modelos avançados de produtividade | A separação entre horas e story points é suficiente para o MVP. | Confirmado |
| Integrações com ferramentas externas (repositórios de código, chat, e-mail, calendário) | Não discutido. | Pressuposto P10 |
| Registo do tempo efetivamente gasto (timesheets) | Não discutido; a US05 usa estimativas e capacidade. | Pressuposto P10 |
| Versão dedicada a dispositivos móveis, incluindo aplicação nativa | Utilização principal em computador (RNF11). | Confirmado |
| Outros idiomas além do português | Interface em pt-PT no MVP (RNF10). | Confirmado — Futuro |
| Relatórios exportáveis e dashboards configuráveis | Não discutido; a US07 cobre a consulta básica. | Pressuposto P10 |
