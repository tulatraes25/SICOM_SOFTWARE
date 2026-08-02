import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/config/supabase';
import type { User } from '@supabase/supabase-js';
import type { Profile } from '@/types/roles';
import {
  getCurrentUserProfile,
  signIn,
  signOut,
  isValidRole,
  getRoleDashboardPath,
} from '@/lib/auth';

const REQUIRED_PASSWORD_CHANGE_PATH = '/cambiar-contrasena-obligatoria';

interface AuthState {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    profile: null,
    loading: true,
    error: null,
  });

  const loadProfile = useCallback(async () => {
    const profile = await getCurrentUserProfile();
    return profile;
  }, []);

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (!mounted) return;

        if (session?.user) {
          const profile = await loadProfile();
          if (!mounted) return;

          if (!profile) {
            setState({ user: null, profile: null, loading: false, error: null });
            return;
          }

          if (!profile.active) {
            await signOut();
            if (mounted) setState({ user: null, profile: null, loading: false, error: null });
            return;
          }

          setState({ user: session.user, profile, loading: false, error: null });
        } else {
          setState({ user: null, profile: null, loading: false, error: null });
        }
      } catch {
        if (mounted) {
          setState({ user: null, profile: null, loading: false, error: 'Error al inicializar sesión' });
        }
      }
    }

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        if (event === 'SIGNED_IN' && session?.user) {
          const profile = await loadProfile();
          if (!mounted) return;

          if (!profile) {
            setState({ user: null, profile: null, loading: false, error: null });
            return;
          }

          if (!profile.active) {
            await signOut();
            if (mounted) setState({ user: null, profile: null, loading: false, error: null });
            return;
          }

          setState({ user: session.user, profile, loading: false, error: null });
        } else if (event === 'SIGNED_OUT') {
          setState({ user: null, profile: null, loading: false, error: null });
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          const profile = await loadProfile();
          if (!mounted) return;

          if (!profile) return;

          if (!profile.active) {
            await signOut();
            if (mounted) setState({ user: null, profile: null, loading: false, error: null });
            return;
          }

          setState(prev => ({ ...prev, user: session.user, profile }));
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadProfile]);

  const login = useCallback(async (email: string, password: string) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    const { data, error } = await signIn(email, password);

    if (error) {
      setState(prev => ({ ...prev, loading: false, error: error.message }));
      return { error: error.message };
    }

    if (data.user) {
      const profile = await loadProfile();

      if (!profile) {
        setState(prev => ({ ...prev, user: data.user, profile: null, loading: false, error: 'No se encontró el perfil del usuario' }));
        return { error: 'No se encontró el perfil del usuario' };
      }

      if (!isValidRole(profile.role)) {
        setState(prev => ({ ...prev, user: data.user, profile, loading: false, error: 'Rol de usuario no válido' }));
        return { error: 'Rol de usuario no válido' };
      }

      if (!profile.active) {
        await signOut();
        const msg = 'Tu usuario está inactivo. Contactá al administrador.';
        setState({ user: null, profile: null, loading: false, error: msg });
        return { error: msg };
      }

      setState({ user: data.user, profile, loading: false, error: null });
      return { error: null, profile };
    }

    return { error: 'Error desconocido' };
  }, [loadProfile]);

  const logout = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true }));
    await signOut();
    setState({ user: null, profile: null, loading: false, error: null });
  }, []);

  const getRedirectPath = useCallback(() => {
    if (state.profile && isValidRole(state.profile.role)) {
      if (state.profile.must_change_password) {
        return REQUIRED_PASSWORD_CHANGE_PATH;
      }
      return getRoleDashboardPath(state.profile.role);
    }
    return '/login';
  }, [state.profile]);

  const hasRole = useCallback((role: string) => {
    return state.profile?.role === role;
  }, [state.profile]);

  const isAdmin = state.profile?.role === 'admin';
  const isTechnician = state.profile?.role === 'technician';
  const isSupervisor = state.profile?.role === 'supervisor';
  const isResponsible = state.profile?.role === 'responsible';

  return {
    ...state,
    login,
    logout,
    getRedirectPath,
    hasRole,
    isAdmin,
    isTechnician,
    isSupervisor,
    isResponsible,
    isAuthenticated: !!state.user && !!state.profile,
  };
}
