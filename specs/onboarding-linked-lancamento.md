# Spec: Onboarding de repasse em modo `linked` para o lançamento

**Versão:** 1.1
**Data:** 2026-07-25
**Status:** ✅ Implementado e validado em produção

## 1. Objetivo

Permitir o lançamento comercial da plataforma **sem CNPJ da conta mãe Asaas**, usando o modo `linked` (organizador vincula a própria conta Asaas já existente ou recém-criada) em vez do modo `baas` (subconta invisível, que exige CNPJ — ver `specs/eventosbr-producao.md` §5.5, §7).

## 2. Contexto / por que

- O modo `baas` (criação de subconta via `POST /v3/accounts`) exige que a conta mãe da plataforma seja pessoa jurídica (CNPJ) — bloqueio regulatório (BACEN), confirmado em pesquisa aprofundada de mercado (nenhum PSP pesquisado oferece onboarding 100% invisível para plataforma pessoa física).
- O modo `linked` não tem essa exigência: o organizador cria/usa uma conta Asaas própria e independente, e a plataforma só consulta o `walletId` dessa conta (via chave de API) para configurar o split.
- Trade-off aceito conscientemente: o organizador **sabe** que existe um Asaas por trás (ele mesmo cria a conta), diferente do `baas` que é 100% invisível. Lançamento serve também para validar aceitação do público com essa fricção.

## 3. Requisitos exatos

1. `ASAAS_ONBOARDING_MODE=linked` deve ser aceito como configuração válida e completa em produção (não apenas em dev/test).
2. `production_checks.py::build_setup_status()` não deve reportar `asaas_onboarding_mode` como `"pendente"` quando o modo é `linked` em produção.
3. Quando `permite_vinculo_wallet_organizador()` é `True`, a tela do organizador (`organizador-repasses-painel.tsx`) deve oferecer o botão "Vincular conta existente" — **já existente**, sem alteração necessária.
4. O formulário de vínculo deve incluir um link visível para o organizador criar uma conta Asaas gratuita, caso ainda não tenha uma — **requisito novo desta spec**.
   - Se o Asaas tiver programa de afiliados/indicação disponível para a plataforma: usar o link de afiliado.
   - Caso contrário (confirmado: o programa de parceiros do Asaas exige CNPJ, que a plataforma não tem): usar o link oficial de cadastro `https://www.asaas.com/onboarding/createAccount?customerSignUpOriginChannel=EVENTOSBR`.
5. Abaixo do link, uma instrução curta de como obter a chave de API dentro da conta Asaas recém-criada (Integrações → Chave de API).
6. O fluxo de busca automática do `walletId` via chave de API (`consultar_wallet_organizador_por_api_key` / botão "Buscar ID") já existente **não deve ser alterado** — é o mecanismo central do modo `linked`.

## 4. Casos extremos

- **Organizador já tinha conta Asaas antes de conhecer a plataforma:** deve funcionar normalmente — o vínculo usa a chave de API de qualquer conta Asaas existente, criada dentro ou fora do fluxo da plataforma (confirmado via documentação oficial do Asaas: `walletId` "pode ser recuperado pela API quando você possui a chave de API da conta destino").
- **`ASAAS_ONBOARDING_MODE=both`:** ambos os botões ("Vincular conta existente" e "Criar conta de recebimento") continuam aparecendo — comportamento inalterado, não é o modo ativo no lançamento mas o código permanece compatível.
- **CNPJ resolvido futuramente:** trocar `ASAAS_ONBOARDING_MODE` para `both` ou `baas` no `.env` reativa o fluxo invisível sem mudança de código — nenhuma migração de dado necessária, pois `walletId` já vinculado continua válido independentemente do modo.

## 5. Definição de "concluído"

- [x] `production_checks.py`: modo `linked` aceito em produção (`onboarding_ok`)
- [x] Teste `test_onboarding_linked_aceito_em_producao` cobrindo o caso acima
- [x] Link de criação de conta Asaas visível no formulário de vínculo (`organizador-repasses-painel.tsx`)
- [x] `pytest` verde (266 testes)
- [x] `npm run build` (produção) sem erros
- [x] `.env` de produção atualizado com `ASAAS_ONBOARDING_MODE=linked` — confirmado em produção (25/07/2026)
- [x] Validação manual no VPS: fluxo funcionando, confirmado pelo usuário ("a parte do Asaas deu certo na atualização")

## 6. Fora de escopo (não construído nesta spec)

- Alteração da UI para explicitamente mostrar o nome "Asaas" (a UI já é neutra o suficiente — o link de cadastro é a única exposição direta da marca)
- Fluxo de retorno automático ao Asaas via OAuth (o Asaas não oferece esse mecanismo — é colar a chave manualmente)
- Reversão para `baas` quando o CNPJ estiver disponível (trivial — só variável de ambiente, não requer spec própria)
