# Matriz — Restrições, pressupostos e decisões pendentes

> **Versão:** 0.2 · **Data:** 2026-10-29 · **Estado:** revisto na revisão crítica (Ficha PL 01, Ex. 6)
> **Relacionados:** [`requirements.md`](requirements.md) · [`user-stories.md`](user-stories.md) · [`review.md`](review.md)

Este documento separa o que **é sabido** (restrições) do que **foi assumido** (pressupostos) e do que **ainda tem de ser decidido**. Um pressuposto nunca se sobrepõe a uma regra de negócio confirmada (RN).

---

## 1. Restrições conhecidas

| ID | Restrição | Origem |
|---|---|---|
| R01 | O MVP destina-se à utilização interna da empresa. | RN16 |
| R02 | A capacidade mede-se apenas em horas. Os story points são uma estimativa independente: a aplicação não os soma às horas nem os converte. | RN06 |
| R03 | Não existe um estado «Em reparação»; o retrabalho faz-se reabrindo a tarefa. | RN11 |
| R04 | A linguagem, a framework, a base de dados e a arquitetura só serão escolhidas na Aula 2. Nenhum documento deve pressupor tecnologias. | Enunciado da Ficha PL 01 |
| R05 | Na fase atual não é implementado código; o entregável é o Specification Pack versionado em Git. | Enunciado da Ficha PL 01 |

## 2. Pressupostos assumidos

Cada pressuposto deve ser confirmado ou rejeitado através da decisão indicada. Os pressupostos já resolvidos estão no §4.3.

| ID | Pressuposto | Porque foi assumido | Validar em |
|---|---|---|---|
| P01 | A transição automática do backlog para a nova sprint (RN05) abrange apenas as tarefas previamente selecionadas, e não todo o backlog. | Evita conflito com CA08.1 e com a planificação por capacidade. Assumido nas US do Ex. 3. | D01 |
| P02 | «Bloqueada» é um indicador independente que coexiste com o estado, e não um estado do ciclo de vida. | Recomendação da análise (Ex. 3); não decidido. | D15 |
| P04 | Os alertas resultam de regras explícitas: prazo ultrapassado, tarefa bloqueada, capacidade temporal excedida, nova tarefa no backlog, tarefa reaberta após entrega. | Recomendação da análise (US07). O alerta de capacidade excedida já está confirmado (RN19). | D17 |
| P06 | Uma equipa pode participar em vários projetos e um projeto pode ter várias equipas. | Formulação da US01 ("projetos em que participam"). | Cliente |
| P07 | Um utilizador pode pertencer a mais do que uma equipa. | Implícito no caso excecional EC05.3. | D09 |
| P08 | Uma tarefa sem critérios de aceitação formais pode ser concluída. | As respostas no Ex. 3 sugerem-no, sem definir em que condições. | D08 |
| P09 | A empresa opera na UE e está sujeita ao RGPD. | Contexto do projeto; a localização da empresa não foi indicada. | Cliente |
| P10 | As funcionalidades não discutidas na análise ficam fora do MVP (ver `requirements.md` §8). | Manter o MVP mínimo e não inventar âmbito. | Cliente |
| P11 | Todos os utilizadores são colaboradores internos autenticados. | Consequência de RN16. | DT04 |

## 3. Requisitos de segurança e privacidade

Confirmados na revisão crítica (Ex. 6). Os critérios de aceitação transversais estão em [`user-stories.md`](user-stories.md) §3 (CAT01–CAT05).

| ID | Requisito | Base |
|---|---|---|
| SEC01 | Só utilizadores internos autenticados acedem à aplicação. | R01, P11 |
| SEC02 | A autorização por papel é verificada em cada operação, e não apenas escondida na interface. Uma operação recusada não altera dados (cf. CA03.6, CA04.6, CA08.3). | RNF01, D14 |
| SEC03 | As alterações relevantes — responsável, equipa, estado, estimativas, critérios de aceitação, transferências — ficam registadas com autor e data/hora. | RNF04, RN14, RN15, RN24 |
| SEC04 | O histórico não pode ser editado nem apagado através das funcionalidades comuns da aplicação. | RN14, RN15 |
| SEC05 | Minimização de dados pessoais: guardar apenas o necessário à gestão do trabalho (p. ex. nome, contacto profissional, papel, equipas, disponibilidade em horas). | P09 (RGPD) |
| SEC06 | Regista-se apenas a disponibilidade em horas, nunca o motivo da indisponibilidade (férias, doença, etc.). Os dados de saúde são uma categoria especial (art. 9.º do RGPD). O mesmo se aplica ao motivo de bloqueio (RF29) e a qualquer outro campo de texto livre: descrevem o trabalho, nunca motivos pessoais. | EC07.1, RF29, P09 |
| SEC07 | Os dados individuais de capacidade e sobrecarga, bem como os alertas, só são visíveis para quem tem responsabilidade de gestão sobre essas pessoas ou tarefas e, no que lhe diz respeito, para a própria pessoa. A finalidade destes dados é o planeamento; qualquer uso para avaliação de desempenho exige decisão explícita. | US05, RN19, CA07.5 |
| SEC08 | Credenciais, chaves e dados reais de colaboradores nunca são guardados no repositório nem nos documentos; exemplos e testes usam dados fictícios. | Boas práticas; `AGENTS.md` §7 |
| SEC09 | Definir uma política de retenção para os dados de colaboradores que saem da empresa e para os registos de auditoria (SEC03), compatível com RN15 e com o direito de retificação. | RN15, SEC03, SEC04, P09 — D21 |

