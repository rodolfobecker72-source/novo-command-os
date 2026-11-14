-- WhatsApp number of each user, for future integrations. One number per
-- user (a column on the profile) and one user per number (unique), so an
-- incoming message can be matched to a single person. Stored in
-- international format; the app validates the same rule (src/utils/whatsapp.ts).
-- Visibility follows profiles: the user and the members of their company.

ALTER TABLE public.profiles
  ADD COLUMN whatsapp text,
  ADD CONSTRAINT profiles_whatsapp_format CHECK (whatsapp ~ '^\+55[1-9]{2}(9[0-9]{8}|[2-5][0-9]{7})$');

CREATE UNIQUE INDEX profiles_whatsapp_key ON public.profiles (whatsapp) WHERE whatsapp IS NOT NULL;
