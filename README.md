# EventosBR API 🎉

Plataforma de eventos com reembolsos automáticos usando FastAPI, SQLAlchemy e **Asaas** (PIX e cartão).

> **Branch `main` desatualizada?** O desenvolvimento recente está nos PRs abertos (#8–#11). Para ver o código e docs atuais no GitHub, abra o branch `cursor/patamar-review-fixes-final-bf71` ou faça merge do [PR #11](https://github.com/ortizpedroso/eventos/pull/11) em `main`.

## 📖 Documentação do sistema (técnica)

Descrição da arquitetura, módulos backend, modelos de dados, frontend Next.js, pagamentos/lotes/webhooks Asaas e operação (env, Docker, Alembic):

- **→ [docs/00-sistema-completo.md](docs/00-sistema-completo.md)** — documento consolidado (produto, funcionalidades, tecnologias e tabelas do banco)
- **→ [docs/README.md](docs/README.md)** — índice completo em Markdown no repositório

No site (Next.js), a mesma informação está resumida na página pública **`/documentacao`**.

## 🚀 Características

- ✅ Autenticação com JWT
- ✅ Gerenciamento de eventos
- ✅ Sistema de ingressos
- ✅ Integração com Asaas para pagamentos (PIX, cartão, fatura)
- ✅ Reembolsos automáticos
- ✅ Webhooks para sincronização
- ✅ Documentação automática (Swagger)

## 📋 Pré-requisitos

- Python 3.11+
- Docker & Docker Compose (opcional)
- Conta Asaas (sandbox ou produção) para pagamentos reais

## 🔧 Instalação

### Opção 1: Com Docker (Recomendado)

```bash
# Clone o repositório
git clone <seu-repo>
cd eventosbr

# Copie o arquivo de configuração
cp .env.example .env

# Configure suas variáveis de ambiente (Asaas, SECRET_KEY, etc.)
nano .env

# Inicie os containers
docker-compose up -d --build

# A API estará disponível em http://localhost:8000
```

### Opção 2: Instalação Local

```bash
# Clone o repositório
git clone <seu-repo>
cd eventosbr

# Crie um ambiente virtual
python -m venv venv

# Ative o ambiente virtual
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Instale as dependências
pip install -r requirements.txt

# Configure variáveis de ambiente
cp .env.example .env
nano .env

# Execute a aplicação
python -m app.main
# ou
uvicorn app.main:app --reload
```

## 📝 Configuração de Variáveis de Ambiente

Crie um arquivo `.env` na raiz do projeto:

```env
# Database
DATABASE_URL=sqlite:///./eventos.db

# Pagamentos — Asaas
PAYMENT_PROVIDER=asaas
ASAAS_API_KEY=
ASAAS_WEBHOOK_TOKEN=
ASAAS_PLATFORM_WALLET_ID=
ASAAS_DISABLED=false

# JWT
SECRET_KEY=sua-chave-secreta-muito-segura-aqui
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Ambiente
DEBUG=True
ENVIRONMENT=development
```

## 📚 Documentação da API

Após iniciar a aplicação, acesse:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## 🖥️ Frontend (Next.js)

O painel web fica em `frontend/` (Next.js + TypeScript + Tailwind + checkout Asaas).

### Rodar localmente (API + front)

1. Suba a API (Docker ou `uvicorn`) em **http://localhost:8000**.
2. No `.env` da API, inclua `CORS_ORIGINS` com **http://localhost:3000** (já sugerido no `.env.example`).
3. No frontend:

```bash
cd frontend
cp .env.local.example .env.local
# Ajuste NEXT_PUBLIC_API_URL se necessário
npm install
npm run dev
```

4. Abra **http://localhost:3000** (lista de eventos, login, compra com cartão, “Meus pagamentos”).

### Docker (API + Postgres + Redis + Web)

Na raiz do projeto, com `.env` preenchido (`SECRET_KEY`, Asaas, etc.):

```bash
docker compose up -d --build
```

- API: http://localhost:8000  
- Frontend: http://localhost:3000  

O serviço `web` recebe `NEXT_PUBLIC_PAYMENT_PROVIDER=asaas` na build.

### `ERR_CONNECTION_REFUSED` em `http://localhost:3000`

O front **só escuta na 3000** se estiver rodando. Faça **um** dos dois:

- **Docker:** `docker compose up -d --build web` (e confira com `docker compose ps` se o serviço `web` está *Up*).
- **Local:** `cd frontend && npm run dev`.

A API continua em **`http://localhost:8000`** (`/docs`).

## 🔌 Endpoints Principais

### Autenticação

- `POST /api/auth/registrar` - Registra novo usuário
- `POST /api/auth/login` - Realiza login

### Eventos

- `POST /api/eventos/criar` - Cria novo evento (organizador)
- `GET /api/eventos/` - Lista eventos
- `GET /api/eventos/{slug}` - Obtém evento específico

### Pagamentos

- `POST /api/pagamentos/criar` - Cria intenção de pagamento
- `GET /api/pagamentos/meus` - Lista pagamentos do usuário
- `POST /api/pagamentos/cancelar` - Cancela ingresso e reembolsa

### Ingressos

- `GET /api/ingressos/meus` - Lista ingressos do usuário

### Webhooks

- `POST /api/webhooks/asaas` - Webhook do Asaas

## 🧪 Testando a API

### 1. Registrar novo usuário

```bash
curl -X POST "http://localhost:8000/api/auth/registrar" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizador@exemplo.com",
    "nome": "João Organizador",
    "senha": "senha123",
    "tipo": "organizador"
  }'
```

### 2. Fazer login

```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "organizador@exemplo.com",
    "senha": "senha123"
  }'
```

### 3. Criar um evento

```bash
curl -X POST "http://localhost:8000/api/eventos/criar" \
  -H "Authorization: Bearer {seu_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "nome": "Conferência Tech 2025",
    "descricao": "Maior conferência de tecnologia do Brasil",
    "data_inicio": "2025-06-15T09:00:00",
    "local": "São Paulo, SP",
    "imagem_url": "https://exemplo.com/imagem.jpg"
  }'
```

## 🏗️ Estrutura do Projeto

```
eventosbr/
├── app/
│   ├── main.py              # Aplicação FastAPI
│   ├── models/              # Modelos SQLAlchemy
│   ├── routes/              # Rotas/Endpoints
│   ├── schemas/             # Schemas Pydantic
│   └── services/            # Serviços (auth, etc)
├── config/
│   ├── settings.py          # Configurações
│   └── database.py          # Configuração do banco
├── docs/                    # Documentação técnica do sistema (Markdown)
├── frontend/                # Next.js (UI)
├── alembic/                 # Migrações do banco
├── tests/                   # Testes
├── requirements.txt         # Dependências Python
├── Dockerfile               # API (Docker)
├── docker-compose.yml       # API + Postgres + Redis + Web
└── .env.example             # Exemplo de variáveis
```

## 🔐 Segurança

- Senhas são hasheadas com bcrypt
- JWTs para autenticação
- CORS configurado
- Validação de entrada com Pydantic
- Tratamento de erros robusto

## 📦 Dependências Principais

- **FastAPI** - Framework web
- **SQLAlchemy** - ORM para banco de dados
- **Pydantic** - Validação de dados
- **Asaas** - Processamento de pagamentos (PIX, cartão)
- **python-jose** - Autenticação com JWT
- **python-slugify** - Geração de slugs

## 🐛 Troubleshooting

### Erro: "ModuleNotFoundError"
```bash
pip install -r requirements.txt
```

### Erro: Conexão com banco de dados
- Verifique DATABASE_URL no .env
- Para SQLite, certifique-se que a pasta existe

### Erro: Pagamento Asaas rejeitado
- Verifique `ASAAS_API_KEY` e `ASAAS_WALLET_ID` no `.env`
- Use ambiente sandbox (`ASAAS_ENVIRONMENT=sandbox`) para testes

### Porta 8000 já em uso
```bash
# Linux/Mac
lsof -i :8000
kill -9 <PID>

# Windows
netstat -ano | findstr :8000
taskkill /PID <PID> /F
```

## 📄 Licença

MIT License

## 👥 Autores

- Seu Nome aqui

## 📞 Suporte

Para issues e dúvidas, abra uma issue no repositório.

---

**Desenvolvido com ❤️ usando FastAPI e Asaas**
