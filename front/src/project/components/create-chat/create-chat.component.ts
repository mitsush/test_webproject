import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { UserSearchComponent } from './user-search.component';

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
  imports: [CommonModule, FormsModule, UserSearchComponent],
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
        
        <app-user-search (userSelected)="onUserSelected($event)"></app-user-search>
        
        <div class="selected-users" *ngIf="selectedUsers.length > 0">
          <h4>Selected Users ({{ selectedUsers.length }})</h4>
          <div class="selected-user-list">
            <div *ngFor="let user of selectedUsers" class="selected-user-item">
              <div class="user-avatar">{{ getUserInitials(user.username) }}</div>
              <div class="user-name">{{ user.username }}</div>
              <button class="remove-user-btn" (click)="removeUser(user.id)">×</button>
            </div>
          </div>
        </div>
      </div>
      
      <div class="modal-footer">
        <button class="cancel-btn" (click)="close()">Cancel</button>
        <button class="create-btn" 
                [disabled]="selectedUsers.length === 0"
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
    
    .selected-users {
      margin-top: 20px;
    }
    
    .selected-users h4 {
      margin-bottom: 10px;
      font-size: 16px;
      color: #333;
    }
    
    .selected-user-list {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .selected-user-item {
      display: flex;
      align-items: center;
      background-color: #f0f7ff;
      border-radius: 20px;
      padding: 5px 10px;
    }
    
    .user-avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background-color: #4a79f7;
      color: white;
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 12px;
      margin-right: 5px;
    }
    
    .user-name {
      font-size: 14px;
      margin-right: 5px;
    }
    
    .remove-user-btn {
      background: none;
      border: none;
      color: #999;
      font-size: 16px;
      cursor: pointer;
    }
    
    .remove-user-btn:hover {
      color: #f44336;
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
  
  chatName: string = '';
  isGroupChat: boolean = false;
  selectedUserIds: number[] = [];
  selectedUsers: User[] = [];
  
  private apiUrl = 'http://localhost:8000/api';
  
  constructor(private http: HttpClient) {}
  
  ngOnInit(): void {}
  
  onUserSelected(userIds: number[]): void {
    this.selectedUserIds = userIds;
    this.loadSelectedUsersDetails();
  }
  
  loadSelectedUsersDetails(): void {
    if (this.selectedUserIds.length === 0) {
      this.selectedUsers = [];
      return;
    }
    
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    // Fetch details for each selected user
    // In a real app, you might want to implement a more efficient endpoint 
    // to get multiple users at once
    const userRequests = this.selectedUserIds.map(id => 
      this.http.get<User>(`${this.apiUrl}/users/${id}/`, { headers })
    );
    
    // Handle each request separately to avoid failing if one user fetch fails
    this.selectedUsers = [];
    userRequests.forEach(request => {
      request.subscribe({
        next: (user) => {
          if (!this.selectedUsers.some(u => u.id === user.id)) {
            this.selectedUsers.push(user);
          }
        },
        error: (error) => {
          console.error('Error fetching user details:', error);
        }
      });
    });
  }
  
  removeUser(userId: number): void {
    const index = this.selectedUserIds.indexOf(userId);
    if (index !== -1) {
      this.selectedUserIds.splice(index, 1);
      this.selectedUsers = this.selectedUsers.filter(user => user.id !== userId);
    }
  }
  
  getUserInitials(username: string): string {
    if (!username) return '';
    return username.substring(0, 2).toUpperCase();
  }
  
  createChat(): void {
    if (this.selectedUserIds.length === 0) {
      console.error('No users selected');
      alert('Please select at least one user to chat with');
      return;
    }
    
    console.log('Creating chat with:', {
      participants: this.selectedUserIds,
      name: this.chatName,
      isGroup: this.isGroupChat
    });
    
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