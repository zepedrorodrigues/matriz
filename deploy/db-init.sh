#!/bin/sh
# Primeiro arranque do PostgreSQL do compose (corre uma vez, com o volume vazio): cria o role da
# aplicação sem privilégios de superutilizador e a base matriz, como o scripts/db-setup.sql.
# O role é dono da base (cria os schemas e as extensões confiáveis) mas não é superutilizador: é o
# que faz valer o REVOKE sobre o histórico (SEC04, CAT04).
# A palavra-passe vem do ambiente (MATRIZ_DB_PASSWORD) e passa como variável do psql, nunca no texto.
set -eu

: "${MATRIZ_DB_PASSWORD:?Falta MATRIZ_DB_PASSWORD}"

psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -v pw="$MATRIZ_DB_PASSWORD" <<'SQL'
CREATE ROLE matriz LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE PASSWORD :'pw';
CREATE DATABASE matriz OWNER matriz ENCODING 'UTF8' TEMPLATE template0;
SQL
