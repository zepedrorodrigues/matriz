# Changelog

Alterações da Matriz por versão. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Semantic Versioning](https://semver.org/lang/pt-BR/). Os identificadores (US, CA, RN, DT…) remetem para a especificação em `docs/`.

## [1.0.0-rc.1] — 2026-11-15

Primeira versão identificada: versão candidata do MVP. Reúne o trabalho das Fichas PL 01 a 05, desde 2026-10-22. Notas da versão: [`docs/release-notes-1.0.0-rc.1.md`](docs/release-notes-1.0.0-rc.1.md).

### Adicionado

- **MVP completo (US01–US10):** equipas e projetos; hierarquia Objetivos → Épicos → Tarefas → Subtarefas; criação, estimativa e atribuição de tarefas; backlog e sprints por equipa; capacidade e carga de trabalho; estados e validação da conclusão pelos critérios de aceitação; progresso, desvios e alertas; propostas no backlog; transferência de tarefas entre equipas com o histórico preservado; comentários.
- **Consulta do histórico (I13, D50):** linha temporal de cada tarefa, projeto, objetivo, épico, sprint e equipa, com as permissões e os filtros de SEC07 e CAT06.
- **API REST/JSON** descrita em `openapi.yaml` (OpenAPI 3.1, 58 operações), com erros em *problem details* (RFC 9457).
- **Autenticação OpenID Connect** (Authorization Code + PKCE) com Keycloak; a conta da Matriz liga-se à identidade no primeiro acesso (RN35).
- **Testes:** 255 testes do backend (unitários e de integração contra PostgreSQL), 47 do frontend e 2 End-to-End com Playwright (`E2E-01`, `SEC-01`).
- **Análise estática** com ESLint e `typescript-eslint` (`npm run lint`, DT18).
- **Integração contínua** no GitHub Actions (DT18, DT19): análise estática, tipos, testes, build e `npm audit`; depois, imagens Docker, análise com o Trivy e testes End-to-End contra a aplicação completa.
- **Imagens de contentor** do backend e do frontend (DT16) e **`compose.yaml`** com a aplicação completa: PostgreSQL, Keycloak, migrations, dados de demonstração, duas instâncias do backend, frontend e proxy, com verificações de saúde e volumes (DT19).
- **Documentação:** especificação (`requirements.md`, `user-stories.md`, `constraints.md`), arquitetura com diagramas Mermaid, modelo de dados, plano de testes, revisão de qualidade e de segurança, verificação e relatório da entrega.

### Alterado

- O compose passa de `deploy/compose.yaml` para `compose.yaml`, na raiz, e deixa de depender de um Keycloak instalado no computador: o emissor OIDC é `http://keycloak.localhost:8080` (DT19).
- Imagem do frontend e proxy em `nginx:1.30-alpine` (antes 1.29, sem atualizações desde abril de 2026).
- A imagem final do backend deixa de ter a CLI do npm. As migrations correm com `node ../node_modules/typeorm/cli.js migration:run -d dist/src/shared/database/data-source.js` (antes `npm run migration:run:dist`, que continua a existir fora da imagem).
- No CI, o job dos testes End-to-End passa a usar a aplicação do `compose.yaml` em vez de arrancar cada serviço à mão.
- Interface reformulada com shadcn/ui e Tailwind CSS 4 (DT17).

### Corrigido

- Leituras de outro módulo com uma segunda ligação do pool dentro de uma transação, que podiam esgotar o pool com muitas escritas em simultâneo.
- Alerta de sobrecarga repetido por duas transações em simultâneo, e equipa desativada com uma tarefa aberta criada no mesmo instante (auditoria de 2026-11-07).
- *Deadlock* entre planear e transferir a mesma tarefa (CR1); `?page=1e21` devolvia 500 (S5).
- Seis avisos do ESLint em três ficheiros, sem mudança de comportamento.

### Segurança

- Quem sai de uma equipa perde o acesso às tarefas dela (S1); o responsável de outra equipa já não edita o título nem as estimativas (S2); os alertas deixam de mostrar dados de uma tarefa que o destinatário deixou de ver (S3).
- O histórico é só de acrescento na base de dados (SEC04): o role da aplicação não pode alterar nem apagar eventos. No compose, o role `matriz` é criado sem privilégios de superutilizador, para o `REVOKE` valer.
- Imagens sem vulnerabilidades altas ou críticas com correção (Trivy 0.76.2): o frontend tinha 58 nos pacotes do Alpine e o backend 6 na CLI do npm.

### Limitações conhecidas

- P12 (validação jurídica da retenção) por fechar; DT09–DT12 são revisões futuras.
- Achados pendentes da revisão: S4, S6, S7, CR8–CR10 (`docs/quality-security-review.md`).
- 3 vulnerabilidades moderadas nas dependências de produção, através do `typeorm` 0.3; a correção exige o `typeorm` 1.x.
- O `compose.yaml` não é a configuração de produção: Keycloak em modo de desenvolvimento, sem TLS, contas fictícias.

[1.0.0-rc.1]: https://github.com/zepedrorodrigues/matriz/releases/tag/v1.0.0-rc.1
