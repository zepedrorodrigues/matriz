// Em desenvolvimento fica vazio e valem as variáveis VITE_OIDC_* do .env (auth/runtime-config.ts).
// Na imagem de produção é substituído no arranque do contentor (docker/40-matriz-config.sh).
window.__MATRIZ_CONFIG__ = {};
