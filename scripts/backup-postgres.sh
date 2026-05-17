#!/usr/bin/env sh
# Backup lógico PostgreSQL (ex.: Docker Compose com serviço "db").
# Uso típico a partir da raiz do repositório:
#   docker compose exec -T db pg_dump -U eventosbr eventosbr > backup_eventosbr_$(date +%Y%m%d_%H%M).sql
#
# Ou com variáveis (host local, sem Docker):
#   pg_dump "$DATABASE_URL" > backup.sql
#
# Agende com cron ou o scheduler do seu ambiente; teste restauração periodicamente.

set -euo pipefail
echo "Este ficheiro é um modelo — descomente e adapte o comando que corresponde ao seu ambiente."
# docker compose exec -T db pg_dump -U eventosbr eventosbr | gzip -1 > "backup_eventosbr_$(date +%Y%m%d_%H%M).sql.gz"
