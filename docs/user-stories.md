# Matriz — User Stories do MVP

> **Versão:** 0.1 · **Data:** 2026-10-22 · **Estado:** rascunho para revisão crítica (Ficha PL 01, Ex. 6)
> **Fonte:** backlog produzido no Ex. 3, consolidado no Ex. 4. As alterações face ao Ex. 3 estão no §4.
> **Relacionados:** [`requirements.md`](requirements.md) · [`constraints.md`](constraints.md)

## Como ler

- Formato: *Como [tipo de utilizador], quero [funcionalidade], para [benefício].*
- Critérios de aceitação (CA) no formato **Given / When / Then**.
- Cada CA indica se é ***verificável*** hoje ou de que decisão pendente (`Dxx`, ver [`constraints.md`](constraints.md) §4) ***depende***.
- "Utilizador autorizado" ou "com permissão" significa o papel indicado na US. A matriz de permissões completa está pendente (**D14**); até lá, os testes usam o papel da US como referência.
- Os casos excecionais (EC) sem regra definida **não são critérios de aceitação** — são perguntas em aberto.

---

## 1. Resumo do backlog

| ID | Título | Utilizador principal | Prior. | Depende de | Requisitos |
|---|---|---|---|---|---|
| US01 | Gerir equipas e projetos | Administrador | P0 | — | RF01–RF04 |
| US02 | Gerir a hierarquia de trabalho | Gestor de projeto | P0 | US01 | RF05–RF08 |
| US03 | Criar, estimar e atribuir tarefas | Líder de equipa, Gestor de projeto | P0 | US01, US02 | RF09–RF11 |
| US04 | Gerir backlog e sprints por equipa | Líder de equipa | P0 | US03 | RF12, RF15–RF18 |
| US05 | Consultar capacidade e carga de trabalho | Líder de equipa | P0 | US04 | RF19–RF21 |
| US06 | Atualizar o estado e validar a conclusão | Membro da equipa | P0 | US03 | RF22–RF25 |
| US07 | Consultar progresso, desvios e alertas | Líder de equipa, Gestor de projeto | P1 | US04–US06 | RF26–RF30 |
| US08 | Propor trabalho e preservar histórico entre equipas | Membro da equipa, Gestor de projeto | P1 | US03, US04 | RF12–RF14, RF25 |

**Prioridades:** P0 — crítica · P1 — alta, incluída no MVP numa versão básica.

---

## 2. User Stories

### US01 — Gerir equipas e projetos

**Prioridade:** P0 — Crítica · **Objetivo:** estabelecer a estrutura organizacional mínima para gerir o trabalho. · **Regras:** RN01, RN02

> Como **administrador**, quero criar e gerir equipas e projetos, associando as equipas aos projetos em que participam, para organizar o trabalho e identificar as responsabilidades de cada unidade.

#### Critérios de aceitação

**CA01.1 — Criar uma equipa** · *depende de EC01.1 (o que é um nome válido)*
- **Given** que sou um administrador autorizado,
- **When** crio uma equipa com um nome válido,
- **Then** a equipa fica registada e disponível para associação a projetos e utilizadores.

**CA01.2 — Criar um projeto** · *verificável*
- **Given** que sou um utilizador com permissão para gerir projetos,
- **When** crio um projeto com um nome e um objetivo,
- **Then** o projeto fica registado e pode receber associações a equipas e tarefas.

**CA01.3 — Associar uma equipa a um projeto** · *verificável*
- **Given** que existe um projeto e uma equipa,
- **When** um utilizador autorizado associa essa equipa ao projeto,
- **Then** a equipa passa a constar das equipas participantes no projeto.

**CA01.4 — Consultar as equipas de um projeto** · *verificável*
- **Given** que um projeto tem uma ou mais equipas associadas,
- **When** um utilizador com acesso consulta o projeto,
- **Then** consegue identificar todas as equipas associadas.

