# Plan B — rollback do /review v1.16

Pontos de restauração criados em **2026-07-29** para reverter o deploy se algo quebrar após o merge do review.

## Identificação rápida

| Papel | Tag (imutável) | Branch (deploy VPS) | Commit |
|-------|----------------|---------------------|--------|
| **PLAN B** (voltar ao estado Claude, antes do review) | `bkp-planb-antes-review-v1.16` | `cursor/bkp-planb-antes-review-v116-9182` | `cf8d88a` |
| Snapshot atual (pós-review, não é o Plan B) | `bkp-main-pos-review-v1.16` | `cursor/bkp-main-pos-review-v116-9182` | `ab62694` |

O **Plan B** é sempre a linha **antes** do review (`cf8d88a`). O snapshot `ab62694` só serve para voltar ao estado pós-review se alguém mexer em `main` depois.

## O que o Plan B desfaz

Ao voltar para `cf8d88a` / tag `bkp-planb-antes-review-v1.16`:

- remove Redis do job CI `api`
- volta SMTP direto (`smtplib`) em ingresso/notificação/lembrete/assinatura/marketing
- workers `email_simples` / `contato` deixam de iniciar no boot
- mapa do evento volta a exigir `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` (sem iframe `?output=embed`)
- OpenAPI volta a vazar “Asaas” (~49 ocorrências)
- UX de 2FA do cliente-admin / redirect do menu admin volta ao comportamento anterior

## Como executar o Plan B no VPS (sem alterar `main` no GitHub)

Deploy só da branch de backup:

```bash
cd /opt/eventosbr
bash scripts/atualizar-vps-branch.sh cursor/bkp-planb-antes-review-v116-9182
```

Para voltar depois ao código atual de `main`:

```bash
cd /opt/eventosbr && bash scripts/atualizar-vps-agora.sh
```

## Como executar o Plan B em `main` (GitHub + VPS)

Só se quiser que `main` volte de fato ao estado Claude:

```bash
# na máquina com push em main
git fetch origin
git checkout main
git reset --hard bkp-planb-antes-review-v1.16   # = cf8d88a
git push --force-with-lease origin main

# no VPS
cd /opt/eventosbr && bash scripts/atualizar-vps-agora.sh
```

Preferir o deploy por branch (`atualizar-vps-branch.sh`) quando o objetivo for só estabilizar produção sem force-push em `main`.

## Conferir os refs

```bash
git fetch origin --tags
git show bkp-planb-antes-review-v1.16 --no-patch
git log -1 --oneline origin/cursor/bkp-planb-antes-review-v116-9182
```
