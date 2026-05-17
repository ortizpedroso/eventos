# 🔧 Troubleshooting - EventosBR API

## ⚠️ Erros do Pylance - "Não foi possível resolver a importação"

### 📌 O que é?

Estes erros aparecem quando o VS Code não consegue encontrar as bibliotecas Python:

```
❌ Não foi possível resolver a importação "fastapi"
❌ Não foi possível resolver a importação "sqlalchemy"
❌ Não foi possível resolver a importação "stripe"
```

### ✅ Solução (Escolha uma)

#### Opção 1: Usar Docker (RECOMENDADO)

```bash
# 1. Configure o .env
cp .env.example .env
# Edite .env com suas chaves Stripe

# 2. Inicie com Docker
docker-compose up -d --build

# 3. Pronto! Os erros desaparecerão
```

**Vantagens:**
- ✅ Tudo isolado em containers
- ✅ Sem conflitos de dependências
- ✅ Mesmo ambiente em produção

#### Opção 2: Instalação Local (Windows)

```bash
# 1. Abra PowerShell na pasta do projeto

# 2. Execute o script de setup
.\setup.bat

# 3. Ative o ambiente virtual (se não foi ativado automaticamente)
.\venv\Scripts\activate

# 4. Instale dependências
pip install -r requirements.txt

# 5. Configure VS Code para usar este ambiente Python:
#    - Abra: Ctrl+Shift+P
#    - Digite: Python: Select Interpreter
#    - Escolha: ./venv/Scripts/python.exe
```

#### Opção 3: Instalação Local (Linux/Mac)

```bash
# 1. Execute o script de setup
bash setup.sh

# 2. Ative o ambiente virtual (se não foi ativado automaticamente)
source venv/bin/activate

# 3. Configure VS Code para usar este ambiente:
#    - Cmd+Shift+P (Mac) ou Ctrl+Shift+P (Linux)
#    - Digite: Python: Select Interpreter
#    - Escolha: ./venv/bin/python
```

---

## 🐳 Docker Errors / Issues

### Erro: "docker-compose up failed"

```bash
# 1. Verifique se Docker está rodando
docker ps

# 2. Se não estiver, inicie o Docker Desktop (Windows) ou daemon (Linux)

# 3. Tente novamente
docker-compose up -d --build
```

### Erro: "Port 8000 already in use"

```bash
# Windows (PowerShell):
Get-Process -Id (Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue).OwningProcess | Stop-Process -Force

# Linux/Mac:
lsof -ti:8000 | xargs kill -9
```

### Erro: "services.api" não encontrado

```bash
# Certifique-se que está na pasta correta:
cd c:\projetos\eventosbr

# Verifique se docker-compose.yml existe:
ls docker-compose.yml

# Recrie do zero:
docker-compose down
docker system prune -a
docker-compose up -d --build
```

---

## 🐍 Python Environment Issues

### "ModuleNotFoundError: No module named 'fastapi'"

```bash
# Verifique se está no ambiente virtual (deve ter "(venv)" no prompt)
# Windows:
.\venv\Scripts\activate

# Linux/Mac:
source venv/bin/activate

# Reinstale dependências:
pip install --upgrade pip
pip install -r requirements.txt
```

### "Python interpreter not found"

**VS Code:**
1. Abra a Paleta de Comandos: `Ctrl+Shift+P`
2. Digite: `Python: Select Interpreter`
3. Escolha o ambiente virtual criado
4. Se não aparecer, clique em "Find" e navegue até `./venv/Scripts/python.exe` (Windows) ou `./venv/bin/python` (Linux/Mac)

### Erro ao rodarvenv\Scripts\activate (Windows)

```powershell
# Se receber erro de permissão:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Tente novamente:
.\venv\Scripts\activate
```

---

## ⚡ Executando a Aplicação

### Com Docker

```bash
# Já está rodando depois de docker-compose up!
# Acesse: http://localhost:8000/docs
```

### Localmente

```bash
# 1. Ative o ambiente virtual
# Windows:
.\venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# 2. Execute
python -m app.main

# Ou use uvicorn diretamente:
uvicorn app.main:app --reload

# 3. Acesse: http://localhost:8000/docs
```

---

## 📊 Verificar Status

### Verificar se dependências estão instaladas

```bash
# Ative o ambiente virtual primeiro!
pip list

# Deve conter: fastapi, sqlalchemy, stripe, pydantic, etc
```

### Testar importações

```bash
python -c "import fastapi; print('FastAPI OK')"
python -c "import sqlalchemy; print('SQLAlchemy OK')"
python -c "import stripe; print('Stripe OK')"
```

### Verificar conexão com banco de dados

```bash
python -c "from config.database import engine; print('Database connection OK')"
```

---

## 🔄 Reiniciar/Resetar

### Limpar cache do Pylance

1. Abra a Paleta de Comandos: `Ctrl+Shift+P`
2. Digite: `Python: Restart Language Server`
3. Aguarde alguns segundos

### Reiniciar VS Code

```bash
# Simples:
- Feche VS Code
- Reabra

# Ou pelo terminal:
code --disable-extensions  # Desativa extensões
code                       # Reativa
```

