export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  status: 'pending' | 'active' | 'suspended' | 'inactive';
}
