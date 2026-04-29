// PostgreSQL 枚举类型对应的 TypeScript 联合类型
export type MembershipTier = 'free' | 'pro' | 'business';
export type BillingCycle = 'monthly' | 'yearly';
export type PaymentProvider = 'stripe' | 'paypal' | 'wechat' | 'alipay';
export type SubscriptionStatus = 'active' | 'expiring' | 'expired' | 'cancelled' | 'grace_period';
export type TemplateCategory = 'free_template' | 'paid_template';
export type AnalysisStatus = 'pending' | 'analyzing' | 'completed' | 'failed';
export type GenerationType = 'preview' | 'full_demo';
export type TaskStatus = 'pending' | 'building_prompt' | 'generating' | 'post_processing' | 'completed' | 'failed' | 'safety_blocked';
export type PaymentStatus = 'pending' | 'completed' | 'failed' | 'refunded';
export type ConfigType = 'credit_quota' | 'cost_rule' | 'pricing' | 'credits_pack';
export type AccessStatus = 'accessible' | 'upgrade_required';

// Database 接口定义
export interface Database {
  public: {
    Tables: {
      memberships: {
        Row: {
          id: string;
          user_id: string;
          tier: MembershipTier;
          billing_cycle: BillingCycle | null;
          start_date: string | null;
          expires_at: string | null;
          auto_renew: boolean;
          payment_provider: PaymentProvider | null;
          subscription_id: string | null;
          status: SubscriptionStatus;
          grace_period_end: string | null;
          pending_downgrade_tier: MembershipTier | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier?: MembershipTier;
          billing_cycle?: BillingCycle | null;
          start_date?: string | null;
          expires_at?: string | null;
          auto_renew?: boolean;
          payment_provider?: PaymentProvider | null;
          subscription_id?: string | null;
          status?: SubscriptionStatus;
          grace_period_end?: string | null;
          pending_downgrade_tier?: MembershipTier | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier?: MembershipTier;
          billing_cycle?: BillingCycle | null;
          start_date?: string | null;
          expires_at?: string | null;
          auto_renew?: boolean;
          payment_provider?: PaymentProvider | null;
          subscription_id?: string | null;
          status?: SubscriptionStatus;
          grace_period_end?: string | null;
          pending_downgrade_tier?: MembershipTier | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      credits: {
        Row: {
          id: string;
          user_id: string;
          tier: MembershipTier;
          used: number;
          total: number;
          period_start: string;
          period_end: string;
          version: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tier?: MembershipTier;
          used?: number;
          total: number;
          period_start: string;
          period_end: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          tier?: MembershipTier;
          used?: number;
          total?: number;
          period_start?: string;
          period_end?: string;
          version?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      credit_history: {
        Row: {
          id: string;
          user_id: string;
          month: string;
          used: number;
          total: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          month: string;
          used: number;
          total: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          month?: string;
          used?: number;
          total?: number;
          created_at?: string;
        };
        Relationships: [];
      };

      preview_counts: {
        Row: {
          id: string;
          user_id: string;
          used: number;
          total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          used?: number;
          total?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          used?: number;
          total?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      templates: {
        Row: {
          id: string;
          name: string;
          description: string;
          category: TemplateCategory;
          genre: string;
          preview_url: string | null;
          cover_url: string | null;
          reference_audio_url: string | null;
          analysis_result: string | null;
          lyria_prompt: string | null;
          analyzed_at: string | null;
          analysis_status: AnalysisStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          description: string;
          category: TemplateCategory;
          genre: string;
          preview_url?: string | null;
          cover_url?: string | null;
          reference_audio_url?: string | null;
          analysis_result?: string | null;
          lyria_prompt?: string | null;
          analyzed_at?: string | null;
          analysis_status?: AnalysisStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string;
          category?: TemplateCategory;
          genre?: string;
          preview_url?: string | null;
          cover_url?: string | null;
          reference_audio_url?: string | null;
          analysis_result?: string | null;
          lyria_prompt?: string | null;
          analyzed_at?: string | null;
          analysis_status?: AnalysisStatus;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      generation_tasks: {
        Row: {
          id: string;
          user_id: string;
          generation_type: GenerationType;
          status: TaskStatus;
          prompt: string | null;
          template_id: string | null;
          model_id: string;
          audio_path: string | null;
          raw_audio_path: string | null;
          lyrics: string | null;
          song_structure: string | null;
          credits_consumed: number;
          error_code: string | null;
          error_message: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          generation_type: GenerationType;
          status?: TaskStatus;
          prompt?: string | null;
          template_id?: string | null;
          model_id: string;
          audio_path?: string | null;
          raw_audio_path?: string | null;
          lyrics?: string | null;
          song_structure?: string | null;
          credits_consumed?: number;
          error_code?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          generation_type?: GenerationType;
          status?: TaskStatus;
          prompt?: string | null;
          template_id?: string | null;
          model_id?: string;
          audio_path?: string | null;
          raw_audio_path?: string | null;
          lyrics?: string | null;
          song_structure?: string | null;
          credits_consumed?: number;
          error_code?: string | null;
          error_message?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      payment_sessions: {
        Row: {
          id: string;
          user_id: string;
          provider: PaymentProvider;
          checkout_url: string;
          tier: MembershipTier;
          billing_cycle: BillingCycle;
          expires_at: string;
          created_at: string;
        };
        Insert: {
          id: string;
          user_id: string;
          provider: PaymentProvider;
          checkout_url: string;
          tier: MembershipTier;
          billing_cycle: BillingCycle;
          expires_at: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          provider?: PaymentProvider;
          checkout_url?: string;
          tier?: MembershipTier;
          billing_cycle?: BillingCycle;
          expires_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };

      payments: {
        Row: {
          id: string;
          user_id: string;
          session_id: string | null;
          amount: number;
          currency: string;
          provider: PaymentProvider;
          tier: MembershipTier;
          billing_cycle: BillingCycle;
          status: PaymentStatus;
          created_at: string;
          completed_at: string | null;
        };
        Insert: {
          id: string;
          user_id: string;
          session_id?: string | null;
          amount: number;
          currency?: string;
          provider: PaymentProvider;
          tier: MembershipTier;
          billing_cycle: BillingCycle;
          status?: PaymentStatus;
          created_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          session_id?: string | null;
          amount?: number;
          currency?: string;
          provider?: PaymentProvider;
          tier?: MembershipTier;
          billing_cycle?: BillingCycle;
          status?: PaymentStatus;
          created_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };

      processed_webhook_events: {
        Row: {
          event_id: string;
          provider: PaymentProvider;
          session_id: string;
          status: string;
          processed_at: string;
        };
        Insert: {
          event_id: string;
          provider: PaymentProvider;
          session_id: string;
          status: string;
          processed_at?: string;
        };
        Update: {
          event_id?: string;
          provider?: PaymentProvider;
          session_id?: string;
          status?: string;
          processed_at?: string;
        };
        Relationships: [];
      };

      admin_config: {
        Row: {
          id: string;
          config_type: ConfigType;
          config_data: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          config_type: ConfigType;
          config_data: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          config_type?: ConfigType;
          config_data?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };

      config_changelog: {
        Row: {
          id: string;
          operator_id: string;
          operator_name: string;
          config_type: ConfigType;
          previous_value: Record<string, unknown>;
          new_value: Record<string, unknown>;
          changed_at: string;
          description: string;
        };
        Insert: {
          id: string;
          operator_id: string;
          operator_name: string;
          config_type: ConfigType;
          previous_value: Record<string, unknown>;
          new_value: Record<string, unknown>;
          changed_at?: string;
          description: string;
        };
        Update: {
          id?: string;
          operator_id?: string;
          operator_name?: string;
          config_type?: ConfigType;
          previous_value?: Record<string, unknown>;
          new_value?: Record<string, unknown>;
          changed_at?: string;
          description?: string;
        };
        Relationships: [];
      };

      downgraded_file_access: {
        Row: {
          id: string;
          file_id: string;
          user_id: string;
          original_tier: MembershipTier;
          export_format: Record<string, unknown>;
          generated_at: string;
          grace_period_end: string;
          access_status: AccessStatus;
        };
        Insert: {
          id?: string;
          file_id: string;
          user_id: string;
          original_tier: MembershipTier;
          export_format: Record<string, unknown>;
          generated_at: string;
          grace_period_end: string;
          access_status?: AccessStatus;
        };
        Update: {
          id?: string;
          file_id?: string;
          user_id?: string;
          original_tier?: MembershipTier;
          export_format?: Record<string, unknown>;
          generated_at?: string;
          grace_period_end?: string;
          access_status?: AccessStatus;
        };
        Relationships: [];
      };
    };

    Views: {
      [_ in never]: never;
    };

    Functions: {
      upgrade_membership: {
        Args: {
          p_user_id: string;
          p_target_tier: MembershipTier;
          p_billing_cycle: BillingCycle;
          p_monthly_credits: number;
        };
        Returns: undefined;
      };
    };

    Enums: {
      membership_tier: MembershipTier;
      billing_cycle: BillingCycle;
      payment_provider: PaymentProvider;
      subscription_status: SubscriptionStatus;
      template_category: TemplateCategory;
      analysis_status: AnalysisStatus;
      generation_type: GenerationType;
      task_status: TaskStatus;
      payment_status: PaymentStatus;
      config_type: ConfigType;
      access_status: AccessStatus;
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// 便捷类型别名
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type InsertTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type UpdateTables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
