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
      annotations: {
        Row: {
          content: string | null
          created_at: string
          document_id: string
          id: string
          page_index: number
          position: Json
          type: Database["public"]["Enums"]["annotation_type"]
          visible_to_recipients: boolean
        }
        Insert: {
          content?: string | null
          created_at?: string
          document_id: string
          id?: string
          page_index: number
          position: Json
          type: Database["public"]["Enums"]["annotation_type"]
          visible_to_recipients?: boolean
        }
        Update: {
          content?: string | null
          created_at?: string
          document_id?: string
          id?: string
          page_index?: number
          position?: Json
          type?: Database["public"]["Enums"]["annotation_type"]
          visible_to_recipients?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "annotations_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pdf_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      page_view_events: {
        Row: {
          active_ms: number
          entered_at: string
          id: string
          page_index: number
          sequence: number
          session_id: string
        }
        Insert: {
          active_ms?: number
          entered_at?: string
          id?: string
          page_index: number
          sequence?: number
          session_id: string
        }
        Update: {
          active_ms?: number
          entered_at?: string
          id?: string
          page_index?: number
          sequence?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_view_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "viewing_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      pdf_documents: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          page_count: number
          size_bytes: number
          source_storage_path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          page_count?: number
          size_bytes?: number
          source_storage_path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          page_count?: number
          size_bytes?: number
          source_storage_path?: string
          updated_at?: string
        }
        Relationships: []
      }
      pdf_pages: {
        Row: {
          document_id: string
          id: string
          position: number
          rotation: number
          source_page_index: number
        }
        Insert: {
          document_id: string
          id?: string
          position: number
          rotation?: number
          source_page_index: number
        }
        Update: {
          document_id?: string
          id?: string
          position?: number
          rotation?: number
          source_page_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "pdf_pages_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pdf_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          user_id?: string
        }
        Relationships: []
      }
      share_links: {
        Row: {
          allow_download: boolean
          created_at: string
          document_id: string
          expires_at: string | null
          id: string
          is_active: boolean
          label: string | null
          owner_id: string
          password_hash: string | null
          recipient_email: string | null
          recipient_name: string | null
          slug: string
        }
        Insert: {
          allow_download?: boolean
          created_at?: string
          document_id: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          owner_id: string
          password_hash?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          slug: string
        }
        Update: {
          allow_download?: boolean
          created_at?: string
          document_id?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          label?: string | null
          owner_id?: string
          password_hash?: string | null
          recipient_email?: string | null
          recipient_name?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "share_links_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "pdf_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      viewers: {
        Row: {
          anon_id: string
          first_seen: string
          id: string
          last_seen: string
          recipient_email: string | null
          recipient_name: string | null
          share_link_id: string
        }
        Insert: {
          anon_id: string
          first_seen?: string
          id?: string
          last_seen?: string
          recipient_email?: string | null
          recipient_name?: string | null
          share_link_id: string
        }
        Update: {
          anon_id?: string
          first_seen?: string
          id?: string
          last_seen?: string
          recipient_email?: string | null
          recipient_name?: string | null
          share_link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewers_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
        ]
      }
      viewing_sessions: {
        Row: {
          active_ms: number
          browser: string | null
          completion_pct: number
          country: string | null
          device: string | null
          duration_seconds: number
          ended_at: string | null
          id: string
          last_page: number | null
          share_link_id: string
          started_at: string
          user_agent: string | null
          viewer_id: string
        }
        Insert: {
          active_ms?: number
          browser?: string | null
          completion_pct?: number
          country?: string | null
          device?: string | null
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          last_page?: number | null
          share_link_id: string
          started_at?: string
          user_agent?: string | null
          viewer_id: string
        }
        Update: {
          active_ms?: number
          browser?: string | null
          completion_pct?: number
          country?: string | null
          device?: string | null
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          last_page?: number | null
          share_link_id?: string
          started_at?: string
          user_agent?: string | null
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewing_sessions_share_link_id_fkey"
            columns: ["share_link_id"]
            isOneToOne: false
            referencedRelation: "share_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "viewing_sessions_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "viewers"
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
      annotation_type: "highlight" | "strikethrough" | "note"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      annotation_type: ["highlight", "strikethrough", "note"],
    },
  },
} as const