## 4. Decisões pendentes

### 4.1 Funcionais

D01–D13 vêm da revisão do Ex. 3, D14–D21 da consolidação do Ex. 4 e D22–D31 da revisão crítica do Ex. 6. As decisões resolvidas passam para o §4.3.
**Urgência** (proposta): fechar primeiro D01 e o ciclo de vida (D04, D05, D18). D14 e D20 também são urgentes: a D14 é referida em quase todos os CA e a D20 é necessária para a arquitetura (Aula 2).

| ID | Questão | Impacto | Afeta | Urgência |
|---|---|---|---|---|
| D01 | A transição automática do backlog para a nova sprint inclui todas as tarefas ou apenas as previamente selecionadas? | Planeamento e capacidade | RN05, US04, US05, US08 · CA04.5, CA08.1 | Alta |
| D03 | Pode uma tarefa existir sem estimativa temporal e/ou sem story points? Como é contabilizada? | Criação e planeamento | US03, US05 | Média |
| D04 | Como se relacionam «Terminada» e «Entregue»? Qual delas conta como "concluída"? | Ciclo de vida | RN04, RN17, US04, US06, US07 · CA04.4, CA06.3, CA06.4, CA07.1 | Alta |
| D05 | Para que estado regressa uma tarefa entregue quando é reaberta? | Retrabalho | RN11, US06 · CA06.5 | Alta |
| D06 | Pode uma tarefa existir diretamente sob um objetivo, sem épico? | Hierarquia | RN12, US02 | Média |
| D07 | Quem recebe os alertas de novas tarefas criadas por membros? | Notificações | RN09, US08 · CA08.2 | Média |
| D08 | Pode uma tarefa sem critérios de aceitação ser concluída? Em que condições? | Validação da conclusão | RN13, US06 | Média |
| D09 | Como se trata a capacidade de uma pessoa que pertence a várias equipas (RN06 soma a capacidade dos membros de cada equipa)? | Planeamento global | RN06, RN21, US05, US08 · CA08.8 | Média |
| D10 | A escala comum de story points tem valores fixos ou configuráveis? Qual o procedimento de estimativa? | Estimativas | RN07, US03 | Média |
| D11 | Quem pode alterar estimativas depois de a tarefa começar? A comparação entre planeado e realizado usa a estimativa original, a atual ou ambas? | Planeamento e histórico | RN10, US03, US07 · CA07.2 | Média |
| D12 | Como se registam a equipa original e as transferências sucessivas de uma tarefa? (Quando a equipa muda já está definido em RN20.) | Rastreabilidade | RN14, RN15, RN20, US06, US08 | Média |
| D13 | A estrutura permite vários níveis de objetivos superiores? | Hierarquia | RN12, US02 | Baixa |
| D14 | Matriz de permissões: que operações cabem a cada papel; papéis fixos ou configuráveis ("permissões equivalentes", RN03); permissões de administração; acumulação de papéis; visibilidade de projetos e tarefas entre equipas. Já decidido: RN20, RN24, RN25. | Segurança; todas as US | RN03, RN10, SEC02, SEC07 · CAT05 | Alta |
| D15 | «Bloqueada» é um estado do ciclo de vida ou um indicador independente? | Ciclo de vida e acompanhamento | US06, US07 · CA07.1, CA07.4, CA07.6 | Média |
| D16 | Que campos são obrigatórios numa tarefa? O prazo é um campo da tarefa? | Criação e atrasos | US03, US07 · CA03.1, CA07.3 | Média |
| D17 | Que eventos geram alertas no MVP? (Canal decidido em RN18; capacidade excedida decidida em RN19.) | Alertas | RN09, US07 · CA07.5 | Média |
| D18 | Quais as transições permitidas entre estados e quem as pode executar? | Ciclo de vida | RN17, US06 · CA06.2, CA07.1 | Alta |
| D19 | Regras de validação das sprints: datas válidas, sobreposição de sprints da mesma equipa, sprint sem tarefas. | Planeamento | US04 · CA04.1 | Média |
| D20 | Requisitos não funcionais quantitativos: número inicial de utilizadores (referido na resposta QT06 do Ex. 3, cujo valor não está registado no repositório), desempenho, disponibilidade, idioma, dispositivos suportados. | Arquitetura | RNF06 | Alta (antes da Aula 2) |
| D21 | Política de retenção dos dados de colaboradores que saem da empresa e dos registos de auditoria; exercício do direito de retificação face a SEC04. | Privacidade | RN15, SEC03, SEC04, SEC09 | Baixa |
| D22 | O que é um nome de equipa válido? Pode repetir o de outra equipa? | Estrutura organizacional | US01 · CA01.1, CA01.7 | Média |
| D23 | Pode existir um projeto sem equipas associadas? | Estrutura organizacional | US01 | Baixa |
| D24 | Pode desativar-se uma equipa que ainda tem tarefas atribuídas? O que acontece a essas tarefas? | Estrutura organizacional | US01 | Média |
| D25 | Que justificação ou autorização é exigida para atribuir uma tarefa a alguém de outra equipa? | Atribuição | RN03, US03, US08 | Baixa |
| D26 | Como se trata um prazo ultrapassado durante a indisponibilidade do responsável, sabendo que o motivo não é registado (SEC06)? | Acompanhamento | US07, SEC06 | Baixa |
| D27 | Pode transferir-se uma tarefa já concluída ou entregue? | Rastreabilidade | RN20, US08 | Média |
| D28 | Uma tarefa com subtarefas tem story points próprios ou a soma dos das subtarefas? | Estimativas | RN22, US03, US05 | Média |
| D29 | Uma subtarefa pode ter uma equipa responsável diferente da tarefa principal? | Atribuição | RN02, RN22, US02 | Média |
| D30 | Quando as subtarefas estão em sprints diferentes da tarefa principal, como se contabilizam as horas na capacidade de cada sprint, sem as contar duas vezes? | Capacidade | RN06, RN22, US05 | Média |
| D31 | Os feriados contam como dias úteis no cálculo da capacidade? | Capacidade | RN06, US05 | Baixa |

