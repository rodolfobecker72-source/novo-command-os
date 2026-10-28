-- ============================================================================
-- Command OS — schema base (baseline) para um projeto Supabase novo
-- ============================================================================
-- Gerado em 2026-10-28 a partir de todas as migrations do repositório original
-- (docs/migration-full-consolidated.sql + supabase/migrations + drizzle/migrations),
-- conferido contra o schema de produção (src/integrations/supabase/types.ts:
-- 41 tabelas e todas as colunas iguais).
--
-- Inclui: tipos, tabelas, funções, triggers, índices, RLS e políticas do schema
-- public; buckets e políticas do Storage; trigger de criação de perfil em
-- auth.users; tabelas no Realtime; permissões explícitas.
-- ============================================================================

-- As funções citam tabelas criadas mais abaixo; valida os corpos só ao executar.
SET check_function_bodies = false;

CREATE TYPE public.app_role AS ENUM (
    'owner',
    'admin',
    'vendedor',
    'visualizador',
    'time_hero'
);

CREATE TYPE public.appointment_kind AS ENUM (
    'reuniao',
    'gravacao',
    'entrega',
    'visita',
    'outro'
);

CREATE FUNCTION public.accept_invite(invite_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_invite public.workspace_invites%ROWTYPE;
BEGIN
  SELECT * INTO v_invite FROM public.workspace_invites WHERE id = invite_id AND accepted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invite not found or already accepted';
  END IF;

  IF v_invite.email != (SELECT email FROM auth.users WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Email does not match invite';
  END IF;

  INSERT INTO public.workspace_members (workspace_id, user_id, role, page_permissions)
  VALUES (v_invite.workspace_id, auth.uid(), v_invite.role, v_invite.page_permissions);

  UPDATE public.workspace_invites SET accepted_at = now() WHERE id = invite_id;
END;
$$;

CREATE FUNCTION public.can_manage_avatar(_user_id uuid, _folder text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT _folder = _user_id::text
    OR EXISTS (
      SELECT 1
      FROM public.workspace_members target
      JOIN public.workspace_members caller ON caller.workspace_id = target.workspace_id
      WHERE target.user_id::text = _folder
        AND caller.user_id = _user_id
        AND caller.role = 'owner'
    )
$$;

CREATE FUNCTION public.get_user_role(_user_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.workspace_members
  WHERE user_id = _user_id LIMIT 1
$$;

CREATE FUNCTION public.get_user_role(_user_id uuid, _workspace_id uuid) RETURNS public.app_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT role FROM public.workspace_members
  WHERE user_id = _user_id AND workspace_id = _workspace_id
  LIMIT 1
$$;

CREATE FUNCTION public.get_user_workspace(_user_id uuid) RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT workspace_id FROM public.workspace_members
  WHERE user_id = _user_id LIMIT 1
$$;

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.profiles (id, name, photo_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    NULL
  );
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.handle_signup_workspace(workspace_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF EXISTS (SELECT 1 FROM public.workspace_members WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'User already belongs to a workspace';
  END IF;

  IF coalesce(trim(workspace_name), '') = '' THEN
    RAISE EXCEPTION 'Workspace name is required';
  END IF;

  INSERT INTO public.workspaces (name, created_by)
  VALUES (trim(workspace_name), auth.uid())
  RETURNING id INTO new_workspace_id;

  INSERT INTO public.workspace_members (workspace_id, user_id, role)
  VALUES (new_workspace_id, auth.uid(), 'owner');

  RETURN new_workspace_id;
END;
$$;

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE FUNCTION public.has_workspace_access(_user_id uuid, _workspace_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE user_id = _user_id AND workspace_id = _workspace_id
  )
$$;

CREATE FUNCTION public.is_system_admin(_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.system_admins WHERE user_id = _user_id)
$$;

CREATE FUNCTION public.reorder_payment_terms(p_workspace_id uuid, p_ids uuid[]) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_ids IS NULL OR cardinality(p_ids) <> (SELECT count(*) FROM public.payment_terms WHERE workspace_id = p_workspace_id)
     OR cardinality(p_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_ids) id)
     OR EXISTS (SELECT 1 FROM unnest(p_ids) id WHERE NOT EXISTS (SELECT 1 FROM public.payment_terms t WHERE t.id = id AND t.workspace_id = p_workspace_id)) THEN
    RAISE EXCEPTION 'Invalid payment terms ordering';
  END IF;
  UPDATE public.payment_terms t SET sort_order = ordered.position - 1, updated_at = now()
  FROM unnest(p_ids) WITH ORDINALITY AS ordered(id, position)
  WHERE t.id = ordered.id AND t.workspace_id = p_workspace_id;
END;
$$;

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE FUNCTION public.workspace_has_members(_workspace_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.workspace_members WHERE workspace_id = _workspace_id)
$$;

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    created_by uuid NOT NULL,
    assigned_to uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    title text NOT NULL,
    kind public.appointment_kind DEFAULT 'reuniao'::public.appointment_kind NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    start_at timestamp with time zone NOT NULL,
    end_at timestamp with time zone,
    all_day boolean DEFAULT false NOT NULL,
    color text,
    budget_id uuid,
    client_id uuid,
    lead_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.appointments REPLICA IDENTITY FULL;

CREATE TABLE public.archived_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    group_name text NOT NULL,
    project_number text DEFAULT ''::text NOT NULL,
    project_name text DEFAULT ''::text NOT NULL,
    client_name text DEFAULT ''::text NOT NULL,
    link text DEFAULT ''::text NOT NULL,
    source_card_id uuid,
    archived_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.assets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    serial_number text DEFAULT ''::text NOT NULL,
    hero_asset_number text DEFAULT ''::text NOT NULL,
    photo text DEFAULT ''::text NOT NULL,
    reference_link text DEFAULT ''::text NOT NULL,
    assigned_to text DEFAULT ''::text NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    category text DEFAULT 'equipamento'::text NOT NULL,
    needs_insurance boolean DEFAULT false NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    units jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    inactive_reason text DEFAULT ''::text NOT NULL,
    insurance_expires_at date
);

ALTER TABLE ONLY public.assets REPLICA IDENTITY FULL;

CREATE TABLE public.budget_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    budget_id uuid NOT NULL,
    version integer DEFAULT 1 NOT NULL,
    services jsonb DEFAULT '[]'::jsonb NOT NULL,
    operational_costs jsonb DEFAULT '[]'::jsonb NOT NULL,
    costs jsonb DEFAULT '[]'::jsonb NOT NULL,
    production_cost numeric DEFAULT 0 NOT NULL,
    fixed_cost_percentage numeric DEFAULT 20 NOT NULL,
    nf_cost_percentage numeric DEFAULT 13 NOT NULL,
    total_cost numeric DEFAULT 0 NOT NULL,
    full_price numeric DEFAULT 0 NOT NULL,
    discount4_price numeric DEFAULT 0 NOT NULL,
    discount5_price numeric DEFAULT 0 NOT NULL,
    margin numeric DEFAULT 0 NOT NULL,
    is_rejected boolean DEFAULT false NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    rejection_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.budget_versions REPLICA IDENTITY FULL;

CREATE TABLE public.budgets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_id uuid NOT NULL,
    proposal_id text DEFAULT ''::text NOT NULL,
    project_name text DEFAULT ''::text NOT NULL,
    project_description text DEFAULT ''::text NOT NULL,
    service_type text DEFAULT ''::text NOT NULL,
    objective text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    payment_terms text DEFAULT ''::text NOT NULL,
    location text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'oportunidade_mapeada'::text NOT NULL,
    includes_tax boolean DEFAULT false NOT NULL,
    includes_logistics boolean DEFAULT false NOT NULL,
    includes_accommodation boolean DEFAULT false NOT NULL,
    includes_meals boolean DEFAULT false NOT NULL,
    includes_raw_material boolean DEFAULT false NOT NULL,
    includes_technical_visit boolean DEFAULT false NOT NULL,
    has_execution_date boolean DEFAULT false NOT NULL,
    execution_start_date timestamp with time zone,
    execution_end_date timestamp with time zone,
    execution_month text,
    current_version integer DEFAULT 0 NOT NULL,
    approved_version integer,
    approval_date timestamp with time zone,
    final_value numeric,
    execution jsonb,
    contract_url text,
    nf_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    drive_url text DEFAULT ''::text,
    rejection_reason text DEFAULT ''::text NOT NULL,
    rejection_observation text DEFAULT ''::text NOT NULL,
    pdf_released boolean DEFAULT false NOT NULL,
    hide_nf_in_pdf boolean DEFAULT false NOT NULL,
    hide_operational_in_pdf boolean DEFAULT false NOT NULL,
    hide_nf_observation_in_pdf boolean DEFAULT false NOT NULL,
    execution_start_time text,
    execution_end_time text,
    is_recurring boolean DEFAULT false NOT NULL,
    contact_id uuid
);

ALTER TABLE ONLY public.budgets REPLICA IDENTITY FULL;

CREATE TABLE public.calendar_notes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    date date NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.calendar_notes REPLICA IDENTITY FULL;

CREATE TABLE public.cashflow_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    type text DEFAULT 'receita'::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    date date DEFAULT CURRENT_DATE NOT NULL,
    account_id uuid,
    budget_id uuid,
    revenue_center_id uuid,
    cost_center_id uuid,
    notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_future_payment boolean DEFAULT false NOT NULL,
    payment_due_date date,
    is_paid boolean DEFAULT false NOT NULL,
    paid_at timestamp with time zone,
    credit_card_id uuid,
    execution_cost_id text
);

ALTER TABLE ONLY public.cashflow_entries REPLICA IDENTITY FULL;

CREATE TABLE public.client_contacts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    role text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.clients (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    company_name text DEFAULT ''::text NOT NULL,
    cnpj text DEFAULT ''::text NOT NULL,
    responsible_person text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    lead_origin text DEFAULT 'indicacao'::text NOT NULL,
    sector text DEFAULT ''::text NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    legal_representative_name text DEFAULT ''::text NOT NULL,
    legal_representative_cpf text DEFAULT ''::text NOT NULL,
    address text,
    address_number text,
    address_complement text,
    neighborhood text,
    zip_code text,
    city text,
    state text,
    state_registration text,
    municipal_registration text
);

ALTER TABLE ONLY public.clients REPLICA IDENTITY FULL;

CREATE TABLE public.cost_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.cost_centers REPLICA IDENTITY FULL;

CREATE TABLE public.credit_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    account_id uuid,
    name text DEFAULT ''::text NOT NULL,
    last_digits text DEFAULT ''::text NOT NULL,
    brand text DEFAULT ''::text NOT NULL,
    credit_limit numeric DEFAULT 0 NOT NULL,
    closing_day integer DEFAULT 1 NOT NULL,
    due_day integer DEFAULT 10 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.credit_cards REPLICA IDENTITY FULL;

CREATE TABLE public.feedback_reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid,
    user_id uuid NOT NULL,
    user_name text DEFAULT ''::text NOT NULL,
    workspace_name text DEFAULT ''::text NOT NULL,
    page_path text DEFAULT ''::text NOT NULL,
    type text DEFAULT 'sugestao'::text NOT NULL,
    rating integer,
    message text NOT NULL,
    images jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'aberto'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.financial_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    type text DEFAULT 'corrente'::text NOT NULL,
    bank text DEFAULT ''::text NOT NULL,
    agency text DEFAULT ''::text NOT NULL,
    account_number text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.financial_accounts REPLICA IDENTITY FULL;

CREATE TABLE public.google_calendar_connections (
    user_id uuid NOT NULL,
    workspace_id uuid,
    connection_key text,
    pending_session_id text,
    email text,
    connected_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.google_calendar_sync_map (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    activity_id uuid NOT NULL,
    google_event_id text NOT NULL,
    last_synced_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.hard_drives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    capacity_gb numeric DEFAULT 0 NOT NULL,
    projects jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.hard_drives REPLICA IDENTITY FULL;

CREATE TABLE public.historical_project_links (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    history_key text NOT NULL,
    link text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.kanban_columns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    key text DEFAULT ''::text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    color text DEFAULT ''::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.kanban_columns REPLICA IDENTITY FULL;

CREATE TABLE public.landing_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    company text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    whatsapp text DEFAULT ''::text NOT NULL,
    instagram text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.lead_statuses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    color text DEFAULT 'slate'::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    role text,
    is_default boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.legacy_projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_number text DEFAULT ''::text NOT NULL,
    client_id text DEFAULT ''::text NOT NULL,
    client_name text DEFAULT ''::text NOT NULL,
    size_gb numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.legacy_projects REPLICA IDENTITY FULL;

CREATE TABLE public.monthly_goals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    month text DEFAULT ''::text NOT NULL,
    value numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    meetings_goal integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.monthly_goals REPLICA IDENTITY FULL;

CREATE TABLE public.payment_terms (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.payment_terms REPLICA IDENTITY FULL;

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    birth_date date
);

CREATE TABLE public.project_activities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    project_card_id uuid NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'nao_iniciado'::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    assigned_to_user_id uuid,
    due_date date,
    assigned_to_user_ids uuid[] DEFAULT '{}'::uuid[] NOT NULL,
    freela_name text,
    is_delivery boolean DEFAULT false NOT NULL,
    end_date date,
    is_captacao boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.project_activities REPLICA IDENTITY FULL;

CREATE TABLE public.project_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    budget_id uuid NOT NULL,
    proposal_id text DEFAULT ''::text NOT NULL,
    project_name text DEFAULT ''::text NOT NULL,
    client_name text DEFAULT ''::text NOT NULL,
    client_id text DEFAULT ''::text NOT NULL,
    objective text DEFAULT ''::text NOT NULL,
    status text DEFAULT 'planejamento'::text NOT NULL,
    service_types jsonb DEFAULT '[]'::jsonb NOT NULL,
    progress integer DEFAULT 0 NOT NULL,
    tasks jsonb DEFAULT '[]'::jsonb NOT NULL,
    links jsonb DEFAULT '[]'::jsonb NOT NULL,
    comments jsonb DEFAULT '[]'::jsonb NOT NULL,
    material_link text DEFAULT ''::text NOT NULL,
    notes text DEFAULT ''::text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    drive_url text DEFAULT ''::text,
    material_links jsonb DEFAULT '[]'::jsonb NOT NULL,
    archived_at timestamp with time zone
);

ALTER TABLE ONLY public.project_cards REPLICA IDENTITY FULL;

CREATE TABLE public.project_columns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    key text DEFAULT ''::text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    color text DEFAULT ''::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.project_columns REPLICA IDENTITY FULL;

CREATE TABLE public.prospection_leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    company_name text DEFAULT ''::text NOT NULL,
    contact_name text DEFAULT ''::text NOT NULL,
    contact_role text DEFAULT ''::text NOT NULL,
    phone text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    city text DEFAULT ''::text NOT NULL,
    origin text DEFAULT 'prospeccao_ativa'::text NOT NULL,
    segment text DEFAULT 'outro'::text NOT NULL,
    acquisition_type text DEFAULT 'outbound'::text NOT NULL,
    estimated_potential numeric DEFAULT 0 NOT NULL,
    temperature text DEFAULT 'frio'::text NOT NULL,
    funnel_status text DEFAULT 'mapeado'::text NOT NULL,
    prospection_responsible text DEFAULT ''::text NOT NULL,
    closing_responsible text DEFAULT ''::text NOT NULL,
    last_contact_date text DEFAULT ''::text NOT NULL,
    next_action text DEFAULT ''::text NOT NULL,
    next_action_date text DEFAULT ''::text NOT NULL,
    priority text DEFAULT 'media'::text NOT NULL,
    strategic_notes text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    responsible_user_id uuid,
    temperature_manual boolean DEFAULT false NOT NULL,
    meeting_scheduled_at timestamp with time zone,
    meeting_happened boolean,
    responsible_user_id_2 uuid
);

ALTER TABLE ONLY public.prospection_leads REPLICA IDENTITY FULL;

CREATE TABLE public.revenue_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.revenue_centers REPLICA IDENTITY FULL;

CREATE TABLE public.score_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    client_id uuid NOT NULL,
    score integer DEFAULT 0 NOT NULL,
    previous_score integer DEFAULT 0 NOT NULL,
    reason text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.score_history REPLICA IDENTITY FULL;

CREATE TABLE public.service_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    key text DEFAULT ''::text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL,
    is_default boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.service_categories REPLICA IDENTITY FULL;

CREATE TABLE public.service_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    name text DEFAULT ''::text NOT NULL,
    category_key text DEFAULT ''::text NOT NULL,
    unit text DEFAULT 'diaria'::text NOT NULL,
    description text DEFAULT ''::text NOT NULL,
    default_price numeric DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.service_items REPLICA IDENTITY FULL;

CREATE TABLE public.service_objectives (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    key text DEFAULT ''::text NOT NULL,
    label text DEFAULT ''::text NOT NULL,
    category_key text DEFAULT ''::text NOT NULL,
    "order" integer DEFAULT 0 NOT NULL
);

ALTER TABLE ONLY public.service_objectives REPLICA IDENTITY FULL;

CREATE TABLE public.system_admins (
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.team_finance_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.workspace_contract_template (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    content text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.workspace_contract_template REPLICA IDENTITY FULL;

CREATE TABLE public.workspace_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    email text NOT NULL,
    role public.app_role DEFAULT 'vendedor'::public.app_role NOT NULL,
    page_permissions text[] DEFAULT '{}'::text[] NOT NULL,
    invited_by uuid,
    accepted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT workspace_invites_role_not_visualizador CHECK ((role <> 'visualizador'::public.app_role))
);

CREATE TABLE public.workspace_layout (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    logo_url text DEFAULT ''::text NOT NULL,
    company_name text DEFAULT ''::text NOT NULL,
    website text DEFAULT ''::text NOT NULL,
    email text DEFAULT ''::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pdf_title text DEFAULT 'PROPOSTA COMERCIAL'::text NOT NULL,
    section_client_title text DEFAULT 'CLIENTE'::text NOT NULL,
    section_briefing_title text DEFAULT 'BRIEFING DO PROJETO'::text NOT NULL,
    section_inclusions_title text DEFAULT 'O QUE ESTÁ INCLUSO'::text NOT NULL,
    section_services_title text DEFAULT 'SERVIÇOS'::text NOT NULL,
    section_operational_title text DEFAULT 'DESPESAS OPERACIONAIS'::text NOT NULL,
    section_investment_title text DEFAULT 'COMPOSIÇÃO DO INVESTIMENTO'::text NOT NULL,
    section_total_title text DEFAULT 'INVESTIMENTO TOTAL'::text NOT NULL,
    section_terms_title text DEFAULT 'TERMOS E CONDIÇÕES'::text NOT NULL,
    terms_company_label text DEFAULT 'Responsabilidades da HERO:'::text NOT NULL,
    terms_company_items text DEFAULT '• Executar os serviços descritos com qualidade profissional
• Fornecer equipe técnica qualificada
• Cumprir os prazos acordados
• Realizar até 2 rodadas de revisão'::text NOT NULL,
    terms_client_label text DEFAULT 'Responsabilidades do Cliente:'::text NOT NULL,
    terms_client_items text DEFAULT '• Fornecer acesso às locações e informações necessárias
• Aprovar materiais dentro dos prazos combinados
• Efetuar pagamentos conforme condições acordadas'::text NOT NULL,
    terms_general_label text DEFAULT 'Condições Gerais:'::text NOT NULL,
    terms_general_items text DEFAULT '• Proposta válida por 30 dias
• Alterações de escopo podem gerar custos adicionais
• Cancelamento após início sujeito a cobrança proporcional'::text NOT NULL,
    terms_approval_text text DEFAULT 'A aprovação desta proposta implica na aceitação dos termos acima.'::text NOT NULL,
    validity_text text DEFAULT 'Validade: 30 dias'::text NOT NULL,
    cover_pdf_url text,
    back_pdf_url text,
    brand_md_url text,
    brand_theme jsonb,
    company_cnpj text,
    company_address text,
    company_city_line text
);

ALTER TABLE ONLY public.workspace_layout REPLICA IDENTITY FULL;

CREATE TABLE public.workspace_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role DEFAULT 'vendedor'::public.app_role NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    page_permissions text[] DEFAULT '{}'::text[] NOT NULL,
    CONSTRAINT workspace_members_role_not_visualizador CHECK ((role <> 'visualizador'::public.app_role))
);

ALTER TABLE ONLY public.workspace_members REPLICA IDENTITY FULL;

CREATE TABLE public.workspace_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    workspace_id uuid NOT NULL,
    default_fixed_cost_percentage numeric DEFAULT 20 NOT NULL,
    default_nf_percentage numeric DEFAULT 13 NOT NULL,
    default_target_margin_percentage numeric DEFAULT 25 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    team_finance_enabled boolean DEFAULT false NOT NULL
);

ALTER TABLE ONLY public.workspace_settings REPLICA IDENTITY FULL;

CREATE TABLE public.workspaces (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.archived_projects
    ADD CONSTRAINT archived_projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.budget_versions
    ADD CONSTRAINT budget_versions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.calendar_notes
    ADD CONSTRAINT calendar_notes_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cashflow_entries
    ADD CONSTRAINT cashflow_entries_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.credit_cards
    ADD CONSTRAINT credit_cards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.feedback_reports
    ADD CONSTRAINT feedback_reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financial_accounts
    ADD CONSTRAINT financial_accounts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.google_calendar_sync_map
    ADD CONSTRAINT google_calendar_sync_map_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.google_calendar_sync_map
    ADD CONSTRAINT google_calendar_sync_map_user_id_activity_id_key UNIQUE (user_id, activity_id);

ALTER TABLE ONLY public.hard_drives
    ADD CONSTRAINT hard_drives_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.historical_project_links
    ADD CONSTRAINT historical_project_links_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.historical_project_links
    ADD CONSTRAINT historical_project_links_workspace_id_history_key_key UNIQUE (workspace_id, history_key);

ALTER TABLE ONLY public.kanban_columns
    ADD CONSTRAINT kanban_columns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.landing_leads
    ADD CONSTRAINT landing_leads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lead_statuses
    ADD CONSTRAINT lead_statuses_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.lead_statuses
    ADD CONSTRAINT lead_statuses_workspace_id_key_key UNIQUE (workspace_id, key);

ALTER TABLE ONLY public.legacy_projects
    ADD CONSTRAINT legacy_projects_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.monthly_goals
    ADD CONSTRAINT monthly_goals_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.monthly_goals
    ADD CONSTRAINT monthly_goals_workspace_id_month_key UNIQUE (workspace_id, month);

ALTER TABLE ONLY public.payment_terms
    ADD CONSTRAINT payment_terms_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_activities
    ADD CONSTRAINT project_activities_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_cards
    ADD CONSTRAINT project_cards_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_columns
    ADD CONSTRAINT project_columns_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.project_columns
    ADD CONSTRAINT project_columns_workspace_key_unique UNIQUE (workspace_id, key);

ALTER TABLE ONLY public.prospection_leads
    ADD CONSTRAINT prospection_leads_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.revenue_centers
    ADD CONSTRAINT revenue_centers_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.score_history
    ADD CONSTRAINT score_history_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_workspace_key_unique UNIQUE (workspace_id, key);

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.service_objectives
    ADD CONSTRAINT service_objectives_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_admins
    ADD CONSTRAINT system_admins_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY public.team_finance_access
    ADD CONSTRAINT team_finance_access_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.team_finance_access
    ADD CONSTRAINT team_finance_access_workspace_id_user_id_key UNIQUE (workspace_id, user_id);

ALTER TABLE ONLY public.workspace_contract_template
    ADD CONSTRAINT workspace_contract_template_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspace_contract_template
    ADD CONSTRAINT workspace_contract_template_workspace_id_key UNIQUE (workspace_id);

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspace_layout
    ADD CONSTRAINT workspace_layout_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspace_layout
    ADD CONSTRAINT workspace_layout_workspace_id_key UNIQUE (workspace_id);

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_user_id_key UNIQUE (workspace_id, user_id);

ALTER TABLE ONLY public.workspace_settings
    ADD CONSTRAINT workspace_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.workspace_settings
    ADD CONSTRAINT workspace_settings_workspace_id_key UNIQUE (workspace_id);

ALTER TABLE ONLY public.workspaces
    ADD CONSTRAINT workspaces_pkey PRIMARY KEY (id);

CREATE INDEX appointments_budget_idx ON public.appointments USING btree (budget_id) WHERE (budget_id IS NOT NULL);

CREATE INDEX appointments_lead_idx ON public.appointments USING btree (lead_id) WHERE (lead_id IS NOT NULL);

CREATE INDEX appointments_workspace_start_idx ON public.appointments USING btree (workspace_id, start_at);

CREATE INDEX client_contacts_client_idx ON public.client_contacts USING btree (client_id);

CREATE INDEX idx_archived_projects_ws_group ON public.archived_projects USING btree (workspace_id, group_name);

CREATE INDEX idx_budget_versions_budget_id ON public.budget_versions USING btree (budget_id);

CREATE INDEX idx_budget_versions_workspace_id ON public.budget_versions USING btree (workspace_id);

CREATE INDEX idx_budgets_client_id ON public.budgets USING btree (client_id);

CREATE INDEX idx_budgets_status ON public.budgets USING btree (status);

CREATE INDEX idx_budgets_workspace_id ON public.budgets USING btree (workspace_id);

CREATE INDEX idx_calendar_notes_user_date ON public.calendar_notes USING btree (user_id, date);

CREATE INDEX idx_cashflow_entries_credit_card ON public.cashflow_entries USING btree (credit_card_id) WHERE (credit_card_id IS NOT NULL);

CREATE INDEX idx_cashflow_execution_cost ON public.cashflow_entries USING btree (workspace_id, execution_cost_id);

CREATE INDEX idx_clients_workspace_id ON public.clients USING btree (workspace_id);

CREATE INDEX idx_gcsm_activity ON public.google_calendar_sync_map USING btree (activity_id);

CREATE INDEX idx_kanban_columns_workspace_id ON public.kanban_columns USING btree (workspace_id);

CREATE INDEX idx_lead_statuses_workspace ON public.lead_statuses USING btree (workspace_id, "order");

CREATE INDEX idx_monthly_goals_workspace_id ON public.monthly_goals USING btree (workspace_id);

CREATE INDEX idx_payment_terms_workspace_id ON public.payment_terms USING btree (workspace_id);

CREATE INDEX idx_project_activities_card ON public.project_activities USING btree (project_card_id);

CREATE INDEX idx_project_activities_workspace ON public.project_activities USING btree (workspace_id);

CREATE INDEX idx_project_cards_budget_id ON public.project_cards USING btree (budget_id);

CREATE INDEX idx_project_cards_workspace_id ON public.project_cards USING btree (workspace_id);

CREATE INDEX idx_project_columns_workspace_id ON public.project_columns USING btree (workspace_id);

CREATE INDEX idx_prospection_leads_workspace_id ON public.prospection_leads USING btree (workspace_id);

CREATE INDEX idx_score_history_client_id ON public.score_history USING btree (client_id);

CREATE INDEX idx_score_history_workspace_id ON public.score_history USING btree (workspace_id);

CREATE INDEX idx_service_categories_workspace_id ON public.service_categories USING btree (workspace_id);

CREATE INDEX idx_service_items_workspace_id ON public.service_items USING btree (workspace_id);

CREATE INDEX idx_service_objectives_workspace_id ON public.service_objectives USING btree (workspace_id);

CREATE INDEX idx_workspace_invites_email ON public.workspace_invites USING btree (email);

CREATE INDEX idx_workspace_invites_workspace_id ON public.workspace_invites USING btree (workspace_id);

CREATE INDEX idx_workspace_members_user_id ON public.workspace_members USING btree (user_id);

CREATE INDEX idx_workspace_members_workspace_id ON public.workspace_members USING btree (workspace_id);

CREATE TRIGGER appointments_updated_at BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER lead_statuses_updated_at BEFORE UPDATE ON public.lead_statuses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_gcal_conn_updated_at BEFORE UPDATE ON public.google_calendar_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_archived_projects_updated_at BEFORE UPDATE ON public.archived_projects FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_calendar_notes_updated_at BEFORE UPDATE ON public.calendar_notes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_client_contacts_updated_at BEFORE UPDATE ON public.client_contacts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_credit_cards_updated_at BEFORE UPDATE ON public.credit_cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feedback_reports_updated_at BEFORE UPDATE ON public.feedback_reports FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_historical_project_links_updated_at BEFORE UPDATE ON public.historical_project_links FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_project_activities_updated_at BEFORE UPDATE ON public.project_activities FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_team_finance_access_updated_at BEFORE UPDATE ON public.team_finance_access FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_workspace_layout_updated_at BEFORE UPDATE ON public.workspace_layout FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_lead_id_fkey FOREIGN KEY (lead_id) REFERENCES public.prospection_leads(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.archived_projects
    ADD CONSTRAINT archived_projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.assets
    ADD CONSTRAINT assets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.budget_versions
    ADD CONSTRAINT budget_versions_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.budget_versions
    ADD CONSTRAINT budget_versions_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_contact_id_fkey FOREIGN KEY (contact_id) REFERENCES public.client_contacts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.budgets
    ADD CONSTRAINT budgets_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cashflow_entries
    ADD CONSTRAINT cashflow_entries_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id);

ALTER TABLE ONLY public.cashflow_entries
    ADD CONSTRAINT cashflow_entries_cost_center_id_fkey FOREIGN KEY (cost_center_id) REFERENCES public.cost_centers(id);

ALTER TABLE ONLY public.cashflow_entries
    ADD CONSTRAINT cashflow_entries_credit_card_id_fkey FOREIGN KEY (credit_card_id) REFERENCES public.credit_cards(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.cashflow_entries
    ADD CONSTRAINT cashflow_entries_revenue_center_id_fkey FOREIGN KEY (revenue_center_id) REFERENCES public.revenue_centers(id);

ALTER TABLE ONLY public.cashflow_entries
    ADD CONSTRAINT cashflow_entries_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_client_id_fkey FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.client_contacts
    ADD CONSTRAINT client_contacts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.clients
    ADD CONSTRAINT clients_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);

ALTER TABLE ONLY public.credit_cards
    ADD CONSTRAINT credit_cards_account_id_fkey FOREIGN KEY (account_id) REFERENCES public.financial_accounts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.credit_cards
    ADD CONSTRAINT credit_cards_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financial_accounts
    ADD CONSTRAINT financial_accounts_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);

ALTER TABLE ONLY public.google_calendar_connections
    ADD CONSTRAINT google_calendar_connections_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.hard_drives
    ADD CONSTRAINT hard_drives_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.historical_project_links
    ADD CONSTRAINT historical_project_links_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.kanban_columns
    ADD CONSTRAINT kanban_columns_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.lead_statuses
    ADD CONSTRAINT lead_statuses_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.legacy_projects
    ADD CONSTRAINT legacy_projects_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.monthly_goals
    ADD CONSTRAINT monthly_goals_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payment_terms
    ADD CONSTRAINT payment_terms_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_cards
    ADD CONSTRAINT project_cards_budget_id_fkey FOREIGN KEY (budget_id) REFERENCES public.budgets(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_cards
    ADD CONSTRAINT project_cards_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.project_columns
    ADD CONSTRAINT project_columns_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.prospection_leads
    ADD CONSTRAINT prospection_leads_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.revenue_centers
    ADD CONSTRAINT revenue_centers_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id);

ALTER TABLE ONLY public.score_history
    ADD CONSTRAINT score_history_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.service_categories
    ADD CONSTRAINT service_categories_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.service_items
    ADD CONSTRAINT service_items_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.service_objectives
    ADD CONSTRAINT service_objectives_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.team_finance_access
    ADD CONSTRAINT team_finance_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.team_finance_access
    ADD CONSTRAINT team_finance_access_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workspace_contract_template
    ADD CONSTRAINT workspace_contract_template_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workspace_invites
    ADD CONSTRAINT workspace_invites_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workspace_layout
    ADD CONSTRAINT workspace_layout_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workspace_members
    ADD CONSTRAINT workspace_members_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workspace_settings
    ADD CONSTRAINT workspace_settings_workspace_id_fkey FOREIGN KEY (workspace_id) REFERENCES public.workspaces(id) ON DELETE CASCADE;

CREATE POLICY "Members can create lead statuses" ON public.lead_statuses FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can delete archived projects" ON public.archived_projects FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can delete lead statuses" ON public.lead_statuses FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can insert archived projects" ON public.archived_projects FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can update archived projects" ON public.archived_projects FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id)) WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can update lead statuses" ON public.lead_statuses FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id)) WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view archived projects" ON public.archived_projects FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view lead statuses" ON public.lead_statuses FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Members can view team finance access" ON public.team_finance_access FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Owner/admin manage team finance access" ON public.team_finance_access TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = team_finance_access.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.workspace_members wm
  WHERE ((wm.workspace_id = team_finance_access.workspace_id) AND (wm.user_id = auth.uid()) AND (wm.role = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))))));

