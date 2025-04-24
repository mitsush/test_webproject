import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { catchError, map, Observable, of } from 'rxjs';
import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private apiUrl = 'http://localhost:8000/api';
  private defaultAvatarUrl = 'assets/default-avatar.png';
  
  private avatarCache = new Map<number, string>();

  constructor(private http: HttpClient) {
    // Listen for avatar cache invalidation events
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', (event) => {
        if (event.key === 'avatar_cache_invalidated') {
          this.clearAvatarCache();
        }
      });
    }
  }

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

  getAvatarUrl(userId: number): Observable<string> {
    // Check for cache invalidation flag
    const cacheInvalidated = localStorage.getItem('avatar_cache_invalidated');
    const isCurrent = userId === Number(localStorage.getItem('user_id'));
    
    // Always refresh current user's avatar if we've updated it
    if (cacheInvalidated && isCurrent) {
      this.avatarCache.delete(userId);
    }
    
    if (this.avatarCache.has(userId)) {
      return of(this.avatarCache.get(userId) || this.defaultAvatarUrl);
    }

    return this.http.get<User>(`${this.apiUrl}/users/${userId}/`, {
      headers: this.getHeaders()
    }).pipe(
      map(user => {
        let avatarUrl = this.defaultAvatarUrl;
        
        // First try to use avatar_url which is pre-processed by backend
        if (user.avatar_url) {
          avatarUrl = user.avatar_url;
        } 
        // If not available, but avatar path exists, construct the URL
        else if (user.avatar) {
          // Process avatar path to full URL
          if (user.avatar.startsWith('/')) {
            avatarUrl = `http://localhost:8000${user.avatar}`;
          } else if (user.avatar.startsWith('http')) {
            avatarUrl = user.avatar;
          } else {
            avatarUrl = `http://localhost:8000/media/${user.avatar}`;
          }
        }
        
        this.avatarCache.set(userId, avatarUrl);
        return avatarUrl;
      }),
      catchError(() => {
        this.avatarCache.set(userId, this.defaultAvatarUrl);
        return of(this.defaultAvatarUrl);
      })
    );
  }

  clearAvatarCache(userId?: number): void {
    if (userId) {
      this.avatarCache.delete(userId);
    } else {
      this.avatarCache.clear();
    }
  }
}