# Matriz — Restrições, pressupostos e decisões pendentes

> **Versão:** 0.1 · **Data:** 2026-10-22 · **Estado:** rascunho para revisão crítica (Ficha PL 01, Ex. 6)
> **Relacionados:** [`requirements.md`](requirements.md) · [`user-stories.md`](user-stories.md)

Este documento separa o que **é sabido** (restrições) do que **foi assumido** (pressupostos) e do que **ainda tem de ser decidido**. Um pressuposto nunca se sobrepõe a uma regra de negócio confirmada (RN).

---

## 1. Restrições conhecidas

| ID | Restrição | Origem |
|---|---|---|
| R01 | O MVP destina-se à utilização interna da empresa. | RN16 |
| R02 | Horas e story points são métricas independentes: a aplicação não as soma nem converte uma na outra. | RN06 |
| R03 | Não existe um estado «Em reparação»; o retrabalho faz-se reabrindo a tarefa. | RN11 |
| R04 | A linguagem, a framework, a base de dados e a arquitetura só serão escolhidas na Aula 2. Nenhum documento deve pressupor tecnologias. | Enunciado da Ficha PL 01 |
| R05 | Na fase atual não é implementado código; o entregável é o Specification Pack versionado em Git. | Enunciado da Ficha PL 01 |

## 2. Pressupostos assumidos

Cada pressuposto deve ser confirmado ou rejeitado através da decisão indicada.

| ID | Pressuposto | Porque foi assumido | Validar em |
|---|---|---|---|
| P01 | A transição automática do backlog para a nova sprint (RN05) abrange apenas as tarefas previamente selecionadas, e não todo o backlog. | Evita conflito com a capacidade (RN06) e com CA08.1. Assumido nas US do Ex. 3. | D01 |
| P02 | «Bloqueada» é um indicador independente que coexiste com o estado, e não um estado do ciclo de vida. | Recomendação da análise (Ex. 3); não decidido. | D15 |
| P03 | No MVP, os alertas são apresentados apenas dentro da aplicação. | CA08.2 refere "alerta na aplicação"; outros canais não foram discutidos. | D17 |
| P04 | Os alertas resultam de regras explícitas: prazo ultrapassado, tarefa bloqueada, capacidade temporal excedida, nova tarefa no backlog, tarefa reaberta após entrega. | Recomendação da análise (US07). | D17 |
| P05 | A gestão de capacidade distingue capacidade disponível, trabalho planeado e trabalho realizado. | Recomendação da análise (US05). | D02 |
| P06 | Uma equipa pode participar em vários projetos e um projeto pode ter várias equipas. | Formulação da US01 ("projetos em que participam"). | Cliente |
| P07 | Um utilizador pode pertencer a mais do que uma equipa. | Implícito no caso excecional EC05.3. | D09 |
| P08 | Uma tarefa sem critérios de aceitação formais pode ser concluída. | As respostas no Ex. 3 sugerem-no, sem definir em que condições. | D08 |
| P09 | A empresa opera na UE e está sujeita ao RGPD. | Contexto do projeto; a localização da empresa não foi indicada. | Cliente |
| P10 | As funcionalidades não discutidas na análise ficam fora do MVP (ver `requirements.md` §8). | Manter o MVP mínimo e não inventar âmbito. | Cliente |
| P11 | Todos os utilizadores são colaboradores internos autenticados. | Consequência de RN16. | DT04 |

## 3. Requisitos de segurança e privacidade

Todos **Propostos** — a validar no Ex. 6.

| ID | Requisito | Base |
|---|---|---|
| SEC01 | Só utilizadores internos autenticados acedem à aplicação. | R01, P11 |
| SEC02 | A autorização por papel é verificada em cada operação, e não apenas escondida na interface. Uma operação recusada não altera dados (cf. CA03.6, CA04.6, CA08.3). | RNF01, D14 |
| SEC03 | As alterações relevantes — responsável, equipa, estado, estimativas, transferências — ficam registadas com autor e data/hora. | RNF04, RN14, RN15 |
| SEC04 | O histórico não pode ser editado nem apagado através das funcionalidades comuns da aplicação. | RN14, RN15 |
| SEC05 | Minimização de dados pessoais: guardar apenas o necessário à gestão do trabalho (p. ex. nome, contacto profissional, papel, equipas, disponibilidade em horas). | P09 (RGPD) |
| SEC06 | Regista-se apenas a disponibilidade em horas, nunca o motivo da indisponibilidade (férias, doença, etc.). Os dados de saúde são uma categoria especial (art. 9.º do RGPD). | EC07.1, P09 |
| SEC07 | Os dados individuais de capacidade e sobrecarga, bem como os alertas, só são visíveis para quem tem responsabilidade de gestão sobre essas pessoas ou tarefas. A finalidade destes dados é o planeamento; qualquer uso para avaliação de desempenho exige decisão explícita. | US05, CA07.5 |
| SEC08 | Credenciais, chaves e dados reais de colaboradores nunca são guardados no repositório nem nos documentos; exemplos e testes usam dados fictícios. | Boas práticas; `AGENTS.md` §7 |
| SEC09 | Definir uma política de retenção para os dados de colaboradores que saem da empresa, compatível com RN15 (o responsável pela execução permanece no histórico). | RN15, P09 — D21 |

