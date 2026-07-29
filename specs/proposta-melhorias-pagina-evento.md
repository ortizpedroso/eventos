# Proposta: página de evento — o que o mercado faz e o que trazer pro EventosBR

**Data:** 29/07/2026
**Status:** 📋 Proposta para discussão — nada implementado ainda

---

## 1. Quem eu analisei

| Plataforma | Situação |
|---|---|
| **Sympla** | Líder do mercado brasileiro — e ficou **ainda maior**: a Eventbrite **encerrou operações no Brasil em dezembro/2025** (citou "instabilidade regulatória"), e a Sympla está absorvendo boa parte da migração |
| **Ingresse** | Foco em shows/festivais de maior porte, modelo mais "sob consulta" que autoatendimento |
| **Even3** | Forte em eventos acadêmicos/científicos (inscrições, certificados) |
| **Catraca Virtual** | Concorrente direto de preço com a Sympla, taxa fixa (vantagem em ingressos de valor mais alto) |
| **Zig** | Plataforma B2B para ingressos, foco em times/arenas |
| **Lets.events** | Diferencial em gestão de lista de convidados |
| **Uticket / SuperTixs** | Blogs voltados a produtor, bom material sobre o que funciona na prática |
| **Ticketmaster / SeatGeek / StubHub** | Referências internacionais (já usadas na pesquisa do redesenho do hero, mantidas aqui como padrão-ouro de UX) |

⚠️ **Achado importante:** a Eventbrite não é mais uma referência ativa no Brasil — vale **não imitar o modelo dela** como prioridade, e sim aproveitar esse momento (produtores órfãos procurando alternativa) como oportunidade de posicionamento.

## 2. O que os concorrentes fazem bem (padrões que se repetem)

1. **Prova social explícita** — fotos/vídeos de edições anteriores, depoimentos de participantes, "local lotado" em edições passadas. Quase toda fonte que li menciona isso como o gatilho mais eficaz.
2. **Urgência real, não genérica** — não é só escrever "últimos ingressos": contador regressivo, indicação clara de quantos restam no lote atual, aviso de troca de lote com antecedência.
3. **Ficha técnica completa e escaneável** — o que, quando, onde, quanto, e informações práticas (estacionamento, idade mínima, dress code, classificação). Um site cita isso literalmente: "página mal feita gera desconfiança e mata a venda".
4. **Upsell/cross-sell no checkout** (Sympla Store) — produtos/experiências extras vendidos junto do ingresso, sem sair do fluxo de compra, aumentando o ticket médio.
5. **Compartilhamento fácil** — botões de rede social, cupom personalizado pra cada comprador divulgar pra amigos (com recompensa por indicação).
6. **Identidade visual do evento** — a página "veste a camisa" do evento (cores, imagem), não só do organizador.

## 3. O que já temos que já bate com esses padrões

- ✅ Hero redesenhado (imagem nítida, CTA de compra na primeira dobra) — já pesquisado e implementado
- ✅ Lotes com indicação de "à venda"/"inativo"/vendidos por lote
- ✅ Reembolso automático, badges de pagamento seguro
- ✅ Mapa embutido (corrigido agora)
- ✅ Sistema de repasse/split transparente (diferencial forte — poucos concorrentes comunicam isso tão bem)

## 4. Oportunidades concretas — o que eu proponho trazer

### 4.1 Prova social (maior impacto, esforço médio)
- Campo opcional no cadastro do evento: **fotos de edições anteriores** (galeria pequena, 3-6 imagens)
- Contagem de **"X pessoas já confirmaram presença"** perto do botão de compra (já temos os dados — ingressos vendidos — só falta expor isso na UI de forma amigável, sem parecer "pressão artificial" demais)

### 4.2 Urgência mais visível (baixo esforço, alto impacto)
- Contador regressivo pro início das vendas de um lote, ou pro fim de um lote com prazo definido (já temos `urgencia_ativo`/`urgencia_badge` no modelo — dá pra evoluir a UI disso)
- Barra de progresso visual do lote atual ("faltam 12 de 50")

### 4.3 Ficha técnica mais completa (baixo esforço)
- Campos opcionais na criação de evento: classificação etária, "o que levar"/dress code, informações de estacionamento — hoje só temos descrição livre; padronizar isso em campos estruturados deixa a leitura mais rápida (a maioria dos concorrentes usa ícones + texto curto, não parágrafo)

### 4.4 Compartilhar e indicar (baixo esforço, ajuda alcance orgânico)
- Botões de compartilhamento (WhatsApp, Instagram Stories, copiar link) na página do evento — hoje não existe isso
- Reconsiderar cupom de indicação no médio prazo (mais complexo, envolve regra de negócio nova)

### 4.5 Consistência na página (achado da varredura — resolve a "informação repetitiva")
- O local do evento aparece hoje em até 3 lugares na mesma tela (resumo do topo, ficha técnica, texto acima do mapa) — proponho consolidar: manter no resumo do topo (rápido) e no mapa (contexto espacial), removendo a repetição na ficha técnica do meio

## 5. O que eu NÃO recomendo copiar agora
- **Upsell/loja integrada (tipo Sympla Store)**: alto valor, mas é uma feature grande (catálogo de produtos, estoque, split do valor extra) — vale um `/spec` dedicado depois do lançamento, não antes
- **App próprio / gamificação de pré-evento**: fora de escopo pro momento de lançamento

## 6. Proposta de ordem de execução (se você aprovar)

1. Corrigir a repetição de informação (rápido, resolve o achado da varredura)
2. Urgência mais visível (contador + barra de progresso) — já temos a base de dados
3. "X pessoas confirmaram" — já temos os dados de vendas
4. Botões de compartilhamento
5. Campos estruturados de ficha técnica (classificação etária, dress code, estacionamento)

---

**Aguardando sua aprovação pra transformar isso num `/spec` e depois `/build`.** Quer que eu comece por algum item específico, ou sigo a ordem sugerida?
