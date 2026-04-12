-- Add created_at column to notifications table for patient message timestamps
alter table notifications
  add column if not exists created_at timestamptz default now();
