# Plano pré-lançamento: posicionamento + animação

**Data:** 30/07/2026
**Status:** 📋 Proposta — aguardando aprovação item a item

---

## 0. GitHub — limpeza feita

- 3 PRs abertas (#65, #63, #61) revisadas e fechadas — todas defasadas em relação ao `main` atual; mesclar qualquer uma reverteria trabalho já feito depois. Comentário explicando o motivo deixado em cada uma.
- 128 branches remotos apagados (101 já mesclados + 27 órfãos sem PR, de fases bem anteriores do projeto)
- Preservados de propósito: os 2 branches de backup (`cursor/bkp-*`) — são a rede de segurança de rollback, não devem ser apagados

Repositório limpo: só `main` + os 2 backups.

---

## 1. Minha avaliação da análise competitiva

Concordo com o diagnóstico geral (híbrido B2C/B2B, produto forte mal empacotado). Onde ajustei:

- **Reordenei**: a página "Para produtores" vem antes da animação — ela resolve o "gap principal" que o próprio documento identifica; animação é polimento, não resolve gap de negócio nenhum.
- **Subi a prioridade de Apple/Google Wallet** (estava em "alto esforço, depois") — conecta direto com a reclamação que você mesmo fez sobre o QR code no celular. Carteira digital é a solução mais robusta pra esse problema especificamente (funciona sem internet, na tela de bloqueio, atualiza sozinha se o evento mudar). Mais trabalho que a carteirinha em PNG que já existe, mas resolve melhor.

---

## 2. Ordem proposta (pré-lançamento)

| # | Item | Por quê nessa posição |
|---|---|---|
| 1 | Página "Para produtores" | Resolve o gap principal — sem isso o resto fica escondido |
| 2 | Home com uma promessa (separar Comprar × Sou produtor) | Mesma frente do item 1 |
| 3 | Animação leve — Fase 1 (ver seção 3) | Polimento, mas rápido e de baixo risco |
| 4 | Fechar GitHub | ✅ Já feito (seção 0) |

**Depois do lançamento:** promoters/afiliados, recuperação de carrinho, prova social viva, PDV, mapa de assentos, Apple/Google Wallet.

---

## 3. Plano de animação (pesquisado — práticas de 2026)

### Princípios não-negociáveis
- **CSS em vez de JS** sempre que possível (transform/opacity — usa GPU, não trava a thread principal)
- **`prefers-reduced-motion` respeitado em tudo** — ~35% dos usuários tem sensibilidade a movimento; é também critério de acessibilidade do Lighthouse (afeta SEO)
- **Sem autoplay de fundo animado pesado**, principalmente no mobile (rede/bateria)
- **Só anima quando entra na tela** (Intersection Observer), nunca a página inteira de uma vez
- Durações curtas: 150–300ms pra micro-interação, até 400ms pra reveal de seção

### Fase 1 — Micro-interações (baixo risco, base pra tudo)
- Botões: leve elevação + sombra no hover (`translateY(-2px)`, sombra suave)
- Cards de evento: leve escala/elevação no hover
- Campos de formulário: transição suave de foco (borda + sombra)
- Scroll-reveal simples (fade + subida de 20px) nas seções da home, Funcionalidades, Planos, Sobre — não na página de evento nem no checkout (ali a prioridade é velocidade, não estética)

```css
/* Exemplo do padrão a seguir em todo o site */
.reveal {
  opacity: 0;
  transform: translateY(20px);
  transition: opacity 400ms ease-out, transform 400ms ease-out;
}
.reveal.visible { opacity: 1; transform: translateY(0); }

@media (prefers-reduced-motion: reduce) {
  .reveal { transition: none; opacity: 1; transform: none; }
}
```

### Fase 2 — Hero e conversão
- Números da home (ex.: "+X eventos publicados") contando de 0 até o valor real quando entra na tela
- Micro-celebração ao concluir uma compra (confete leve ou check animado) — momento emocional positivo, comum em apps de ingresso
- Transição suave entre estados do checkout (carregando → confirmado)

### Fase 3 — Refinamento (depois do lançamento)
- Transições de página mais elaboradas
- Interações mais ricas na página do evento (ex.: barra de progresso do lote animando ao vivo)

---

## 4. Próximo passo

Aprova a ordem da seção 2? Se sim, começo pela página "Para produtores".
