# Matriz — Restrições, pressupostos e decisões pendentes

> **Versão:** 0.5 · **Data:** 2026-10-29 · **Estado:** revisão cruzada da Ficha PL 02 (Ex. 5)
> **Relacionados:** [`requirements.md`](requirements.md) · [`user-stories.md`](user-stories.md) · [`review.md`](review.md)

Este documento separa o que **é sabido** (restrições) do que **foi assumido** (pressupostos) e do que **ainda tem de ser decidido**. Um pressuposto nunca se sobrepõe a uma regra de negócio confirmada (RN).

---

## 1. Restrições conhecidas

| ID | Restrição | Origem |
|---|---|---|
| R01 | O MVP destina-se à utilização interna da empresa. | RN16 |
| R02 | A capacidade mede-se apenas em horas. Os story points são uma estimativa independente: a aplicação não os soma às horas nem os converte. | RN06 |
| R03 | Não existe um estado «Em reparação»; o retrabalho faz-se reabrindo a tarefa. | RN11 |
| R04 | As escolhas tecnológicas e arquiteturais estão registadas nas decisões técnicas (§4) e no Architecture Pack (Ficha PL 02). Os documentos de requisitos (`requirements.md`, `user-stories.md`) não pressupõem tecnologias. | Enunciados das Fichas PL 01 e PL 02 |
| R05 | Até à Aula 03 não é implementado código funcional; os entregáveis são o Specification Pack e o Architecture Pack, versionados em Git. | Enunciados das Fichas PL 01 e PL 02 |

## 2. Pressupostos assumidos

Cada pressuposto deve ser confirmado ou rejeitado através da decisão indicada. Os pressupostos já resolvidos estão no §4.3.

| ID | Pressuposto | Porque foi assumido | Validar em |
|---|---|---|---|
| P09 | A empresa opera na UE e está sujeita ao RGPD. | Contexto do projeto; a localização da empresa não foi indicada. | Cliente |
| P10 | As funcionalidades não discutidas na análise ficam fora do MVP (ver `requirements.md` §8). | Manter o MVP mínimo e não inventar âmbito. | Cliente |
| P12 | A política de retenção e retificação de dados pessoais (SEC09) é adequada ao RGPD. | Proposta pela análise; não foi validada juridicamente. Mantém-se em aberto por decisão do humano: não é relevante no âmbito do projeto académico; a validação é necessária antes de uma entrada em produção. | Encarregado de proteção de dados |

## 3. Requisitos de segurança e privacidade

Confirmados na revisão crítica (Ex. 6). Os critérios de aceitação transversais estão em [`user-stories.md`](user-stories.md) §3 (CAT01–CAT05).

| ID | Requisito | Base |
|---|---|---|
| SEC01 | Só utilizadores internos autenticados acedem à aplicação. | R01, P11 |
| SEC02 | A autorização por papel é verificada em cada operação, e não apenas escondida na interface. Uma operação recusada não altera dados (cf. CA03.6, CA04.6, CA08.3). | RNF01, `requirements.md` §3.1 |
| SEC03 | As alterações relevantes — responsável, equipa, estado, estimativas, critérios de aceitação, transferências — ficam registadas com autor e data/hora. | RNF04, RN14, RN15, RN24 |
| SEC04 | O histórico não pode ser editado nem apagado através das funcionalidades comuns da aplicação. | RN14, RN15 |
| SEC05 | Minimização de dados pessoais: guardar apenas o necessário à gestão do trabalho (p. ex. nome, contacto profissional, papel, equipas, disponibilidade em horas). | P09 (RGPD) |
| SEC06 | Regista-se apenas a disponibilidade em horas, nunca o motivo da indisponibilidade (férias, doença, etc.). Os dados de saúde são uma categoria especial (art. 9.º do RGPD). O mesmo se aplica ao motivo de bloqueio (RF29) e a qualquer outro campo de texto livre: descrevem o trabalho, nunca motivos pessoais. | EC07.1, RF29, P09 |
| SEC07 | Os dados individuais de capacidade e sobrecarga, bem como os alertas, só são visíveis para quem tem responsabilidade de gestão sobre essas pessoas ou tarefas e, no que lhe diz respeito, para a própria pessoa. A finalidade destes dados é o planeamento; qualquer uso para avaliação de desempenho exige decisão explícita. | US05, RN19, CA07.5 |
| SEC08 | Credenciais, chaves e dados reais de colaboradores nunca são guardados no repositório nem nos documentos; exemplos e testes usam dados fictícios. | Boas práticas; `AGENTS.md` §7 |
| SEC09 | Quando um colaborador sai da empresa, a sua conta é desativada de imediato e o seu nome mantém-se no histórico (RN15); os restantes dados pessoais (contacto, disponibilidade) são apagados 12 meses após a saída. Os registos de auditoria são conservados enquanto o projeto existir. A retificação faz-se acrescentando um evento de correção, nunca editando o histórico (SEC04). | RN15, SEC03, SEC04, P09, P12 |

