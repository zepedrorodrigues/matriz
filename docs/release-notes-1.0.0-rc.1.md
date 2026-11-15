# Matriz 1.0.0-rc.1 — notas da versão candidata

- **Data:** 2026-11-15
- **Versão:** `1.0.0-rc.1` (Semantic Versioning: primeira versão candidata à 1.0.0)
- **Etiqueta Git:** `v1.0.0-rc.1`, no commit `0e3118f` do `main` (merge do pull request #5; o código é o do commit `e8a1d79`). CI no commit etiquetado: execução `43711179061`, os dois jobs a passar.
- **Publicação no GitHub:** [v1.0.0-rc.1](https://github.com/zepedrorodrigues/matriz/releases/tag/v1.0.0-rc.1), marcada como pré-lançamento, com autorização do responsável do projeto.
- **Estado:** candidata. Não é uma publicação de produção (Ficha PL 05, Ex. 5): a página no GitHub identifica a versão, não publica imagens nem implanta nada.

## O que é

A Matriz é uma aplicação interna de gestão de projetos e tarefas por equipas. Esta versão contém o MVP completo (as dez user stories, US01–US10), a consulta do histórico e tudo o que é preciso para a construir, testar e executar de forma reproduzível.

## Destaques

- **Funcionalidade:** equipas e projetos, hierarquia de trabalho, tarefas com estimativa e atribuição, sprints por equipa com capacidade em horas, conclusão validada pelos critérios de aceitação, alertas, transferências entre equipas com rastreabilidade, comentários e histórico de cada elemento.
- **Executar com um comando:** `docker compose up --build -d --wait` arranca a base de dados, o Keycloak, as migrations, os dados de demonstração, duas instâncias da API, o frontend e o proxy. Aplicação em <http://localhost:5173>.
- **Pipeline:** cada pull request corre a análise estática, os tipos, 302 testes (255 do backend, 47 do frontend), o build e a análise de dependências; só depois constrói as imagens, analisa-as com o Trivy e corre os 2 testes End-to-End contra a aplicação completa.
- **Imagens sem vulnerabilidades altas ou críticas com correção** à data desta versão.

## Como executar

Ver o [`README.md`](../README.md): *Execução com Docker Compose* (só precisa do Docker) ou *Desenvolvimento* (Node.js, PostgreSQL e Keycloak locais).

## O que muda para quem já usava o repositório

| Antes | Agora |
|---|---|
| `docker compose --env-file .env -f deploy/compose.yaml up --build -d`, com um Keycloak local na porta 8180 e `host.docker.internal` no ficheiro `hosts` | `docker compose up --build -d --wait`, com o Keycloak incluído; nada a configurar no `hosts` |
| Migrations na imagem: `npm run migration:run:dist` | `node ../node_modules/typeorm/cli.js migration:run -d dist/src/shared/database/data-source.js` (a imagem final já não tem o npm) |
| Projeto do compose `matriz-local` | Projeto `matriz`. Um volume antigo `matriz-local_db-data` pode ser apagado com `docker volume rm matriz-local_db-data` |

O esquema da base de dados não muda nesta versão: não há migrations novas.

## Verificação

Resultados medidos, com as execuções do CI, em [`delivery-report.md`](delivery-report.md). Resumo: pipeline a passar no commit `e8a1d79` (execução `43710210612`); aplicação do compose saudável em 1 min 25 s no primeiro arranque; os dados mantêm-se depois de recriar os contentores; com um teste a falhar, a pipeline falha e não constrói imagens (execução `43709975844`).

## Limitações conhecidas

- **Não é a configuração de produção.** O Keycloak do compose corre em modo de desenvolvimento, não há TLS e as contas são fictícias. A produção depende do fornecedor de alojamento (DT06) e da réplica e cópias de segurança (DT13), ainda por escolher pelo cliente.
- **P12** — validação jurídica do período de retenção: por fechar.
- **Revisões futuras planeadas:** DT09 (volume dos alertas), DT10 (microservices), DT11 (eventos), DT12 (gestão de erros).
- **Achados pendentes da revisão de qualidade e de segurança:** S4, S6, S7, CR8, CR9 e CR10 — todos de severidade baixa (`quality-security-review.md` §2).
- **Dependências:** 3 vulnerabilidades moderadas através do `typeorm` 0.3, não exploráveis por um utilizador; a correção exige o `typeorm` 1.x.
- **Contrato da API:** o `openapi.yaml` tem a sua própria versão (`0.3.0`), que não foi alinhada com a da aplicação, e não foi validado com uma ferramenta de *lint* nesta entrega.
- **Imagens:** não são publicadas em nenhum registo; constroem-se a partir do repositório.

## Próximo passo para a 1.0.0

Fechar o P12, decidir o fornecedor de alojamento (DT06) e verificar a implantação nesse ambiente, com TLS e o fornecedor de identidade da empresa.
