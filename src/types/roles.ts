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
  must_change_password: boolean;
  temporary_password_issued_at: string | null;
  password_changed_at: string | null;
}

export interface User {
  id: string;
  email: string;
  profile: Profile;
}