**CA01.5 — Impedir duplicação da mesma associação** · *verificável*
- **Given** que uma equipa já está associada a um projeto,
- **When** um utilizador tenta criar novamente a mesma associação,
- **Then** a aplicação impede a duplicação e mantém uma única associação.

#### Casos excecionais

| ID | Situação | Regra |
|---|---|---|
| EC01.1 | Criar uma equipa com o mesmo nome de outra equipa existente. | Por definir |
| EC01.2 | Criar um projeto antes de lhe associar qualquer equipa. | Por definir |
| EC01.3 | Desativar uma equipa que ainda tem tarefas atribuídas. | Por definir |

**Decisões pendentes:** D14 · **Pressupostos:** P06, P07

---

### US02 — Gerir a hierarquia de trabalho

**Prioridade:** P0 — Crítica · **Objetivo:** decompor os objetivos em unidades de trabalho geríveis. · **Regras:** RN12

> Como **gestor de projeto** ou **membro autorizado**, quero criar e organizar objetivos, épicos, tarefas e subtarefas, para decompor o trabalho em unidades executáveis e acompanhar a sua contribuição para os objetivos superiores.

#### Critérios de aceitação

**CA02.1 — Criar um objetivo** · *verificável*
- **Given** que tenho permissão para criar ou gerir objetivos,
- **When** registo um objetivo com uma identificação e uma descrição,
- **Then** o objetivo fica disponível para organização do trabalho do projeto.

**CA02.2 — Criar um épico associado a um objetivo** · *verificável*
- **Given** que existe um objetivo,
- **When** crio um épico e o associo a esse objetivo,
- **Then** o épico passa a integrar a hierarquia desse objetivo.

**CA02.3 — Criar uma tarefa associada a um épico** · *verificável*
- **Given** que existe um épico,
- **When** crio uma tarefa e a associo ao épico,
- **Then** a tarefa passa a integrar esse épico.

**CA02.4 — Criar subtarefas** · *verificável*
- **Given** que existe uma tarefa,
- **When** crio uma subtarefa associada a essa tarefa,
- **Then** a subtarefa fica identificada como uma unidade de trabalho subordinada à tarefa principal.

**CA02.5 — Criar uma tarefa sem subtarefas** · *verificável* · *(revisto — ver §4)*
- **Given** que existe uma tarefa cujo trabalho não necessita de decomposição,
- **When** a crio sem subtarefas,
- **Then** a aplicação permite a sua existência sem exigir subtarefas.

**CA02.6 — Consultar a hierarquia** · *verificável*
- **Given** que existe uma estrutura com objetivos, épicos, tarefas e subtarefas,
- **When** um utilizador autorizado consulta essa estrutura,
- **Then** consegue identificar a relação hierárquica entre os elementos existentes.

#### Casos excecionais

| ID | Situação | Regra |
|---|---|---|
| EC02.1 | Associar uma tarefa diretamente a um objetivo, sem épico. | D06 |
| EC02.2 | Criar uma subtarefa sem tarefa principal. | Por definir |
| EC02.3 | Associar um elemento a si próprio ou criar uma relação hierárquica circular. | Deve ser impedido em qualquer caso — RF07 (Proposto) |

**Decisões pendentes:** D06, D13, D14

---

### US03 — Criar, estimar e atribuir tarefas

**Prioridade:** P0 — Crítica · **Objetivo:** distribuir o trabalho pelas equipas e pelos seus elementos. · **Regras:** RN02, RN03, RN06, RN07, RN10

> Como **líder de equipa** ou **gestor de projeto** autorizado, quero criar tarefas, definir as respetivas estimativas e atribuí-las a uma equipa ou indivíduo, para distribuir o trabalho de acordo com as responsabilidades e o planeamento estabelecido.

#### Critérios de aceitação

**CA03.1 — Criar uma tarefa** · *depende de D16 (campos obrigatórios)*
- **Given** que sou um utilizador autorizado a criar tarefas,
- **When** registo uma tarefa com os campos obrigatórios definidos,
- **Then** a tarefa fica criada e disponível no contexto de trabalho correspondente.

