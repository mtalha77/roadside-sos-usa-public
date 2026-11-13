// GENERATED from rsos-dev by `pnpm --filter @rsos/db gen:types`. Do not edit by hand.
// Regenerate after every migration that changes the public schema.

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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      account_requests: {
        Row: {
          created_at: string
          id: string
          kind: string
          provider_id: string | null
          reason: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          provider_id?: string | null
          reason?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          provider_id?: string | null
          reason?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_requests_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      attributions: {
        Row: {
          call_id: string | null
          created_at: string
          device: string | null
          fbclid: string | null
          gbraid: string | null
          gclid: string | null
          id: string
          ip_hash: string | null
          landing_page: string | null
          msclkid: string | null
          referrer: string | null
          request_id: string
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
          wbraid: string | null
        }
        Insert: {
          call_id?: string | null
          created_at?: string
          device?: string | null
          fbclid?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          ip_hash?: string | null
          landing_page?: string | null
          msclkid?: string | null
          referrer?: string | null
          request_id: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wbraid?: string | null
        }
        Update: {
          call_id?: string | null
          created_at?: string
          device?: string | null
          fbclid?: string | null
          gbraid?: string | null
          gclid?: string | null
          id?: string
          ip_hash?: string | null
          landing_page?: string | null
          msclkid?: string | null
          referrer?: string | null
          request_id?: string
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
          wbraid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attributions_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: true
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_role: string | null
          created_at: string
          data: Json
          entity_id: string | null
          entity_type: string
          id: number
          ip: unknown
          market_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type: string
          id?: never
          ip?: unknown
          market_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          data?: Json
          entity_id?: string | null
          entity_type?: string
          id?: never
          ip?: unknown
          market_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      consents: {
        Row: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at: string
          granted: boolean
          id: string
          ip: unknown
          phone: string
          policy_version: string
          request_id: string | null
          source: string
          user_agent: string | null
        }
        Insert: {
          consent_type: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          granted: boolean
          id?: string
          ip?: unknown
          phone: string
          policy_version: string
          request_id?: string | null
          source: string
          user_agent?: string | null
        }
        Update: {
          consent_type?: Database["public"]["Enums"]["consent_type"]
          created_at?: string
          granted?: boolean
          id?: string
          ip?: unknown
          phone?: string
          policy_version?: string
          request_id?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string | null
          id: string
          market_id: string | null
          message: string
          name: string
          phone: string | null
          status: Database["public"]["Enums"]["message_status"]
          topic: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          market_id?: string | null
          message: string
          name: string
          phone?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          topic?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          market_id?: string | null
          message?: string
          name?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["message_status"]
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      email_second_step_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          locked_until: string | null
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          locked_until?: string | null
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          locked_until?: string | null
          user_id?: string
        }
        Relationships: []
      }
      market_phone_numbers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          market_id: string
          phone_number: string
          purpose: Database["public"]["Enums"]["phone_purpose"]
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          market_id: string
          phone_number: string
          purpose: Database["public"]["Enums"]["phone_purpose"]
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          market_id?: string
          phone_number?: string
          purpose?: Database["public"]["Enums"]["phone_purpose"]
          twilio_sid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_phone_numbers_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_services: {
        Row: {
          created_at: string
          effective_from: string
          enabled: boolean
          id: string
          market_id: string
          platform_fee_cents: number | null
          price_max_cents: number | null
          price_min_cents: number | null
          price_note: string | null
          service_id: string
        }
        Insert: {
          created_at?: string
          effective_from?: string
          enabled?: boolean
          id?: string
          market_id: string
          platform_fee_cents?: number | null
          price_max_cents?: number | null
          price_min_cents?: number | null
          price_note?: string | null
          service_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          enabled?: boolean
          id?: string
          market_id?: string
          platform_fee_cents?: number | null
          price_max_cents?: number | null
          price_min_cents?: number | null
          price_note?: string | null
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_services_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      markets: {
        Row: {
          boundary: unknown
          center: unknown
          coverage_hours: Json
          created_at: string
          id: string
          name: string
          seo_intro: string | null
          seo_title: string | null
          slug: string
          state_code: string
          status: Database["public"]["Enums"]["market_status"]
          support_phone: string | null
          time_zone: string
          updated_at: string
        }
        Insert: {
          boundary: unknown
          center: unknown
          coverage_hours?: Json
          created_at?: string
          id?: string
          name: string
          seo_intro?: string | null
          seo_title?: string | null
          slug: string
          state_code: string
          status?: Database["public"]["Enums"]["market_status"]
          support_phone?: string | null
          time_zone: string
          updated_at?: string
        }
        Update: {
          boundary?: unknown
          center?: unknown
          coverage_hours?: Json
          created_at?: string
          id?: string
          name?: string
          seo_intro?: string | null
          seo_title?: string | null
          slug?: string
          state_code?: string
          status?: Database["public"]["Enums"]["market_status"]
          support_phone?: string | null
          time_zone?: string
          updated_at?: string
        }
        Relationships: []
      }
      provider_applications: {
        Row: {
          company_name: string
          contact_name: string
          created_at: string
          email: string
          id: string
          insurance_carrier: string | null
          license_number: string | null
          market_ids: string[]
          notes: string | null
          phone: string
          referral_source: string | null
          service_ids: string[]
          status: Database["public"]["Enums"]["application_status"]
          truck_count: number | null
          updated_at: string
        }
        Insert: {
          company_name: string
          contact_name: string
          created_at?: string
          email: string
          id?: string
          insurance_carrier?: string | null
          license_number?: string | null
          market_ids?: string[]
          notes?: string | null
          phone: string
          referral_source?: string | null
          service_ids?: string[]
          status?: Database["public"]["Enums"]["application_status"]
          truck_count?: number | null
          updated_at?: string
        }
        Update: {
          company_name?: string
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          insurance_carrier?: string | null
          license_number?: string | null
          market_ids?: string[]
          notes?: string | null
          phone?: string
          referral_source?: string | null
          service_ids?: string[]
          status?: Database["public"]["Enums"]["application_status"]
          truck_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      provider_billing_events: {
        Row: {
          amount_cents: number
          created_at: string
          id: number
          kind: string
          provider_id: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: never
          kind: string
          provider_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: never
          kind?: string
          provider_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_billing_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_members: {
        Row: {
          created_at: string
          provider_id: string
          role: Database["public"]["Enums"]["provider_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          provider_id: string
          role: Database["public"]["Enums"]["provider_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          provider_id?: string
          role?: Database["public"]["Enums"]["provider_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_members_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_wallets: {
        Row: {
          balance_cents: number
          provider_id: string
          updated_at: string
        }
        Insert: {
          balance_cents?: number
          provider_id: string
          updated_at?: string
        }
        Update: {
          balance_cents?: number
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_wallets_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
        ]
      }
      providers: {
        Row: {
          created_at: string
          id: string
          market_ids: string[]
          name: string
          status: Database["public"]["Enums"]["provider_status"]
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          market_ids?: string[]
          name: string
          status?: Database["public"]["Enums"]["provider_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          market_ids?: string[]
          name?: string
          status?: Database["public"]["Enums"]["provider_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      request_events: {
        Row: {
          actor_id: string | null
          actor_type: Database["public"]["Enums"]["actor_type"]
          created_at: string
          data: Json
          event_type: string
          from_status: Database["public"]["Enums"]["request_status"] | null
          id: number
          request_id: string
          to_status: Database["public"]["Enums"]["request_status"] | null
        }
        Insert: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          data?: Json
          event_type: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: never
          request_id: string
          to_status?: Database["public"]["Enums"]["request_status"] | null
        }
        Update: {
          actor_id?: string | null
          actor_type?: Database["public"]["Enums"]["actor_type"]
          created_at?: string
          data?: Json
          event_type?: string
          from_status?: Database["public"]["Enums"]["request_status"] | null
          id?: never
          request_id?: string
          to_status?: Database["public"]["Enums"]["request_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      requests: {
        Row: {
          accepted_at: string | null
          assigned_dispatcher_id: string | null
          cancelled_at: string | null
          channel: Database["public"]["Enums"]["request_channel"]
          completed_at: string | null
          created_at: string
          destination_address: string | null
          destination_point: unknown
          driver_name: string
          driver_phone: string
          driver_phone_verified: boolean
          en_route_at: string | null
          expired_at: string | null
          has_passengers: boolean | null
          id: string
          keys_available: boolean | null
          market_id: string
          market_service_id: string
          notes: string | null
          on_highway: boolean | null
          on_site_at: string | null
          pickup_address: string
          pickup_note: string | null
          pickup_point: unknown
          platform_fee_cents: number
          quoted_at: string | null
          safe_spot: boolean | null
          service_id: string
          short_code: string
          spare_available: boolean | null
          status: Database["public"]["Enums"]["request_status"]
          status_token: string
          submitted_at: string | null
          updated_at: string
          vehicle_color: string | null
          vehicle_is_ev: boolean
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_year: number | null
        }
        Insert: {
          accepted_at?: string | null
          assigned_dispatcher_id?: string | null
          cancelled_at?: string | null
          channel?: Database["public"]["Enums"]["request_channel"]
          completed_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_point?: unknown
          driver_name: string
          driver_phone: string
          driver_phone_verified?: boolean
          en_route_at?: string | null
          expired_at?: string | null
          has_passengers?: boolean | null
          id?: string
          keys_available?: boolean | null
          market_id: string
          market_service_id: string
          notes?: string | null
          on_highway?: boolean | null
          on_site_at?: string | null
          pickup_address: string
          pickup_note?: string | null
          pickup_point: unknown
          platform_fee_cents: number
          quoted_at?: string | null
          safe_spot?: boolean | null
          service_id: string
          short_code: string
          spare_available?: boolean | null
          status?: Database["public"]["Enums"]["request_status"]
          status_token?: string
          submitted_at?: string | null
          updated_at?: string
          vehicle_color?: string | null
          vehicle_is_ev?: boolean
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_year?: number | null
        }
        Update: {
          accepted_at?: string | null
          assigned_dispatcher_id?: string | null
          cancelled_at?: string | null
          channel?: Database["public"]["Enums"]["request_channel"]
          completed_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_point?: unknown
          driver_name?: string
          driver_phone?: string
          driver_phone_verified?: boolean
          en_route_at?: string | null
          expired_at?: string | null
          has_passengers?: boolean | null
          id?: string
          keys_available?: boolean | null
          market_id?: string
          market_service_id?: string
          notes?: string | null
          on_highway?: boolean | null
          on_site_at?: string | null
          pickup_address?: string
          pickup_note?: string | null
          pickup_point?: unknown
          platform_fee_cents?: number
          quoted_at?: string | null
          safe_spot?: boolean | null
          service_id?: string
          short_code?: string
          spare_available?: boolean | null
          status?: Database["public"]["Enums"]["request_status"]
          status_token?: string
          submitted_at?: string | null
          updated_at?: string
          vehicle_color?: string | null
          vehicle_is_ev?: boolean
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_market_service_id_fkey"
            columns: ["market_service_id"]
            isOneToOne: false
            referencedRelation: "current_market_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_market_service_id_fkey"
            columns: ["market_service_id"]
            isOneToOne: false
            referencedRelation: "market_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "requests_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          allowed_vehicle_types: Database["public"]["Enums"]["vehicle_type"][]
          created_at: string
          description: string
          icon_key: string
          id: string
          name: string
          needs_destination: boolean
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          allowed_vehicle_types?: Database["public"]["Enums"]["vehicle_type"][]
          created_at?: string
          description?: string
          icon_key: string
          id?: string
          name: string
          needs_destination?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          allowed_vehicle_types?: Database["public"]["Enums"]["vehicle_type"][]
          created_at?: string
          description?: string
          icon_key?: string
          id?: string
          name?: string
          needs_destination?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          created_at: string
          display_name: string
          is_active: boolean
          market_ids: string[] | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          is_active?: boolean
          market_ids?: string[] | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          is_active?: boolean
          market_ids?: string[] | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      trusted_devices: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_security_settings: {
        Row: {
          second_step_method: Database["public"]["Enums"]["second_step_method"]
          updated_at: string
          user_id: string
        }
        Insert: {
          second_step_method?: Database["public"]["Enums"]["second_step_method"]
          updated_at?: string
          user_id: string
        }
        Update: {
          second_step_method?: Database["public"]["Enums"]["second_step_method"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      verified_sessions: {
        Row: {
          method: string
          session_id: string
          user_id: string
          verified_at: string
        }
        Insert: {
          method: string
          session_id: string
          user_id: string
          verified_at?: string
        }
        Update: {
          method?: string
          session_id?: string
          user_id?: string
          verified_at?: string
        }
        Relationships: []
      }
      waitlist: {
        Row: {
          city: string | null
          created_at: string
          email: string | null
          id: string
          phone: string | null
          point: unknown
          source: string | null
          state_code: string | null
          zip: string | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          point?: unknown
          source?: string | null
          state_code?: string | null
          zip?: string | null
        }
        Update: {
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          phone?: string | null
          point?: unknown
          source?: string | null
          state_code?: string | null
          zip?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      current_market_services: {
        Row: {
          created_at: string | null
          effective_from: string | null
          enabled: boolean | null
          id: string | null
          market_id: string | null
          platform_fee_cents: number | null
          price_max_cents: number | null
          price_min_cents: number | null
          price_note: string | null
          service_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "market_services_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      create_request: {
        Args: { p: Json }
        Returns: {
          request_id: string
          short_code: string
          status_token: string
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      forget_trusted_device: { Args: { p_id: string }; Returns: undefined }
      generate_recovery_codes: { Args: never; Returns: string[] }
      generate_short_code: { Args: never; Returns: string }
      get_market_services: {
        Args: { p_market_slug: string }
        Returns: {
          enabled: boolean
          icon_key: string
          needs_destination: boolean
          platform_fee_cents: number
          price_max_cents: number
          price_min_cents: number
          price_note: string
          service_name: string
          service_slug: string
          sort_order: number
        }[]
      }
      get_request_by_token: {
        Args: { p_token: string }
        Returns: {
          accepted_at: string
          cancelled_at: string
          completed_at: string
          created_at: string
          en_route_at: string
          expired_at: string
          market_name: string
          market_slug: string
          market_time_zone: string
          on_site_at: string
          quoted_at: string
          service_name: string
          service_slug: string
          short_code: string
          status: Database["public"]["Enums"]["request_status"]
          submitted_at: string
        }[]
      }
      issue_email_code: { Args: never; Returns: string }
      jwt_provider_role: {
        Args: { p_provider_id: string }
        Returns: Database["public"]["Enums"]["provider_role"]
      }
      jwt_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      list_public_markets: {
        Args: never
        Returns: {
          center_lat: number
          center_lng: number
          id: string
          name: string
          seo_intro: string
          seo_title: string
          slug: string
          state_code: string
          status: Database["public"]["Enums"]["market_status"]
          support_phone: string
          time_zone: string
        }[]
      }
      log_security_event: {
        Args: { p_action: string; p_data?: Json; p_ip?: string }
        Returns: undefined
      }
      mark_session_verified: { Args: { p_method: string }; Returns: undefined }
      market_for_point: {
        Args: { p_lat: number; p_lng: number }
        Returns: {
          id: string
          name: string
          slug: string
          state_code: string
          status: Database["public"]["Enums"]["market_status"]
          support_phone: string
          time_zone: string
        }[]
      }
      my_provider_status: {
        Args: never
        Returns: {
          name: string
          provider_id: string
          role: Database["public"]["Enums"]["provider_role"]
          status: Database["public"]["Enums"]["provider_status"]
          status_reason: string
        }[]
      }
      my_security_events: {
        Args: { p_limit?: number }
        Returns: {
          action: string
          created_at: string
          data: Json
          ip: string
        }[]
      }
      my_sessions: {
        Args: never
        Returns: {
          created_at: string
          id: string
          ip: string
          is_current: boolean
          refreshed_at: string
          user_agent: string
        }[]
      }
      request_account_closure: { Args: { p_reason: string }; Returns: string }
      revoke_my_session: { Args: { p_session_id: string }; Returns: boolean }
      session_status: {
        Args: never
        Returns: {
          active: boolean
          second_step_passed: boolean
        }[]
      }
      set_second_step_method: {
        Args: { p_method: Database["public"]["Enums"]["second_step_method"] }
        Returns: undefined
      }
      sha256_hex: { Args: { p: string }; Returns: string }
      staff_can_access_market: {
        Args: { p_market_id: string }
        Returns: boolean
      }
      trust_this_device: {
        Args: { p_token: string; p_user_agent: string }
        Returns: undefined
      }
      use_recovery_code: { Args: { p_code: string }; Returns: boolean }
      use_trusted_device: { Args: { p_token: string }; Returns: boolean }
      verify_email_code: { Args: { p_code: string }; Returns: string }
    }
    Enums: {
      actor_type: "system" | "driver" | "provider" | "staff"
      application_status: "new" | "reviewing" | "approved" | "rejected"
      consent_type:
        | "terms"
        | "privacy"
        | "sms_transactional"
        | "sms_marketing"
        | "call_recording"
      market_status: "draft" | "test" | "active" | "paused"
      message_status: "new" | "in_progress" | "handled"
      phone_purpose:
        | "website"
        | "google_ads"
        | "meta"
        | "microsoft"
        | "organic"
        | "provider_line"
      provider_role: "owner" | "manager" | "operator"
      provider_status:
        | "applied"
        | "onboarding"
        | "active"
        | "paused"
        | "suspended"
        | "closed"
      request_channel: "web" | "phone" | "landing_page"
      request_status:
        | "draft"
        | "submitted"
        | "quoting"
        | "quoted"
        | "accepted"
        | "en_route"
        | "on_site"
        | "completed"
        | "cancelled"
        | "expired"
      second_step_method: "email" | "sms" | "totp"
      staff_role:
        | "super_admin"
        | "ops_manager"
        | "dispatcher"
        | "support"
        | "finance"
        | "marketing"
        | "read_only"
      vehicle_type: "car" | "suv" | "pickup" | "motorcycle" | "van" | "rv"
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
      actor_type: ["system", "driver", "provider", "staff"],
      application_status: ["new", "reviewing", "approved", "rejected"],
      consent_type: [
        "terms",
        "privacy",
        "sms_transactional",
        "sms_marketing",
        "call_recording",
      ],
      market_status: ["draft", "test", "active", "paused"],
      message_status: ["new", "in_progress", "handled"],
      phone_purpose: [
        "website",
        "google_ads",
        "meta",
        "microsoft",
        "organic",
        "provider_line",
      ],
      provider_role: ["owner", "manager", "operator"],
      provider_status: [
        "applied",
        "onboarding",
        "active",
        "paused",
        "suspended",
        "closed",
      ],
      request_channel: ["web", "phone", "landing_page"],
      request_status: [
        "draft",
        "submitted",
        "quoting",
        "quoted",
        "accepted",
        "en_route",
        "on_site",
        "completed",
        "cancelled",
        "expired",
      ],
      second_step_method: ["email", "sms", "totp"],
      staff_role: [
        "super_admin",
        "ops_manager",
        "dispatcher",
        "support",
        "finance",
        "marketing",
        "read_only",
      ],
      vehicle_type: ["car", "suv", "pickup", "motorcycle", "van", "rv"],
    },
  },
} as const