CREATE POLICY "System admins can delete feedback" ON public.feedback_reports FOR DELETE TO authenticated USING (public.is_system_admin(auth.uid()));

CREATE POLICY "System admins can update feedback" ON public.feedback_reports FOR UPDATE TO authenticated USING (public.is_system_admin(auth.uid()));

CREATE POLICY "Users can check own system admin status" ON public.system_admins FOR SELECT TO authenticated USING ((user_id = auth.uid()));

CREATE POLICY "Users can create own feedback" ON public.feedback_reports FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY "Users can delete historical links in their workspace" ON public.historical_project_links FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can insert historical links in their workspace" ON public.historical_project_links FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can update historical links in their workspace" ON public.historical_project_links FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can view historical links of their workspace" ON public.historical_project_links FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Users can view own feedback" ON public.feedback_reports FOR SELECT TO authenticated USING (((auth.uid() = user_id) OR public.is_system_admin(auth.uid())));

CREATE POLICY "Workspace members can create appointments" ON public.appointments FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can delete appointments" ON public.appointments FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can update appointments" ON public.appointments FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id)) WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY "Workspace members can view appointments" ON public.appointments FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY anyone_can_insert_landing_leads ON public.landing_leads FOR INSERT TO anon, authenticated WITH CHECK (true);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.archived_projects ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY assets_owner_admin ON public.assets TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