**CA03.2 — Atribuir uma tarefa a uma equipa** · *verificável*
- **Given** que existe uma tarefa e tenho permissão para atribuir trabalho,
- **When** atribuo a tarefa a uma equipa,
- **Then** a equipa fica identificada como responsável pela tarefa.

**CA03.3 — Atribuir uma tarefa a um indivíduo** · *verificável* · *(revisto — ver §4)*
- **Given** que existe uma tarefa atribuída a uma equipa,
- **When** um líder autorizado atribui a tarefa a um membro dessa equipa,
- **Then** o indivíduo fica identificado como responsável pela execução, sem eliminar a associação à equipa responsável.

A atribuição a alguém de outra equipa é a exceção prevista em RN03 e está coberta pelo CA08.4.

**CA03.4 — Definir estimativas independentes** · *verificável*
- **Given** que existe uma tarefa,
- **When** um utilizador autorizado regista uma estimativa temporal e uma estimativa em story points,
- **Then** ambas ficam registadas como valores independentes.

**CA03.5 — Alterar estimativas** · *verificável*
- **Given** que uma tarefa tem estimativas registadas,
- **When** um utilizador com permissão altera uma dessas estimativas,
- **Then** a nova estimativa fica guardada sem alterar automaticamente a outra unidade de medida.

**CA03.6 — Impedir atribuições não autorizadas** · *verificável*
- **Given** que um membro não tem permissão para atribuir tarefas a equipas,
- **When** tenta atribuir uma tarefa à sua equipa,
- **Then** a operação é recusada e a tarefa mantém a atribuição anterior.

#### Casos excecionais

| ID | Situação | Regra |
|---|---|---|
| EC03.1 | Tarefa sem story points ou sem estimativa temporal. | D03 |
| EC03.2 | Estimativa negativa ou incompatível com a escala definida. | Por definir — depende de D10 |
| EC03.3 | Atribuição a alguém de outra equipa: que justificação ou autorização é exigida? | Por definir — RN03 define apenas quem pode |

**Observação:** RN10 confirma que líderes e membros podem estimar, mas não determina se um membro pode alterar a estimativa de uma tarefa atribuída a outra pessoa, nem se uma estimativa aprovada fica protegida (D11). A US define a capacidade de estimar sem inventar uma política de edição.

**Decisões pendentes:** D03, D10, D11, D14, D16

---

### US04 — Gerir backlog e sprints por equipa

**Prioridade:** P0 — Crítica · **Objetivo:** organizar temporalmente o trabalho de cada equipa. · **Regras:** RN01, RN04, RN05, RN08

> Como **líder de equipa**, quero gerir o backlog e as sprints da minha equipa, selecionando e acompanhando as tarefas previstas para cada período, para planear a execução do trabalho de acordo com os objetivos e a capacidade disponível.

#### Critérios de aceitação

**CA04.1 — Criar uma sprint** · *depende de D19 (o que são datas válidas)*
- **Given** que sou um líder autorizado,
- **When** crio uma sprint com uma data de início e uma data de fim válidas,
- **Then** a sprint fica registada e associada à minha equipa.

**CA04.2 — Adicionar uma tarefa ao backlog** · *verificável*
- **Given** que existe uma tarefa elegível para planeamento,
- **When** a tarefa é criada sem associação a uma sprint,
- **Then** a tarefa fica disponível no backlog da equipa responsável.

**CA04.3 — Planear uma tarefa numa sprint** · *verificável*
- **Given** que existe uma sprint e uma tarefa no backlog da equipa,
- **When** um utilizador com permissão planeia a tarefa nessa sprint,
- **Then** a tarefa fica associada à sprint selecionada.

**CA04.4 — Terminar uma sprint** · *depende de D04 (que estado conta como concluído)*
- **Given** que uma sprint chega ao fim e existem tarefas não concluídas,
- **When** a sprint termina,
- **Then** as tarefas não concluídas passam para o backlog, preservando a respetiva informação e histórico.

