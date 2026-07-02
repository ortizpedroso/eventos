---
name: spec-build-review
description: Workflow de três comandos para construir funcionalidades com rigor: /spec entrevista o usuário e escreve uma especificação em specs/<nome>.md; /build lê a spec e constrói exatamente o que ela descreve; /review compara a build com a spec e lista lacunas. Use quando o usuário digitar /spec, /build ou /review, ou quando pedir para especificar, construir a partir de uma spec, ou revisar uma build contra uma spec.
disable-model-invocation: true
---

# Spec / Build / Review

Três comandos que formam um ciclo completo de desenvolvimento disciplinado.

---

## /spec — Entrevistar e escrever especificação

**Objetivo:** entender completamente o que o usuário quer construir antes de tocar no código.

### Regras

- Faça **uma pergunta por vez**, específica e direta.
- Espere a resposta antes de fazer a próxima pergunta.
- Não sugira soluções técnicas durante a entrevista.
- Continue até cobrir todas as dimensões abaixo.

### Dimensões obrigatórias da entrevista

1. **Objetivo** — qual problema isso resolve? Para quem?
2. **Requisitos funcionais** — o que o sistema deve fazer? (lista exaustiva)
3. **Requisitos não-funcionais** — performance, segurança, acessibilidade, limites?
4. **Casos extremos** — o que pode dar errado? Entradas inválidas? Estados inesperados?
5. **Restrições** — tecnologia, integrações existentes, o que não deve ser alterado?
6. **Definição de "concluído"** — como o usuário vai verificar que está pronto? (testes manuais, critérios objetivos)

### Ao ter informações suficientes

Escreva a especificação em `specs/<nome-kebab-case>.md` seguindo este template. A spec canônica do produto é `specs/eventosbr-produto-completo.md`.

```markdown
# Spec: <título>

**Data:** YYYY-MM-DD  
**Status:** rascunho | aprovada | implementada

---

## Objetivo

[Uma ou duas frases: o que isso faz e para quem.]

---

## Requisitos

### Funcionais

- REQ-01: ...
- REQ-02: ...
- REQ-0N: ...

### Não-funcionais

- RNF-01: ...

---

## Casos extremos

- CE-01: [situação] → [comportamento esperado]
- CE-0N: ...

---

## Restrições

- Não alterar: ...
- Tecnologia obrigatória: ...

---

## Definição de concluído

Checklist verificável (cada item é um teste manual ou automatizado):

- [ ] DC-01: ...
- [ ] DC-0N: ...
```

Após salvar o arquivo, exiba o caminho e pergunte ao usuário se a spec está correta antes de qualquer build.

---

## /build — Construir exatamente a spec

**Objetivo:** implementar todos os requisitos da spec, nada a mais, nada a menos.

### Regras

- Leia `specs/eventosbr-produto-completo.md` (ou `specs/<nome>.md` se indicado) **antes** de escrever qualquer código.
- Implemente apenas o que está na spec. Não refatore código não relacionado.
- Não invente requisitos ausentes — se algo for ambíguo, implemente a interpretação mais conservadora.
- Ao concluir, liste cada REQ-XX e DC-XX da spec e marque como ✅ atendido ou ⚠️ parcial, com notas.

### Formato de saída

```
## Build concluída

### Requisitos atendidos
- ✅ REQ-01: <descrição breve>
- ✅ REQ-02: <descrição breve>
- ⚠️ REQ-03: parcialmente — [motivo]

### Definição de concluído
- ✅ DC-01: <como verificar>
- ✅ DC-02: <como verificar>

### Arquivos modificados
- `caminho/arquivo.py` — [o que mudou]
```

---

## /review — Revisar build contra a spec

**Objetivo:** verificar se todos os requisitos da spec foram atendidos. Ser a barreira de qualidade.

### Regras

- Leia `specs/eventosbr-produto-completo.md` e compare com o código atual.
- Analise **cada** REQ-XX e DC-XX individualmente.
- Seja exato: cite o item da spec que falha ou passa.
- A build só é aprovada quando **todos** os itens estiverem OK.
- Se houver lacunas, escreva as correções necessárias em formato acionável para o `/build`.

### Formato de saída — com lacunas

```
## Review: REPROVADO

### Lacunas encontradas

| Item | Status | Detalhe |
|------|--------|---------|
| REQ-03 | ❌ Faltando | O campo X não valida Y |
| DC-02  | ❌ Incompleto | Cenário Z não é coberto |

### Correções necessárias para /build

1. **REQ-03**: Adicionar validação Y no campo X em `arquivo.py:linha`.
2. **DC-02**: Cobrir o cenário Z no teste `tests/test_x.py`.
```

### Formato de saída — aprovado

```
## Review: APROVADO ✅

Todos os requisitos da spec `specs/<nome>.md` foram atendidos:

| Item | Status |
|------|--------|
| REQ-01 | ✅ |
| REQ-0N | ✅ |
| DC-01  | ✅ |
| DC-0N  | ✅ |
```