ALTER TABLE public.budget_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY budget_versions_delete ON public.budget_versions FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY budget_versions_insert ON public.budget_versions FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY budget_versions_select ON public.budget_versions FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY budget_versions_update ON public.budget_versions FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY budgets_delete ON public.budgets FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY budgets_insert ON public.budgets FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY budgets_select ON public.budgets FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY budgets_update ON public.budgets FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.calendar_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY calendar_notes_delete_own ON public.calendar_notes FOR DELETE TO authenticated USING (((auth.uid() = user_id) AND public.has_workspace_access(auth.uid(), workspace_id)));

CREATE POLICY calendar_notes_insert_own ON public.calendar_notes FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND public.has_workspace_access(auth.uid(), workspace_id)));

CREATE POLICY calendar_notes_select_own ON public.calendar_notes FOR SELECT TO authenticated USING (((auth.uid() = user_id) AND public.has_workspace_access(auth.uid(), workspace_id)));

CREATE POLICY calendar_notes_update_own ON public.calendar_notes FOR UPDATE TO authenticated USING (((auth.uid() = user_id) AND public.has_workspace_access(auth.uid(), workspace_id)));

ALTER TABLE public.cashflow_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY cashflow_entries_owner_admin ON public.cashflow_entries TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

