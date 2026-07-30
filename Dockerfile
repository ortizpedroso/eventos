FROM python:3.11-slim

WORKDIR /app

RUN useradd --create-home --shell /bin/sh --uid 1000 appuser

# Instala dependências do sistema
# fonts-dejavu-core: necessário pro Pillow desenhar texto na carteirinha do
# ingresso (nome/evento/data/local ao lado do QR) — python:3.11-slim não vem
# com nenhuma fonte TrueType por padrão.
RUN apt-get update && apt-get install -y \
    gcc \
    fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Copia requirements
COPY requirements.txt .

# Instala dependências Python
RUN pip install --no-cache-dir -r requirements.txt

# Copia código
ARG GIT_COMMIT=dev
COPY . .
ENV GIT_COMMIT=$GIT_COMMIT
RUN chown -R appuser:appuser /app

USER appuser

# Expõe porta
EXPOSE 8000

# Comando padrão da imagem (Compose sobrescreve com `command:` inline no mount Windows)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
