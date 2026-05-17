# Guia de Contribuição - EventosBR

Primeiramente, obrigado por contribuir para a EventosBR! Este documento estabelece as diretrizes para garantir que o código se mantenha organizado, escalável, legível e seguro.

## 🚀 Padrões de Commit (Conventional Commits)

Utilizamos o padrão [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/) para manter o histórico claro e facilitar o entendimento das alterações.

O formato da sua mensagem de commit deve ser:
`<tipo>[escopo opcional]: <descrição>`

### Tipos permitidos:
* `feat`: Uma nova funcionalidade (ex: novos endpoints, novos componentes).
* `fix`: Correção de um bug ou erro.
* `docs`: Alterações que afetam apenas a documentação (README, Swagger, etc).
* `style`: Alterações de formatação que não afetam a lógica (espaçamento, ponto e vírgula, etc).
* `refactor`: Uma alteração de código que não corrige um bug nem adiciona funcionalidade, mas melhora a estrutura.
* `perf`: Uma alteração focada em melhorar a performance.
* `test`: Adição de testes ausentes ou correção de testes existentes.
* `chore`: Atualizações de ferramentas, dependências ou configurações de build.

**Exemplos:**
* `feat(auth): adiciona bloqueio de conta após 5 tentativas de login`
* `fix(api): corrige cálculo de taxa de reembolso para eventos antigos`
* `docs: atualiza instrução de setup do docker-compose`

## 🌿 Fluxo de Branches e Pull Requests

1. **Crie uma branch a partir da `main` (ou da branch de desenvolvimento base)**:
   Use nomes curtos, em inglês ou português, refletindo o tipo e o objetivo.
   *Exemplo:* `feat/pagamento-pix` ou `fix/botao-comprar`.

2. **Mantenha os commits organizados**:
   Faça commits lógicos e atômicos. Evite um commit gigante com milhares de alterações distintas.

3. **Abra o Pull Request (PR)**:
   * Descreva o "Por que" e o "O que" foi alterado.
   * Se a alteração envolver o Frontend (UI), adicione prints ou vídeos da tela.
   * Referencie issues ou cards do seu gestor de tarefas.

4. **Code Review**:
   Todo PR deve passar por revisão antes do merge. O objetivo do review não é julgar, mas garantir a qualidade e compartilhar conhecimento.

## 💻 Padrões de Código

### Backend (Python / FastAPI)
* **Type Hints Obrigatórios**: Todas as funções devem ter as tipagens de parâmetros e retorno claramente definidas.
  ```python
  # ❌ Incorreto
  def calcular_taxa(valor):
      return valor * 0.10

  # ✅ Correto
  def calcular_taxa(valor: float) -> float:
      return valor * 0.10
  ```
* **Docstrings**: Regras complexas (como cálculos financeiros e estornos) devem ter uma docstring explicativa.
* **Schemas Autodocumentados**: Use a funcionalidade do Pydantic para fornecer exemplos concretos no Swagger/ReDoc.

### Frontend (Next.js / TypeScript)
* **Zero `any`**: Mantenha o projeto 100% tipado. Tipifique adequadamente as props dos componentes e as respostas das requisições na API.
* **Responsabilidade Única**: Se um componente passar de 300 linhas, considere extrair partes menores para novos componentes.
* **Tailwind CSS**: Utilize utilitários do Tailwind em vez de criar classes customizadas no `globals.css` (exceto para variáveis de design system).

## 🧪 Testes
* Sempre que adicionar uma feature crítica (ex: regras de pagamento, login, criação de eventos), crie o cenário de teste correspondente ou valide cuidadosamente o fluxo principal (Happy Path) e os cenários de erro.
* Garanta que o projeto roda sem erros antes de fazer o push das alterações (`npm run build` no front e `pytest` no back, quando aplicável).