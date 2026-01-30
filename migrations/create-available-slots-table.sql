-- Create available_slots table for admin-managed booking availability
CREATE TABLE IF NOT EXISTS available_slots (
  id SERIAL PRIMARY KEY,
  slot_date DATE NOT NULL,
  slot_time TIME NOT NULL,
  is_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(slot_date, slot_time)
);

CREATE INDEX IF NOT EXISTS idx_available_slots_date_time ON available_slots(slot_date, slot_time);
CREATE INDEX IF NOT EXISTS idx_available_slots_available ON available_slots(is_available);

