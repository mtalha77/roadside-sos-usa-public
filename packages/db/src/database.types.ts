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
      vehicle_type: ["car", "suv", "pickup", "motorcycle", "van", "rv"],
    },
  },
} as const
