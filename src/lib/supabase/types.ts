export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never;
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      graphql: {
        Args: {
          extensions?: Json;
          operationName?: string;
          query?: string;
          variables?: Json;
        };
        Returns: Json;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
  public: {
    Tables: {
      accounts: {
        Row: {
          bank_name: string | null;
          closing_day: number | null;
          color: string | null;
          created_at: string;
          credit_limit: number | null;
          default_payment_account_id: string | null;
          due_day: number | null;
          id: string;
          is_active: boolean;
          name: string;
          opening_balance: number;
          opening_balance_date: string | null;
          organization_id: string;
          type: string;
          updated_at: string;
        };
        Insert: {
          bank_name?: string | null;
          closing_day?: number | null;
          color?: string | null;
          created_at?: string;
          credit_limit?: number | null;
          default_payment_account_id?: string | null;
          due_day?: number | null;
          id?: string;
          is_active?: boolean;
          name: string;
          opening_balance?: number;
          opening_balance_date?: string | null;
          organization_id: string;
          type: string;
          updated_at?: string;
        };
        Update: {
          bank_name?: string | null;
          closing_day?: number | null;
          color?: string | null;
          created_at?: string;
          credit_limit?: number | null;
          default_payment_account_id?: string | null;
          due_day?: number | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          opening_balance?: number;
          opening_balance_date?: string | null;
          organization_id?: string;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "accounts_default_payment_account_id_fkey";
            columns: ["default_payment_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "accounts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      attachments: {
        Row: {
          created_at: string;
          filename: string | null;
          id: string;
          mime_type: string | null;
          organization_id: string;
          size_bytes: number | null;
          storage_path: string;
          transaction_id: string;
        };
        Insert: {
          created_at?: string;
          filename?: string | null;
          id?: string;
          mime_type?: string | null;
          organization_id: string;
          size_bytes?: number | null;
          storage_path: string;
          transaction_id: string;
        };
        Update: {
          created_at?: string;
          filename?: string | null;
          id?: string;
          mime_type?: string | null;
          organization_id?: string;
          size_bytes?: number | null;
          storage_path?: string;
          transaction_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attachments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attachments_transaction_id_fkey";
            columns: ["transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_conversations: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          title: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          title?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          title?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_conversations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          metadata: Json;
          organization_id: string;
          role: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id: string;
          role: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          metadata?: Json;
          organization_id?: string;
          role?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey";
            columns: ["conversation_id"];
            isOneToOne: false;
            referencedRelation: "ai_conversations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_messages_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      category_memory: {
        Row: {
          category_id: string;
          confidence: number;
          created_at: string;
          id: string;
          last_used_at: string;
          normalized_description: string;
          organization_id: string;
          sample_description: string;
          transaction_type: string;
          updated_at: string;
          usage_count: number;
        };
        Insert: {
          category_id: string;
          confidence?: number;
          created_at?: string;
          id?: string;
          last_used_at?: string;
          normalized_description: string;
          organization_id: string;
          sample_description: string;
          transaction_type: string;
          updated_at?: string;
          usage_count?: number;
        };
        Update: {
          category_id?: string;
          confidence?: number;
          created_at?: string;
          id?: string;
          last_used_at?: string;
          normalized_description?: string;
          organization_id?: string;
          sample_description?: string;
          transaction_type?: string;
          updated_at?: string;
          usage_count?: number;
        };
        Relationships: [
          {
            foreignKeyName: "category_memory_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "category_memory_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      chart_of_accounts: {
        Row: {
          code: string;
          cost_classification: string | null;
          created_at: string;
          dfc_group: string;
          display_order: number;
          id: string;
          is_active: boolean;
          name: string;
          nature: string;
          organization_id: string;
          parent_id: string | null;
          updated_at: string;
        };
        Insert: {
          code: string;
          cost_classification?: string | null;
          created_at?: string;
          dfc_group: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name: string;
          nature: string;
          organization_id: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          cost_classification?: string | null;
          created_at?: string;
          dfc_group?: string;
          display_order?: number;
          id?: string;
          is_active?: boolean;
          name?: string;
          nature?: string;
          organization_id?: string;
          parent_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chart_of_accounts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chart_of_accounts_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      credit_card_invoices: {
        Row: {
          account_id: string;
          closing_date: string;
          created_at: string;
          due_date: string;
          id: string;
          organization_id: string;
          paid_amount: number;
          payment_transaction_id: string | null;
          status: string;
          total_amount: number;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          closing_date: string;
          created_at?: string;
          due_date: string;
          id?: string;
          organization_id: string;
          paid_amount?: number;
          payment_transaction_id?: string | null;
          status?: string;
          total_amount?: number;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          closing_date?: string;
          created_at?: string;
          due_date?: string;
          id?: string;
          organization_id?: string;
          paid_amount?: number;
          payment_transaction_id?: string | null;
          status?: string;
          total_amount?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "credit_card_invoices_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_card_invoices_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "credit_card_invoices_payment_transaction_id_fkey";
            columns: ["payment_transaction_id"];
            isOneToOne: false;
            referencedRelation: "transactions";
            referencedColumns: ["id"];
          },
        ];
      };
      imports: {
        Row: {
          account_id: string | null;
          completed_at: string | null;
          created_at: string;
          duplicates_found: number;
          error_message: string | null;
          filename: string;
          id: string;
          import_type: string;
          imported_rows: number;
          organization_id: string;
          raw_content: string | null;
          review_payload: Json | null;
          status: string;
          total_rows: number;
        };
        Insert: {
          account_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          duplicates_found?: number;
          error_message?: string | null;
          filename: string;
          id?: string;
          import_type: string;
          imported_rows?: number;
          organization_id: string;
          raw_content?: string | null;
          review_payload?: Json | null;
          status?: string;
          total_rows?: number;
        };
        Update: {
          account_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          duplicates_found?: number;
          error_message?: string | null;
          filename?: string;
          id?: string;
          import_type?: string;
          imported_rows?: number;
          organization_id?: string;
          raw_content?: string | null;
          review_payload?: Json | null;
          status?: string;
          total_rows?: number;
        };
        Relationships: [
          {
            foreignKeyName: "imports_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "imports_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          action_href: string | null;
          action_label: string | null;
          body: string;
          created_at: string;
          dedupe_key: string;
          dismissed_at: string | null;
          expires_at: string | null;
          id: string;
          metadata: Json;
          organization_id: string;
          read_at: string | null;
          severity: string;
          title: string;
          type: string;
          user_id: string | null;
        };
        Insert: {
          action_href?: string | null;
          action_label?: string | null;
          body: string;
          created_at?: string;
          dedupe_key: string;
          dismissed_at?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json;
          organization_id: string;
          read_at?: string | null;
          severity: string;
          title: string;
          type: string;
          user_id?: string | null;
        };
        Update: {
          action_href?: string | null;
          action_label?: string | null;
          body?: string;
          created_at?: string;
          dedupe_key?: string;
          dismissed_at?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json;
          organization_id?: string;
          read_at?: string | null;
          severity?: string;
          title?: string;
          type?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_values: {
        Row: {
          amount: number;
          budget_version_id: string;
          chart_account_id: string;
          created_at: string;
          id: string;
          month: number;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          amount?: number;
          budget_version_id: string;
          chart_account_id: string;
          created_at?: string;
          id?: string;
          month: number;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          budget_version_id?: string;
          chart_account_id?: string;
          created_at?: string;
          id?: string;
          month?: number;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "budget_values_budget_version_id_fkey";
            columns: ["budget_version_id"];
            isOneToOne: false;
            referencedRelation: "budget_versions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_values_chart_account_id_fkey";
            columns: ["chart_account_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "budget_values_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      budget_versions: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          organization_id: string;
          status: string;
          updated_at: string;
          year: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          organization_id: string;
          status?: string;
          updated_at?: string;
          year: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          organization_id?: string;
          status?: string;
          updated_at?: string;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "budget_versions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          locale: string;
          name: string;
          slug: string | null;
          timezone: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          locale?: string;
          name: string;
          slug?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          locale?: string;
          name?: string;
          slug?: string | null;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          organization_id: string | null;
          role: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          organization_id?: string | null;
          role?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          organization_id?: string | null;
          role?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      transactions: {
        Row: {
          account_id: string;
          ai_categorized: boolean;
          ai_confidence: number | null;
          amount: number;
          cash_date: string;
          category_id: string | null;
          counter_account_id: string | null;
          created_at: string;
          credit_card_invoice_id: string | null;
          description: string;
          event_date: string;
          external_id: string | null;
          id: string;
          import_id: string | null;
          notes: string | null;
          organization_id: string;
          source: string;
          status: string;
          transfer_direction: string | null;
          transfer_group_id: string | null;
          type: string;
          updated_at: string;
        };
        Insert: {
          account_id: string;
          ai_categorized?: boolean;
          ai_confidence?: number | null;
          amount: number;
          cash_date: string;
          category_id?: string | null;
          counter_account_id?: string | null;
          created_at?: string;
          credit_card_invoice_id?: string | null;
          description: string;
          event_date: string;
          external_id?: string | null;
          id?: string;
          import_id?: string | null;
          notes?: string | null;
          organization_id: string;
          source?: string;
          status?: string;
          transfer_direction?: string | null;
          transfer_group_id?: string | null;
          type: string;
          updated_at?: string;
        };
        Update: {
          account_id?: string;
          ai_categorized?: boolean;
          ai_confidence?: number | null;
          amount?: number;
          cash_date?: string;
          category_id?: string | null;
          counter_account_id?: string | null;
          created_at?: string;
          credit_card_invoice_id?: string | null;
          description?: string;
          event_date?: string;
          external_id?: string | null;
          id?: string;
          import_id?: string | null;
          notes?: string | null;
          organization_id?: string;
          source?: string;
          status?: string;
          transfer_direction?: string | null;
          transfer_group_id?: string | null;
          type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey";
            columns: ["account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "chart_of_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_counter_account_id_fkey";
            columns: ["counter_account_id"];
            isOneToOne: false;
            referencedRelation: "accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_credit_card_invoice_id_fkey";
            columns: ["credit_card_invoice_id"];
            isOneToOne: false;
            referencedRelation: "credit_card_invoices";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_import_id_fkey";
            columns: ["import_id"];
            isOneToOne: false;
            referencedRelation: "imports";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transactions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      auth_org_id: { Args: never; Returns: string };
      complete_onboarding: {
        Args: { p_account: Json; p_full_name: string; p_org_name: string };
        Returns: string;
      };
      create_manual_transfer: {
        Args: {
          p_amount: number;
          p_cash_date: string;
          p_description: string;
          p_event_date: string;
          p_from_account_id: string;
          p_notes?: string;
          p_status?: string;
          p_to_account_id: string;
        };
        Returns: string;
      };
      create_budget_version: {
        Args: { p_name: string; p_source_version_id?: string | null; p_year: number };
        Returns: string;
      };
      seed_corporis_chart: { Args: { p_org: string }; Returns: undefined };
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

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const;
