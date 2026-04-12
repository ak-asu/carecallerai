export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      appointments: {
        Row: {
          conflict_detected: boolean | null;
          created_at: string | null;
          datetime: string;
          doctor_id: string | null;
          google_calendar_event_id: string | null;
          id: string;
          patient_id: string | null;
          reschedule_reason: string | null;
          status: string | null;
          updated_at: string | null;
        };
        Insert: {
          conflict_detected?: boolean | null;
          created_at?: string | null;
          datetime: string;
          doctor_id?: string | null;
          google_calendar_event_id?: string | null;
          id?: string;
          patient_id?: string | null;
          reschedule_reason?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Update: {
          conflict_detected?: boolean | null;
          created_at?: string | null;
          datetime?: string;
          doctor_id?: string | null;
          google_calendar_event_id?: string | null;
          id?: string;
          patient_id?: string | null;
          reschedule_reason?: string | null;
          status?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "appointments_doctor_id_fkey";
            columns: ["doctor_id"];
            isOneToOne: false;
            referencedRelation: "doctors";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "appointments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      automation_jobs: {
        Row: {
          completed_at: string | null;
          created_at: string | null;
          id: string;
          payload: Json | null;
          result: Json | null;
          status: string | null;
          triggered_by: string | null;
          type: string;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          payload?: Json | null;
          result?: Json | null;
          status?: string | null;
          triggered_by?: string | null;
          type: string;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string | null;
          id?: string;
          payload?: Json | null;
          result?: Json | null;
          status?: string | null;
          triggered_by?: string | null;
          type?: string;
        };
        Relationships: [];
      };
      call_entities: {
        Row: {
          action_taken: string | null;
          call_id: string | null;
          confidence: number | null;
          contradiction_detected: boolean | null;
          created_at: string | null;
          decision_rationale: string | null;
          entity_type: string | null;
          id: string;
          negated: boolean | null;
          patient_id: string | null;
          source: string | null;
          value_normalized: string | null;
          value_raw: string | null;
        };
        Insert: {
          action_taken?: string | null;
          call_id?: string | null;
          confidence?: number | null;
          contradiction_detected?: boolean | null;
          created_at?: string | null;
          decision_rationale?: string | null;
          entity_type?: string | null;
          id?: string;
          negated?: boolean | null;
          patient_id?: string | null;
          source?: string | null;
          value_normalized?: string | null;
          value_raw?: string | null;
        };
        Update: {
          action_taken?: string | null;
          call_id?: string | null;
          confidence?: number | null;
          contradiction_detected?: boolean | null;
          created_at?: string | null;
          decision_rationale?: string | null;
          entity_type?: string | null;
          id?: string;
          negated?: boolean | null;
          patient_id?: string | null;
          source?: string | null;
          value_normalized?: string | null;
          value_raw?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_entities_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "call_entities_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      call_sessions: {
        Row: {
          call_id: string;
          context: Json;
          created_at: string | null;
          patient_id: string | null;
        };
        Insert: {
          call_id: string;
          context: Json;
          created_at?: string | null;
          patient_id?: string | null;
        };
        Update: {
          call_id?: string;
          context?: Json;
          created_at?: string | null;
          patient_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "call_sessions_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      calls: {
        Row: {
          ended_at: string | null;
          id: string;
          intent: string | null;
          language: string | null;
          patient_id: string | null;
          severity_score: number | null;
          started_at: string | null;
          status: string;
          summary: string | null;
          transcript: string | null;
          type: string;
          vapi_call_id: string | null;
        };
        Insert: {
          ended_at?: string | null;
          id?: string;
          intent?: string | null;
          language?: string | null;
          patient_id?: string | null;
          severity_score?: number | null;
          started_at?: string | null;
          status?: string;
          summary?: string | null;
          transcript?: string | null;
          type: string;
          vapi_call_id?: string | null;
        };
        Update: {
          ended_at?: string | null;
          id?: string;
          intent?: string | null;
          language?: string | null;
          patient_id?: string | null;
          severity_score?: number | null;
          started_at?: string | null;
          status?: string;
          summary?: string | null;
          transcript?: string | null;
          type?: string;
          vapi_call_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "calls_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      corrections: {
        Row: {
          applied_to_memory: boolean | null;
          corrected_at: string | null;
          corrected_by: string | null;
          entity_type: string;
          id: string;
          new_value: string;
          old_value: string | null;
          patient_id: string | null;
          source_call_id: string | null;
        };
        Insert: {
          applied_to_memory?: boolean | null;
          corrected_at?: string | null;
          corrected_by?: string | null;
          entity_type: string;
          id?: string;
          new_value: string;
          old_value?: string | null;
          patient_id?: string | null;
          source_call_id?: string | null;
        };
        Update: {
          applied_to_memory?: boolean | null;
          corrected_at?: string | null;
          corrected_by?: string | null;
          entity_type?: string;
          id?: string;
          new_value?: string;
          old_value?: string | null;
          patient_id?: string | null;
          source_call_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "corrections_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corrections_source_call_id_fkey";
            columns: ["source_call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
        ];
      };
      doctors: {
        Row: {
          availability_last_synced: string | null;
          google_calendar_id: string | null;
          id: string;
          name: string;
          phone: string | null;
          specialty: string | null;
        };
        Insert: {
          availability_last_synced?: string | null;
          google_calendar_id?: string | null;
          id?: string;
          name: string;
          phone?: string | null;
          specialty?: string | null;
        };
        Update: {
          availability_last_synced?: string | null;
          google_calendar_id?: string | null;
          id?: string;
          name?: string;
          phone?: string | null;
          specialty?: string | null;
        };
        Relationships: [];
      };
      escalations: {
        Row: {
          call_id: string | null;
          clinician_notified_at: string | null;
          context_summary: string | null;
          created_at: string | null;
          id: string;
          patient_id: string | null;
          severity: number | null;
          status: string | null;
          trigger_term: string | null;
        };
        Insert: {
          call_id?: string | null;
          clinician_notified_at?: string | null;
          context_summary?: string | null;
          created_at?: string | null;
          id?: string;
          patient_id?: string | null;
          severity?: number | null;
          status?: string | null;
          trigger_term?: string | null;
        };
        Update: {
          call_id?: string | null;
          clinician_notified_at?: string | null;
          context_summary?: string | null;
          created_at?: string | null;
          id?: string;
          patient_id?: string | null;
          severity?: number | null;
          status?: string | null;
          trigger_term?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "escalations_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "escalations_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      medications: {
        Row: {
          active: boolean | null;
          dose: string | null;
          drug_name: string;
          drug_name_normalized: string | null;
          end_date: string | null;
          frequency: string | null;
          id: string;
          patient_id: string | null;
          source: string;
          start_date: string | null;
          verified_at: string | null;
        };
        Insert: {
          active?: boolean | null;
          dose?: string | null;
          drug_name: string;
          drug_name_normalized?: string | null;
          end_date?: string | null;
          frequency?: string | null;
          id?: string;
          patient_id?: string | null;
          source?: string;
          start_date?: string | null;
          verified_at?: string | null;
        };
        Update: {
          active?: boolean | null;
          dose?: string | null;
          drug_name?: string;
          drug_name_normalized?: string | null;
          end_date?: string | null;
          frequency?: string | null;
          id?: string;
          patient_id?: string | null;
          source?: string;
          start_date?: string | null;
          verified_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "medications_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      medication_savings: {
        Row: {
          context_summary: string | null;
          created_at: string;
          drug_name: string;
          fetched_at: string;
          id: string;
          links: Json;
          medication_id: string | null;
          patient_id: string;
          source: string;
          tavily_query: string;
          updated_at: string;
        };
        Insert: {
          context_summary?: string | null;
          created_at?: string;
          drug_name: string;
          fetched_at?: string;
          id?: string;
          links?: Json;
          medication_id?: string | null;
          patient_id: string;
          source?: string;
          tavily_query: string;
          updated_at?: string;
        };
        Update: {
          context_summary?: string | null;
          created_at?: string;
          drug_name?: string;
          fetched_at?: string;
          id?: string;
          links?: Json;
          medication_id?: string | null;
          patient_id?: string;
          source?: string;
          tavily_query?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "medication_savings_medication_id_fkey";
            columns: ["medication_id"];
            isOneToOne: false;
            referencedRelation: "medications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "medication_savings_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string | null;
          id: string;
          language: string | null;
          message: string;
          patient_id: string | null;
          scheduled_at: string | null;
          sent_at: string | null;
          status: string | null;
          triggered_by: string | null;
          type: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          language?: string | null;
          message: string;
          patient_id?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string | null;
          triggered_by?: string | null;
          type: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          language?: string | null;
          message?: string;
          patient_id?: string | null;
          scheduled_at?: string | null;
          sent_at?: string | null;
          status?: string | null;
          triggered_by?: string | null;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patient_timeline: {
        Row: {
          content: Json | null;
          created_at: string | null;
          event_type: string;
          flagged: boolean | null;
          id: string;
          patient_id: string | null;
          severity: number | null;
          source: string | null;
        };
        Insert: {
          content?: Json | null;
          created_at?: string | null;
          event_type: string;
          flagged?: boolean | null;
          id?: string;
          patient_id?: string | null;
          severity?: number | null;
          source?: string | null;
        };
        Update: {
          content?: Json | null;
          created_at?: string | null;
          event_type?: string;
          flagged?: boolean | null;
          id?: string;
          patient_id?: string | null;
          severity?: number | null;
          source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "patient_timeline_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
      patients: {
        Row: {
          created_at: string | null;
          id: string;
          language: string;
          last_call_at: string | null;
          name_alias: string;
          password_hash: string;
          phone: string | null;
          severity_score: number;
          token: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          language?: string;
          last_call_at?: string | null;
          name_alias: string;
          password_hash: string;
          phone?: string | null;
          severity_score?: number;
          token: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          language?: string;
          last_call_at?: string | null;
          name_alias?: string;
          password_hash?: string;
          phone?: string | null;
          severity_score?: number;
          token?: string;
        };
        Relationships: [];
      };
      symptoms: {
        Row: {
          call_id: string | null;
          flagged_to_clinician: boolean | null;
          id: string;
          onset_date: string | null;
          patient_id: string | null;
          resolved: boolean | null;
          severity: number | null;
          symptom_name: string;
        };
        Insert: {
          call_id?: string | null;
          flagged_to_clinician?: boolean | null;
          id?: string;
          onset_date?: string | null;
          patient_id?: string | null;
          resolved?: boolean | null;
          severity?: number | null;
          symptom_name: string;
        };
        Update: {
          call_id?: string | null;
          flagged_to_clinician?: boolean | null;
          id?: string;
          onset_date?: string | null;
          patient_id?: string | null;
          resolved?: boolean | null;
          severity?: number | null;
          symptom_name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "symptoms_call_id_fkey";
            columns: ["call_id"];
            isOneToOne: false;
            referencedRelation: "calls";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "symptoms_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
