# Auditoria de lançamento — correções pertinentes (ago/2026)

Documento de trabalho da rodada v1.50.9. Escopo: itens **necessários e pertinentes** da auditoria (não o backlog completo de polish UI).

## Implementado nesta versão (§2.21 da spec)

| # | Item | Ação |
|---|---|---|
| 1 | Mensagem Docker/uvicorn no cliente | Mensagem genérica em produção (`NODE_ENV`) |
| 2 | Upload com bytes inválidos | `redimensionar_imagem` rejeita (não fail-open) |
| 3 | Sem `not-found` / `error` | Páginas App Router adicionadas |
| 4 | Sitemap limitado a 100 | Paginação via `skip` até esgotar |
| 5 | Produtor sem SSR/metadata | `generateMetadata` + fetch SSR + `initialPerfil` |
| 6 | Twitter/canonical em evento | Twitter card alinhado ao OG |
| 7 | robots incompleto | Disallow de rotas privadas extras |
| 8 | `migrate_encryption` incompleto | Inclui `asaas_repasse_cpf_cnpj` e `totp_secret` |
| 9 | Next 16.2.6 | Bump para 16.3.0 |
| 10 | `graphify-out` | Ignorado no `.gitignore` |

## Fora de escopo (backlog)

Contraste `text-zinc-400`, `text-[10px]`, `window.confirm`, skeletons admin, touch 44px, CSP no FastAPI (CSP já existe no Next/proxy), enumeração de e-mail no registro (comportamento consciente).
