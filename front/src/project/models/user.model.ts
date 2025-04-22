export interface User {
  id: number;
  username: string;
  email: string;
  bio?: string;
  avatar?: string;
  is_online: boolean;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface AuthResponse {
  access: string;
  refresh: string;
}