CREATE POLICY cc_delete ON public.client_contacts FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY cc_insert ON public.client_contacts FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY cc_select ON public.client_contacts FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY cc_update ON public.client_contacts FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY clients_delete ON public.clients FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY clients_insert ON public.clients FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY clients_select ON public.clients FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY clients_update ON public.clients FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.cost_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY cost_centers_owner_admin ON public.cost_centers TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY credit_cards_owner_admin ON public.credit_cards TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

ALTER TABLE public.feedback_reports ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY financial_accounts_owner_admin ON public.financial_accounts TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

CREATE POLICY gcal_conn_own_delete ON public.google_calendar_connections FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY gcal_conn_own_select ON public.google_calendar_connections FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY gcal_conn_own_update ON public.google_calendar_connections FOR UPDATE TO authenticated USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));

CREATE POLICY gcal_conn_own_upsert ON public.google_calendar_connections FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY gcsm_delete_own ON public.google_calendar_sync_map FOR DELETE TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY gcsm_insert_own ON public.google_calendar_sync_map FOR INSERT TO authenticated WITH CHECK ((auth.uid() = user_id));

CREATE POLICY gcsm_select_own ON public.google_calendar_sync_map FOR SELECT TO authenticated USING ((auth.uid() = user_id));

