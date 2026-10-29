# Matriz

Aplicação interna de gestão de projetos e tarefas para equipas de trabalho, ao estilo de Jira, Azure DevOps ou Trello.

> **Estado atual:** Specification Pack v0.5 (Ficha PL 01) e Architecture Pack revisto (Ficha PL 02): arquitetura, modelo de dados, API e wireframe. Tecnologias escolhidas (`docs/constraints.md` §4.3); ainda não há código.

## Problema

O pedido inicial do cliente foi:

> "Precisamos de uma aplicação onde as nossas equipas possam organizar projetos, gerir tarefas e acompanhar o progresso do trabalho."

O cliente não definiu funcionalidades, regras de negócio, requisitos técnicos nem prioridades. A análise de requisitos (Ex. 1–3) transformou este pedido numa especificação verificável, revista criticamente no Ex. 6.

## Objetivos principais

- Organizar o trabalho por **equipas e projetos**, com responsabilidades claras.
- **Decompor o trabalho** em objetivos, épicos, tarefas e subtarefas.
- **Planear em sprints por equipa** com visibilidade sobre a capacidade disponível, medida em horas, e notificação quando esta é excedida; os story points são uma estimativa independente, sem conversão.
- Saber objetivamente **quando uma tarefa está cumprida**, com base em todos os seus critérios de aceitação.
- Dar **visibilidade** sobre progresso, desvios e alertas.
- Garantir **rastreabilidade**: quem executou cada tarefa e a que equipa pertencia, mesmo após transferências.

Detalhe em [`docs/requirements.md`](docs/requirements.md) §1.

## Funcionalidades previstas para o MVP

| ID | Funcionalidade | Prioridade |
|---|---|---|
| US01 | Gerir equipas e projetos | P0 |
| US02 | Gerir a hierarquia de trabalho (Objetivos → Épicos → Tarefas → Subtarefas) | P0 |
| US03 | Criar, estimar e atribuir tarefas | P0 |
| US04 | Gerir backlog e sprints por equipa | P0 |
| US05 | Consultar capacidade e carga de trabalho | P0 |
| US06 | Atualizar o estado e validar a conclusão das tarefas | P0 |
| US07 | Consultar progresso, desvios e alertas (versão básica) | P1 |
| US08 | Propor trabalho no backlog | P1 |
| US09 | Atribuir e transferir tarefas entre equipas, preservando o histórico | P1 |

O MVP destina-se à utilização interna da empresa. Os critérios de aceitação estão em [`docs/user-stories.md`](docs/user-stories.md).

## Organização da documentação

```
matriz/
├── README.md              visão geral e estado do projeto
├── AGENTS.md              instruções para coding agents
├── openapi.yaml           contrato REST (OpenAPI 3.1) de operações do MVP (Ficha PL 02)
└── docs/
    ├── requirements.md    visão, utilizadores, regras de negócio, RF, RNF, âmbito do MVP
    ├── user-stories.md    user stories, prioridades, critérios de aceitação, casos excecionais
    ├── constraints.md     restrições, pressupostos, segurança e privacidade, decisões
    ├── review.md          revisões críticas: problemas encontrados e decisões tomadas
    ├── architecture.md    arquitetura: estilo, módulos, interação, implantação (Ficha PL 02)
    ├── database.md        modelo de dados e diagrama ER em Mermaid (Ficha PL 02)
    └── ui/
        ├── wireframe.svg  wireframe do planeamento da sprint (Ficha PL 02)
        └── wireframe.md   navegação e validação do wireframe face ao MVP
```

### Utilização como contexto

1. Ordem de leitura: `requirements.md` → `user-stories.md` → `constraints.md`. O `review.md` regista a revisão crítica e não é normativo: as decisões nele tomadas estão incorporadas nos restantes documentos.
2. Precedência por estado: **Confirmado** > **Proposto** > **Pressupostos**. Dentro do conteúdo Confirmado: regras de negócio (RN) > requisitos (RF, RNF, SEC) > User Stories e CA. Conteúdo Proposto e Pressupostos só são usados depois de aprovados.
3. Comportamento que dependa de uma decisão pendente (`Dxx`) não é implementado enquanto a decisão não estiver registada.
4. Quando uma decisão é tomada, regista-se no documento respetivo e passa da lista de pendentes para a de resolvidos (`constraints.md` §4.3).

Os coding agents seguem, além disto, as instruções de [`AGENTS.md`](AGENTS.md).

### Identificadores

| Prefixo | Significado | Documento |
|---|---|---|
| OBJ | Objetivo do produto | requirements.md |
| RN | Regra de negócio | requirements.md |
| RF / RNF | Requisito funcional / não funcional | requirements.md |
| US / CA / EC | User story / critério de aceitação / caso excecional | user-stories.md |
| CAT | Critério de aceitação transversal | user-stories.md |
| R / P / L | Restrição / pressuposto / limitação de âmbito | constraints.md |
| SEC | Requisito de segurança e privacidade | constraints.md |
| D / DT | Decisão pendente funcional / técnica | constraints.md |

## Estado atual

- [x] Ex. 1 — Prompt engineering
- [x] Ex. 2 — Análise de requisitos e âmbito do MVP
- [x] Ex. 3 — User stories e critérios de aceitação
- [x] Ex. 4 — Specification Pack v0.1
- [x] Ex. 5 — `AGENTS.md`
- [x] Ex. 6 — Revisão crítica (human-in-the-loop) — Specification Pack v0.3, ver [`docs/review.md`](docs/review.md)
- [x] Aula 2 (Ficha PL 02) — Architecture Pack: arquitetura, modelo de dados, API e wireframe, com revisão cruzada (human-in-the-loop), ver [`docs/review.md`](docs/review.md) §3

**Em números:** 37 regras de negócio · 31 requisitos funcionais · 12 requisitos não funcionais · 9 user stories · 97 critérios de aceitação (91 nas US e 6 transversais), todos verificáveis · sem decisões funcionais pendentes.

**Pendentes:** P12 (validação jurídica da retenção); verificação visual dos diagramas Mermaid e do wireframe. Revisões futuras planeadas: DT09–DT13 (alertas, microservices, eventos, erros, alta disponibilidade).