**CA04.5 — Iniciar a sprint seguinte** · *depende de D01 (regra de transição)*
- **Given** que existe uma nova sprint e tarefas elegíveis no backlog,
- **When** a nova sprint se inicia,
- **Then** as tarefas abrangidas pela regra de transição definida são associadas à nova sprint.

**CA04.6 — Restringir o planeamento a membros comuns** · *verificável*
- **Given** que sou um membro sem permissão para gerir sprints,
- **When** tento adicionar uma tarefa a uma sprint,
- **Then** a operação é recusada e a tarefa permanece no backlog.

#### Casos excecionais

| ID | Situação | Regra |
|---|---|---|
| EC04.1 | Uma tarefa concluída permanece associada à sprint original quando as restantes transitam para o backlog? | Por definir — relacionado com D04 |
| EC04.2 | Há mais tarefas elegíveis no backlog do que capacidade disponível na nova sprint. | D01 |
| EC04.3 | Iniciar uma sprint sem trabalho planeado. | D19 |

**Decisão pendente importante — D01.** A frase "as tarefas passam para a sprint seguinte quando esta se inicia" pode significar que **todo** o backlog transita automaticamente, mesmo excedendo a capacidade, ou que só transitam as tarefas **previamente selecionadas**. A US preserva a intenção de automatizar o processo e assume a segunda leitura (**P01**), mas a regra tem de ser confirmada.

**Decisões pendentes:** D01, D04, D14, D19 · **Pressupostos:** P01

---

### US05 — Consultar capacidade e carga de trabalho

**Prioridade:** P0 — Crítica para a validação do problema central · **Objetivo:** avaliar se o trabalho planeado é compatível com a capacidade disponível. · **Regras:** RN06

> Como **líder de equipa**, quero consultar as horas disponíveis e os story points planeados para a minha equipa e respetivos membros, para identificar sobrecargas e tomar decisões informadas sobre a distribuição do trabalho.

#### Critérios de aceitação

**CA05.1 — Consultar capacidade em horas** · *depende de D02 (como se define a capacidade)*
- **Given** que uma equipa tem capacidade temporal definida para uma sprint,
- **When** consulto o planeamento dessa equipa,
- **Then** consigo visualizar as horas disponíveis, as horas estimadas atribuídas e a diferença entre ambas.

**CA05.2 — Consultar story points** · *verificável*
- **Given** que as tarefas planeadas têm estimativas em story points,
- **When** consulto o planeamento da equipa,
- **Then** consigo visualizar o total de story points planeados, sem conversão para horas.

**CA05.3 — Identificar sobrecarga temporal** · *verificável*
- **Given** que a estimativa temporal agregada das tarefas excede as horas disponíveis,
- **When** consulto o planeamento da sprint,
- **Then** a aplicação identifica a sobrecarga temporal.

**CA05.4 — Identificar sobrecarga individual** · *verificável*
- **Given** que um indivíduo tem uma capacidade definida e tarefas atribuídas com uma estimativa temporal agregada superior a essa capacidade,
- **When** consulto a distribuição individual,
- **Then** a aplicação identifica a sobrecarga desse indivíduo.

**CA05.5 — Alterar a disponibilidade** · *verificável*
- **Given** que tenho permissão para gerir a capacidade de uma equipa ou indivíduo,
- **When** atualizo a disponibilidade para uma sprint,
- **Then** a aplicação atualiza os valores de capacidade apresentados e a identificação de eventuais sobrecargas.

#### Casos excecionais

| ID | Situação | Regra |
|---|---|---|
| EC05.1 | Equipa sem horas disponíveis registadas. | D02 |
| EC05.2 | Tarefa com story points mas sem estimativa temporal. | D03 |
| EC05.3 | Pessoa que participa em sprints de várias equipas (risco de duplicar a capacidade). | D09 |

**Nota:** horas e story points nunca são somados nem convertidos (R02). A distinção entre capacidade disponível, trabalho planeado e trabalho realizado é uma recomendação ainda não confirmada (**P05**).

