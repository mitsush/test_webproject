import { Component, OnInit, Inject, PLATFORM_ID } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [FormsModule, RouterModule, CommonModule],
  templateUrl: './settings.component.html',
  styleUrls: ['./settings.component.css'],
})
export class SettingsComponent implements OnInit {
  private apiUrl = 'http://localhost:8000/api';
  private baseUrl = 'http://localhost:8000';
  
  constructor(
    private router: Router,
    @Inject(PLATFORM_ID) private platformId: Object,
    private http: HttpClient
  ) {}

  user: User = {
    id: 0,
    username: '',
    email: '',
    bio: '',
    avatar: undefined,
    is_online: false,
  };

  selectedAvatarFile: File | null = null;
  avatarPreview: string | null = null;
  avatarUrl: string = 'assets/default-avatar.png';

  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      if (!token) {
        this.router.navigate(['/login']);
      } else {
        this.loadUserProfile();
      }
    }
  }

  loadUserProfile(): void {
    const token = localStorage.getItem('access_token');
    if (!token) {
      this.router.navigate(['/login']);
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.http
      .get<User>(`${this.apiUrl}/users/me/`, { headers })
      .subscribe({
        next: (data: User) => {
          if (data) {
            this.user = data;
            console.log('User profile loaded:', data);
            this.processAvatarUrl();
          }
        },
        error: (err: any) => {
          console.error('Error loading user profile:', err);
          this.errorMessage = 'Failed to load user profile';
        },
      });
  }

  processAvatarUrl(): void {
    // First check for avatar_url which is the processed URL from the backend
    if (this.user.avatar_url) {
      this.avatarUrl = this.user.avatar_url;
      console.log('Using avatar_url:', this.avatarUrl);
      return;
    }
    
    // If no avatar_url, fall back to avatar path processing
    if (!this.user.avatar) {
      this.avatarUrl = 'assets/default-avatar.png';
      console.log('No avatar, using default:', this.avatarUrl);
      return;
    }

    // If avatar is a relative path, make it absolute
    if (this.user.avatar.startsWith('/')) {
      this.avatarUrl = `${this.baseUrl}${this.user.avatar}`;
    } else if (this.user.avatar.startsWith('http')) {
      // If it's already a full URL, use it as is
      this.avatarUrl = this.user.avatar;
    } else {
      // Otherwise, assume it's a relative path without a leading slash
      this.avatarUrl = `${this.baseUrl}/media/${this.user.avatar}`;
    }
    
    console.log('Processed avatar URL:', this.avatarUrl);
  }

  onFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedAvatarFile = file;
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.avatarPreview = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  updateProfile(): void {
    const token = localStorage.getItem('access_token');
    if (!token) {
      this.errorMessage = 'Missing access token';
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    const formData = new FormData();
    formData.append('username', this.user.username);
    formData.append('email', this.user.email);
    formData.append('bio', this.user.bio || '');
    
    // Only add avatar if a new one is selected
    if (this.selectedAvatarFile) {
      formData.append('avatar', this.selectedAvatarFile);
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    // Use a dedicated endpoint for avatar upload if the user is just changing their avatar
    if (this.selectedAvatarFile && !this.hasProfileDataChanged()) {
      this.http
        .post<any>(`${this.apiUrl}/users/${this.user.id}/upload_avatar/`, formData, {
          headers: new HttpHeaders({
            Authorization: `Bearer ${token}`,
          }),
        })
        .subscribe({
          next: (response) => {
            console.log('Avatar updated successfully:', response);
            this.successMessage = 'Avatar updated successfully';
            this.isLoading = false;
            
            // Update avatar URL and clear selected file
            if (response.avatar) {
              this.avatarUrl = response.avatar;
              // Store it in the user object too
              this.user.avatar = response.avatar;
              this.user.avatar_url = response.avatar;
            }
            this.selectedAvatarFile = null;
            this.avatarPreview = null;
            
            // Clear avatar cache in UserService to force refresh in chat
            this.clearAvatarCacheInStorage();
          },
          error: (err) => {
            console.error('Error updating avatar:', err);
            this.errorMessage = 'Failed to update avatar';
            this.isLoading = false;
          },
        });
    } else {
      // Update the entire profile
      this.http
        .patch<User>(`${this.apiUrl}/users/${this.user.id}/`, formData, {
          headers,
        })
        .subscribe({
          next: (updatedUser: User) => {
            console.log('Profile updated successfully:', updatedUser);
            this.successMessage = 'Profile updated successfully';
            
            // Important: Preserve existing avatar URL if none returned in response
            if (!updatedUser.avatar_url && this.avatarUrl && this.avatarUrl !== 'assets/default-avatar.png') {
              updatedUser.avatar_url = this.avatarUrl;
            }
            
            this.user = updatedUser;
            this.processAvatarUrl();
            this.selectedAvatarFile = null;
            this.avatarPreview = null;
            this.isLoading = false;
            
            // Clear avatar cache in UserService to force refresh in chat
            this.clearAvatarCacheInStorage();
          },
          error: (err: any) => {
            this.errorMessage = 'Failed to update profile';
            console.error('Error updating profile:', err);
            this.isLoading = false;
          },
        });
    }
  }

  // Helper method to check if non-avatar profile data has changed
  private hasProfileDataChanged(): boolean {
    // We'd need to compare with original data from server
    // For simplicity, assuming any edit was made
    return true;
  }
  
  // Helper to clear avatar cache
  private clearAvatarCacheInStorage(): void {
    // Add this to force other components to reload the avatar
    const userId = localStorage.getItem('user_id');
    if (userId) {
      localStorage.setItem('avatar_cache_invalidated', Date.now().toString());
    }
  }

  deleteAccount(): void {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (!token) {
      this.errorMessage = 'Missing access token';
      return;
    }

    const headers = new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });

    this.isLoading = true;
    this.errorMessage = '';

    this.http
      .delete(`${this.apiUrl}/users/${this.user.id}/`, { headers })
      .subscribe({
        next: () => {
          this.successMessage = 'Account deleted successfully';
          localStorage.removeItem('access_token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_id');
          this.isLoading = false;
          this.router.navigate(['/login']);
        },
        error: (err: any) => {
          this.errorMessage = 'Failed to delete account';
          console.error('Error deleting account:', err);
          this.isLoading = false;
        },
      });
  }

  logOut(): void {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    this.router.navigate(['/login']);
  }
}