export interface LoginRequest {
  username: string;
  password: string;
}

export interface RegisterRequest {
  username: string;
  password: string;
  email: string;
}

export interface User {
  id: number;
  username: string;
  email: string;
  created_at: string;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface VerifyTokenResponse {
  valid: boolean;
  user?: User;
}
