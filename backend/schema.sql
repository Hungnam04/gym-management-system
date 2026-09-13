PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
 password_hash TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '', role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('member','trainer','admin')),
 active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)), created_at TEXT NOT NULL, session_version INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS plans (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, tagline TEXT NOT NULL, price INTEGER NOT NULL CHECK(price>=0),
 duration_days INTEGER NOT NULL CHECK(duration_days>0), features TEXT NOT NULL, popular INTEGER NOT NULL DEFAULT 0,
 active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS trainers (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, specialty TEXT NOT NULL, bio TEXT NOT NULL,
 experience INTEGER NOT NULL DEFAULT 1, image TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1,
 user_id INTEGER UNIQUE REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS classes (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL, trainer_id INTEGER NOT NULL REFERENCES trainers(id),
 starts_at TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0), capacity INTEGER NOT NULL CHECK(capacity>0),
 room TEXT NOT NULL, level TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'scheduled' CHECK(status IN ('scheduled','cancelled'))
);
CREATE TABLE IF NOT EXISTS orders (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), plan_id INTEGER NOT NULL REFERENCES plans(id),
 plan_name TEXT NOT NULL, amount INTEGER NOT NULL CHECK(amount>=0), duration_days INTEGER NOT NULL,
 payment_method TEXT NOT NULL CHECK(payment_method IN ('demo','cash')), status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','paid','cancelled')),
 created_at TEXT NOT NULL, paid_at TEXT
);
CREATE TABLE IF NOT EXISTS memberships (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER NOT NULL UNIQUE REFERENCES orders(id),
 plan_name TEXT NOT NULL, starts_at TEXT NOT NULL, ends_at TEXT NOT NULL, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), class_id INTEGER NOT NULL REFERENCES classes(id),
 status TEXT NOT NULL DEFAULT 'confirmed' CHECK(status IN ('confirmed','cancelled','attended')), created_at TEXT NOT NULL,
 UNIQUE(user_id,class_id)
);
CREATE TABLE IF NOT EXISTS progress (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), recorded_on TEXT NOT NULL,
 weight REAL NOT NULL CHECK(weight BETWEEN 20 AND 350), height REAL NOT NULL CHECK(height BETWEEN 80 AND 250),
 note TEXT NOT NULL DEFAULT '', UNIQUE(user_id, recorded_on)
);
CREATE TABLE IF NOT EXISTS workouts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL REFERENCES users(id), title TEXT NOT NULL,
 recorded_on TEXT NOT NULL, duration_minutes INTEGER NOT NULL CHECK(duration_minutes>0), note TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS posts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, category TEXT NOT NULL, excerpt TEXT NOT NULL,
 content TEXT NOT NULL, image TEXT NOT NULL DEFAULT '', published INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS contacts (
 id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, email TEXT NOT NULL, phone TEXT NOT NULL DEFAULT '',
 topic TEXT NOT NULL, message TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','contacted','closed')), created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS rate_limits (
 bucket TEXT PRIMARY KEY, hits INTEGER NOT NULL, resets_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_classes_time ON classes(starts_at);
CREATE INDEX IF NOT EXISTS idx_bookings_class ON bookings(class_id,status);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id,ends_at);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created_at);
