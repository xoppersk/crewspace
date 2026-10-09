/**
 * Hand-written database types for the Crewspace schema.
 *
 * In a real project, generate these with the Supabase CLI instead:
 *
 *   supabase gen types typescript --local > src/lib/supabase/database.types.ts
 *
 * and import that file. The shape below mirrors
 * `supabase/migrations/00001_init.sql` through `00008_storage.sql`.
 *
 * CI check (later phase): `supabase gen types` staleness check fails the
 * build if this file drifts from the migrations.
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string;
          avatar_url: string | null;
          title: string | null;
          bio: string | null;
          timezone: string;
          email_verified: boolean;
          /** Mirror of auth.users.email for directory search (00013). Nullable. */
          email: string | null;
          /** Nullable pointer at the caller's current team. Kept from the starter. */
          active_team_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name: string;
          avatar_url?: string | null;
          title?: string | null;
          bio?: string | null;
          timezone?: string;
          email_verified?: boolean;
          email?: string | null;
          active_team_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          avatar_url?: string | null;
          title?: string | null;
          bio?: string | null;
          timezone?: string;
          email_verified?: boolean;
          email?: string | null;
          active_team_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          logo_url: string | null;
          default_role_id: string | null;
          invite_policy: "owners" | "admins" | "managers";
          allowed_domains: string[];
          require_email_verification: boolean;
          session_timeout_minutes: number | null;
          require_reauth_destructive: boolean;
          is_demo: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          logo_url?: string | null;
          default_role_id?: string | null;
          invite_policy?: "owners" | "admins" | "managers";
          allowed_domains?: string[];
          require_email_verification?: boolean;
          session_timeout_minutes?: number | null;
          require_reauth_destructive?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          logo_url?: string | null;
          default_role_id?: string | null;
          invite_policy?: "owners" | "admins" | "managers";
          allowed_domains?: string[];
          require_email_verification?: boolean;
          session_timeout_minutes?: number | null;
          require_reauth_destructive?: boolean;
          is_demo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      roles: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          description: string | null;
          is_system: boolean;
          system_key: string | null;
          color: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          description?: string | null;
          is_system?: boolean;
          system_key?: string | null;
          color?: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          description?: string | null;
          is_system?: boolean;
          system_key?: string | null;
          color?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      permissions: {
        Row: {
          key: string;
          resource: string;
          action: string;
          label: string;
          description: string | null;
        };
        Insert: {
          key: string;
          resource: string;
          action: string;
          label: string;
          description?: string | null;
        };
        Update: {
          key?: string;
          resource?: string;
          action?: string;
          label?: string;
          description?: string | null;
        };
        Relationships: [];
      };
      role_permissions: {
        Row: {
          role_id: string;
          permission_key: string;
          granted_at: string;
          granted_by: string | null;
        };
        Insert: {
          role_id: string;
          permission_key: string;
          granted_at?: string;
          granted_by?: string | null;
        };
        Update: {
          role_id?: string;
          permission_key?: string;
          granted_at?: string;
          granted_by?: string | null;
        };
        Relationships: [];
      };
      role_permission_denies: {
        Row: {
          role_id: string;
          permission_key: string;
          denied_at: string;
          denied_by: string | null;
        };
        Insert: {
          role_id: string;
          permission_key: string;
          denied_at?: string;
          denied_by?: string | null;
        };
        Update: {
          role_id?: string;
          permission_key?: string;
          denied_at?: string;
          denied_by?: string | null;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          org_id: string;
          user_id: string;
          role_id: string;
          is_active: boolean;
          deactivated_at: string | null;
          deactivated_by: string | null;
          last_active_at: string | null;
          joined_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          user_id: string;
          role_id: string;
          is_active?: boolean;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          last_active_at?: string | null;
          joined_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          user_id?: string;
          role_id?: string;
          is_active?: boolean;
          deactivated_at?: string | null;
          deactivated_by?: string | null;
          last_active_at?: string | null;
          joined_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      teams: {
        Row: {
          id: string;
          org_id: string;
          name: string;
          description: string | null;
          lead_membership_id: string | null;
          is_archived: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          name: string;
          description?: string | null;
          lead_membership_id?: string | null;
          is_archived?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          name?: string;
          description?: string | null;
          lead_membership_id?: string | null;
          is_archived?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      team_memberships: {
        Row: {
          team_id: string;
          membership_id: string;
          added_by: string;
          added_at: string;
        };
        Insert: {
          team_id: string;
          membership_id: string;
          added_by: string;
          added_at?: string;
        };
        Update: {
          team_id?: string;
          membership_id?: string;
          added_by?: string;
          added_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          org_id: string;
          email: string;
          role_id: string;
          team_ids: string[];
          token_hash: string;
          status: "pending" | "accepted" | "expired" | "revoked";
          invited_by: string;
          message: string | null;
          source: "manual" | "bulk";
          expires_at: string;
          accepted_at: string | null;
          accepted_user_id: string | null;
          resend_count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          email: string;
          role_id: string;
          team_ids?: string[];
          token_hash: string;
          status?: "pending" | "accepted" | "expired" | "revoked";
          invited_by?: string;
          message?: string | null;
          source?: "manual" | "bulk";
          expires_at?: string;
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          resend_count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          email?: string;
          role_id?: string;
          team_ids?: string[];
          token_hash?: string;
          status?: "pending" | "accepted" | "expired" | "revoked";
          invited_by?: string;
          message?: string | null;
          source?: "manual" | "bulk";
          expires_at?: string;
          accepted_at?: string | null;
          accepted_user_id?: string | null;
          resend_count?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      audit_log: {
        Row: {
          id: string;
          org_id: string;
          actor_id: string;
          action: string;
          target_type: string | null;
          target_id: string | null;
          target_label: string | null;
          diff: Record<string, unknown>;
          metadata: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          org_id: string;
          actor_id: string;
          action: string;
          target_type?: string | null;
          target_id?: string | null;
          target_label?: string | null;
          diff?: Record<string, unknown>;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          id?: string;
          org_id?: string;
          actor_id?: string;
          action?: string;
          target_type?: string | null;
          target_id?: string | null;
          target_label?: string | null;
          diff?: Record<string, unknown>;
          metadata?: Record<string, unknown>;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      is_org_member: {
        Args: { p_org_id: string };
        Returns: boolean;
      };
      has_permission: {
        Args: { p_org_id: string; p_key: string };
        Returns: boolean;
      };
      user_permissions: {
        Args: { p_org_id: string; p_user_id: string };
        Returns: string[];
      };
      accept_invitation: {
        Args: { p_token: string; p_user_id: string };
        Returns: string;
      };
      my_pending_invitations: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          org_id: string;
          org_name: string;
          org_slug: string;
          org_logo_url: string | null;
          role_name: string;
          invited_by_name: string | null;
          expires_at: string;
          message: string | null;
        }[];
      };
      accept_invitation_by_id: {
        Args: { p_invitation_id: string };
        Returns: string;
      };
      transfer_org_ownership: {
        Args: { p_org_id: string; p_target_membership_id: string };
        Returns: { actor_name: string; target_name: string };
      };
      decline_invitation: {
        Args: { p_invitation_id: string };
        Returns: undefined;
      };
      leave_organization: {
        Args: { p_org_id: string };
        Returns: undefined;
      };
      delete_own_account: {
        Args: { p_email_confirm: string };
        Returns: undefined;
      };
      create_organization: {
        Args: { p_name: string; p_slug: string; p_logo_url?: string | null };
        Returns: string;
      };
      get_invitation_preview: {
        Args: { p_token: string };
        Returns: {
          org_id: string;
          org_slug: string;
          org_name: string;
          org_logo_url: string | null;
          email: string;
          role_name: string;
          role_description: string | null;
          permission_labels: string[];
          inviter_name: string;
          status: string;
          expires_at: string;
        }[];
      };
      org_member_id_by_email: {
        Args: { p_org_id: string; p_email: string };
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
