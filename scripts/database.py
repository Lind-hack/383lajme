import sqlite3
import uuid
from pathlib import Path
from datetime import datetime

SCHEMA = """
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  url TEXT UNIQUE,
  dispatch TEXT,
  title TEXT,
  excerpt TEXT,
  body TEXT,
  source TEXT,
  source_flag TEXT,
  source_bias TEXT DEFAULT 'neutral',
  tone TEXT DEFAULT 'neutral',
  category TEXT,
  published_at TEXT,
  reading_time INTEGER DEFAULT 3,
  featured INTEGER DEFAULT 0,
  engagement_score REAL DEFAULT 0,
  image_url TEXT,
  raw_image TEXT,
  processed INTEGER DEFAULT 0,
  raw_content TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
"""

# Run for existing DBs that predate these columns
_MIGRATIONS = [
    "ALTER TABLE articles ADD COLUMN engagement_score REAL DEFAULT 0",
    "ALTER TABLE articles ADD COLUMN image_url TEXT",
    "ALTER TABLE articles ADD COLUMN raw_image TEXT",
]


def init_db(db_path: Path) -> sqlite3.Connection:
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    for migration in _MIGRATIONS:
        try:
            conn.execute(migration)
            conn.commit()
        except Exception:
            pass  # column already exists
    return conn


def save_raw(conn, url, source, source_flag, title, raw_content, pub_date, raw_image=None):
    article_id = str(uuid.uuid4())
    try:
        conn.execute(
            "INSERT OR IGNORE INTO articles "
            "(id, url, source, source_flag, title, raw_content, published_at, raw_image, processed) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0)",
            (article_id, url, source, source_flag, title, raw_content, pub_date, raw_image),
        )
        conn.commit()
    except Exception as e:
        print(f"  DB save_raw error: {e}")


def get_unprocessed(conn, limit=20):
    return conn.execute(
        "SELECT * FROM articles WHERE processed = 0 AND raw_content IS NOT NULL "
        "ORDER BY created_at ASC LIMIT ?",
        (limit,),
    ).fetchall()


def mark_skipped(conn, article_id):
    conn.execute("UPDATE articles SET processed = -1 WHERE id = ?", (article_id,))
    conn.commit()


def save_processed(conn, article_id, fields):
    fields["processed"] = 1
    placeholders = ", ".join(f"{k} = ?" for k in fields)
    values = list(fields.values()) + [article_id]
    conn.execute(f"UPDATE articles SET {placeholders} WHERE id = ?", values)
    conn.commit()


def next_dispatch_number(conn) -> str:
    today = datetime.utcnow().strftime("%Y-%m-%d")
    count = conn.execute(
        "SELECT COUNT(*) FROM articles WHERE processed = 1 AND date(published_at) = ?",
        (today,),
    ).fetchone()[0]
    return str(count + 1).zfill(2)
