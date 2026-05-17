# 🎯 Guia Rápido de Uso - EventosBR API

## ⚡ Iniciar Rápido (Docker)

```bash
# 1. Clone/acesse o projeto
cd eventosbr

# 2. Configure variáveis de ambiente
cp .env.example .env
# Edite .env com suas chaves Stripe

# 3. Inicie com Docker
docker-compose up -d --build

# 4. Acesse a documentação
# Swagger: http://localhost:8000/docs
# ReDoc: http://localhost:8000/redoc
```

## ⚡ Iniciar Rápido (Local)

```bash
# 1. Setup (escolha seu SO)
# Windows:
setup.bat

# Linux/Mac:
bash setup.sh

# 2. Configure .env
nano .env

# 3. Rode a aplicação
python -m app.main
```

## 📋 Fluxo de Uso Típico

### 1️⃣ Registro e Login

```bash
# Registrar organizador
curl -X POST "http://localhost:8000/api/auth/registrar" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "org@exemplo.com",
    "nome": "Meu Nome",
    "senha": "senha123",
    "tipo": "organizador"
  }'

# Resposta:
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...",
  "token_type": "bearer",
  "usuario": {
    "id": "uuid-aqui",
    "email": "org@exemplo.com",
    "nome": "Meu Nome",
    "tipo": "organizador",
    "data_criacao": "2025-05-07T10:00:00"
  }
}

# Salve o token para próximas requisições
TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."
```

### 2️⃣ Criar Evento

```bash
curl -X POST "http://localhost:8000/api/eventos/criar" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Tech Summit 2025",
    "descricao": "Conferência de tecnologia",
    "data_inicio": "2025-08-20T09:00:00",
    "local": "São Paulo, SP",
    "imagem_url": "https://exemplo.com/imagem.jpg"
  }'

# Resposta:
{
  "id": "evento-uuid",
  "slug": "tech-summit-2025",
  "nome": "Tech Summit 2025",
  "descricao": "Conferência de tecnologia",
  "data_inicio": "2025-08-20T09:00:00",
  "local": "São Paulo, SP",
  "imagem_url": "https://exemplo.com/imagem.jpg",
  "data_criacao": "2025-05-07T10:00:00"
}
```

### 3️⃣ Cliente Compra Ingresso

```bash
# Registrar cliente
curl -X POST "http://localhost:8000/api/auth/registrar" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "cliente@exemplo.com",
    "nome": "João Cliente",
    "senha": "senha123",
    "tipo": "cliente"
  }'

# Salvar token do cliente
CLIENT_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."

# Criar pagamento (intenção de pagamento Stripe)
curl -X POST "http://localhost:8000/api/pagamentos/criar" \
  -H "Authorization: Bearer $CLIENT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "evento_id": "evento-uuid",
    "valor": 50.00
  }'

# Resposta:
{
  "client_secret": "pi_1234567890_secret_abcdefgh",
  "ingresso_id": "ingresso-uuid"
}
```

## 🔑 Autenticação

### Padrão Bearer Token

```bash
curl -X GET "http://localhost:8000/api/ingressos/meus" \
  -H "Authorization: Bearer seu_token_aqui"
```

### Obter novo token (Login)

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "seu-email@exemplo.com",
    "senha": "sua-senha"
  }'
```

## 💳 Processamento de Pagamento

### Fluxo Stripe

1. **Backend cria PaymentIntent**
   ```
   POST /api/pagamentos/criar
   ```

2. **Frontend captura `client_secret`**
   - Use a biblioteca Stripe.js do frontend

3. **Frontend confirma pagamento**
   - Stripe envia webhook para backend

4. **Backend processa webhook**
   - Atualiza status do ingresso para "pago"
   - Confirma transação

### Webhook em desenvolvimento (Windows)

Requer [Stripe CLI](https://stripe.com/docs/stripe-cli) (`stripe login`).

```powershell
.\scripts\stripe-webhook-setup.ps1    # grava whsec no .env
docker compose restart api
.\scripts\stripe-webhook-dev.ps1      # terminal A — deixe aberto
.\scripts\compra-teste-stripe.ps1     # terminal B — compra automática
```

Sem CLI: após criar o ingresso pendente, use `POST /api/webhooks/mock-payment?ingresso_id=...` (apenas `DEBUG` + `ENVIRONMENT=development`).

Detalhes e erros comuns: [TROUBLESHOOTING.md](TROUBLESHOOTING.md#stripe--webhook-e-compra-de-teste).

## 📊 Endpoints Principais

| Método | Endpoint | Auth | Descrição |
|--------|----------|------|-----------|
| POST | `/api/auth/registrar` | ❌ | Registrar novo usuário |
| POST | `/api/auth/login` | ❌ | Fazer login |
| GET | `/health` | ❌ | Liveness (processo vivo) |
| GET | `/ready` | ❌ | Readiness (inclui BD; 503 se falhar) |
| POST | `/api/eventos/criar` | ✅ | Criar evento (organizador) |
| GET | `/api/eventos/` | ❌ | Listar eventos |
| GET | `/api/eventos/{slug}` | ❌ | Obter evento específico |
| POST | `/api/pagamentos/criar` | ✅ | Criar intenção de pagamento |
| GET | `/api/pagamentos/meus` | ✅ | Listar pagamentos |
| POST | `/api/pagamentos/cancelar` | ✅ | Cancelar ingresso |
| GET | `/api/ingressos/meus` | ✅ | Listar ingressos |

## 🧪 Teste com Insomnia/Postman

1. Importe a coleção de requisições
2. Configure variáveis de ambiente:
   - `BASE_URL` = http://localhost:8000
   - `TOKEN` = seu_token_aqui
3. Execute as requisições

## 🔧 Variáveis de Ambiente

```env
# Essencial para Stripe
STRIPE_SECRET_KEY=sk_test_seu_chave
STRIPE_PUBLISHABLE_KEY=pk_test_sua_chave
STRIPE_WEBHOOK_SECRET=whsec_seu_secret

# Segurança
SECRET_KEY=sua_chave_secreta_min_32_chars
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Banco de dados
DATABASE_URL=sqlite:///./eventos.db

# Desenvolvimento
DEBUG=False
ENVIRONMENT=production
```

## ❌ Troubleshooting

### "Token inválido ou expirado"
- Gere um novo token com `/api/auth/login`
- Verifique se o token está no header correto

### "Evento não encontrado"
- Verifique o ID/slug do evento
- Liste eventos com `GET /api/eventos/`

### "Erro Stripe"
- Verifique se as chaves estão corretas no `.env`
- Use chaves de teste (começam com `sk_test_`)
- Confirme que o webhook secret está correto

### Porta 8000 ocupada
```bash
# Liberar porta (Linux/Mac)
sudo lsof -ti:8000 | xargs kill -9

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

## 📚 Mais Informações

- Documentação OpenAPI: http://localhost:8000/docs
- Repositório: [seu-repo]
- Issues: [link-issues]

---

**Desenvolvido com FastAPI + Stripe** ⚡💳
