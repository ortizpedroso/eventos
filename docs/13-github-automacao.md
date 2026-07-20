# 13 — Automação GitHub (CI + PR automático)

**Atualizado:** 2026-07-14

## CI em branches `cursor/*`

O workflow `.github/workflows/ci.yml` roda em:

- `push` para `main`, `master` e `cursor/**`
- `pull_request` (qualquer branch)

Assim, cada push do Cloud Agent dispara pytest, build Next.js e E2E.

---

## PR automático (Cursor Agent)

Workflow: `.github/workflows/cursor-agent-pr.yml`

Em cada `push` para `cursor/**`:

1. Procura PR aberto `cursor/...` → `main`
2. Se existir, comenta com o novo commit
3. Se não existir, cria **draft PR**

### Habilitar criação automática de PR (obrigatório uma vez)

No GitHub: **ortizpedroso/eventos** → **Settings** → **Actions** → **General**

Em **Workflow permissions**:

1. Selecione **Read and write permissions**
2. Marque **Allow GitHub Actions to create and approve pull requests**
3. Salve

Sem isso, o workflow ainda roda o CI mas retorna:

`GitHub Actions is not permitted to create or approve pull requests`

Nesse caso, use o link **Compare** no resumo do workflow ou:

```
https://github.com/ortizpedroso/eventos/compare/main...SUA_BRANCH?expand=1
```

---

## Backup produção no VPS

| Script | Arquivo gerado |
|--------|----------------|
| `./scripts/backup-prod-env.sh` | `.env.prod-backup` (completo) |
| `./scripts/verify-prod-backup.sh` | valida 11 chaves obrigatórias |
| `./scripts/sync-asaas-prod-from-backup.sh` | restaura no `.env` no deploy |

Template: `.env.prod-backup.example`