CREATE POLICY gcsm_update_own ON public.google_calendar_sync_map FOR UPDATE TO authenticated USING ((auth.uid() = user_id));

ALTER TABLE public.google_calendar_connections ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.google_calendar_sync_map ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.hard_drives ENABLE ROW LEVEL SECURITY;

CREATE POLICY hard_drives_delete ON public.hard_drives FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY hard_drives_insert ON public.hard_drives FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY hard_drives_select ON public.hard_drives FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY hard_drives_update ON public.hard_drives FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.historical_project_links ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY kanban_columns_delete ON public.kanban_columns FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY kanban_columns_insert ON public.kanban_columns FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY kanban_columns_select ON public.kanban_columns FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY kanban_columns_update ON public.kanban_columns FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.landing_leads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.lead_statuses ENABLE ROW LEVEL SECURITY;

CREATE POLICY leads_delete ON public.prospection_leads FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY leads_insert ON public.prospection_leads FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY leads_select ON public.prospection_leads FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY leads_update ON public.prospection_leads FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.legacy_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY legacy_projects_delete ON public.legacy_projects FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY legacy_projects_insert ON public.legacy_projects FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY legacy_projects_select ON public.legacy_projects FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY legacy_projects_update ON public.legacy_projects FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.monthly_goals ENABLE ROW LEVEL SECURITY;

