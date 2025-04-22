import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  User,
} from '../models/user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  register(data: RegisterRequest): Observable<User> {
    return this.http.post<User>(`${this.apiUrl}/auth/register/`, data);
  }

  login(data: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login/`, data).pipe(
      tap(response => {
        // Get user ID from token (JWT)
        if (response.access) {
          const tokenParts = response.access.split('.');
          if (tokenParts.length === 3) {
            try {
              const payload = JSON.parse(atob(tokenParts[1]));
              if (payload.user_id) {
                localStorage.setItem('user_id', payload.user_id.toString());
              }
            } catch (e) {
              console.error('Error parsing JWT token', e);
            }
          }
        }
      })
    );
  }

  setTokens(access: string, refresh: string): void {
    localStorage.setItem('access_token', access);
    localStorage.setItem('refresh_token', refresh);
    
    // Extract user_id from the JWT token
    const tokenParts = access.split('.');
    if (tokenParts.length === 3) {
      try {
        const payload = JSON.parse(atob(tokenParts[1]));
        if (payload.user_id) {
          localStorage.setItem('user_id', payload.user_id.toString());
        }
      } catch (e) {
        console.error('Error parsing JWT token', e);
      }
    }
  }

  getAccessToken(): string | null {
    return localStorage.getItem('access_token');
  }

  getRefreshToken(): string | null {
    return localStorage.getItem('refresh_token');
  }
  
  getUserId(): number | null {
    const userId = localStorage.getItem('user_id');
    return userId ? parseInt(userId) : null;
  }

  logout(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
  }

  isAuthenticated(): boolean {
    return !!this.getAccessToken();
  }
}