-- Update chat_bookings table to include 'requested' status in the check constraint
-- This migration alters the existing constraint to allow 'requested' status

-- Drop the old constraint if it exists
ALTER TABLE chat_bookings DROP CONSTRAINT IF EXISTS chat_bookings_status_check;

-- Add the new constraint with 'requested' included
ALTER TABLE chat_bookings ADD CONSTRAINT chat_bookings_status_check 
  CHECK (status IN ('pending', 'requested', 'confirmed', 'cancelled', 'completed'));

-- Update default status to 'requested' if it's still 'confirmed'
ALTER TABLE chat_bookings ALTER COLUMN status SET DEFAULT 'requested';

