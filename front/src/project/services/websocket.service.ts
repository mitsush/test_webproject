import { Injectable } from '@angular/core';
import { Subject, Observable, interval } from 'rxjs';
import { takeWhile } from 'rxjs/operators';
import { io, Socket } from 'socket.io-client';

export interface ChatMessage {
  id: number;
  sender: number;
  chat: number;
  text: string;
  image?: string;
  sent_at: string;
  is_read: boolean;
  sender_username?: string;
}

export interface Chat {
  id: number;
  name: string;
  participants: number[];
  is_group: boolean;
  created_at: string;
  last_message?: ChatMessage;
}

export interface UserStatus {
  [userId: number]: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: Socket | null = null;
  private socketUrl = 'http://localhost:5000';
  private connected = false;
  
  private newMessageSubject = new Subject<ChatMessage>();
  private newChatSubject = new Subject<Chat>();
  private connectionStatusSubject = new Subject<boolean>();
  private userStatusSubject = new Subject<{userId: number, isOnline: boolean}>();
  private searchResultsSubject = new Subject<any[]>();
  
  public newMessage$ = this.newMessageSubject.asObservable();
  public newChat$ = this.newChatSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();
  public userStatus$ = this.userStatusSubject.asObservable();
  public searchResults$ = this.searchResultsSubject.asObservable();

  constructor() {}

  connect(token: string): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    try {
      this.socket = io(this.socketUrl, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000
      });

      this.setupEventListeners();
      this.authenticate(token);
      
      this.startHeartbeat(token);
    } catch (error) {
      console.error('Failed to connect to WebSocket server:', error);
      this.connectionStatusSubject.next(false);
    }
  }

  private authenticate(token: string): void {
    if (!this.socket) return;
    
    this.socket.emit('auth', { token });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connected = true;
      this.connectionStatusSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      this.connected = false;
      this.connectionStatusSubject.next(false);
    });

    this.socket.on('auth_success', (data) => {
      console.log('Authentication successful', data);
    });

    this.socket.on('auth_error', (error) => {
      console.error('Authentication failed', error);
    });

    this.socket.on('message:created', (message: ChatMessage) => {
      console.log('New message received', message);
      this.newMessageSubject.next(message);
    });

    this.socket.on('chat:created', (chat: Chat) => {
      console.log('New chat created', chat);
      this.newChatSubject.next(chat);
    });

    this.socket.on('user_status_changed', (data: {user_id: number, is_online: boolean}) => {
      console.log('User status changed', data);
      this.userStatusSubject.next({
        userId: data.user_id,
        isOnline: data.is_online
      });
    });

    this.socket.on('search_results', (data: {users: any[]}) => {
      console.log('Search results received', data);
      this.searchResultsSubject.next(data.users);
    });

    this.socket.on('online_users', (statusMap: UserStatus) => {
      console.log('Online users status received', statusMap);
      Object.entries(statusMap).forEach(([userId, isOnline]) => {
        this.userStatusSubject.next({
          userId: Number(userId),
          isOnline: isOnline
        });
      });
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error', error);
    });
  }

  private startHeartbeat(token: string): void {
    interval(30000)
      .pipe(takeWhile(() => this.connected))
      .subscribe(() => {
        if (this.socket && this.connected) {
          this.socket.emit('heartbeat', { token });
        }
      });
  }

  disconnect(): void {
    this.connected = false;
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(token: string, chatId: number, text: string): void {
    if (!this.socket || !this.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('message_create', {
      token,
      chat_id: chatId,
      text
    });
  }

  createChat(token: string, participants: number[], isGroup: boolean = false, name: string = ''): void {
    if (!this.socket || !this.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('chat_create', {
      token,
      participants,
      is_group: isGroup,
      name
    });
  }

  searchUsers(token: string, searchTerm: string): void {
    if (!this.socket || !this.connected) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('search_users', {
      token,
      search: searchTerm
    });
  }

  getOnlineStatus(token: string, userIds: number[]): void {
    if (!this.socket || !this.connected || !userIds.length) {
      return;
    }

    this.socket.emit('get_online_users', {
      token,
      user_ids: userIds
    });
  }

  isConnected(): boolean {
    return this.connected;
  }
}