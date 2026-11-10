-- How many days a proposal is valid, set in Regras Comerciais and printed on the PDF
ALTER TABLE public.workspace_settings
  ADD COLUMN proposal_validity_days integer NOT NULL DEFAULT 30
    CHECK (proposal_validity_days BETWEEN 1 AND 365);