## 4. Decisões pendentes

### 4.1 Funcionais

Não há decisões funcionais pendentes: D01–D40 estão resolvidas (§4.3).

### 4.2 Técnicas

As decisões técnicas da Aula 2 estão resolvidas no §4.3. Ficam planeadas as seguintes revisões futuras.

| ID | Decisão | Quando | Dependências |
|---|---|---|---|
| DT09 | Revisão do peso dos alertas na base de dados: volume, retenção e arquivo dos alertas antigos. Até lá, os alertas não são apagados nem arquivados (decisão do humano: sem perda de informação no início) | Médio a longo prazo, com dados reais de utilização | DT07, RN30 |
| DT10 | Extração de módulos do monólito para serviços independentes (microservices) | Quando se verificarem os sinais de revisão abaixo | DT03 |
| DT11 | Melhoria da gestão de eventos interna e estudo de uma plataforma de eventos (p. ex. Kafka) para deployments integrados em larga escala | Em conjunto com DT10 | DT03, DT07, DT10 |
| DT12 | Melhoria da gestão de erros (p. ex. catálogo de códigos de erro, mensagens localizadas, monitorização e alarmística) | Depois do MVP | DT03 |
| DT13 | Alternativas de implantação mais tolerantes a falhas: várias instâncias do backend com verificações de saúde, réplica e cópias de segurança da base de dados | A estudar; antes da entrada em produção | DT06, RNF09 |

**Sinais de revisão da arquitetura (DT10):** várias equipas de desenvolvimento a trabalhar em módulos diferentes, com ciclos de entrega independentes; módulos com necessidades de carga ou de disponibilidade muito diferentes; ou crescimento para milhares de utilizadores em que o escalonamento horizontal do monólito (várias instâncias sobre a mesma base de dados) deixe de cumprir RNF08 e RNF09. O número de utilizadores, por si só, não obriga à migração. As fronteiras entre módulos (DT03) são o que torna a extração possível sem reescrever a aplicação.

### 4.3 Resolvidos (Ficha PL 01, Ex. 6, e Ficha PL 02 — 2026-10-29)

**Decisões funcionais**

