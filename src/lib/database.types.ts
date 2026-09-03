// =============================================================================
// GENERATED FILE — do not edit by hand.
// =============================================================================
// Generated from the Local Buzz Supabase schema via:
//   supabase gen types typescript --project-id <ref>   (see `npm run db:types`)
//
// Committed as the source-controlled database contract (P0 #1 / P1 #8).
// NOT yet wired into the Supabase clients — typing `createClient<Database>()`
// in src/lib/supabase/* is a follow-up so this change is contract-only.
// =============================================================================

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
      admin_users: {
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
      contributor_profiles: {
        Row: {
          created_at: string
          display_name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          user_id?: string
        }
        Relationships: []
      }
      listing_confirmations: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_confirmations_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_reports: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          note: string | null
          reason: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          note?: string | null
          reason: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          note?: string | null
          reason?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_reports_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_staff_metadata: {
        Row: {
          created_at: string
          listing_id: string
          review_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          listing_id: string
          review_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          listing_id?: string
          review_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_staff_metadata_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: true
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listings: {
        Row: {
          city: string
          confirmation_count: number
          created_at: string
          days: string[]
          description: string
          end_time: string | null
          id: string
          is_staff_sourced: boolean
          last_verified_at: string | null
          listing_type: string
          place_name: string
          source_checked_at: string | null
          source_url: string | null
          start_time: string | null
          status: string
          street_address: string | null
          submitted_at: string
          submitted_by: string | null
          updated_at: string
          zip_code: string | null
        }
        Insert: {
          city: string
          confirmation_count?: number
          created_at?: string
          days: string[]
          description: string
          end_time?: string | null
          id?: string
          is_staff_sourced?: boolean
          last_verified_at?: string | null
          listing_type: string
          place_name: string
          source_checked_at?: string | null
          source_url?: string | null
          start_time?: string | null
          status?: string
          street_address?: string | null
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Update: {
          city?: string
          confirmation_count?: number
          created_at?: string
          days?: string[]
          description?: string
          end_time?: string | null
          id?: string
          is_staff_sourced?: boolean
          last_verified_at?: string | null
          listing_type?: string
          place_name?: string
          source_checked_at?: string | null
          source_url?: string | null
          start_time?: string | null
          status?: string
          street_address?: string | null
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      point_events: {
        Row: {
          confirmation_id: string | null
          created_at: string
          event_type: string
          id: string
          listing_id: string | null
          points: number
          source_key: string
          user_id: string
        }
        Insert: {
          confirmation_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          listing_id?: string | null
          points: number
          source_key: string
          user_id: string
        }
        Update: {
          confirmation_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          listing_id?: string | null
          points?: number
          source_key?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "point_events_confirmation_id_fkey"
            columns: ["confirmation_id"]
            isOneToOne: false
            referencedRelation: "listing_confirmations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_events_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
