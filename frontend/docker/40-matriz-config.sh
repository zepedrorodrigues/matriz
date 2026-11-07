#!/bin/sh
# Escreve /config.js com a configuração pública do ambiente (corre no arranque do contentor nginx,
# antes do servidor). Só valores públicos: o endereço do emissor OIDC e o ID do cliente.
set -eu

: "${OIDC_AUTHORITY:?Falta OIDC_AUTHORITY (emissor OIDC, p. ex. https://sso.exemplo/realms/matriz)}"
: "${OIDC_CLIENT_ID:?Falta OIDC_CLIENT_ID (cliente público do frontend, p. ex. matriz-web)}"

# Os valores entram numa string JavaScript: recusam-se aspas, barras invertidas e '<'.
for value in "$OIDC_AUTHORITY" "$OIDC_CLIENT_ID"; do
  case "$value" in
    *'"'* | *'\'* | *'<'*) echo "40-matriz-config: valor inválido em OIDC_*" >&2; exit 1 ;;
  esac
done

cat > /usr/share/nginx/html/config.js <<EOF
window.__MATRIZ_CONFIG__ = { oidcAuthority: "$OIDC_AUTHORITY", oidcClientId: "$OIDC_CLIENT_ID" };
EOF