**Decisões pendentes:** D02, D03, D09 · **Pressupostos:** P05, P07

---

### US06 — Atualizar o estado e validar a conclusão das tarefas

**Prioridade:** P0 — Crítica · **Objetivo:** acompanhar a execução e assegurar que uma tarefa só é considerada concluída quando satisfaz os critérios estabelecidos. · **Regras:** RN11, RN13, RN15, RN17

> Como **membro da equipa**, quero atualizar o estado das tarefas que me estão atribuídas e registar o cumprimento dos respetivos critérios de aceitação, para que o progresso apresentado reflita o trabalho efetivamente concluído.

#### Critérios de aceitação

**CA06.1 — Consultar os estados** · *verificável*
- **Given** que existe uma tarefa,
- **When** um utilizador autorizado consulta os seus detalhes,
- **Then** consegue identificar o estado atual da tarefa.

**CA06.2 — Atualizar o estado** · *depende de D18 (transições permitidas)*
- **Given** que tenho permissão para atualizar uma tarefa,
- **When** altero o seu estado através de uma transição permitida,
- **Then** a aplicação guarda o novo estado.

**CA06.3 — Validar os critérios de aceitação** · *verificável*
- **Given** que uma tarefa tem critérios de aceitação definidos,
- **When** um utilizador tenta marcá-la como concluída sem os satisfazer,
- **Then** a aplicação impede a conclusão e identifica os critérios que permanecem por cumprir.

**CA06.4 — Concluir uma tarefa** · *depende de D04 (que estado conta como concluído)*
- **Given** que todos os critérios de aceitação obrigatórios estão cumpridos,
- **When** um utilizador autorizado conclui a tarefa,
- **Then** a aplicação regista a tarefa como concluída.

**CA06.5 — Reabrir uma tarefa entregue** · *depende de D05 (estado de destino)*
- **Given** que uma tarefa entregue apresenta um problema que exige nova intervenção,
- **When** um utilizador autorizado reabre a tarefa,
- **Then** a aplicação permite retomar o trabalho e conserva o histórico anterior.

**CA06.6 — Preservar o responsável pela execução** · *verificável*
- **Given** que uma tarefa foi executada por um indivíduo e posteriormente transferida para outra equipa,
- **When** consulto o histórico da tarefa,
- **Then** consigo identificar o responsável pela execução anterior e a equipa à qual a tarefa estava originalmente associada.

#### Casos excecionais

| ID | Situação | Regra |
|---|---|---|
| EC06.1 | Concluir uma tarefa sem critérios de aceitação formalmente definidos. | D08 — pressuposto P08 |
| EC06.2 | Estado para onde regressa uma tarefa entregue quando é reaberta (p. ex. o anterior à entrega ou «Em análise técnica»). | D05 |
| EC06.3 | O responsável muda depois da entrega: distinguir o responsável atual do responsável histórico pela execução. | RN15 — formato do registo: D12 |

**Estados confirmados (RN17):** Em planeamento · Em análise técnica · Pronto a desenvolver · A desenvolver · Em testes · Terminada · Entregue. «Em reparação» não é um estado (RN11). Falta definir se «Terminada» e «Entregue» representam situações distintas (D04) e quais as transições permitidas (D18).

**Decisões pendentes:** D04, D05, D08, D12, D18

---

### US07 — Consultar progresso, desvios e alertas

**Prioridade:** P1 — Alta, com funcionalidades básicas incluídas no MVP · **Objetivo:** acompanhar o trabalho sem ter de analisar individualmente todas as tarefas.

> Como **líder de equipa** ou **gestor de projeto**, quero consultar o progresso das tarefas, sprints e projetos, incluindo os desvios relativamente ao planeamento e os alertas relevantes, para identificar problemas e agir antes que comprometam os objetivos.

#### Critérios de aceitação

