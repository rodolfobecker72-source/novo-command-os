import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled';

export interface Subscription {
  status: SubscriptionStatus;
  /** 'full' or 'read_only' (computed by the database, which enforces it) */
  access: 'full' | 'read_only';
  trialEndsAt: Date;
  currentPeriodEnd: Date | null;
  pastDueSince: Date | null;
  /** When the company becomes read-only if nothing changes (trial end, grace end, paid period end) */
  readOnlyAt: Date | null;
  canceledAt: Date | null;
  planName: string;
  price: number;
  maxUsers: number | null;
  memberCount: number;
  hasCard: boolean;
}

const toDate = (v: string | null) => (v ? new Date(v) : null);

/** The company's Command OS subscription (every member can read it). */
export function useSubscription() {
  const { workspace } = useAuth();
  return useQuery({
    queryKey: ['subscription', workspace?.id],
    enabled: !!workspace?.id,
    refetchOnWindowFocus: true,
    staleTime: 60_000,
    queryFn: async (): Promise<Subscription | null> => {
      const { data, error } = await supabase.rpc('my_subscription' as any);
      if (error) throw error;
      const row = ((data || []) as any[])[0];
      if (!row) return null;
      return {
        status: row.status,
        access: row.access,
        trialEndsAt: new Date(row.trial_ends_at),
        currentPeriodEnd: toDate(row.current_period_end),
        pastDueSince: toDate(row.past_due_since),
        readOnlyAt: toDate(row.read_only_at),
        canceledAt: toDate(row.canceled_at),
        planName: row.plan_name,
        price: Number(row.price),
        maxUsers: row.max_users,
        memberCount: row.member_count,
        hasCard: row.has_card,
      };
    },
  });
}

/** Whole days from now until a date (0 when already past). */
export function daysUntil(date: Date | null): number {
  if (!date) return 0;
  return Math.max(0, Math.ceil((date.getTime() - Date.now()) / 86_400_000));
}
