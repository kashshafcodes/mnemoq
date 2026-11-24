-- Reminder language: send each person's reminders in the app language they use.
--
-- Approved by the owner on 24 Nov 2026. Safe to run again.
-- The app saves the current language here when reminders are set up or changed,
-- and when the person opens or switches the app language (src/reminders.js).
-- api/remind.js reads it per row and falls back to English.

alter table public.reminder_settings
  add column if not exists lang text not null default 'en';

alter table public.reminder_settings
  drop constraint if exists reminder_settings_lang_check;

alter table public.reminder_settings
  add constraint reminder_settings_lang_check check (lang in ('en', 'bn'));
