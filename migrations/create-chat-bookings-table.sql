-- Create chat_bookings table for scheduling 20-minute chat sessions
CREATE TABLE IF NOT EXISTS chat_bookings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_date DATE NOT NULL,
  booking_time TIME NOT NULL,
  preferred_method TEXT NOT NULL CHECK (preferred_method IN ('teams', 'google-meet', 'phone')),
  share_screen BOOLEAN,
  record_conversation BOOLEAN,
  notes TEXT,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(booking_date, booking_time)
);

CREATE INDEX IF NOT EXISTS idx_chat_bookings_user_id ON chat_bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_bookings_date_time ON chat_bookings(booking_date, booking_time);
CREATE INDEX IF NOT EXISTS idx_chat_bookings_status ON chat_bookings(status);

