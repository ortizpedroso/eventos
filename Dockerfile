FROM python:3.11-slim

WORKDIR /app

RUN useradd --create-home --shell /bin/sh --uid 1000 appuser

# Instala dependências do sistema
RUN apt-get update && apt-get install -y \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements
COPY requirements.txt .

# Instala dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia código
COPY . .
RUN chown -R appuser:appuser /app

USER appuser

# Expõe porta
EXPOSE 8000

# Comando padrão da imagem (Compose sobrescreve com `command:` para evitar CRLF em start.sh no mount Windows)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