CREATE POLICY monthly_goals_delete ON public.monthly_goals FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY monthly_goals_insert ON public.monthly_goals FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY monthly_goals_select ON public.monthly_goals FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY monthly_goals_update ON public.monthly_goals FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

ALTER TABLE public.payment_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY payment_terms_delete_owner ON public.payment_terms FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY payment_terms_insert_owner ON public.payment_terms FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY payment_terms_select ON public.payment_terms FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY payment_terms_update_owner ON public.payment_terms FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role)) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK ((auth.uid() = id));

CREATE POLICY profiles_select_own ON public.profiles FOR SELECT TO authenticated USING ((auth.uid() = id));

CREATE POLICY profiles_select_peers ON public.profiles FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.workspace_members wm1
     JOIN public.workspace_members wm2 ON ((wm1.workspace_id = wm2.workspace_id)))
  WHERE ((wm1.user_id = auth.uid()) AND (wm2.user_id = profiles.id)))));

CREATE POLICY profiles_update ON public.profiles FOR UPDATE TO authenticated USING ((auth.uid() = id));

ALTER TABLE public.project_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_activities_delete ON public.project_activities FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY project_activities_insert ON public.project_activities FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY project_activities_select ON public.project_activities FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY project_activities_update ON public.project_activities FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.project_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_cards_delete ON public.project_cards FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY project_cards_insert ON public.project_cards FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY project_cards_select ON public.project_cards FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY project_cards_update ON public.project_cards FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.project_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_columns_delete ON public.project_columns FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY project_columns_insert ON public.project_columns FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY project_columns_select ON public.project_columns FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY project_columns_update ON public.project_columns FOR UPDATE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.prospection_leads ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.revenue_centers ENABLE ROW LEVEL SECURITY;