| ID | Questão | Resolução |
|---|---|---|
| D01 | Âmbito da transição backlog → sprint. | RN05 — só as tarefas planeadas para a sprint (confirma P01). |
| D02 | Capacidade de equipas e indivíduos. | RN06 — 8 h por dia útil da sprint; equipa = soma dos membros; apenas horas. |
| D03 | Tarefas sem estimativas. | RN27 — podem existir no backlog; para entrar numa sprint precisam de estimativa temporal. |
| D04 | «Terminada» vs «Entregue». | RN26 — «Terminada» conta como concluída; «Entregue» só a partir de «Terminada». |
| D05 | Estado após reabertura. | RN26 — «A desenvolver». |
| D06 | Tarefas diretamente sob um objetivo. | RN12 — não; uma tarefa pertence sempre a um épico. |
| D07 | Destinatários dos alertas de novas tarefas. | RN09 — o(s) líder(es) da equipa da tarefa. |
| D08 | Tarefas sem critérios de aceitação. | RN27 — pelo menos um critério para «Pronto a desenvolver» (rejeita P08). |
| D09 | Pessoas em várias equipas. | RN06 — percentagem de alocação por equipa (confirma P07). |
| D10 | Escala de story points. | RN07 — 1, 2, 3, 5, 8, 13, 21, fixa. |
| D11 | Alteração de estimativas e comparação. | RN10 — só líder ou gestor após «A desenvolver»; compara-se a estimativa no início da sprint e a atual. |
| D12 | Registo do histórico e das transferências. | RN32 — registo só de acrescento, apresentado cronologicamente. |
| D13 | Níveis de objetivos. | RN12 — um único nível. |
| D14 | Matriz de permissões. | `requirements.md` §3.1 (confirma P11 quanto aos papéis). |
| D15 | «Bloqueada»: estado ou indicador. | RN28 — indicador com motivo obrigatório (confirma P02). |
| D16 | Campos obrigatórios e prazo. | RN29 — título, elemento superior e equipa; prazo opcional. |
| D17 | Eventos e canal dos alertas. | RN18 (canal) e RN30 (eventos e destinatários; confirma P03 e P04). |
| D18 | Transições de estado. | RN26. |
| D19 | Validação das sprints. | RN31. |
| D20 | Requisitos não funcionais quantitativos. | RNF06, RNF08–RNF12. |
| D21 | Retenção e retificação de dados pessoais. | SEC09 — validação jurídica pendente (P12). |
| D22 | Nome de uma equipa. | RN33. |
| D23 | Projeto sem equipas. | RN33 — permitido. |
| D24 | Desativação de equipas. | RN33 — só sem tarefas por concluir. |
| D25 | Justificação de atribuições a outra equipa. | RN03 — obrigatória e registada. |
| D26 | Prazos ultrapassados durante indisponibilidades. | RN29 — sem tratamento especial; o prazo pode ser alterado com registo. |
| D27 | Transferência de tarefas concluídas. | RN20 — não permitida. |
| D28 | Story points de uma tarefa com subtarefas. | RN22 — soma dos das subtarefas. |
| D29 | Equipa de uma subtarefa. | RN22 — sempre a da tarefa principal. |
| D30 | Capacidade com subtarefas noutras sprints. | RN22 — contam só as subtarefas, cada uma na sua sprint. |
| D31 | Feriados na capacidade. | RN06 — ajusta-se a disponibilidade. |
| D32 | Equipas sem líder. | RN34 — uma equipa ativa tem sempre pelo menos um líder. |
| D33 | O líder conta para a capacidade da equipa? | RN06 — sim, como qualquer membro. |
| D34 | Criação de contas de utilizador. | RN35 — o administrador cria a conta pelo e-mail profissional; a ligação à identidade faz-se no primeiro acesso. |
| D40 | Acrescentar tarefas a uma sprint já iniciada. | RN37 — permitido ao líder; a tarefa fica identificada como acrescentada depois do início. |
| D39 | Fim da sprint. | RN36 — automático, no fim do dia da data de fim. |
| D38 | Retirar uma tarefa de uma sprint. | RN37 — permitido ao líder; numa sprint ativa, a tarefa volta ao backlog, a remoção fica registada e continua a contar como planeada no início (RF27). |
| D37 | Alteração das datas de uma sprint. | RN36 — enquanto está «Planeada» (pelo líder) e no momento do início (por quem a inicia); depois do início, não. |
| D36 | Início da sprint. | RN36 — manual, pelo líder de equipa ou pelo administrador. |
| D35 | Tarefa transferida que está planeada numa sprint da equipa de origem. | RN20 — sai dessa sprint e passa para o backlog da equipa de destino. |

