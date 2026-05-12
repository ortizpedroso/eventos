@echo off
REM Script de setup inicial para o projeto EventosBR (Windows)

echo 🚀 Configurando EventosBR API...
echo.

REM Cria .env a partir do exemplo
if not exist ".env" (
    echo 📋 Criando arquivo .env...
    copy .env.example .env
    echo ✅ Arquivo .env criado. Edite com suas configurações de Stripe!
) else (
    echo ⚠️  Arquivo .env já existe. Pulando...
)

REM Verifica Python
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Python não encontrado. Instale Python 3.11+
    exit /b 1
)

echo ✅ Python encontrado: 
python --version
echo.

REM Cria venv
if not exist "venv" (
    echo 📦 Criando ambiente virtual...
    python -m venv venv
    echo ✅ Ambiente virtual criado
) else (
    echo ⚠️  Ambiente virtual já existe
)

echo.
echo 🔌 Ativando ambiente virtual...
call venv\Scripts\activate.bat

echo 📥 Instalando dependências...
pip install -r requirements.txt

echo.
echo ✨ Setup completo!
echo.
echo 📝 Próximos passos:
echo 1. Edite o arquivo .env com suas credenciais Stripe
echo 2. Execute: python -m app.main
echo 3. Acesse: http://localhost:8000/docs
echo.
