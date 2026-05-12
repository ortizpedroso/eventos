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

**Última atualização:** 07/05/2026