### 4.2 Técnicas

Nenhuma destas decisões foi tomada. Não devem ser antecipadas na documentação nem no código.

| ID | Decisão | Quando | Dependências |
|---|---|---|---|
| DT01 | Linguagem e framework | Aula 2 | D20 |
| DT02 | Base de dados e modelo de dados, incluindo a modelação do histórico e da auditoria | Aula 2 | D12, SEC03 |
| DT03 | Arquitetura da aplicação e desenho da API | Aula 2 | D20 |
| DT04 | Mecanismo de autenticação (contas próprias ou integração com o diretório da empresa) | Aula 2 | P11, infraestrutura do cliente |
| DT05 | Tipo de interface (web, móvel, outro) | Aula 2 (prototipagem) | D20 |
| DT06 | Alojamento (infraestrutura interna ou cloud) | Por definir | P09, D20 |
| DT07 | Mecanismo de entrega de alertas na aplicação | Por definir | RN18, D17 |
| DT08 | Estratégia de testes de aceitação a partir dos CA | Por definir | user-stories.md §4 |

### 4.3 Resolvidos na revisão crítica (Ex. 6, 2026-10-29)

| ID | Questão | Resolução |
|---|---|---|
| D02 | Como se define a capacidade de uma equipa e de cada indivíduo? | RN06 (8 h por dia útil da sprint; equipa = soma dos membros; apenas horas). |
| D17 (parcial) | Canal dos alertas. | RN18 (apenas na aplicação). Eventos continuam pendentes em D17. |
| P03 | Os alertas são apresentados apenas dentro da aplicação. | Confirmado — RN18. |
| P05 | A gestão de capacidade distingue capacidade disponível, trabalho planeado e trabalho realizado. | Confirmado pelos requisitos RF19, RF20 e RF27. |
| EC02.2 | Criar uma subtarefa sem tarefa principal. | Impossível por definição (RN22). |
| EC05.1 | Equipa sem horas disponíveis registadas. | A capacidade é calculada a partir das datas da sprint (RN06). |

## 5. Limitações de âmbito

| ID | Limitação |
|---|---|
| L01 | A especificação cobre apenas o MVP (US01–US08). As funcionalidades excluídas estão em `requirements.md` §8. |
| L02 | As regras marcadas como "Confirmado" foram validadas pela equipa de projeto em representação do cliente (Ex. 2) e na revisão crítica (Ex. 6), o que equivale a validação pelo cliente. |
| L03 | 20 dos 66 critérios de aceitação dependem de decisões pendentes e ainda não são verificáveis (`user-stories.md` §4). |
| L04 | Ainda não foram levantados requisitos não funcionais quantitativos (D20). |
| L05 | Os documentos não definem arquitetura, modelo de dados nem interface (R04). |
