import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';

export interface OrderAlertData {
  newCount: number;
  urgentCount: number;
  highestPriority: 'urgent' | 'high' | 'normal' | 'low' | null;
  loading: boolean;
  refresh: () => Promise<void>;
}

export function useTechnicianOrderAlerts(): OrderAlertData {
  const [newCount, setNewCount] = useState(0);
  const [urgentCount, setUrgentCount] = useState(0);
  const [highestPriority, setHighestPriority] = useState<'urgent' | 'high' | 'normal' | 'low' | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setNewCount(0); setLoading(false); return; }

      // Query service_orders assigned to this technician via service_order_technicians
      const { data: techAssignments, error: techError } = await supabase
        .from('service_order_technicians')
        .select('service_order_id')
        .eq('technician_id', user.id);

      if (techError || !techAssignments || techAssignments.length === 0) {
        setNewCount(0); setLoading(false); return;
      }

      const orderIds = techAssignments.map(t => t.service_order_id);

      const { data: orders, error: ordersError } = await supabase
        .from('service_orders')
        .select('id, priority')
        .in('id', orderIds)
        .eq('status', 'assigned');

      if (ordersError) { setLoading(false); return; }

      const count = orders?.length || 0;
      setNewCount(count);

      if (count === 0) {
        setUrgentCount(0);
        setHighestPriority(null);
      } else {
        const priorities = orders!.map(o => o.priority);
        setUrgentCount(priorities.filter(p => p === 'urgent').length);
        if (priorities.includes('urgent')) setHighestPriority('urgent');
        else if (priorities.includes('high')) setHighestPriority('high');
        else if (priorities.includes('normal')) setHighestPriority('normal');
        else setHighestPriority('low');
      }
    } catch (err) {
      console.error(err);
      setNewCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { newCount, urgentCount, highestPriority, loading, refresh };
}
