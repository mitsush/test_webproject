import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(private http: HttpClient) {}

  getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getCurrentUser(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/me/`, {
      headers: this.getHeaders()
    });
  }

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}/users/`, {
      headers: this.getHeaders()
    });
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/users/${id}/`, {
      headers: this.getHeaders()
    });
  }

  updateUser(id: number, userData: FormData): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/users/${id}/`, userData, {
      headers: this.getHeaders()
    });
  }

  deleteUser(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/users/${id}/`, {
      headers: this.getHeaders()
    });
  }

  // Helper method to process avatar URLs
  getAvatarUrl(avatarPath: string | undefined | null): string {
    if (!avatarPath) {
      return 'assets/default-avatar.png';
    }
    
    if (avatarPath.startsWith('http')) {
      return avatarPath;
    }
    
    return `http://localhost:8000${avatarPath}`;
  }
}