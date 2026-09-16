export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          all_day: boolean
          assigned_to: string[]
          budget_id: string | null
          client_id: string | null
          color: string | null
          created_at: string
          created_by: string
          description: string
          end_at: string | null
          id: string
          kind: Database["public"]["Enums"]["appointment_kind"]
          lead_id: string | null
          location: string
          start_at: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          all_day?: boolean
          assigned_to?: string[]
          budget_id?: string | null
          client_id?: string | null
          color?: string | null
          created_at?: string
          created_by: string
          description?: string
          end_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          lead_id?: string | null
          location?: string
          start_at: string
          title: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          all_day?: boolean
          assigned_to?: string[]
          budget_id?: string | null
          client_id?: string | null
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string
          end_at?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["appointment_kind"]
          lead_id?: string | null
          location?: string
          start_at?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "prospection_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      archived_projects: {
        Row: {
          archived_at: string
          client_name: string
          created_at: string
          group_name: string
          id: string
          link: string
          project_name: string
          project_number: string
          source_card_id: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string
          client_name?: string
          created_at?: string
          group_name: string
          id?: string
          link?: string
          project_name?: string
          project_number?: string
          source_card_id?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string
          client_name?: string
          created_at?: string
          group_name?: string
          id?: string
          link?: string
          project_name?: string
          project_number?: string
          source_card_id?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "archived_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      assets: {
        Row: {
          assigned_to: string
          category: string
          created_at: string
          description: string
          hero_asset_number: string
          id: string
          inactive_reason: string
          insurance_expires_at: string | null
          is_active: boolean
          name: string
          needs_insurance: boolean
          photo: string
          quantity: number
          reference_link: string
          serial_number: string
          units: Json
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          assigned_to?: string
          category?: string
          created_at?: string
          description?: string
          hero_asset_number?: string
          id?: string
          inactive_reason?: string
          insurance_expires_at?: string | null
          is_active?: boolean
          name?: string
          needs_insurance?: boolean
          photo?: string
          quantity?: number
          reference_link?: string
          serial_number?: string
          units?: Json
          updated_at?: string
          value?: number
          workspace_id: string
        }
        Update: {
          assigned_to?: string
          category?: string
          created_at?: string
          description?: string
          hero_asset_number?: string
          id?: string
          inactive_reason?: string
          insurance_expires_at?: string | null
          is_active?: boolean
          name?: string
          needs_insurance?: boolean
          photo?: string
          quantity?: number
          reference_link?: string
          serial_number?: string
          units?: Json
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_versions: {
        Row: {
          budget_id: string
          costs: Json
          created_at: string
          discount4_price: number
          discount5_price: number
          fixed_cost_percentage: number
          full_price: number
          id: string
          is_rejected: boolean
          margin: number
          nf_cost_percentage: number
          operational_costs: Json
          production_cost: number
          reason: string
          rejection_reason: string | null
          services: Json
          total_cost: number
          version: number
          workspace_id: string
        }
        Insert: {
          budget_id: string
          costs?: Json
          created_at?: string
          discount4_price?: number
          discount5_price?: number
          fixed_cost_percentage?: number
          full_price?: number
          id?: string
          is_rejected?: boolean
          margin?: number
          nf_cost_percentage?: number
          operational_costs?: Json
          production_cost?: number
          reason?: string
          rejection_reason?: string | null
          services?: Json
          total_cost?: number
          version?: number
          workspace_id: string
        }
        Update: {
          budget_id?: string
          costs?: Json
          created_at?: string
          discount4_price?: number
          discount5_price?: number
          fixed_cost_percentage?: number
          full_price?: number
          id?: string
          is_rejected?: boolean
          margin?: number
          nf_cost_percentage?: number
          operational_costs?: Json
          production_cost?: number
          reason?: string
          rejection_reason?: string | null
          services?: Json
          total_cost?: number
          version?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_versions_budget_id_fkey"
            columns: ["budget_id"]
            isOneToOne: false
            referencedRelation: "budgets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "budget_versions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      budgets: {
        Row: {
          approval_date: string | null
          approved_version: number | null
          client_id: string
          contract_url: string | null
          created_at: string
          current_version: number
          description: string
          drive_url: string | null
          execution: Json | null
          execution_end_date: string | null
          execution_end_time: string | null
          execution_month: string | null
          execution_start_date: string | null
          execution_start_time: string | null
          final_value: number | null
          has_execution_date: boolean
          hide_nf_in_pdf: boolean
          hide_nf_observation_in_pdf: boolean
          hide_operational_in_pdf: boolean
          id: string
          includes_accommodation: boolean
          includes_logistics: boolean
          includes_meals: boolean
          includes_raw_material: boolean
          includes_tax: boolean
          includes_technical_visit: boolean
          is_recurring: boolean
          location: string
          nf_url: string | null
          objective: string
          payment_terms: string
          pdf_released: boolean
          project_description: string
          project_name: string
          proposal_id: string
          rejection_observation: string
          rejection_reason: string
          service_type: string
          status: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          approval_date?: string | null
          approved_version?: number | null
          client_id: string
          contract_url?: string | null
          created_at?: string
          current_version?: number
          description?: string
          drive_url?: string | null
          execution?: Json | null
          execution_end_date?: string | null
          execution_end_time?: string | null
          execution_month?: string | null
          execution_start_date?: string | null
          execution_start_time?: string | null
          final_value?: number | null
          has_execution_date?: boolean
          hide_nf_in_pdf?: boolean
          hide_nf_observation_in_pdf?: boolean
          hide_operational_in_pdf?: boolean
          id?: string
          includes_accommodation?: boolean
          includes_logistics?: boolean
          includes_meals?: boolean
          includes_raw_material?: boolean
          includes_tax?: boolean
          includes_technical_visit?: boolean
          is_recurring?: boolean
          location?: string
          nf_url?: string | null
          objective?: string
          payment_terms?: string
          pdf_released?: boolean
          project_description?: string
          project_name?: string
          proposal_id?: string
          rejection_observation?: string
          rejection_reason?: string
          service_type?: string
          status?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          approval_date?: string | null
          approved_version?: number | null
          client_id?: string
          contract_url?: string | null
          created_at?: string
          current_version?: number
          description?: string
          drive_url?: string | null
          execution?: Json | null
          execution_end_date?: string | null
          execution_end_time?: string | null
          execution_month?: string | null
          execution_start_date?: string | null
          execution_start_time?: string | null
          final_value?: number | null
          has_execution_date?: boolean
          hide_nf_in_pdf?: boolean
          hide_nf_observation_in_pdf?: boolean
          hide_operational_in_pdf?: boolean
          id?: string
          includes_accommodation?: boolean
          includes_logistics?: boolean
          includes_meals?: boolean
          includes_raw_material?: boolean
          includes_tax?: boolean
          includes_technical_visit?: boolean
          is_recurring?: boolean
          location?: string
          nf_url?: string | null
          objective?: string
          payment_terms?: string
          pdf_released?: boolean
          project_description?: string
          project_name?: string
          proposal_id?: string
          rejection_observation?: string
          rejection_reason?: string
          service_type?: string
          status?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budgets_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_notes: {
        Row: {
          content: string
          created_at: string
          date: string
          id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          date: string
          id?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          date?: string
          id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      cashflow_entries: {
        Row: {
          account_id: string | null
          budget_id: string | null
          cost_center_id: string | null
          created_at: string
          credit_card_id: string | null
          date: string
          description: string
          id: string
          is_future_payment: boolean
          is_paid: boolean
          notes: string
          paid_at: string | null
          payment_due_date: string | null
          revenue_center_id: string | null
          type: string
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          budget_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          credit_card_id?: string | null
          date?: string
          description?: string
          id?: string
          is_future_payment?: boolean
          is_paid?: boolean
          notes?: string
          paid_at?: string | null
          payment_due_date?: string | null
          revenue_center_id?: string | null
          type?: string
          updated_at?: string
          value?: number
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          budget_id?: string | null
          cost_center_id?: string | null
          created_at?: string
          credit_card_id?: string | null
          date?: string
          description?: string
          id?: string
          is_future_payment?: boolean
          is_paid?: boolean
          notes?: string
          paid_at?: string | null
          payment_due_date?: string | null
          revenue_center_id?: string | null
          type?: string
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cashflow_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_cost_center_id_fkey"
            columns: ["cost_center_id"]
            isOneToOne: false
            referencedRelation: "cost_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_credit_card_id_fkey"
            columns: ["credit_card_id"]
            isOneToOne: false
            referencedRelation: "credit_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_revenue_center_id_fkey"
            columns: ["revenue_center_id"]
            isOneToOne: false
            referencedRelation: "revenue_centers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cashflow_entries_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address: string | null
          address_complement: string | null
          address_number: string | null
          city: string | null
          cnpj: string
          company_name: string
          created_at: string
          email: string
          id: string
          lead_origin: string
          legal_representative_cpf: string
          legal_representative_name: string
          municipal_registration: string | null
          neighborhood: string | null
          phone: string
          responsible_person: string
          score: number
          sector: string
          state: string | null
          state_registration: string | null
          updated_at: string
          workspace_id: string
          zip_code: string | null
        }
        Insert: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          lead_origin?: string
          legal_representative_cpf?: string
          legal_representative_name?: string
          municipal_registration?: string | null
          neighborhood?: string | null
          phone?: string
          responsible_person?: string
          score?: number
          sector?: string
          state?: string | null
          state_registration?: string | null
          updated_at?: string
          workspace_id: string
          zip_code?: string | null
        }
        Update: {
          address?: string | null
          address_complement?: string | null
          address_number?: string | null
          city?: string | null
          cnpj?: string
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          lead_origin?: string
          legal_representative_cpf?: string
          legal_representative_name?: string
          municipal_registration?: string | null
          neighborhood?: string | null
          phone?: string
          responsible_person?: string
          score?: number
          sector?: string
          state?: string | null
          state_registration?: string | null
          updated_at?: string
          workspace_id?: string
          zip_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      cost_centers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_centers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_cards: {
        Row: {
          account_id: string | null
          brand: string
          closing_day: number
          created_at: string
          credit_limit: number
          due_day: number
          id: string
          is_active: boolean
          last_digits: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_id?: string | null
          brand?: string
          closing_day?: number
          created_at?: string
          credit_limit?: number
          due_day?: number
          id?: string
          is_active?: boolean
          last_digits?: string
          name?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_id?: string | null
          brand?: string
          closing_day?: number
          created_at?: string
          credit_limit?: number
          due_day?: number
          id?: string
          is_active?: boolean
          last_digits?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_cards_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "credit_cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_reports: {
        Row: {
          created_at: string
          id: string
          images: Json
          message: string
          page_path: string
          rating: number | null
          status: string
          type: string
          updated_at: string
          user_id: string
          user_name: string
          workspace_id: string | null
          workspace_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          images?: Json
          message: string
          page_path?: string
          rating?: number | null
          status?: string
          type?: string
          updated_at?: string
          user_id: string
          user_name?: string
          workspace_id?: string | null
          workspace_name?: string
        }
        Update: {
          created_at?: string
          id?: string
          images?: Json
          message?: string
          page_path?: string
          rating?: number | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
          user_name?: string
          workspace_id?: string | null
          workspace_name?: string
        }
        Relationships: []
      }
      financial_accounts: {
        Row: {
          account_number: string
          agency: string
          bank: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          type: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          account_number?: string
          agency?: string
          bank?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          account_number?: string
          agency?: string
          bank?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          type?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_accounts_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      google_calendar_connections: {
        Row: {
          connected_at: string | null
          connection_key: string | null
          created_at: string
          email: string | null
          pending_session_id: string | null
          updated_at: string
          user_id: string
          workspace_id: string | null
        }
        Insert: {
          connected_at?: string | null
          connection_key?: string | null
          created_at?: string
          email?: string | null
          pending_session_id?: string | null
          updated_at?: string
          user_id: string
          workspace_id?: string | null
        }
        Update: {
          connected_at?: string | null
          connection_key?: string | null
          created_at?: string
          email?: string | null
          pending_session_id?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string | null
        }
        Relationships: []
      }
      google_calendar_sync_map: {
        Row: {
          activity_id: string
          google_event_id: string
          id: string
          last_synced_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          activity_id: string
          google_event_id: string
          id?: string
          last_synced_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          activity_id?: string
          google_event_id?: string
          id?: string
          last_synced_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: []
      }
      hard_drives: {
        Row: {
          capacity_gb: number
          created_at: string
          id: string
          label: string
          projects: Json
          workspace_id: string
        }
        Insert: {
          capacity_gb?: number
          created_at?: string
          id?: string
          label?: string
          projects?: Json
          workspace_id: string
        }
        Update: {
          capacity_gb?: number
          created_at?: string
          id?: string
          label?: string
          projects?: Json
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hard_drives_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_project_links: {
        Row: {
          created_at: string
          history_key: string
          id: string
          link: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          history_key: string
          id?: string
          link?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          history_key?: string
          id?: string
          link?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_project_links_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      kanban_columns: {
        Row: {
          color: string
          id: string
          is_default: boolean
          key: string
          label: string
          order: number
          workspace_id: string
        }
        Insert: {
          color?: string
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          order?: number
          workspace_id: string
        }
        Update: {
          color?: string
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kanban_columns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      landing_leads: {
        Row: {
          company: string
          created_at: string
          email: string
          id: string
          instagram: string
          name: string
          whatsapp: string
        }
        Insert: {
          company?: string
          created_at?: string
          email?: string
          id?: string
          instagram?: string
          name?: string
          whatsapp?: string
        }
        Update: {
          company?: string
          created_at?: string
          email?: string
          id?: string
          instagram?: string
          name?: string
          whatsapp?: string
        }
        Relationships: []
      }
      lead_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_default: boolean
          key: string
          label: string
          order: number
          role: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          key: string
          label: string
          order?: number
          role?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          order?: number
          role?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_statuses_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      legacy_projects: {
        Row: {
          client_id: string
          client_name: string
          created_at: string
          id: string
          project_number: string
          size_gb: number
          workspace_id: string
        }
        Insert: {
          client_id?: string
          client_name?: string
          created_at?: string
          id?: string
          project_number?: string
          size_gb?: number
          workspace_id: string
        }
        Update: {
          client_id?: string
          client_name?: string
          created_at?: string
          id?: string
          project_number?: string
          size_gb?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "legacy_projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_goals: {
        Row: {
          created_at: string
          id: string
          meetings_goal: number
          month: string
          updated_at: string
          value: number
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          meetings_goal?: number
          month?: string
          updated_at?: string
          value?: number
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          meetings_goal?: number
          month?: string
          updated_at?: string
          value?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_goals_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_terms: {
        Row: {
          active: boolean
          created_at: string
          description: string
          id: string
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_terms_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          birth_date: string | null
          created_at: string
          id: string
          name: string
          photo_url: string | null
        }
        Insert: {
          birth_date?: string | null
          created_at?: string
          id: string
          name?: string
          photo_url?: string | null
        }
        Update: {
          birth_date?: string | null
          created_at?: string
          id?: string
          name?: string
          photo_url?: string | null
        }
        Relationships: []
      }
      project_activities: {
        Row: {
          assigned_to_user_id: string | null
          assigned_to_user_ids: string[]
          created_at: string
          due_date: string | null
          end_date: string | null
          freela_name: string | null
          id: string
          is_captacao: boolean
          is_delivery: boolean
          order: number
          project_card_id: string
          status: string
          title: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          assigned_to_user_id?: string | null
          assigned_to_user_ids?: string[]
          created_at?: string
          due_date?: string | null
          end_date?: string | null
          freela_name?: string | null
          id?: string
          is_captacao?: boolean
          is_delivery?: boolean
          order?: number
          project_card_id: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          assigned_to_user_id?: string | null
          assigned_to_user_ids?: string[]
          created_at?: string
          due_date?: string | null
          end_date?: string | null
          freela_name?: string | null
          id?: string
          is_captacao?: boolean
          is_delivery?: boolean
          order?: number
          project_card_id?: string
          status?: string
          title?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: []
      }
      project_cards: {
        Row: {
          archived_at: string | null
          budget_id: string
          client_id: string
          client_name: string
          comments: Json
          created_at: string
          drive_url: string | null
          end_date: string | null
          id: string
          links: Json
          material_link: string
          material_links: Json
          notes: string
          objective: string
          progress: number
          project_name: string
          proposal_id: string
          service_types: Json
          start_date: string | null
          status: string
          tasks: Json
          updated_at: string
          workspace_id: string
        }
        Insert: {
          archived_at?: string | null
          budget_id: string
          client_id?: string
          client_name?: string
          comments?: Json
          created_at?: string
          drive_url?: string | null
          end_date?: string | null
          id?: string
          links?: Json
          material_link?: string
          material_links?: Json
          notes?: string
          objective?: string
          progress?: number
          project_name?: string
          proposal_id?: string
          service_types?: Json
          start_date?: string | null
          status?: string
          tasks?: Json
          updated_at?: string
          workspace_id: string
        }
        Update: {
          archived_at?: string | null
          budget_id?: string
          client_id?: string
          client_name?: string
          comments?: Json
          created_at?: string
          drive_url?: string | null
          end_date?: string | null
          id?: string
          links?: Json
          material_link?: string
          material_links?: Json
          notes?: string
          objective?: string
          progress?: number
          project_name?: string
          proposal_id?: string
          service_types?: Json
          start_date?: string | null
          status?: string
          tasks?: Json
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_cards_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_columns: {
        Row: {
          color: string
          id: string
          is_default: boolean
          key: string
          label: string
          order: number
          workspace_id: string
        }
        Insert: {
          color?: string
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          order?: number
          workspace_id: string
        }
        Update: {
          color?: string
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_columns_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      prospection_leads: {
        Row: {
          acquisition_type: string
          city: string
          closing_responsible: string
          company_name: string
          contact_name: string
          contact_role: string
          created_at: string
          email: string
          estimated_potential: number
          funnel_status: string
          id: string
          last_contact_date: string
          meeting_happened: boolean | null
          meeting_scheduled_at: string | null
          next_action: string
          next_action_date: string
          origin: string
          phone: string
          priority: string
          prospection_responsible: string
          responsible_user_id: string | null
          segment: string
          strategic_notes: string
          temperature: string
          temperature_manual: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          acquisition_type?: string
          city?: string
          closing_responsible?: string
          company_name?: string
          contact_name?: string
          contact_role?: string
          created_at?: string
          email?: string
          estimated_potential?: number
          funnel_status?: string
          id?: string
          last_contact_date?: string
          meeting_happened?: boolean | null
          meeting_scheduled_at?: string | null
          next_action?: string
          next_action_date?: string
          origin?: string
          phone?: string
          priority?: string
          prospection_responsible?: string
          responsible_user_id?: string | null
          segment?: string
          strategic_notes?: string
          temperature?: string
          temperature_manual?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          acquisition_type?: string
          city?: string
          closing_responsible?: string
          company_name?: string
          contact_name?: string
          contact_role?: string
          created_at?: string
          email?: string
          estimated_potential?: number
          funnel_status?: string
          id?: string
          last_contact_date?: string
          meeting_happened?: boolean | null
          meeting_scheduled_at?: string | null
          next_action?: string
          next_action_date?: string
          origin?: string
          phone?: string
          priority?: string
          prospection_responsible?: string
          responsible_user_id?: string | null
          segment?: string
          strategic_notes?: string
          temperature?: string
          temperature_manual?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prospection_leads_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      revenue_centers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "revenue_centers_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      score_history: {
        Row: {
          client_id: string
          created_at: string
          id: string
          previous_score: number
          reason: string
          score: number
          workspace_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          id?: string
          previous_score?: number
          reason?: string
          score?: number
          workspace_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          id?: string
          previous_score?: number
          reason?: string
          score?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_categories: {
        Row: {
          id: string
          is_default: boolean
          key: string
          label: string
          order: number
          workspace_id: string
        }
        Insert: {
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          order?: number
          workspace_id: string
        }
        Update: {
          id?: string
          is_default?: boolean
          key?: string
          label?: string
          order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_categories_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_items: {
        Row: {
          category_key: string
          created_at: string
          default_price: number
          description: string
          id: string
          name: string
          sort_order: number
          unit: string
          workspace_id: string
        }
        Insert: {
          category_key?: string
          created_at?: string
          default_price?: number
          description?: string
          id?: string
          name?: string
          sort_order?: number
          unit?: string
          workspace_id: string
        }
        Update: {
          category_key?: string
          created_at?: string
          default_price?: number
          description?: string
          id?: string
          name?: string
          sort_order?: number
          unit?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_items_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      service_objectives: {
        Row: {
          category_key: string
          id: string
          key: string
          label: string
          order: number
          workspace_id: string
        }
        Insert: {
          category_key?: string
          id?: string
          key?: string
          label?: string
          order?: number
          workspace_id: string
        }
        Update: {
          category_key?: string
          id?: string
          key?: string
          label?: string
          order?: number
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_objectives_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      system_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      team_finance_access: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_finance_access_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_contract_template: {
        Row: {
          content: string
          created_at: string
          id: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_contract_template_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invites: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          page_permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
          workspace_id: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          page_permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          workspace_id: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          page_permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invites_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_layout: {
        Row: {
          company_name: string
          created_at: string
          email: string
          id: string
          logo_url: string
          pdf_title: string
          section_briefing_title: string
          section_client_title: string
          section_inclusions_title: string
          section_investment_title: string
          section_operational_title: string
          section_services_title: string
          section_terms_title: string
          section_total_title: string
          terms_approval_text: string
          terms_client_items: string
          terms_client_label: string
          terms_company_items: string
          terms_company_label: string
          terms_general_items: string
          terms_general_label: string
          updated_at: string
          validity_text: string
          website: string
          workspace_id: string
        }
        Insert: {
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          logo_url?: string
          pdf_title?: string
          section_briefing_title?: string
          section_client_title?: string
          section_inclusions_title?: string
          section_investment_title?: string
          section_operational_title?: string
          section_services_title?: string
          section_terms_title?: string
          section_total_title?: string
          terms_approval_text?: string
          terms_client_items?: string
          terms_client_label?: string
          terms_company_items?: string
          terms_company_label?: string
          terms_general_items?: string
          terms_general_label?: string
          updated_at?: string
          validity_text?: string
          website?: string
          workspace_id: string
        }
        Update: {
          company_name?: string
          created_at?: string
          email?: string
          id?: string
          logo_url?: string
          pdf_title?: string
          section_briefing_title?: string
          section_client_title?: string
          section_inclusions_title?: string
          section_investment_title?: string
          section_operational_title?: string
          section_services_title?: string
          section_terms_title?: string
          section_total_title?: string
          terms_approval_text?: string
          terms_client_items?: string
          terms_client_label?: string
          terms_company_items?: string
          terms_company_label?: string
          terms_general_items?: string
          terms_general_label?: string
          updated_at?: string
          validity_text?: string
          website?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_layout_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          joined_at: string
          page_permissions: string[]
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          page_permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          page_permissions?: string[]
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_settings: {
        Row: {
          created_at: string
          default_fixed_cost_percentage: number
          default_nf_percentage: number
          default_target_margin_percentage: number
          id: string
          team_finance_enabled: boolean
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          default_fixed_cost_percentage?: number
          default_nf_percentage?: number
          default_target_margin_percentage?: number
          id?: string
          team_finance_enabled?: boolean
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          default_fixed_cost_percentage?: number
          default_nf_percentage?: number
          default_target_margin_percentage?: number
          id?: string
          team_finance_enabled?: boolean
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_settings_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { invite_id: string }; Returns: undefined }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_user_workspace: { Args: { _user_id: string }; Returns: string }
      handle_signup_workspace: {
        Args: { workspace_name: string }
        Returns: string
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_access: {
        Args: { _user_id: string; _workspace_id: string }
        Returns: boolean
      }
      is_system_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "vendedor" | "visualizador" | "time_hero"
      appointment_kind: "reuniao" | "gravacao" | "entrega" | "visita" | "outro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "vendedor", "visualizador", "time_hero"],
      appointment_kind: ["reuniao", "gravacao", "entrega", "visita", "outro"],
    },
  },
} as const
