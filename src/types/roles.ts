export type UserRole = 'admin' | 'technician' | 'supervisor' | 'responsible';

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  profile: Profile;
}