## 4. Decisões pendentes

### 4.1 Funcionais

D01–D13 vêm da revisão do Ex. 3. D14–D21 foram identificadas na consolidação do Ex. 4.
**Urgência** (proposta): a análise do Ex. 3 recomenda fechar primeiro D01 e o ciclo de vida (D04, D05, D18). D14 e D20 também são urgentes: a D14 é referida em quase todos os CA e a D20 é necessária para a arquitetura (Aula 2).

| ID | Questão | Impacto | Afeta | Urgência |
|---|---|---|---|---|
| D01 | A transição automática do backlog para a nova sprint inclui todas as tarefas ou apenas as previamente selecionadas? | Planeamento e capacidade | RN05, US04, US05, US08 · CA04.5 | Alta |
| D02 | Como se define a capacidade de uma equipa e de cada indivíduo (em horas e em story points)? | Gestão de capacidade | RN06, US05 · CA05.1 | Média |
| D03 | Pode uma tarefa existir sem estimativa temporal e/ou sem story points? Como é contabilizada? | Criação e planeamento | US03, US05 | Média |
| D04 | Como se relacionam «Terminada» e «Entregue»? Qual delas conta como "concluída"? | Ciclo de vida | RN04, RN17, US04, US06, US07 · CA04.4, CA06.4, CA07.1 | Alta |
| D05 | Para que estado regressa uma tarefa entregue quando é reaberta? | Retrabalho | RN11, US06 · CA06.5 | Alta |
| D06 | Pode uma tarefa existir diretamente sob um objetivo, sem épico? | Hierarquia | RN12, US02 | Média |
| D07 | Quem recebe os alertas de novas tarefas criadas por membros? | Notificações | RN09, US08 · CA08.2 | Média |
| D08 | Pode uma tarefa sem critérios de aceitação ser concluída? Em que condições? | Validação da conclusão | RN13, US06 | Média |
| D09 | Como se trata a capacidade de uma pessoa que pertence a várias equipas? | Planeamento global | US05 | Média |
| D10 | A escala comum de story points tem valores fixos ou configuráveis? Qual o procedimento de estimativa? | Estimativas | RN07, US03 | Média |
| D11 | Quem pode alterar estimativas depois de a tarefa começar? A comparação entre planeado e realizado usa a estimativa original, a atual ou ambas? | Planeamento e histórico | RN10, US03, US07 · CA07.2 | Média |
| D12 | Como se registam a equipa original e as transferências sucessivas de uma tarefa? | Rastreabilidade | RN14, RN15, US06, US08 | Média |
| D13 | A estrutura permite vários níveis de objetivos superiores? | Hierarquia | RN12, US02 | Baixa |
| D14 | Matriz de permissões: que operações cabem a cada papel; papéis fixos ou configuráveis ("permissões equivalentes", RN03); acumulação de papéis; visibilidade de projetos e tarefas entre equipas. | Segurança; todas as US | RN03, RN10, SEC02 | Alta |
| D15 | «Bloqueada» é um estado do ciclo de vida ou um indicador independente? | Ciclo de vida e acompanhamento | US06, US07 · CA07.1, CA07.4 | Média |
| D16 | Que campos são obrigatórios numa tarefa? O prazo é um campo da tarefa? | Criação e atrasos | US03, US07 · CA03.1, CA07.3 | Média |
| D17 | Que eventos geram alertas no MVP e por que canal? | Alertas | RN09, US07 · CA07.5 | Média |
| D18 | Quais as transições permitidas entre estados e quem as pode executar? | Ciclo de vida | RN17, US06 · CA06.2, CA07.1 | Alta |
| D19 | Regras de validação das sprints: datas válidas, sobreposição de sprints da mesma equipa, sprint sem tarefas. | Planeamento | US04 · CA04.1 | Média |
| D20 | Requisitos não funcionais quantitativos: número inicial de utilizadores (referido no QT06, mas não registado), desempenho, disponibilidade, idioma, dispositivos suportados. | Arquitetura | RNF06 | Alta (antes da Aula 2) |
| D21 | Política de retenção dos dados de colaboradores que saem da empresa. | Privacidade | RN15, SEC09 | Baixa |

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
| DT07 | Mecanismo de entrega de alertas | Por definir | D17 |
| DT08 | Estratégia de testes de aceitação a partir dos CA | Por definir | user-stories.md §3 |

## 5. Limitações de âmbito

| ID | Limitação |
|---|---|
| L01 | A especificação cobre apenas o MVP (US01–US08). As funcionalidades excluídas estão em `requirements.md` §8. |
| L02 | As regras marcadas como "Confirmado" foram validadas pela equipa de projeto em representação do cliente (Ex. 2); o cliente apenas forneceu a descrição inicial. Devem ser validadas com o cliente antes da implementação. |
| L03 | 15 dos 44 critérios de aceitação dependem de decisões pendentes e ainda não são verificáveis (`user-stories.md` §3). |
| L04 | Ainda não foram levantados requisitos não funcionais quantitativos (D20). |
| L05 | Os documentos não definem arquitetura, modelo de dados nem interface (R04). |
