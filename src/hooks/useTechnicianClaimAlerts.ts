import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';

export interface ClaimAlertData {
  newCount: number;
  urgentCount: number;
  highestPriority: 'urgent' | 'high' | 'normal' | 'low' | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useTechnicianClaimAlerts(): ClaimAlertData {
  const [newCount, setNewCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [highestPriority, setHighestPriority] = useState<'urgent' | 'high' | 'normal' | 'low' | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setNewCount(0); setLoading(false); return; }

      // Use the same approach that works in TechClaimsPage:
      // query via the service layer which handles RLS correctly
      const { listClaims } = await import('@/services/claims.service');
      const result = await listClaims({
        assigned_to: user.id,
        status: 'assigned',
      });

      const count = result.count || 0;
      setNewCount(count);

      if (count === 0) {
        setUrgentCount(0);
        setHighestPriority(null);
      } else {
        const priorities = result.data.map(c => c.priority);
        const urgent = priorities.filter(p => p === 'urgent').length;
        setUrgentCount(urgent);

        if (priorities.includes('urgent')) setHighestPriority('urgent');
        else if (priorities.includes('high')) setHighestPriority('high');
        else if (priorities.includes('normal')) setHighestPriority('normal');
        else setHighestPriority('low');
      }
    } catch (err) {
      console.error('[ClaimAlert]', err);
      setNewCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { newCount, urgentCount, highestPriority, loading, refresh };
}