**Pressupostos**

| ID | Pressuposto | Resolução |
|---|---|---|
| P01 | A transição para a nova sprint abrange só as tarefas selecionadas. | Confirmado — RN05. |
| P02 | «Bloqueada» é um indicador. | Confirmado — RN28. |
| P03 | Alertas apenas na aplicação. | Confirmado — RN18. |
| P04 | Lista de eventos que geram alertas. | Confirmado — RN30. |
| P05 | Capacidade disponível, trabalho planeado e realizado distinguidos. | Confirmado — RF19, RF20, RF27. |
| P06 | Uma equipa pode participar em vários projetos e um projeto pode ter várias equipas. | Confirmado pelo humano (N:M) — RF03. |
| P07 | Um utilizador pode pertencer a várias equipas. | Confirmado — RN06, RN21. |
| P08 | Uma tarefa sem critérios pode ser concluída. | **Rejeitado** — RN27. |
| P11 | Todos os utilizadores são colaboradores internos autenticados. | Confirmado — DT04. |

**Decisões técnicas**

| ID | Decisão | Resolução |
|---|---|---|
| DT01 | Linguagem e framework | TypeScript em toda a aplicação: NestJS no backend e React no frontend. Alternativas analisadas: Go (viável, mas com duas linguagens e modelação de regras mais verbosa) e Rust (custo de desenvolvimento desproporcionado para um MVP ligado a dados). Escolhido por simplificar o desenvolvimento, os deployments e a atualização de versões com uma única linguagem e um único ecossistema. |
| DT02 | Base de dados | PostgreSQL, relacional, com um schema por módulo. |
| DT03 | Arquitetura e API | Monólito modular; API REST/JSON documentada em OpenAPI 3.1; comunicação síncrona. Módulos: Identidade e acesso, Organização, Trabalho, Planeamento, Acompanhamento, Histórico. Cada módulo é dono das suas tabelas e expõe uma interface pública aos restantes. |
| DT04 | Autenticação | OpenID Connect com o fornecedor de identidade da empresa em produção e um fornecedor local em desenvolvimento; papéis geridos na Matriz (`requirements.md` §3.1). |
| DT05 | Interface | Aplicação web, pensada primeiro para computador; versão móvel numa fase futura. |
| DT06 | Alojamento | Contentores — pelo menos duas imagens, uma para o frontend e outra para o backend —, em infraestrutura interna ou numa região cloud da UE; o fornecedor é escolhido pelo cliente. Alternativas mais tolerantes a falhas: DT13. |
| DT07 | Entrega de alertas | Alertas guardados na base de dados, criados na mesma transação que o evento que os origina; a aplicação web consulta-os periodicamente; os prazos ultrapassados são verificados por uma tarefa diária. Revisão futura: DT09. |
| DT08 | Testes de aceitação | Um teste automático por CA ao nível da API, com o ID do CA no nome; testes end-to-end apenas nos fluxos críticos. |

## 5. Limitações de âmbito

| ID | Limitação |
|---|---|
| L01 | A especificação cobre apenas o MVP (US01–US09). As funcionalidades excluídas estão em `requirements.md` §8. |
| L02 | As regras marcadas como "Confirmado" foram validadas pela equipa de projeto em representação do cliente (Ex. 2) e na revisão crítica (Ex. 6), o que equivale a validação pelo cliente. |
| L03 | A política de retenção (SEC09) carece de validação jurídica (P12). |
| L04 | Os valores dos requisitos não funcionais quantitativos (RNF06, RNF08–RNF12) foram definidos sem medições de utilização real. |
| L05 | Os documentos de requisitos não definem arquitetura, modelo de dados nem interface; estes constam do Architecture Pack (Ficha PL 02). |
