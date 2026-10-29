#!/usr/bin/env bash
# ==============================================================================
# Automated MySQL 8.0 Backup Script — Client Meeting-to-Action Tracker
# ==============================================================================
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups}"
MYSQL_HOST="${MYSQL_HOST:-127.0.0.1}"
MYSQL_PORT="${MYSQL_PORT:-3306}"
MYSQL_USER="${MYSQL_USER:-tracker_user}"
MYSQL_DATABASE="${MYSQL_DATABASE:-meeting_tracker_db}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"

TIMESTAMP="$(date +"%Y%m%d_%H%M%S")"
BACKUP_FILE="${BACKUP_DIR}/${MYSQL_DATABASE}_${TIMESTAMP}.sql.gz"

mkdir -p "${BACKUP_DIR}"

echo "[INFO] Starting database backup for '${MYSQL_DATABASE}' at $(date -u)..."

# Ensure MYSQL_PWD is set or read from environment
if [ -z "${MYSQL_PASSWORD:-}" ]; then
  echo "[WARNING] MYSQL_PASSWORD not set in environment; mysqldump may prompt for password."
else
  export MYSQL_PWD="${MYSQL_PASSWORD}"
fi

# Execute consistent transactional backup with routine and trigger definitions
mysqldump \
  --host="${MYSQL_HOST}" \
  --port="${MYSQL_PORT}" \
  --user="${MYSQL_USER}" \
  --single-transaction \
  --quick \
  --routines \
  --triggers \
  --default-character-set=utf8mb4 \
  "${MYSQL_DATABASE}" | gzip -9 > "${BACKUP_FILE}"

echo "[SUCCESS] Backup created successfully: ${BACKUP_FILE} ($(du -h "${BACKUP_FILE}" | cut -f1))"

# Prune old backups exceeding retention limit
echo "[INFO] Cleaning backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "${MYSQL_DATABASE}_*.sql.gz" -type f -mtime "+${RETENTION_DAYS}" -delete

echo "[INFO] Backup operation complete."

