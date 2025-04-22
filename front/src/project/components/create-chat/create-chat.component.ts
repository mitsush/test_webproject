import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';

interface User {
  id: number;
  username: string;
  email: string;
  bio?: string;
  avatar?: string;
  is_online: boolean;
}

@Component({
  selector: 'app-create-chat',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-backdrop" (click)="close()"></div>
    <div class="modal-container" (click)="$event.stopPropagation()">
      <div class="modal-header">
        <h3>Create New Chat</h3>
        <button class="close-btn" (click)="close()">×</button>
      </div>
      
      <div class="modal-body">
        <div class="form-group">
          <label>Chat Name (optional for group chats)</label>
          <input type="text" [(ngModel)]="chatName" class="form-input" placeholder="Group chat name">
        </div>
        
        <div class="form-group">
          <label>Is Group Chat</label>
          <input type="checkbox" [(ngModel)]="isGroupChat">
        </div>
        
        <div class="search-group">
          <input type="text" [(ngModel)]="searchTerm" (input)="filterUsers()" 
                 placeholder="Search users..." class="form-input">
        </div>
        
        <div class="users-list">
          <div *ngFor="let user of filteredUsers" class="user-item">
            <label class="user-checkbox">
              <input type="checkbox" 
                     [checked]="isSelected(user.id)"
                     (change)="toggleUserSelection(user.id)">
              <div class="user-info">
                <div class="user-avatar">
                  {{ user.username.substring(0, 2).toUpperCase() }}
                </div>
                <div class="user-details">
                  <span class="username">{{ user.username }}</span>
                  <span class="email">{{ user.email }}</span>
                </div>
                <div class="status-dot" [class.online]="user.is_online"></div>
              </div>
            </label>
          </div>
          
          <div *ngIf="filteredUsers.length === 0 && !isLoading" class="no-users">
            No users found
          </div>
          
          <div *ngIf="isLoading" class="loading">
            Loading users...
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-btn" (click)="close()">Cancel</button>
        <button class="create-btn" 
                [disabled]="selectedUserIds.length === 0"
                (click)="createChat()">
          Create Chat
        </button>
      </div>
    </div>
  `,
  styles: [`
    .modal-backdrop {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 1000;
    }
    
    .modal-container {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background-color: white;
      border-radius: 8px;
      width: 90%;
      max-width: 500px;
      z-index: 1001;
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
      display: flex;
      flex-direction: column;
      max-height: 90vh;
    }
    
    .modal-header {
      padding: 15px 20px;
      border-bottom: 1px solid #eee;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    
    .modal-header h3 {
      margin: 0;
      font-size: 20px;
    }
    
    .close-btn {
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: #666;
    }
    
    .modal-body {
      padding: 20px;
      overflow-y: auto;
      max-height: calc(90vh - 130px);
    }
    
    .modal-footer {
      padding: 15px 20px;
      border-top: 1px solid #eee;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
    }
    
    .form-group {
      margin-bottom: 15px;
    }
    
    .form-group label {
      display: block;
      margin-bottom: 5px;
      font-weight: 500;
    }
    
    .form-input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 16px;
    }
    
    .search-group {
      margin-bottom: 15px;
    }
    
    .users-list {
      margin-top: 15px;
      max-height: 300px;
      overflow-y: auto;
    }
    
    .user-item {
      margin-bottom: 10px;
    }
    
    .user-checkbox {
      display: flex;
      align-items: center;
      cursor: pointer;
    }
    
    .user-checkbox input {
      margin-right: 10px;
    }
    
    .user-info {
      display: flex;
      align-items: center;
      padding: 10px;
      border: 1px solid #eee;
      border-radius: 4px;
      width: 100%;
    }
    
    .user-avatar {
      width: 40px;
      height: 40px;
      background-color: #4a79f7;
      color: white;
      border-radius: 50%;
      display: flex;
      justify-content: center;
      align-items: center;
      margin-right: 10px;
      font-weight: bold;
    }
    
    .user-details {
      flex: 1;
    }
    
    .username {
      font-weight: 500;
      display: block;
    }
    
    .email {
      font-size: 14px;
      color: #666;
    }
    
    .status-dot {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: #ccc;
      margin-left: 10px;
    }
    
    .status-dot.online {
      background-color: #4caf50;
    }
    
    .no-users, .loading {
      text-align: center;
      color: #666;
      padding: 20px;
    }
    
    .cancel-btn, .create-btn {
      padding: 10px 20px;
      border-radius: 4px;
      font-size: 16px;
      cursor: pointer;
    }
    
    .cancel-btn {
      background-color: #f1f1f1;
      border: 1px solid #ddd;
      color: #333;
    }
    
    .create-btn {
      background-color: #4a79f7;
      border: none;
      color: white;
    }
    
    .create-btn:disabled {
      background-color: #b3c6f7;
      cursor: not-allowed;
    }
  `]
})
export class CreateChatComponent implements OnInit {
  @Output() chatCreated = new EventEmitter<{
    participants: number[],
    name: string,
    isGroup: boolean
  }>();
  
  @Output() cancelled = new EventEmitter<void>();
  
  users: User[] = [];
  filteredUsers: User[] = [];
  selectedUserIds: number[] = [];
  chatName: string = '';
  isGroupChat: boolean = false;
  searchTerm: string = '';
  isLoading: boolean = false;
  
  private apiUrl = 'http://localhost:8000/api';
  
  constructor(private http: HttpClient) {}
  
  ngOnInit(): void {
    this.loadUsers();
  }
  
  loadUsers(): void {
    this.isLoading = true;
    
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    this.http.get<User[]>(`${this.apiUrl}/users/`, { headers })
      .subscribe({
        next: (users) => {
          // Filter out the current user
          const currentUserId = localStorage.getItem('user_id');
          this.users = users.filter(user => user.id !== Number(currentUserId));
          this.filteredUsers = [...this.users];
          this.isLoading = false;
        },
        error: (error) => {
          console.error('Error loading users', error);
          this.isLoading = false;
        }
      });
  }
  
  filterUsers(): void {
    if (!this.searchTerm.trim()) {
      this.filteredUsers = [...this.users];
      return;
    }
    
    const term = this.searchTerm.toLowerCase();
    this.filteredUsers = this.users.filter(user => 
      user.username.toLowerCase().includes(term) || 
      user.email.toLowerCase().includes(term)
    );
  }
  
  toggleUserSelection(userId: number): void {
    const index = this.selectedUserIds.indexOf(userId);
    if (index === -1) {
      this.selectedUserIds.push(userId);
    } else {
      this.selectedUserIds.splice(index, 1);
    }
  }
  
  isSelected(userId: number): boolean {
    return this.selectedUserIds.includes(userId);
  }
  
  createChat(): void {
    if (this.selectedUserIds.length === 0) {
      return;
    }
    
    this.chatCreated.emit({
      participants: this.selectedUserIds,
      name: this.chatName,
      isGroup: this.isGroupChat
    });
  }
  
  close(): void {
    this.cancelled.emit();
  }
}