**CA07.1 — Consultar o trabalho da equipa** · *depende de D04, D15, D18 (correspondência entre estados e situações)*
- **Given** que existem tarefas associadas à minha equipa,
- **When** acedo à vista de gestão da equipa,
- **Then** consigo distinguir as tarefas planeadas, em execução, concluídas e bloqueadas, de acordo com os estados e classificações definidos.

**CA07.2 — Comparar planeamento e execução** · *depende de D11 (estimativa original ou atual)*
- **Given** que existem estimativas iniciais e informação de execução registada,
- **When** consulto uma sprint,
- **Then** consigo comparar o trabalho inicialmente planeado com o trabalho concluído.

**CA07.3 — Identificar tarefas atrasadas** · *depende de D16 (prazo como campo da tarefa)*
- **Given** que uma tarefa tem um prazo definido e não está concluída,
- **When** o prazo é ultrapassado,
- **Then** a aplicação identifica a tarefa como atrasada.

**CA07.4 — Consultar bloqueios** · *depende de D15 (bloqueio como estado ou indicador)*
- **Given** que uma tarefa está identificada como bloqueada,
- **When** consulto o trabalho da equipa ou do projeto,
- **Then** consigo identificar a tarefa e consultar o motivo do bloqueio, quando registado.

**CA07.5 — Consultar alertas relevantes** · *depende de D17 (eventos que geram alertas)*
- **Given** que ocorreu um evento definido como relevante para acompanhamento,
- **When** um utilizador com responsabilidade de acompanhamento consulta os alertas,
- **Then** o alerta correspondente é apresentado ao utilizador autorizado.

#### Casos excecionais

| ID | Situação | Regra |
|---|---|---|
| EC07.1 | Prazo ultrapassado enquanto o responsável esteve indisponível. | Por definir — o motivo da ausência não é registado (SEC06) |
| EC07.2 | Estimativa alterada durante a execução: a comparação usa a original, a atual ou ambas? | D11 |
| EC07.3 | Tarefa simultaneamente bloqueada e atrasada: uma classificação ou ambas visíveis? | D15 |

**Recomendação (não confirmada — P04):** alertas baseados em regras explícitas — prazo ultrapassado, tarefa bloqueada, capacidade temporal excedida, nova tarefa criada no backlog, tarefa reaberta depois de entregue. Sem previsões automáticas nem avaliações de risco.

**Decisões pendentes:** D04, D11, D15, D16, D17, D18 · **Pressupostos:** P02, P03, P04

---

### US08 — Propor trabalho e preservar o histórico entre equipas

**Prioridade:** P1 — Alta · **Objetivo:** permitir que os membros identifiquem trabalho necessário sem lhes atribuir poderes de gestão, e garantir que as transferências não destroem a rastreabilidade. · **Regras:** RN03, RN08, RN09, RN14, RN15

> Como **membro da equipa**, quero criar tarefas no backlog e, como **gestor autorizado**, quero poder reatribuir tarefas excecionalmente entre equipas, para que o trabalho necessário seja identificado sem comprometer as responsabilidades e o histórico organizacional.

#### Critérios de aceitação

**CA08.1 — Criar uma tarefa no backlog** · *verificável*
- **Given** que sou um membro da equipa autorizado a criar tarefas,
- **When** registo uma nova tarefa sem a associar a uma sprint,
- **Then** a tarefa fica no backlog e não é automaticamente incluída numa sprint.

**CA08.2 — Notificar os responsáveis** · *depende de D07 (destinatários)*
- **Given** que um membro cria uma tarefa no backlog,
- **When** a tarefa é registada com sucesso,
- **Then** os responsáveis definidos para esse tipo de notificação recebem um alerta na aplicação.

**CA08.3 — Impedir a inclusão direta numa sprint** · *verificável*
- **Given** que sou um membro sem permissão para gerir sprints,
- **When** tento associar diretamente uma nova tarefa a uma sprint,
- **Then** a aplicação recusa a operação e mantém a tarefa no backlog.

