-- Prepara o PostgreSQL local para a Matriz (DT02, DT15). Executar uma vez, com o psql, como superutilizador:
--
--   & 'C:\Program Files\PostgreSQL\17\bin\psql.exe' -U postgres -h localhost -f scripts\db-setup.sql
--
-- A palavra-passe do role matriz é pedida pelo \password, sem eco, e enviada já cifrada (SCRAM):
-- nunca fica neste ficheiro, no histórico do psql nem nos logs do servidor (SEC08, AGENTS.md §7).
-- Depois, a mesma palavra-passe vai para DB_PASSWORD no .env local (ver .env.example).
--
-- Cria apenas o role e as bases vazias; os schemas e as tabelas são criados pelas migrations.
-- Não apaga nada: se o role ou as bases já existirem, o script para no primeiro erro.

\set ON_ERROR_STOP on

CREATE ROLE matriz LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE;
\echo 'Palavra-passe do role matriz:'
\password matriz

-- O role é dono das bases: pode criar os schemas por módulo e extensões confiáveis (p. ex. btree_gist),
-- e recriar os schemas da base de testes antes de cada execução.
CREATE DATABASE matriz OWNER matriz ENCODING 'UTF8' TEMPLATE template0;
CREATE DATABASE matriz_test OWNER matriz ENCODING 'UTF8' TEMPLATE template0;

\echo 'Role matriz e bases matriz e matriz_test criados.'
