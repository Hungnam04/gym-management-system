"""Versioned upgrades that preserve existing Gym TN records and foreign keys."""
import re


def migrate_database(connection):
    connection.execute('CREATE TABLE IF NOT EXISTS schema_migrations(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)')
    if connection.execute('SELECT 1 FROM schema_migrations WHERE version=1').fetchone():
        return
    # SQLite's generalized ALTER TABLE procedure; foreign keys are restored
    # after the transaction and the complete graph is checked before commit.
    # https://www.sqlite.org/lang_altertable.html#otheralter
    connection.execute('PRAGMA foreign_keys=OFF')
    try:
        connection.execute('BEGIN IMMEDIATE')
        if connection.execute('SELECT 1 FROM schema_migrations WHERE version=1').fetchone():
            connection.commit()
            return
        original = connection.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='users'").fetchone()[0]
        if "'trainer'" not in original:
            indexes = connection.execute("SELECT sql FROM sqlite_master WHERE tbl_name='users' AND type IN ('index','trigger') AND sql IS NOT NULL").fetchall()
            sequence = connection.execute("SELECT seq FROM sqlite_sequence WHERE name='users'").fetchone()
            upgraded = re.sub(r'CHECK\s*\(\s*role\s+IN\s*\([^)]*\)\s*\)', "CHECK(role IN ('member','trainer','admin'))", original, count=1, flags=re.I)
            if upgraded == original:
                raise RuntimeError('Unrecognized users role constraint; migration was not applied.')
            upgraded = re.sub(r'CREATE TABLE\s+["`\[]?users["`\]]?', 'CREATE TABLE users_with_trainer_role', upgraded, count=1, flags=re.I)
            connection.execute(upgraded)
            columns = ','.join('"' + row[1].replace('"', '""') + '"' for row in connection.execute('PRAGMA table_info(users)'))
            connection.execute(f'INSERT INTO users_with_trainer_role({columns}) SELECT {columns} FROM users')
            connection.execute('DROP TABLE users')
            connection.execute('ALTER TABLE users_with_trainer_role RENAME TO users')
            if sequence:
                connection.execute("UPDATE sqlite_sequence SET seq=MAX(seq,?) WHERE name='users'", (sequence[0],))
            for item in indexes:
                connection.execute(item[0])
        if 'user_id' not in [row[1] for row in connection.execute('PRAGMA table_info(trainers)')]:
            connection.execute('ALTER TABLE trainers ADD COLUMN user_id INTEGER REFERENCES users(id)')
        connection.execute('CREATE UNIQUE INDEX IF NOT EXISTS idx_trainers_user ON trainers(user_id)')
        if connection.execute('PRAGMA foreign_key_check').fetchall():
            raise RuntimeError('Foreign key check failed; the migration was rolled back.')
        connection.execute('INSERT INTO schema_migrations(version) VALUES (1)')
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.execute('PRAGMA foreign_keys=ON')
