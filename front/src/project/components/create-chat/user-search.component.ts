import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { User } from '../../models/user.model';

@Component({
  selector: 'app-user-search',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="search-container">
      <div class="search-input-group">
        <input 
          type="text" 
          [(ngModel)]="searchTerm" 
          placeholder="Search users by username or email" 
          class="search-input"
        />
        <button class="search-button" (click)="searchUsers()">Search</button>
      </div>
      
      <div class="search-results" *ngIf="hasSearched">
        <div class="loading-spinner" *ngIf="isLoading">
          <div class="spinner"></div>
          <p>Searching...</p>
        </div>
        
        <div class="no-results" *ngIf="!isLoading && searchResults.length === 0">
          <p>No users found matching "{{ searchTerm }}"</p>
        </div>
        
        <div class="user-list" *ngIf="!isLoading && searchResults.length > 0">
          <div 
            *ngFor="let user of searchResults" 
            class="user-item"
            [class.selected]="isSelected(user.id)"
            (click)="toggleUserSelection(user.id)"
          >
            <div class="user-avatar">
              {{ getUserInitials(user.username) }}
            </div>
            <div class="user-info">
              <div class="user-name">{{ user.username }}</div>
              <div class="user-email">{{ user.email }}</div>
            </div>
            <div class="status-indicator" [class.online]="user.is_online"></div>
            <div class="selection-indicator">
              <i class="checkmark" *ngIf="isSelected(user.id)">✓</i>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .search-container {
      width: 100%;
      margin-bottom: 20px;
    }
    
    .search-input-group {
      display: flex;
      margin-bottom: 10px;
    }
    
    .search-input {
      flex: 1;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px 0 0 4px;
      font-size: 16px;
    }
    
    .search-button {
      padding: 10px 15px;
      background-color: #4a79f7;
      color: white;
      border: none;
      border-radius: 0 4px 4px 0;
      cursor: pointer;
    }
    
    .search-button:hover {
      background-color: #3a69e7;
    }
    
    .search-results {
      background-color: white;
      border: 1px solid #ddd;
      border-radius: 4px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .loading-spinner {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 20px;
    }
    
    .spinner {
      width: 30px;
      height: 30px;
      border: 3px solid #f3f3f3;
      border-top: 3px solid #4a79f7;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin-bottom: 10px;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    .no-results {
      padding: 20px;
      text-align: center;
      color: #666;
    }
    
    .user-list {
      display: flex;
      flex-direction: column;
    }
    
    .user-item {
      display: flex;
      align-items: center;
      padding: 10px 15px;
      border-bottom: 1px solid #eee;
      cursor: pointer;
      transition: background-color 0.2s;
    }
    
    .user-item:hover {
      background-color: #f9f9f9;
    }
    
    .user-item.selected {
      background-color: #e6f0ff;
    }
    
    .user-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background-color: #4a79f7;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      font-weight: bold;
      margin-right: 10px;
    }
    
    .user-info {
      flex: 1;
    }
    
    .user-name {
      font-weight: 500;
    }
    
    .user-email {
      font-size: 12px;
      color: #666;
    }
    
    .status-indicator {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: #ccc;
      margin-right: 10px;
    }
    
    .status-indicator.online {
      background-color: #4caf50;
    }
    
    .selection-indicator {
      width: 20px;
      height: 20px;
      display: flex;
      justify-content: center;
      align-items: center;
    }
    
    .checkmark {
      color: #4a79f7;
      font-weight: bold;
    }
  `]
})
export class UserSearchComponent implements OnInit {
  @Output() userSelected = new EventEmitter<number[]>();
  
  searchTerm: string = '';
  searchResults: User[] = [];
  selectedUserIds: number[] = [];
  isLoading: boolean = false;
  hasSearched: boolean = false;
  
  private apiUrl = 'http://localhost:8000/api';
  
  constructor(private http: HttpClient) {}
  
  ngOnInit(): void {}
  
  searchUsers(): void {
    if (!this.searchTerm.trim()) {
      return;
    }
    
    this.isLoading = true;
    this.hasSearched = true;
    
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    // Assuming your API supports searching users with a query parameter
    this.http.get<User[]>(`${this.apiUrl}/users/?search=${this.searchTerm}`, { headers })
      .subscribe({
        next: (users) => {
          // Filter out the current user
          const currentUserId = Number(localStorage.getItem('user_id'));
          this.searchResults = users.filter(user => user.id !== currentUserId);
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error searching users:', error);
          this.searchResults = [];
          this.isLoading = false;
        }
      });
  }
  
  toggleUserSelection(userId: number): void {
    const index = this.selectedUserIds.indexOf(userId);
    if (index === -1) {
      this.selectedUserIds.push(userId);
    } else {
      this.selectedUserIds.splice(index, 1);
    }
    
    this.userSelected.emit(this.selectedUserIds);
  }
  
  isSelected(userId: number): boolean {
    return this.selectedUserIds.includes(userId);
  }
  
  getUserInitials(username: string): string {
    if (!username) return '';
    return username.substring(0, 2).toUpperCase();
  }
  
  clearSelection(): void {
    this.selectedUserIds = [];
    this.userSelected.emit(this.selectedUserIds);
  }
}