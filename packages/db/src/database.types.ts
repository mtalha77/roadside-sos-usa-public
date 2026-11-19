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
      ad_campaigns: {
        Row: {
          campaign_id: string
          mapped_by_hand: boolean
          market_id: string | null
          name: string
          paused_by_auto: boolean
          platform: string
          seen_at: string
          service_slug: string | null
        }
        Insert: {
          campaign_id: string
          mapped_by_hand?: boolean
          market_id?: string | null
          name: string
          paused_by_auto?: boolean
          platform: string
          seen_at?: string
          service_slug?: string | null
        }
        Update: {
          campaign_id?: string
          mapped_by_hand?: boolean
          market_id?: string | null
          name?: string
          paused_by_auto?: boolean
          platform?: string
          seen_at?: string
          service_slug?: string | null
        }
        Relationships: []
      }
      ad_connections: {
        Row: {
          account_name: string | null
          enabled: boolean
          last_error: string | null
          last_sync_at: string | null
          platform: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          account_name?: string | null
          enabled?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          platform: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          account_name?: string | null
          enabled?: boolean
          last_error?: string | null
          last_sync_at?: string | null
          platform?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ad_conversion_uploads: {
        Row: {
          attempts: number
          event_id: string
          last_attempt_at: string
          next_attempt_at: string | null
          platform: string
          response: Json | null
          status: string
        }
        Insert: {
          attempts?: number
          event_id: string
          last_attempt_at?: string
          next_attempt_at?: string | null
          platform: string
          response?: Json | null
          status: string
        }
        Update: {
          attempts?: number
          event_id?: string
          last_attempt_at?: string
          next_attempt_at?: string | null
          platform?: string
          response?: Json | null
          status?: string
        }
        Relationships: []
      }
      ad_pause_events: {
        Row: {
          action: string
          at: string
          campaigns: string[]
          id: number
          market_id: string
          service_slug: string
        }
        Insert: {
          action: string
          at?: string
          campaigns?: string[]
          id?: number
          market_id: string
          service_slug: string
        }
        Update: {
          action?: string
          at?: string
          campaigns?: string[]
          id?: number
          market_id?: string
          service_slug?: string
        }
        Relationships: []
      }
      ad_pause_rules: {
        Row: {
          enabled: boolean
          end_hour: number
          grace_minutes: number
          market_id: string
          min_providers: number
          start_hour: number
          state: Json
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          enabled?: boolean
          end_hour?: number
          grace_minutes?: number
          market_id: string
          min_providers?: number
          start_hour?: number
          state?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          enabled?: boolean
          end_hour?: number
          grace_minutes?: number
          market_id?: string
          min_providers?: number
          start_hour?: number
          state?: Json
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      ad_spend: {
        Row: {
          amount_cents: number
          channel: string
          day: string
          market_id: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          channel: string
          day: string
          market_id: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          channel?: string
          day?: string
          market_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ad_spend_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      ad_spend_daily: {
        Row: {
          campaign_id: string
          clicks: number
          day: string
          imported_at: string
          impressions: number
          market_id: string | null
          platform: string
          service_slug: string | null
          spend_cents: number
        }
        Insert: {
          campaign_id: string
          clicks?: number
          day: string
          imported_at?: string
          impressions?: number
          market_id?: string | null
          platform: string
          service_slug?: string | null
          spend_cents: number
        }
        Update: {
          campaign_id?: string
          clicks?: number
          day?: string
          imported_at?: string
          impressions?: number
          market_id?: string | null
          platform?: string
          service_slug?: string | null
          spend_cents?: number
        }
        Relationships: []
      }
      api_usage: {
        Row: {
          alerted_at: string | null
          day: string
          units: number
          vendor: string
        }
        Insert: {
          alerted_at?: string | null
          day: string
          units?: number
          vendor: string
        }
        Update: {
          alerted_at?: string | null
          day?: string
          units?: number
          vendor?: string
        }
        Relationships: []
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
      bonus_grants: {
        Row: {
          amount_cents: number
          campaign_id: string | null
          created_at: string
          created_by: string | null
          expired_at: string | null
          expires_at: string
          id: string
          market_id: string | null
          note: string | null
          plan_allowed: boolean
          provider_id: string
          reason: string | null
          refund_of: string | null
          remaining_cents: number
          reversed_at: string | null
          source: string
        }
        Insert: {
          amount_cents: number
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          expired_at?: string | null
          expires_at: string
          id?: string
          market_id?: string | null
          note?: string | null
          plan_allowed?: boolean
          provider_id: string
          reason?: string | null
          refund_of?: string | null
          remaining_cents: number
          reversed_at?: string | null
          source: string
        }
        Update: {
          amount_cents?: number
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          expired_at?: string | null
          expires_at?: string
          id?: string
          market_id?: string | null
          note?: string | null
          plan_allowed?: boolean
          provider_id?: string
          reason?: string | null
          refund_of?: string | null
          remaining_cents?: number
          reversed_at?: string | null
          source?: string
        }
        Relationships: []
      }
      calls: {
        Row: {
          answered_at: string | null
          auto_text_sent_at: string | null
          caller_line_type: string | null
          created_at: string
          direction: Database["public"]["Enums"]["call_direction"]
          duration_sec: number | null
          ended_at: string | null
          from_phone: string
          id: string
          market_id: string
          outcome: Database["public"]["Enums"]["call_outcome"]
          recording_duration_sec: number | null
          recording_sid: string | null
          request_id: string | null
          source: Database["public"]["Enums"]["phone_purpose"] | null
          staff_user_id: string | null
          to_phone: string
          tracking_number_id: string | null
          twilio_call_sid: string
          voicemail_transcript: string | null
        }
        Insert: {
          answered_at?: string | null
          auto_text_sent_at?: string | null
          caller_line_type?: string | null
          created_at?: string
          direction: Database["public"]["Enums"]["call_direction"]
          duration_sec?: number | null
          ended_at?: string | null
          from_phone: string
          id?: string
          market_id: string
          outcome?: Database["public"]["Enums"]["call_outcome"]
          recording_duration_sec?: number | null
          recording_sid?: string | null
          request_id?: string | null
          source?: Database["public"]["Enums"]["phone_purpose"] | null
          staff_user_id?: string | null
          to_phone: string
          tracking_number_id?: string | null
          twilio_call_sid: string
          voicemail_transcript?: string | null
        }
        Update: {
          answered_at?: string | null
          auto_text_sent_at?: string | null
          caller_line_type?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["call_direction"]
          duration_sec?: number | null
          ended_at?: string | null
          from_phone?: string
          id?: string
          market_id?: string
          outcome?: Database["public"]["Enums"]["call_outcome"]
          recording_duration_sec?: number | null
          recording_sid?: string | null
          request_id?: string | null
          source?: Database["public"]["Enums"]["phone_purpose"] | null
          staff_user_id?: string | null
          to_phone?: string
          tracking_number_id?: string | null
          twilio_call_sid?: string
          voicemail_transcript?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calls_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_tracking_number_id_fkey"
            columns: ["tracking_number_id"]
            isOneToOne: false
            referencedRelation: "market_phone_numbers"
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
          policy_document: string | null
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
          policy_document?: string | null
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
          policy_document?: string | null
          policy_version?: string
          request_id?: string | null
          source?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consents_policy_version_fk"
            columns: ["policy_document", "policy_version"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["document", "version"]
          },
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
      conversion_events: {
        Row: {
          call_id: string | null
          event_id: string
          fbclid: string | null
          ga4_sent_at: string | null
          gbraid: string | null
          gclid: string | null
          market_id: string
          meta_sent_at: string | null
          msclkid: string | null
          name: string
          occurred_at: string
          request_id: string | null
          service_slug: string | null
          source: string | null
          value_cents: number | null
          wbraid: string | null
        }
        Insert: {
          call_id?: string | null
          event_id: string
          fbclid?: string | null
          ga4_sent_at?: string | null
          gbraid?: string | null
          gclid?: string | null
          market_id: string
          meta_sent_at?: string | null
          msclkid?: string | null
          name: string
          occurred_at?: string
          request_id?: string | null
          service_slug?: string | null
          source?: string | null
          value_cents?: number | null
          wbraid?: string | null
        }
        Update: {
          call_id?: string | null
          event_id?: string
          fbclid?: string | null
          ga4_sent_at?: string | null
          gbraid?: string | null
          gclid?: string | null
          market_id?: string
          meta_sent_at?: string | null
          msclkid?: string | null
          name?: string
          occurred_at?: string
          request_id?: string | null
          service_slug?: string | null
          source?: string | null
          value_cents?: number | null
          wbraid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversion_events_call_id_fkey"
            columns: ["call_id"]
            isOneToOne: false
            referencedRelation: "calls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversion_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      cookie_consents: {
        Row: {
          ads: boolean
          analytics: boolean
          browser_id: string
          created_at: string
          gpc: boolean
          id: string
          policy_document: string
          policy_version: string
        }
        Insert: {
          ads: boolean
          analytics: boolean
          browser_id: string
          created_at?: string
          gpc?: boolean
          id?: string
          policy_document?: string
          policy_version: string
        }
        Update: {
          ads?: boolean
          analytics?: boolean
          browser_id?: string
          created_at?: string
          gpc?: boolean
          id?: string
          policy_document?: string
          policy_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "cookie_consents_policy_document_policy_version_fkey"
            columns: ["policy_document", "policy_version"]
            isOneToOne: false
            referencedRelation: "policy_versions"
            referencedColumns: ["document", "version"]
          },
        ]
      }
      credit_campaigns: {
        Row: {
          amount_cents: number
          audience: Json
          budget_cents: number
          created_at: string
          created_by: string | null
          expiry_days: number
          granted_cents: number
          id: string
          market_id: string | null
          message: string | null
          name: string
          plan_allowed: boolean
          recipients: number
        }
        Insert: {
          amount_cents: number
          audience?: Json
          budget_cents: number
          created_at?: string
          created_by?: string | null
          expiry_days?: number
          granted_cents?: number
          id?: string
          market_id?: string | null
          message?: string | null
          name: string
          plan_allowed?: boolean
          recipients?: number
        }
        Update: {
          amount_cents?: number
          audience?: Json
          budget_cents?: number
          created_at?: string
          created_by?: string | null
          expiry_days?: number
          granted_cents?: number
          id?: string
          market_id?: string | null
          message?: string | null
          name?: string
          plan_allowed?: boolean
          recipients?: number
        }
        Relationships: []
      }
      credit_limits: {
        Row: {
          per_campaign_cents: number | null
          per_grant_cents: number | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          per_campaign_cents?: number | null
          per_grant_cents?: number | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          per_campaign_cents?: number | null
          per_grant_cents?: number | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      credit_rules: {
        Row: {
          amount_cents: number
          budget_cents: number
          enabled: boolean
          expiry_days: number
          kind: string
          market_id: string
          threshold: number
          updated_at: string
          updated_by: string | null
          used_cents: number
        }
        Insert: {
          amount_cents?: number
          budget_cents?: number
          enabled?: boolean
          expiry_days?: number
          kind: string
          market_id: string
          threshold?: number
          updated_at?: string
          updated_by?: string | null
          used_cents?: number
        }
        Update: {
          amount_cents?: number
          budget_cents?: number
          enabled?: boolean
          expiry_days?: number
          kind?: string
          market_id?: string
          threshold?: number
          updated_at?: string
          updated_by?: string | null
          used_cents?: number
        }
        Relationships: []
      }
      demo_accounts: {
        Row: {
          created_at: string
          role: string
          totp_secret: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          role: string
          totp_secret?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          role?: string
          totp_secret?: string | null
          user_id?: string
        }
        Relationships: []
      }
      economics_model_history: {
        Row: {
          changed_at: string
          changed_by: string | null
          id: number
          inputs: Json
          market_id: string
          scenario: string
        }
        Insert: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          inputs: Json
          market_id: string
          scenario: string
        }
        Update: {
          changed_at?: string
          changed_by?: string | null
          id?: never
          inputs?: Json
          market_id?: string
          scenario?: string
        }
        Relationships: [
          {
            foreignKeyName: "economics_model_history_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      economics_models: {
        Row: {
          inputs: Json
          market_id: string
          scenario: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          inputs: Json
          market_id: string
          scenario: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          inputs?: Json
          market_id?: string
          scenario?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "economics_models_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatch_attempts: {
        Row: {
          created_at: string
          id: string
          market_id: string
          outcome: Database["public"]["Enums"]["dispatch_outcome"]
          provider_id: string
          quoted_eta_minutes: number | null
          quoted_price_cents: number | null
          request_id: string
          response_sec: number | null
          staff_user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          market_id: string
          outcome: Database["public"]["Enums"]["dispatch_outcome"]
          provider_id: string
          quoted_eta_minutes?: number | null
          quoted_price_cents?: number | null
          request_id: string
          response_sec?: number | null
          staff_user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          market_id?: string
          outcome?: Database["public"]["Enums"]["dispatch_outcome"]
          provider_id?: string
          quoted_eta_minutes?: number | null
          quoted_price_cents?: number | null
          request_id?: string
          response_sec?: number | null
          staff_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dispatch_attempts_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_attempts_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dispatch_attempts_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      dispatcher_shifts: {
        Row: {
          end_minute: number
          id: string
          start_minute: number
          time_zone: string
          user_id: string
          weekday: number
        }
        Insert: {
          end_minute: number
          id?: string
          start_minute: number
          time_zone?: string
          user_id: string
          weekday: number
        }
        Update: {
          end_minute?: number
          id?: string
          start_minute?: number
          time_zone?: string
          user_id?: string
          weekday?: number
        }
        Relationships: [
          {
            foreignKeyName: "dispatcher_shifts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
          },
        ]
      }
      dispatcher_status: {
        Row: {
          on_duty_now: boolean
          presence: Database["public"]["Enums"]["dispatcher_presence"]
          updated_at: string
          user_id: string
        }
        Insert: {
          on_duty_now?: boolean
          presence?: Database["public"]["Enums"]["dispatcher_presence"]
          updated_at?: string
          user_id: string
        }
        Update: {
          on_duty_now?: boolean
          presence?: Database["public"]["Enums"]["dispatcher_presence"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dispatcher_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "staff_members"
            referencedColumns: ["user_id"]
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
      funnel_events: {
        Row: {
          id: number
          session_id: string
          event: string
          step: string
          last_field: string | null
          market_id: string | null
          source: string | null
          device: string | null
          landing_sec: number | null
          request_id: string | null
          occurred_at: string
        }
        Insert: {
          id?: number
          session_id: string
          event: string
          step: string
          last_field?: string | null
          market_id?: string | null
          source?: string | null
          device?: string | null
          landing_sec?: number | null
          request_id?: string | null
          occurred_at?: string
        }
        Update: {
          id?: number
          session_id?: string
          event?: string
          step?: string
          last_field?: string | null
          market_id?: string | null
          source?: string | null
          device?: string | null
          landing_sec?: number | null
          request_id?: string | null
          occurred_at?: string
        }
        Relationships: []
      }
      location_links: {
        Row: {
          code: string | null
          created_at: string
          expires_at: string
          request_id: string
          token: string
          used_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          expires_at?: string
          request_id: string
          token: string
          used_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          expires_at?: string
          request_id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_links_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      market_pages: {
        Row: {
          areas: string[]
          faqs: Json
          headline: string
          highways: string[]
          intro: string
          local_tips: string[]
          locale: string
          market_id: string
          updated_at: string
        }
        Insert: {
          areas?: string[]
          faqs?: Json
          headline: string
          highways?: string[]
          intro: string
          local_tips?: string[]
          locale?: string
          market_id: string
          updated_at?: string
        }
        Update: {
          areas?: string[]
          faqs?: Json
          headline?: string
          highways?: string[]
          intro?: string
          local_tips?: string[]
          locale?: string
          market_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_pages_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_phone_numbers: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          label: string | null
          market_id: string
          phone_number: string
          purpose: Database["public"]["Enums"]["phone_purpose"]
          synced_at: string | null
          twilio_sid: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          market_id: string
          phone_number: string
          purpose: Database["public"]["Enums"]["phone_purpose"]
          synced_at?: string | null
          twilio_sid?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          label?: string | null
          market_id?: string
          phone_number?: string
          purpose?: Database["public"]["Enums"]["phone_purpose"]
          synced_at?: string | null
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
      market_plans: {
        Row: {
          created_at: string
          effective_from: string
          fee_discount_bps: number
          id: string
          market_id: string
          plan: Database["public"]["Enums"]["plan_kind"]
          price_max_cents: number
          price_min_cents: number
        }
        Insert: {
          created_at?: string
          effective_from?: string
          fee_discount_bps?: number
          id?: string
          market_id: string
          plan: Database["public"]["Enums"]["plan_kind"]
          price_max_cents: number
          price_min_cents: number
        }
        Update: {
          created_at?: string
          effective_from?: string
          fee_discount_bps?: number
          id?: string
          market_id?: string
          plan?: Database["public"]["Enums"]["plan_kind"]
          price_max_cents?: number
          price_min_cents?: number
        }
        Relationships: [
          {
            foreignKeyName: "market_plans_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
        ]
      }
      market_service_notes: {
        Row: {
          locale: string
          market_id: string
          note: string
          service_id: string
          updated_at: string
        }
        Insert: {
          locale?: string
          market_id: string
          note: string
          service_id: string
          updated_at?: string
        }
        Update: {
          locale?: string
          market_id?: string
          note?: string
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "market_service_notes_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "market_service_notes_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
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
          ad_code: string | null
          boundary: unknown
          call_recording_enabled: boolean
          center: unknown
          coverage_hours: Json
          created_at: string
          id: string
          min_providers_per_service: number
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
          ad_code?: string | null
          boundary: unknown
          call_recording_enabled?: boolean
          center: unknown
          coverage_hours?: Json
          created_at?: string
          id?: string
          min_providers_per_service?: number
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
          ad_code?: string | null
          boundary?: unknown
          call_recording_enabled?: boolean
          center?: unknown
          coverage_hours?: Json
          created_at?: string
          id?: string
          min_providers_per_service?: number
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
      policy_versions: {
        Row: {
          created_at: string
          document: string
          published_at: string | null
          status: string
          version: string
        }
        Insert: {
          created_at?: string
          document: string
          published_at?: string | null
          status?: string
          version: string
        }
        Update: {
          created_at?: string
          document?: string
          published_at?: string | null
          status?: string
          version?: string
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
          request_id: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: never
          kind: string
          provider_id: string
          request_id?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: never
          kind?: string
          provider_id?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_billing_events_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_billing_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
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
      provider_notices: {
        Row: {
          created_at: string
          data: Json
          id: string
          kind: string
          provider_id: string
          read_at: string | null
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          kind: string
          provider_id: string
          read_at?: string | null
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          provider_id?: string
          read_at?: string | null
        }
        Relationships: []
      }
      provider_review_flags: {
        Row: {
          created_at: string
          data: Json
          id: string
          kind: string
          provider_id: string
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          created_at?: string
          data?: Json
          id?: string
          kind: string
          provider_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          kind?: string
          provider_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: []
      }
      provider_service_prices: {
        Row: {
          active: boolean
          market_id: string
          price_cents: number
          provider_id: string
          service_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          market_id: string
          price_cents: number
          provider_id: string
          service_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          market_id?: string
          price_cents?: number
          provider_id?: string
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_service_prices_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_service_prices_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
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
          application_id: string | null
          base_point: unknown
          created_at: string
          dispatch_phone: string | null
          id: string
          is_demo: boolean
          market_ids: string[]
          name: string
          service_radius_miles: number | null
          status: Database["public"]["Enums"]["provider_status"]
          status_reason: string | null
          updated_at: string
        }
        Insert: {
          application_id?: string | null
          base_point?: unknown
          created_at?: string
          dispatch_phone?: string | null
          id?: string
          is_demo?: boolean
          market_ids?: string[]
          name: string
          service_radius_miles?: number | null
          status?: Database["public"]["Enums"]["provider_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Update: {
          application_id?: string | null
          base_point?: unknown
          created_at?: string
          dispatch_phone?: string | null
          id?: string
          is_demo?: boolean
          market_ids?: string[]
          name?: string
          service_radius_miles?: number | null
          status?: Database["public"]["Enums"]["provider_status"]
          status_reason?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      rate_limit_counters: {
        Row: {
          count: number
          key: string
          window_start: string
        }
        Insert: {
          count: number
          key: string
          window_start: string
        }
        Update: {
          count?: number
          key?: string
          window_start?: string
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
      redirects: {
        Row: {
          created_at: string
          destination: string
          is_active: boolean
          note: string | null
          source_path: string
          status_code: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          destination: string
          is_active?: boolean
          note?: string | null
          source_path: string
          status_code?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          destination?: string
          is_active?: boolean
          note?: string | null
          source_path?: string
          status_code?: number
          updated_at?: string
        }
        Relationships: []
      }
      request_drafts: {
        Row: {
          created_at: string
          data: Json
          expires_at: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data?: Json
          expires_at?: string
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          expires_at?: string
          token?: string
          updated_at?: string
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
          booking_mode: string
          booking_outcome: string | null
          instant_max_cents: number | null
          answers_version: number | null
          photo_paths: string[]
          scheduled_for: string | null
          service_answers: Json | null
          accepted_at: string | null
          assigned_at: string | null
          assigned_dispatcher_id: string | null
          assigned_provider_id: string | null
          cancelled_at: string | null
          channel: Database["public"]["Enums"]["request_channel"]
          claimed_at: string | null
          completed_at: string | null
          contacted_at: string | null
          created_at: string
          destination_address: string | null
          destination_point: unknown
          driver_email: string | null
          driver_email_verified: boolean
          driver_name: string
          driver_phone: string
          driver_phone_verified: boolean
          en_route_at: string | null
          end_reason: string | null
          expired_at: string | null
          has_passengers: boolean | null
          id: string
          keys_available: boolean | null
          location_confirmed_at: string | null
          market_id: string
          market_service_id: string | null
          no_provider_at: string | null
          notes: string | null
          on_highway: boolean | null
          on_site_at: string | null
          pickup_address: string | null
          pickup_note: string | null
          pickup_point: unknown
          platform_fee_cents: number
          quoted_at: string | null
          quoted_eta_minutes: number | null
          quoted_price_cents: number | null
          safe_spot: boolean | null
          service_id: string | null
          short_code: string
          source: Database["public"]["Enums"]["phone_purpose"] | null
          spare_available: boolean | null
          status: Database["public"]["Enums"]["request_status"]
          status_token: string
          submitted_at: string | null
          updated_at: string
          urgent: boolean
          vehicle_color: string | null
          vehicle_is_ev: boolean
          vehicle_make: string | null
          vehicle_model: string | null
          vehicle_type: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_year: number | null
        }
        Insert: {
          booking_mode?: string
          booking_outcome?: string | null
          instant_max_cents?: number | null
          answers_version?: number | null
          photo_paths?: string[]
          scheduled_for?: string | null
          service_answers?: Json | null
          accepted_at?: string | null
          assigned_at?: string | null
          assigned_dispatcher_id?: string | null
          assigned_provider_id?: string | null
          cancelled_at?: string | null
          channel?: Database["public"]["Enums"]["request_channel"]
          claimed_at?: string | null
          completed_at?: string | null
          contacted_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_point?: unknown
          driver_email?: string | null
          driver_email_verified?: boolean
          driver_name: string
          driver_phone: string
          driver_phone_verified?: boolean
          en_route_at?: string | null
          end_reason?: string | null
          expired_at?: string | null
          has_passengers?: boolean | null
          id?: string
          keys_available?: boolean | null
          location_confirmed_at?: string | null
          market_id: string
          market_service_id?: string | null
          no_provider_at?: string | null
          notes?: string | null
          on_highway?: boolean | null
          on_site_at?: string | null
          pickup_address?: string | null
          pickup_note?: string | null
          pickup_point?: unknown
          platform_fee_cents: number
          quoted_at?: string | null
          quoted_eta_minutes?: number | null
          quoted_price_cents?: number | null
          safe_spot?: boolean | null
          service_id?: string | null
          short_code: string
          source?: Database["public"]["Enums"]["phone_purpose"] | null
          spare_available?: boolean | null
          status?: Database["public"]["Enums"]["request_status"]
          status_token?: string
          submitted_at?: string | null
          updated_at?: string
          urgent?: boolean
          vehicle_color?: string | null
          vehicle_is_ev?: boolean
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_year?: number | null
        }
        Update: {
          booking_mode?: string
          booking_outcome?: string | null
          instant_max_cents?: number | null
          answers_version?: number | null
          photo_paths?: string[]
          scheduled_for?: string | null
          service_answers?: Json | null
          accepted_at?: string | null
          assigned_at?: string | null
          assigned_dispatcher_id?: string | null
          assigned_provider_id?: string | null
          cancelled_at?: string | null
          channel?: Database["public"]["Enums"]["request_channel"]
          claimed_at?: string | null
          completed_at?: string | null
          contacted_at?: string | null
          created_at?: string
          destination_address?: string | null
          destination_point?: unknown
          driver_email?: string | null
          driver_email_verified?: boolean
          driver_name?: string
          driver_phone?: string
          driver_phone_verified?: boolean
          en_route_at?: string | null
          end_reason?: string | null
          expired_at?: string | null
          has_passengers?: boolean | null
          id?: string
          keys_available?: boolean | null
          location_confirmed_at?: string | null
          market_id?: string
          market_service_id?: string | null
          no_provider_at?: string | null
          notes?: string | null
          on_highway?: boolean | null
          on_site_at?: string | null
          pickup_address?: string | null
          pickup_note?: string | null
          pickup_point?: unknown
          platform_fee_cents?: number
          quoted_at?: string | null
          quoted_eta_minutes?: number | null
          quoted_price_cents?: number | null
          safe_spot?: boolean | null
          service_id?: string | null
          short_code?: string
          source?: Database["public"]["Enums"]["phone_purpose"] | null
          spare_available?: boolean | null
          status?: Database["public"]["Enums"]["request_status"]
          status_token?: string
          submitted_at?: string | null
          updated_at?: string
          urgent?: boolean
          vehicle_color?: string | null
          vehicle_is_ev?: boolean
          vehicle_make?: string | null
          vehicle_model?: string | null
          vehicle_type?: Database["public"]["Enums"]["vehicle_type"] | null
          vehicle_year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "requests_assigned_provider_id_fkey"
            columns: ["assigned_provider_id"]
            isOneToOne: false
            referencedRelation: "providers"
            referencedColumns: ["id"]
          },
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
      saved_replies: {
        Row: {
          body: string
          id: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          id?: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          id?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_pages: {
        Row: {
          covers: string[]
          faqs: Json
          locale: string
          not_covered: string[]
          onsite_minutes_max: number | null
          onsite_minutes_min: number | null
          safety_tips: string[]
          service_id: string
          summary: string
          updated_at: string
          what_to_expect: string[]
        }
        Insert: {
          covers?: string[]
          faqs?: Json
          locale?: string
          not_covered?: string[]
          onsite_minutes_max?: number | null
          onsite_minutes_min?: number | null
          safety_tips?: string[]
          service_id: string
          summary: string
          updated_at?: string
          what_to_expect?: string[]
        }
        Update: {
          covers?: string[]
          faqs?: Json
          locale?: string
          not_covered?: string[]
          onsite_minutes_max?: number | null
          onsite_minutes_min?: number | null
          safety_tips?: string[]
          service_id?: string
          summary?: string
          updated_at?: string
          what_to_expect?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "service_pages_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_question_overrides: {
        Row: {
          hidden: boolean
          id: string
          market_id: string | null
          question_id: string
          required: boolean | null
          service_slug: string
          sort: number | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          hidden?: boolean
          id?: string
          market_id?: string | null
          question_id: string
          required?: boolean | null
          service_slug: string
          sort?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          hidden?: boolean
          id?: string
          market_id?: string | null
          question_id?: string
          required?: boolean | null
          service_slug?: string
          sort?: number | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
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
      signup_bonus_rules: {
        Row: {
          amount_cents: number
          enabled: boolean
          ends_on: string | null
          expiry_days: number
          market_id: string
          starts_on: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_cents?: number
          enabled?: boolean
          ends_on?: string | null
          expiry_days?: number
          market_id: string
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_cents?: number
          enabled?: boolean
          ends_on?: string | null
          expiry_days?: number
          market_id?: string
          starts_on?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      site_visits: {
        Row: {
          day: string
          market_key: string
          source: string
          visits: number
        }
        Insert: {
          day: string
          market_key?: string
          source: string
          visits?: number
        }
        Update: {
          day?: string
          market_key?: string
          source?: string
          visits?: number
        }
        Relationships: []
      }
      sms_messages: {
        Row: {
          body: string
          created_at: string
          direction: Database["public"]["Enums"]["message_direction"]
          error_code: number | null
          from_phone: string
          id: string
          market_id: string
          request_id: string | null
          segments: number | null
          staff_user_id: string | null
          status: Database["public"]["Enums"]["sms_status"]
          status_at: string
          status_reason: string | null
          template_key: string | null
          to_phone: string
          twilio_sid: string | null
          urgent: boolean
        }
        Insert: {
          body: string
          created_at?: string
          direction: Database["public"]["Enums"]["message_direction"]
          error_code?: number | null
          from_phone: string
          id?: string
          market_id: string
          request_id?: string | null
          segments?: number | null
          staff_user_id?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          status_at?: string
          status_reason?: string | null
          template_key?: string | null
          to_phone: string
          twilio_sid?: string | null
          urgent?: boolean
        }
        Update: {
          body?: string
          created_at?: string
          direction?: Database["public"]["Enums"]["message_direction"]
          error_code?: number | null
          from_phone?: string
          id?: string
          market_id?: string
          request_id?: string | null
          segments?: number | null
          staff_user_id?: string | null
          status?: Database["public"]["Enums"]["sms_status"]
          status_at?: string
          status_reason?: string | null
          template_key?: string | null
          to_phone?: string
          twilio_sid?: string | null
          urgent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "sms_messages_market_id_fkey"
            columns: ["market_id"]
            isOneToOne: false
            referencedRelation: "markets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sms_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "requests"
            referencedColumns: ["id"]
          },
        ]
      }
      sms_opt_outs: {
        Row: {
          opted_out: boolean
          phone: string
          source: string
          updated_at: string
        }
        Insert: {
          opted_out: boolean
          phone: string
          source: string
          updated_at?: string
        }
        Update: {
          opted_out?: boolean
          phone?: string
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      sms_templates: {
        Row: {
          body_en: string
          body_es: string
          key: string
          title: string
          updated_at: string
          urgent: boolean
        }
        Insert: {
          body_en: string
          body_es: string
          key: string
          title: string
          updated_at?: string
          urgent?: boolean
        }
        Update: {
          body_en?: string
          body_es?: string
          key?: string
          title?: string
          updated_at?: string
          urgent?: boolean
        }
        Relationships: []
      }
      staff_members: {
        Row: {
          created_at: string
          display_name: string
          is_active: boolean
          market_ids: string[] | null
          mobile_phone: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          is_active?: boolean
          market_ids?: string[] | null
          mobile_phone?: string | null
          role: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          is_active?: boolean
          market_ids?: string[] | null
          mobile_phone?: string | null
          role?: Database["public"]["Enums"]["staff_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sync_runs: {
        Row: {
          details: Json
          error: string | null
          finished_at: string
          id: number
          job: string
          ok: boolean
          started_at: string
        }
        Insert: {
          details?: Json
          error?: string | null
          finished_at?: string
          id?: number
          job: string
          ok: boolean
          started_at?: string
        }
        Update: {
          details?: Json
          error?: string | null
          finished_at?: string
          id?: number
          job?: string
          ok?: boolean
          started_at?: string
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      tour_progress: {
        Row: {
          status: string
          step: number
          tour: string
          updated_at: string
          user_id: string
        }
        Insert: {
          status: string
          step?: number
          tour: string
          updated_at?: string
          user_id: string
        }
        Update: {
          status?: string
          step?: number
          tour?: string
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
      usage_thresholds: {
        Row: {
          daily_units: number
          updated_at: string
          vendor_group: string
        }
        Insert: {
          daily_units: number
          updated_at?: string
          vendor_group: string
        }
        Update: {
          daily_units?: number
          updated_at?: string
          vendor_group?: string
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
      wallet_ledger: {
        Row: {
          actor_id: string | null
          amount_cents: number
          balance: string
          created_at: string
          grant_id: string | null
          id: number
          kind: string
          market_id: string | null
          note: string | null
          provider_id: string
          request_id: string | null
        }
        Insert: {
          actor_id?: string | null
          amount_cents: number
          balance: string
          created_at?: string
          grant_id?: string | null
          id?: number
          kind: string
          market_id?: string | null
          note?: string | null
          provider_id: string
          request_id?: string | null
        }
        Update: {
          actor_id?: string | null
          amount_cents?: number
          balance?: string
          created_at?: string
          grant_id?: string | null
          id?: number
          kind?: string
          market_id?: string | null
          note?: string | null
          provider_id?: string
          request_id?: string | null
        }
        Relationships: []
      }
      webhook_events: {
        Row: {
          event_key: string
          received_at: string
          vendor: string
        }
        Insert: {
          event_key: string
          received_at?: string
          vendor: string
        }
        Update: {
          event_key?: string
          received_at?: string
          vendor?: string
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
      admin_live_requests: {
        Args: { p_since?: string }
        Returns: {
          accepted_at: string
          channel: Database["public"]["Enums"]["request_channel"]
          created_at: string
          driver_name: string
          driver_phone: string
          en_route_at: string
          id: string
          lat: number
          lng: number
          market_slug: string
          on_site_at: string
          pickup_address: string
          quoted_at: string
          service_slug: string
          short_code: string
          status: Database["public"]["Enums"]["request_status"]
          status_token: string
          submitted_at: string
        }[]
      }
      admin_market_shapes: {
        Args: never
        Returns: {
          boundary: Json
          center_lat: number
          center_lng: number
          slug: string
        }[]
      }
      admin_update_market_intro: {
        Args: { p_intro: string; p_slug: string }
        Returns: undefined
      }
      campaign_requests: {
        Args: { p_from: string; p_to: string }
        Returns: {
          assigned_at: string
          channel: Database["public"]["Enums"]["request_channel"]
          completed_at: string
          contacted_at: string
          created_at: string
          fee_cents: number
          market_id: string
          quoted_price_cents: number
          request_id: string
          status: Database["public"]["Enums"]["request_status"]
        }[]
      }
      cancel_request_by_token: {
        Args: { p_reason: string; p_token: string }
        Returns: boolean
      }
      claim_request: {
        Args: { p_force?: boolean; p_request_id: string }
        Returns: boolean
      }
      create_request: {
        Args: { p: Json }
        Returns: {
          request_id: string
          short_code: string
          status_token: string
        }[]
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      dispatch_step: {
        Args: {
          p_eta_minutes?: number
          p_price_cents?: number
          p_provider_id?: string
          p_reason?: string
          p_request_id: string
          p_status: Database["public"]["Enums"]["request_status"]
        }
        Returns: undefined
      }
      find_recent_request: { Args: { p_phone: string }; Returns: string }
      forget_trusted_device: { Args: { p_id: string }; Returns: undefined }
      generate_recovery_codes: { Args: never; Returns: string[] }
      generate_short_code: { Args: never; Returns: string }
      get_location_link: {
        Args: { p_token: string }
        Returns: {
          center_lat: number
          center_lng: number
          current_address: string
          market_slug: string
          used: boolean
          valid: boolean
        }[]
      }
      get_market_page: {
        Args: { p_locale?: string; p_market_slug: string }
        Returns: {
          areas: string[]
          faqs: Json
          headline: string
          highways: string[]
          intro: string
          local_tips: string[]
          updated_at: string
        }[]
      }
      get_market_service_note: {
        Args: {
          p_locale?: string
          p_market_slug: string
          p_service_slug: string
        }
        Returns: string
      }
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
      get_request_draft: { Args: { p_token: string }; Returns: Json }
      get_service_page: {
        Args: { p_locale?: string; p_service_slug: string }
        Returns: {
          covers: string[]
          faqs: Json
          not_covered: string[]
          onsite_minutes_max: number
          onsite_minutes_min: number
          safety_tips: string[]
          summary: string
          what_to_expect: string[]
        }[]
      }
      issue_email_code: { Args: never; Returns: string }
      join_waitlist: { Args: { p: Json }; Returns: undefined }
      jwt_provider_role: {
        Args: { p_provider_id: string }
        Returns: Database["public"]["Enums"]["provider_role"]
      }
      jwt_staff_role: {
        Args: never
        Returns: Database["public"]["Enums"]["staff_role"]
      }
      list_market_plans: {
        Args: never
        Returns: {
          fee_discount_bps: number
          market_slug: string
          plan: Database["public"]["Enums"]["plan_kind"]
          price_max_cents: number
          price_min_cents: number
        }[]
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
      list_public_services: {
        Args: never
        Returns: {
          description: string
          icon_key: string
          market_count: number
          name: string
          needs_destination: boolean
          price_max_cents: number
          price_min_cents: number
          slug: string
          sort_order: number
        }[]
      }
      list_redirects: {
        Args: never
        Returns: {
          destination: string
          source_path: string
          status_code: number
        }[]
      }
      list_site_markets: {
        Args: never
        Returns: {
          center_lat: number
          center_lng: number
          id: string
          name: string
          phone: string
          slug: string
          state_code: string
          status: Database["public"]["Enums"]["market_status"]
          time_zone: string
        }[]
      }
      location_link_for_code: { Args: { p_code: string }; Returns: string }
      location_link_valid: { Args: { p_token: string }; Returns: boolean }
      log_security_event: {
        Args: { p_action: string; p_data?: Json; p_ip?: string }
        Returns: undefined
      }
      mark_session_verified: { Args: { p_method: string }; Returns: undefined }
      market_dispatch_covered: {
        Args: { p_market_id: string }
        Returns: boolean
      }
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
      market_launch_checklist: {
        Args: { p_market_id: string }
        Returns: {
          detail: string
          item: string
          ok: boolean
          required: boolean
        }[]
      }
      market_phone_for_source: {
        Args: { p_market_id: string; p_source: string }
        Returns: string
      }
      market_public_stats: {
        Args: { p_market_slug: string }
        Returns: {
          avg_eta_minutes: number
          completed_jobs: number
          provider_count: number
        }[]
      }
      market_website_phone: { Args: { p_market_id: string }; Returns: string }
      marketing_report: {
        Args: { p_from: string; p_to: string }
        Returns: {
          assigned: number
          calls: number
          completed: number
          forms: number
          market_id: string
          market_slug: string
          qualified_calls: number
          requests: number
          source: string
          spend_cents: number
          visits: number
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
      nearby_providers: {
        Args: { p_request_id: string }
        Returns: {
          acceptance_rate: number
          dispatch_phone: string
          distance_miles: number
          in_radius: boolean
          last_response_sec: number
          name: string
          price_cents: number
          provider_id: string
        }[]
      }
      on_duty_dispatchers: {
        Args: { p_at?: string }
        Returns: {
          mobile_phone: string
          presence: Database["public"]["Enums"]["dispatcher_presence"]
          user_id: string
        }[]
      }
      rate_limit_hit: {
        Args: { p_key: string; p_window_seconds: number }
        Returns: number
      }
      rate_limit_sweep: { Args: never; Returns: number }
      record_api_usage: {
        Args: { p_units?: number; p_vendor: string }
        Returns: {
          alert: boolean
          threshold: number
          units_today: number
        }[]
      }
      record_cookie_consent: { Args: { p: Json }; Returns: undefined }
      record_funnel_event: {
        Args: {
          p_device?: string
          p_event: string
          p_field?: string
          p_landing_sec?: number
          p_market_slug?: string
          p_request_token?: string
          p_session: string
          p_source?: string
          p_step: string
        }
        Returns: undefined
      }
      record_manual_test_fee: {
        Args: {
          p_amount_cents: number
          p_provider_id: string
          p_request_id: string
        }
        Returns: undefined
      }
      record_request_conversion: {
        Args: { p_name: string; p_request_id: string }
        Returns: undefined
      }
      record_visit: {
        Args: { p_market_slug: string; p_source: string }
        Returns: undefined
      }
      request_account_closure: { Args: { p_reason: string }; Returns: string }
      request_point: {
        Args: { p_request_id: string }
        Returns: {
          lat: number
          lng: number
        }[]
      }
      revoke_my_session: { Args: { p_session_id: string }; Returns: boolean }
      save_request_draft: {
        Args: { p_patch: Json; p_token: string }
        Returns: string
      }
      session_status: {
        Args: never
        Returns: {
          active: boolean
          second_step_passed: boolean
        }[]
      }
      set_market_status: {
        Args: {
          p_market_id: string
          p_override_reason?: string
          p_status: Database["public"]["Enums"]["market_status"]
        }
        Returns: undefined
      }
      set_second_step_method: {
        Args: { p_method: Database["public"]["Enums"]["second_step_method"] }
        Returns: undefined
      }
      sha256_hex: { Args: { p: string }; Returns: string }
      sms_delivery_report: {
        Args: { p_days?: number }
        Returns: {
          blocked: number
          day: string
          delivered: number
          failed: number
          held: number
          market_id: string
          received: number
          sent: number
          top_errors: number[]
          undelivered: number
        }[]
      }
      staff_can_access_market: {
        Args: { p_market_id: string }
        Returns: boolean
      }
      submit_contact_message: { Args: { p: Json }; Returns: string }
      submit_location: {
        Args: {
          p_address: string
          p_lat: number
          p_lng: number
          p_note?: string
          p_photo_path?: string
          p_token: string
        }
        Returns: boolean
      }
      submit_provider_application: { Args: { p: Json }; Returns: string }
      submit_web_request: {
        Args: {
          p: Json
          p_draft_token: string
          p_email: string
          p_email_verified: boolean
        }
        Returns: {
          request_id: string
          short_code: string
          status_token: string
        }[]
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
      call_direction: "inbound" | "outbound"
      call_outcome:
        | "ringing"
        | "answered"
        | "missed"
        | "voicemail"
        | "busy"
        | "failed"
        | "completed"
      consent_type:
        | "terms"
        | "privacy"
        | "sms_transactional"
        | "sms_marketing"
        | "call_recording"
      dispatch_outcome: "no_answer" | "declined" | "quoted" | "assigned"
      dispatcher_presence: "available" | "busy" | "away"
      market_status: "draft" | "test" | "active" | "paused"
      message_direction: "outbound" | "inbound"
      message_status: "new" | "in_progress" | "handled"
      phone_purpose:
        | "website"
        | "google_ads"
        | "meta"
        | "microsoft"
        | "organic"
        | "provider_line"
        | "gmb"
        | "bing"
        | "staging_test"
      plan_kind: "pro" | "featured"
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
        | "phone_intake"
        | "submitted"
        | "quoting"
        | "quoted"
        | "contacted"
        | "location_confirmed"
        | "assigned"
        | "accepted"
        | "en_route"
        | "on_site"
        | "completed"
        | "cancelled"
        | "expired"
        | "no_provider"
      second_step_method: "email" | "sms" | "totp"
      sms_status:
        | "queued"
        | "held"
        | "blocked"
        | "sent"
        | "delivered"
        | "undelivered"
        | "failed"
        | "received"
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
      call_direction: ["inbound", "outbound"],
      call_outcome: [
        "ringing",
        "answered",
        "missed",
        "voicemail",
        "busy",
        "failed",
        "completed",
      ],
      consent_type: [
        "terms",
        "privacy",
        "sms_transactional",
        "sms_marketing",
        "call_recording",
      ],
      dispatch_outcome: ["no_answer", "declined", "quoted", "assigned"],
      dispatcher_presence: ["available", "busy", "away"],
      market_status: ["draft", "test", "active", "paused"],
      message_direction: ["outbound", "inbound"],
      message_status: ["new", "in_progress", "handled"],
      phone_purpose: [
        "website",
        "google_ads",
        "meta",
        "microsoft",
        "organic",
        "provider_line",
        "gmb",
        "bing",
        "staging_test",
      ],
      plan_kind: ["pro", "featured"],
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
        "phone_intake",
        "submitted",
        "quoting",
        "quoted",
        "contacted",
        "location_confirmed",
        "assigned",
        "accepted",
        "en_route",
        "on_site",
        "completed",
        "cancelled",
        "expired",
        "no_provider",
      ],
      second_step_method: ["email", "sms", "totp"],
      sms_status: [
        "queued",
        "held",
        "blocked",
        "sent",
        "delivered",
        "undelivered",
        "failed",
        "received",
      ],
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
