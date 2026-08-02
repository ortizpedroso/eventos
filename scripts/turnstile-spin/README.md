# Turnstile — scripts Spin

## Erro comum no painel Cloudflare

Se aparece:

`invalid hostname (localhost , 127.0.0.1, eventosbr.app.br, ...)`

você colou **vários domínios num único campo**. O Turnstile exige **um hostname por entrada**.

### Painel Cloudflare (manual)

1. Turnstile → Add widget
2. Em **Hostname**, adicione **um por vez**:
   - `eventosbr.app.br`
   - `www.eventosbr.app.br`
   - (opcional dev) `localhost`
3. **Não** use: `eventosbr.app.br, www.eventosbr.app.br` no mesmo campo

### VPS (script)

```bash
# Produção — sem espaços após vírgula
bash scripts/setup-turnstile-e2e.sh --domains eventosbr.app.br,www.eventosbr.app.br

# Com localhost para dev local
bash scripts/setup-turnstile-e2e.sh --domains localhost,eventosbr.app.br,www.eventosbr.app.br
```

Ou só gravar chaves do painel:

```bash
bash scripts/configure-turnstile-env.sh
```
