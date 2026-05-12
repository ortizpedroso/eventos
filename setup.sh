#!/bin/bash
# Script de setup inicial para o projeto EventosBR

echo "🚀 Configurando EventosBR API..."
echo ""

# Cria .env a partir do exemplo
if [ ! -f .env ]; then
    echo "📋 Criando arquivo .env..."
    cp .env.example .env
    echo "✅ Arquivo .env criado. Edite com suas configurações de Stripe!"
else
    echo "⚠️  Arquivo .env já existe. Pulando..."
fi

# Verifica Python
if ! command -v python3 &> /dev/null; then
    echo "❌ Python3 não encontrado. Instale Python 3.11+"
    exit 1
fi

echo "✅ Python encontrado: $(python3 --version)"
echo ""

# Cria venv
if [ ! -d "venv" ]; then
    echo "📦 Criando ambiente virtual..."
    python3 -m venv venv
    echo "✅ Ambiente virtual criado"
else
    echo "⚠️  Ambiente virtual já existe"
fi

echo ""
echo "🔌 Ativando ambiente virtual..."
source venv/bin/activate

echo "📥 Instalando dependências..."
pip install -r requirements.txt

echo ""
echo "✨ Setup completo!"
echo ""
echo "📝 Próximos passos:"
echo "1. Edite o arquivo .env com suas credenciais Stripe"
echo "2. Execute: python -m app.main"
echo "3. Acesse: http://localhost:8000/docs"
echo ""
