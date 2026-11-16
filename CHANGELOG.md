# Changelog

Alterações da Matriz por versão. O formato segue o [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/) e as versões seguem o [Semantic Versioning](https://semver.org/lang/pt-BR/). Os identificadores (US, CA, RN, DT…) remetem para a especificação em `docs/`.

## [Não publicado]

Ambiente de avaliação público (DT21). As imagens não mudam: o ambiente corre as da `1.0.0-rc.2`.

### Adicionado

- **`compose.publico.yaml`** e **`deploy/Caddyfile`:** por cima do `compose.yaml`, põem a aplicação numa máquina com endereço público, por HTTPS, com certificado obtido e renovado pelo Caddy. A aplicação e o Keycloak partilham o endereço (Keycloak em `/auth`); só as portas 80 e 443 ficam publicadas; a administração do Keycloak responde 403 a quem vem de fora. Com `MATRIZ_REDIRECT_FROM`, um nome anterior da máquina redireciona para o atual.
- **`MATRIZ_PUBLIC_URL`** no `scripts/keycloak-ci.mjs`: limita o cliente `matriz-web` ao endereço público e desativa o cliente `matriz-dev-cli`. Sem a variável, o script faz o mesmo que antes.
- A aplicação está em <https://matriz-app.duckdns.org> durante a avaliação.

## [1.0.0-rc.2] — 2026-11-15

Segunda versão candidata: observabilidade e publicação das imagens (desafios opcionais B e C da Ficha PL 05, DT20). Notas da versão: [`docs/release-notes-1.0.0-rc.2.md`](docs/release-notes-1.0.0-rc.2.md).

### Adicionado

- **Registos estruturados:** o backend escreve uma linha JSON por registo em produção (`LOG_FORMAT=json` ou `text` para escolher), sem dependências novas.
- **Registo dos pedidos:** uma linha por pedido com identificador, método, caminho, código de resposta e duração. Não regista a query, o corpo, o token nem dados de utilizadores (SEC07). O identificador vai na resposta, em `X-Request-Id`, e o proxy do compose passa o seu ao backend.
- **`GET /api/health/live`** e **`GET /api/health/ready`**, no contrato `openapi.yaml` (60 operações). O `ready` responde 503 se a base de dados ou o fornecedor de identidade não responderem, e diz qual.
- **Publicação das imagens:** o workflow `release.yml` envia `matriz-backend` e `matriz-frontend` para o GitHub Container Registry quando uma versão é publicada, depois de as analisar com o Trivy.
- O `compose.yaml` pode usar imagens publicadas (`MATRIZ_BACKEND_IMAGE`, `MATRIZ_FRONTEND_IMAGE`).
- 22 testes novos no backend (277 no total).

### Alterado

- O proxy do compose passa a verificar `GET /api/health/ready`, que atravessa o backend, a base de dados e o fornecedor de identidade.
- No proxy, um 503 das verificações de saúde deixa de contar como falha da instância.

### Corrigido

- Defeito encontrado durante este trabalho, antes de chegar ao `main`: com o fornecedor de identidade parado, o 503 do `ready` fazia o nginx retirar as duas instâncias de serviço e toda a API respondia 502.

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

[1.0.0-rc.2]: https://github.com/zepedrorodrigues/matriz/releases/tag/v1.0.0-rc.2
[1.0.0-rc.1]: https://github.com/zepedrorodrigues/matriz/releases/tag/v1.0.0-rc.1
