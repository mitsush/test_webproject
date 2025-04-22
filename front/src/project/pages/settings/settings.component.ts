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
    if (!this.user.avatar) {
      this.avatarUrl = 'assets/default-avatar.png';
      console.log('No avatar, using default:', this.avatarUrl);
      return;
    }

    // Проверяем различные варианты форматирования пути
    if (this.user.avatar.startsWith('http')) {
      this.avatarUrl = this.user.avatar;
    } else if (this.user.avatar.startsWith('/media/')) {
      this.avatarUrl = `${this.baseUrl}${this.user.avatar}`;
    } else if (this.user.avatar.startsWith('/')) {
      this.avatarUrl = `${this.baseUrl}/media${this.user.avatar}`;
    } else {
      this.avatarUrl = `${this.baseUrl}/media/${this.user.avatar}`;
    }
    
    console.log('Processed avatar URL:', this.avatarUrl);
    
    // Проверяем, что URL доступен
    this.checkImageExists(this.avatarUrl, (exists) => {
      if (!exists) {
        console.error('Avatar image does not exist at:', this.avatarUrl);
        this.avatarUrl = 'assets/default-avatar.png';
      }
    });
  }

  // Функция для проверки существования изображения
  checkImageExists(url: string, callback: (exists: boolean) => void): void {
    const img = new Image();
    img.onload = () => callback(true);
    img.onerror = () => callback(false);
    img.src = url;
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
    formData.append('is_online', String(this.user.is_online));

    // Если выбран новый файл аватарки, добавляем его в formData
    if (this.selectedAvatarFile) {
      formData.append('avatar', this.selectedAvatarFile);
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    console.log('Sending data to the backend:', {
      username: this.user.username,
      email: this.user.email, 
      bio: this.user.bio || '',
      is_online: String(this.user.is_online),
      avatar: this.selectedAvatarFile ? this.selectedAvatarFile.name : 'No new file'
    });

    // Используем PATCH вместо PUT
    this.http
      .patch<User>(`${this.apiUrl}/users/${this.user.id}/`, formData, {
        headers,
      })
      .subscribe({
        next: (updatedUser: User) => {
          console.log('Backend response:', updatedUser);
          this.successMessage = 'Profile updated successfully';
          this.user = updatedUser;
          this.processAvatarUrl(); // Обновляем URL аватарки
          this.selectedAvatarFile = null;
          this.avatarPreview = null;
          this.isLoading = false;
          
          // Принудительно перезагружаем профиль с небольшой задержкой
          setTimeout(() => this.loadUserProfile(), 500);
        },
        error: (err: any) => {
          this.errorMessage = 'Failed to update profile';
          console.error('Error updating profile:', err);
          this.isLoading = false;
        },
      });
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