**CA08.4 — Reatribuir uma tarefa entre equipas** · *verificável*
- **Given** que sou um gestor de projeto ou administrador com permissão para efetuar transferências,
- **When** reatribuo uma tarefa a um indivíduo de outra equipa,
- **Then** a aplicação regista a alteração sem apagar o histórico da equipa original.

**CA08.5 — Consultar o histórico de transferência** · *verificável*
- **Given** que uma tarefa foi transferida entre equipas,
- **When** um utilizador autorizado consulta o histórico,
- **Then** consegue identificar a equipa original, o responsável pela execução e a transferência efetuada.

#### Casos excecionais

| ID | Situação | Regra |
|---|---|---|
| EC08.1 | Tarefa criada sem um responsável claramente definido para receber o alerta. | D07 |
| EC08.2 | Transferir uma tarefa já concluída ou entregue. | Por definir |
| EC08.3 | Tarefa que passa por três ou mais equipas: como apresentar o histórico. | D12 |

**Decisões pendentes:** D07, D12, D14 · **Pressupostos:** P03

---

## 3. Verificabilidade dos critérios de aceitação

**44 CA no total: 29 verificáveis hoje, 15 dependentes de decisões pendentes.**

| Decisão a tomar | CA que desbloqueia |
|---|---|
| D04 — «Terminada» vs «Entregue»; o que conta como concluída | CA04.4, CA06.4, CA07.1 |
| D15 — «Bloqueada»: estado ou indicador | CA07.1, CA07.4 |
| D16 — Campos obrigatórios da tarefa (incluindo prazo) | CA03.1, CA07.3 |
| D18 — Transições de estado permitidas | CA06.2, CA07.1 |
| D01 — Regra de transição backlog → sprint | CA04.5 |
| D02 — Definição da capacidade | CA05.1 |
| D05 — Estado após reabertura | CA06.5 |
| D07 — Destinatários dos alertas de novas tarefas | CA08.2 |
| D11 — Estimativa original vs atual | CA07.2 |
| D17 — Eventos que geram alertas | CA07.5 |
| D19 — Validação das datas da sprint | CA04.1 |
| EC01.1 — Unicidade do nome da equipa | CA01.1 |

---

## 4. Alterações face ao Ex. 3 e observações para a revisão

### 4.1 Alterações efetuadas na consolidação

| Item | Alteração | Motivo |
|---|---|---|
| CA02.5 | O "Given" passou de "existe um objetivo que pode ser executado através de uma única tarefa" para "existe uma tarefa cujo trabalho não necessita de decomposição". | A versão original pressupunha tarefas diretamente sob objetivos, o que ainda é uma questão em aberto (D06). |
| CA03.3 | "Indivíduo elegível" passou a "membro dessa equipa". | Termo ambíguo; a atribuição fora da equipa é a exceção de RN03 (CA08.4). |
| Todos os CA | Indicação de *verificável* / *depende de Dxx*. | Tornar explícito o que já pode ser testado. |
| Casos excecionais | IDs EC atribuídos e ligados às decisões pendentes. | Rastreabilidade. |
| Estados | Registados como RN17 em `requirements.md`. | Os estados estavam confirmados, mas sem ID. |
| Recomendações da IA | Medição da capacidade (P05) e lista de alertas (P04) registadas como pressupostos. | Eram recomendações da análise e não decisões confirmadas. |

### 4.2 Observações para o Ex. 6 (não alteradas)

1. **A US08 junta dois papéis e dois objetivos** (membro propõe trabalho; gestor transfere entre equipas). É candidata a ser dividida.
2. **CA08.1 vs RN05:** "não é automaticamente incluída numa sprint" só é coerente com a transição automática de RN05 se esta abranger apenas tarefas selecionadas (P01 → D01).
3. **Quem cria o quê:** a US02 permite a um "membro autorizado" criar objetivos e épicos; a US03 atribui a criação de tarefas a líderes e gestores; RN08 permite aos membros criar tarefas no backlog. A matriz de permissões (D14) tem de resolver isto.
4. **CA04.2:** "tarefa elegível para planeamento" não está definido.