### Remover ambiente virtual e recriar

```bash
# Windows:
rmdir /s venv
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt

# Linux/Mac:
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

---

## Site “fora do ar” / lista de eventos vazia / erros ao fazer login

O **Next** (porta **3000**) e a **API FastAPI** (porta **8000**) são **dois processos**. O site precisa dos **dois** a correr (ou Docker com `web` + `api`).

### 1) Confirme que a API responde

No PowerShell:

```powershell
Invoke-RestMethod -Uri "http://127.0.0.1:8000/health" -Method Get   # liveness (sempre 200 se a API ouvir)
Invoke-RestMethod -Uri "http://127.0.0.1:8000/ready" -Method Get   # readiness (503 se a BD falhar)
```

- **Falha (ligação recusada)** em ambos → a API não está a ouvir. Arranque-a antes do front (ou use `docker compose up`).
- **`/ready` com 503** ou corpo com **`database": "down"`** → Postgres/SQLite inacessível: confira `DATABASE_URL` no `.env` e se o Postgres do Docker está `healthy` (`docker compose ps`).

### 2) Confirme o front e o proxy `/api`

```powershell
Invoke-WebRequest -Uri "http://127.0.0.1:3000/" -UseBasicParsing | Select-Object StatusCode
```

Se o front abrir mas **dados não carregam**, abra as **Ferramentas de programador (F12) → Rede** e veja pedidos a `/api/...` (erro **502/504/ECONNREFUSED** = o Next não consegue falar com a API).

- **Desenvolvimento local:** na pasta `frontend`, crie `frontend/.env.local` se ainda não existir, com por exemplo:

  ```env
  INTERNAL_API_URL=http://127.0.0.1:8000
  ```

  Reinicie `npm run dev` (o Next lê isto para o *rewrite* de `/api`).

### 3) Docker Compose

```powershell
docker compose ps
docker compose logs api --tail 80
docker compose logs web --tail 40
```

- API a **reiniciar em loop** → veja o fim dos logs (`SECRET_KEY`, `DATABASE_URL`, falha do `alembic`).
- Garanta `.env` na raiz com **`SECRET_KEY`** definida em **produção real** (o compose já tem um valor por defeito só para testes locais).

### 4) Produção (`ENVIRONMENT=production`)

A documentação **`/docs`** fica **desligada** por segurança. Use **`/health`** (liveness) ou **`/ready`** (BD + HTTP 200/503) para testar a API.

---

## ✨ Verificação Final

Após seguir uma das soluções acima, verifique:

- ✅ Nenhum erro vermelho no VS Code
- ✅ Pylance reconhece as importações
- ✅ Auto-complete funciona (comece a digitar `from fastapi import`)
- ✅ Ir para definição funciona (Ctrl+Click em um módulo)

Se tudo estiver OK, execute:

```bash
python -m app.main
```

E acesse: **http://localhost:8000/docs** 🎉

---

## 📞 Ainda não funcionou?

Tente isto em ordem:

1. ✅ Feche todas as instâncias do VS Code
2. ✅ Feche todos os terminais
3. ✅ Limpe cache: `pip cache purge`
4. ✅ Remova venv e recrie (veja seção acima)
5. ✅ Reinicie o computador (última opção!)

Se ainda tiver problemas, compartilhe a mensagem de erro completa!

---

## Stripe — Webhook e compra de teste

### Pré-requisitos

1. [Stripe CLI](https://stripe.com/docs/stripe-cli) instalado e `stripe login`
2. `STRIPE_SECRET_KEY=sk_test_...` no `.env`
3. API rodando (`docker compose up -d` ou `uvicorn`)

### Passo a passo (3 terminais)

**Terminal 1 — configurar `whsec` no `.env` (uma vez por sessão do `stripe listen`):**

```powershell
.\scripts\stripe-webhook-setup.ps1
docker compose up -d api
```

**Terminal 2 — encaminhar webhooks (deixar aberto):**

```powershell
.\scripts\stripe-webhook-dev.ps1
```

**Terminal 3 — compra automática de teste:**

```powershell
.\scripts\compra-teste-stripe.ps1
```

O script cria organizador, evento, PaymentIntent, confirma com cartão `pm_card_visa` e aguarda o ingresso ficar **pago** via webhook.

### Compra manual no navegador

1. Terminal com `stripe-webhook-dev.ps1` rodando
2. Abra `http://localhost:3000/eventos/{slug}`
3. Cartão de teste: `4242 4242 4242 4242`, validade qualquer futura, CVC `123`

### Erros comuns

| Sintoma | Causa | Solução |
|--------|--------|---------|
| Ingresso fica `pendente` | Webhook não chegou | `stripe-webhook-dev.ps1` ativo + `whsec` no `.env` |
| `Invalid signature` | `STRIPE_WEBHOOK_SECRET` diferente do `stripe listen` | Rode `stripe-webhook-setup.ps1` de novo |
| `404` em `/api/admin/setup` | Container API antigo | `docker compose up -d --build api` |

---

**Última atualização:** 15/05/2026
