-- Proposal PDF style options (Layout da Proposta).
--   proposal_style  classico (current layout) or moderno
--   cover_style     moderno cover: cor (brand color), foto (photo under the brand color) or clara (white)
--   corner_style    moderno boxes: arredondado or reto
--   next_steps      moderno closing section: {enabled, title, steps: [{title, text}]}
--   whatsapp        number shown on the contact card and in its QR code
ALTER TABLE public.workspace_layout
  ADD COLUMN proposal_style text NOT NULL DEFAULT 'classico' CHECK (proposal_style IN ('classico', 'moderno')),
  ADD COLUMN cover_style text NOT NULL DEFAULT 'cor' CHECK (cover_style IN ('cor', 'foto', 'clara')),
  ADD COLUMN cover_image_url text,
  ADD COLUMN corner_style text NOT NULL DEFAULT 'arredondado' CHECK (corner_style IN ('arredondado', 'reto')),
  ADD COLUMN next_steps jsonb,
  ADD COLUMN whatsapp text CHECK (whatsapp IS NULL OR length(whatsapp) <= 30);
