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
      if (!user) { console.log('[ClaimAlert] No user'); setNewCount(0); setLoading(false); return; }

      console.log('[ClaimAlert] Querying for user:', user.id);

      const { data, error } = await supabase
        .from('claims')
        .select('id, priority, assigned_to, status')
        .eq('assigned_to', user.id)
        .eq('status', 'assigned');

      if (error) { console.error('[ClaimAlert] Query error:', error); setLoading(false); return; }

      console.log('[ClaimAlert] Results:', JSON.stringify(data));

      const count = data?.length || 0;
      setNewCount(count);

      if (count === 0) {
        setUrgentCount(0);
        setHighestPriority(null);
      } else {
        const priorities = data!.map(c => c.priority);
        const urgent = priorities.filter(p => p === 'urgent').length;
        setUrgentCount(urgent);

        if (priorities.includes('urgent')) setHighestPriority('urgent');
        else if (priorities.includes('high')) setHighestPriority('high');
        else if (priorities.includes('normal')) setHighestPriority('normal');
        else setHighestPriority('low');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { newCount, urgentCount, highestPriority, loading, refresh };
}
