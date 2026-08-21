CREATE TABLE IF NOT EXISTS locations (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  capacity INT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general'
);

CREATE TABLE IF NOT EXISTS checkins (
  id SERIAL PRIMARY KEY,
  location_id INT REFERENCES locations(id),
  user_id TEXT NOT NULL,
  checked_in_at TIMESTAMPTZ DEFAULT now(),
  checked_out_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  location TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  description TEXT,
  rsvp_count INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS rsvps (
  event_id INT REFERENCES events(id),
  user_id TEXT NOT NULL,
  PRIMARY KEY (event_id, user_id)
);

CREATE TABLE IF NOT EXISTS study_rooms (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  building TEXT NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'classroom', -- 'classroom' or 'lab'
  status TEXT NOT NULL DEFAULT 'empty',        -- 'empty' or 'occupied'
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Real campus seating/hangout spots, grouped by category so the app can
-- suggest a quieter alternative of the same "type" when one is full.
INSERT INTO locations (name, capacity, category) VALUES
  ('Canteen - Architecture Building Basement', 120, 'canteen'),
  ('Canteen - Girls Hostel Ground Floor', 100, 'canteen'),
  ('New Reading Hall', 80, 'study'),
  ('Old Reading Hall', 60, 'study'),
  ('Benches - In Front of CS Building', 40, 'outdoor'),
  ('Badminton Court', 20, 'sports'),
  ('Playing Area', 50, 'sports')
ON CONFLICT DO NOTHING;

-- A few sample rooms so the page isn't empty before admin adds real ones.
INSERT INTO study_rooms (name, building, room_type, status) VALUES
  ('Room 101', 'CS Building', 'classroom', 'empty'),
  ('Room 204', 'CS Building', 'classroom', 'occupied'),
  ('Networks Lab', 'CS Building', 'lab', 'empty'),
  ('Seminar Hall 1', 'Mech Building', 'classroom', 'occupied')
ON CONFLICT DO NOTHING;