CREATE POLICY revenue_centers_owner_admin ON public.revenue_centers TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role]))) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

ALTER TABLE public.score_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY score_history_delete ON public.score_history FOR DELETE TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY score_history_insert ON public.score_history FOR INSERT TO authenticated WITH CHECK (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY score_history_select ON public.score_history FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_categories_delete_owner ON public.service_categories FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY service_categories_insert_owner ON public.service_categories FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY service_categories_select ON public.service_categories FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY service_categories_update_owner ON public.service_categories FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role)) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

ALTER TABLE public.service_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_items_delete_owner ON public.service_items FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY service_items_insert_owner ON public.service_items FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY service_items_select ON public.service_items FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY service_items_update_owner ON public.service_items FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role)) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

ALTER TABLE public.service_objectives ENABLE ROW LEVEL SECURITY;

CREATE POLICY service_objectives_delete_owner ON public.service_objectives FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY service_objectives_insert_owner ON public.service_objectives FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY service_objectives_select ON public.service_objectives FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY service_objectives_update_owner ON public.service_objectives FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role)) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

ALTER TABLE public.system_admins ENABLE ROW LEVEL SECURITY;

CREATE POLICY system_admins_can_select_landing_leads ON public.landing_leads FOR SELECT TO authenticated USING (public.is_system_admin(auth.uid()));

ALTER TABLE public.team_finance_access ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.workspace_contract_template ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_contract_template_delete_owner ON public.workspace_contract_template FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY workspace_contract_template_insert_owner ON public.workspace_contract_template FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY workspace_contract_template_select ON public.workspace_contract_template FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY workspace_contract_template_update_owner ON public.workspace_contract_template FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role)) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

