#!/usr/bin/env python3
"""Cross-platform MySQL database backup utility for Client Meeting-to-Action Tracker.

Supports executing either native mysqldump subprocess or streaming SQL export.
"""

from __future__ import annotations

import argparse
import gzip
import os
import shutil
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import urlparse

from app.core.config import settings


def parse_database_url(url: str) -> dict[str, str | int]:
    """Extract host, port, user, password, and database name from SQLAlchemy URL."""
    # Example: mysql+pymysql://user:pass@localhost:3306/dbname
    cleaned = url.replace("mysql+pymysql://", "mysql://")
    parsed = urlparse(cleaned)
    return {
        "host": parsed.hostname or "127.0.0.1",
        "port": parsed.port or 3306,
        "user": parsed.username or "tracker_user",
        "password": parsed.password or "",
        "database": (parsed.path or "/meeting_tracker_db").lstrip("/"),
    }


def perform_backup(output_dir: str = "backups", retention_days: int = 14) -> Path:
    """Create timestamped gzipped MySQL database backup."""
    dest_dir = Path(output_dir)
    dest_dir.mkdir(parents=True, exist_ok=True)

    db_info = parse_database_url(settings.DATABASE_URL)
    timestamp = datetime.now(UTC).strftime("%Y%m%d_%H%M%S")
    backup_file = dest_dir / f"{db_info['database']}_{timestamp}.sql.gz"

    mysqldump_bin = shutil.which("mysqldump")
    if not mysqldump_bin:
        print("[WARNING] 'mysqldump' binary not found on PATH. Attempting standard location...")
        common_paths = [
            Path("C:/Program Files/MySQL/MySQL Server 8.0/bin/mysqldump.exe"),
            Path("C:/Program Files/MySQL/MySQL Server 8.4/bin/mysqldump.exe"),
            Path("/usr/bin/mysqldump"),
            Path("/usr/local/bin/mysqldump"),
        ]
        for p in common_paths:
            if p.exists():
                mysqldump_bin = str(p)
                break

    if not mysqldump_bin:
        print("[ERROR] mysqldump utility is not installed or discoverable on PATH.")
        sys.exit(1)

    cmd = [
        mysqldump_bin,
        f"--host={db_info['host']}",
        f"--port={db_info['port']}",
        f"--user={db_info['user']}",
        "--single-transaction",
        "--quick",
        "--routines",
        "--triggers",
        "--default-character-set=utf8mb4",
        str(db_info["database"]),
    ]

    env = os.environ.copy()
    if db_info["password"]:
        env["MYSQL_PWD"] = str(db_info["password"])

    print(f"[INFO] Backing up database '{db_info['database']}' to {backup_file}...")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env)

    with gzip.open(backup_file, "wb") as gz_out:
        if proc.stdout:
            shutil.copyfileobj(proc.stdout, gz_out)

    _, stderr = proc.communicate()
    if proc.returncode != 0:
        if backup_file.exists():
            backup_file.unlink()
        print(f"[ERROR] mysqldump failed with code {proc.returncode}: {stderr.decode(errors='ignore')}")
        sys.exit(proc.returncode)

    file_size_kb = backup_file.stat().st_size / 1024
    print(f"[SUCCESS] Backup saved: {backup_file} ({file_size_kb:.2f} KB)")

    # Prune old backups
    cutoff = datetime.now(UTC).timestamp() - (retention_days * 86400)
    for existing in dest_dir.glob(f"{db_info['database']}_*.sql.gz"):
        if existing.stat().st_mtime < cutoff:
            print(f"[INFO] Pruning expired backup: {existing.name}")
            existing.unlink()

    return backup_file


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backup MySQL database for Meeting Tracker")
    parser.add_argument("--output-dir", default="backups", help="Directory to store backup files")
    parser.add_argument("--retention-days", type=int, default=14, help="Days to keep backup files")
    args = parser.parse_args()

    perform_backup(output_dir=args.output_dir, retention_days=args.retention_days)