ALTER TABLE public.workspace_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_invites_delete ON public.workspace_invites FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

CREATE POLICY workspace_invites_insert ON public.workspace_invites FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

CREATE POLICY workspace_invites_select ON public.workspace_invites FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY workspace_invites_update ON public.workspace_invites FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = ANY (ARRAY['owner'::public.app_role, 'admin'::public.app_role])));

ALTER TABLE public.workspace_layout ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_layout_delete_owner ON public.workspace_layout FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY workspace_layout_insert_owner ON public.workspace_layout FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY workspace_layout_select ON public.workspace_layout FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY workspace_layout_update_owner ON public.workspace_layout FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role)) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_members_delete ON public.workspace_members FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY workspace_members_insert_owner ON public.workspace_members FOR INSERT TO authenticated WITH CHECK (((auth.uid() = user_id) AND (role = 'owner'::public.app_role) AND (NOT public.workspace_has_members(workspace_id)) AND (EXISTS ( SELECT 1
   FROM public.workspaces w
  WHERE ((w.id = workspace_members.workspace_id) AND (w.created_by = auth.uid()))))));

CREATE POLICY workspace_members_select ON public.workspace_members FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY workspace_members_update ON public.workspace_members FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspace_settings_delete_owner ON public.workspace_settings FOR DELETE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY workspace_settings_insert_owner ON public.workspace_settings FOR INSERT TO authenticated WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

CREATE POLICY workspace_settings_select ON public.workspace_settings FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), workspace_id));

CREATE POLICY workspace_settings_update_owner ON public.workspace_settings FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role)) WITH CHECK ((public.get_user_role(auth.uid(), workspace_id) = 'owner'::public.app_role));

ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY workspaces_insert ON public.workspaces FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));

CREATE POLICY workspaces_select ON public.workspaces FOR SELECT TO authenticated USING (public.has_workspace_access(auth.uid(), id));

CREATE POLICY workspaces_update ON public.workspaces FOR UPDATE TO authenticated USING ((public.get_user_role(auth.uid(), id) = 'owner'::public.app_role));

-- ============================================================================
-- Storage
-- ============================================================================
INSERT INTO storage.buckets (id, name, public) VALUES
  ('avatars', 'avatars', true),
  ('logos', 'logos', true),
  ('budget-documents', 'budget-documents', false),
  ('feedback-images', 'feedback-images', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload own feedback images" ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'feedback-images'::text) AND ((storage.foldername(name))[1] = (auth.uid())::text)));
CREATE POLICY "Users can view own feedback images" ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'feedback-images'::text) AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.is_system_admin(auth.uid()))));
CREATE POLICY avatars_auth_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'avatars'::text) AND public.can_manage_avatar(auth.uid(), (storage.foldername(name))[1])));
CREATE POLICY avatars_auth_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'avatars'::text) AND public.can_manage_avatar(auth.uid(), (storage.foldername(name))[1])));
CREATE POLICY avatars_auth_upload ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'avatars'::text) AND public.can_manage_avatar(auth.uid(), (storage.foldername(name))[1])));
CREATE POLICY avatars_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'avatars'::text));
CREATE POLICY budget_docs_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'budget-documents'::text) AND public.has_workspace_access(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY budget_docs_insert ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'budget-documents'::text) AND public.has_workspace_access(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY budget_docs_select ON storage.objects AS PERMISSIVE FOR SELECT TO authenticated USING (((bucket_id = 'budget-documents'::text) AND public.has_workspace_access(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY budget_docs_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'budget-documents'::text) AND public.has_workspace_access(auth.uid(), ((storage.foldername(name))[1])::uuid)));
CREATE POLICY logos_delete ON storage.objects AS PERMISSIVE FOR DELETE TO authenticated USING (((bucket_id = 'logos'::text) AND (public.get_user_role(auth.uid(), ((storage.foldername(name))[1])::uuid) = 'owner'::public.app_role)));
CREATE POLICY logos_public_read ON storage.objects AS PERMISSIVE FOR SELECT TO public USING ((bucket_id = 'logos'::text));
CREATE POLICY logos_update ON storage.objects AS PERMISSIVE FOR UPDATE TO authenticated USING (((bucket_id = 'logos'::text) AND (public.get_user_role(auth.uid(), ((storage.foldername(name))[1])::uuid) = 'owner'::public.app_role)));
CREATE POLICY logos_upload ON storage.objects AS PERMISSIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'logos'::text) AND (public.get_user_role(auth.uid(), ((storage.foldername(name))[1])::uuid) = 'owner'::public.app_role)));

-- ============================================================================
-- Auth: cria o perfil de cada usuário novo
-- ============================================================================
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- Realtime (tabelas observadas pelo app)
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE
  public.workspace_members,
  public.workspace_settings,
  public.workspace_layout,
  public.clients,
  public.budgets,
  public.budget_versions,
  public.prospection_leads,
  public.kanban_columns,
  public.project_columns,
  public.project_cards,
  public.service_categories,
  public.service_objectives,
  public.service_items,
  public.payment_terms,
  public.score_history,
  public.assets,
  public.hard_drives,
  public.legacy_projects,
  public.monthly_goals,
  public.workspace_contract_template,
  public.financial_accounts,
  public.revenue_centers,
  public.cost_centers,
  public.cashflow_entries,
  public.credit_cards,
  public.project_activities,
  public.calendar_notes,
  public.appointments,
  public.lead_statuses;

-- ============================================================================
-- Permissões
-- ============================================================================
-- Tabelas: o acesso real é decidido pelas políticas RLS acima.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
-- Visitantes não logados só podem enviar o formulário de interesse
-- (o Supabase concede tudo a anon por padrão em tabelas novas)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
GRANT INSERT ON public.landing_leads TO anon;

-- Funções: só usuários logados (e o backend) executam
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated, service_role;
-- A função do gatilho de cadastro não deve ser chamada diretamente
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;
