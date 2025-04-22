import { Injectable } from '@angular/core';
import { Subject, Observable } from 'rxjs';
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

@Injectable({
  providedIn: 'root'
})
export class WebSocketService {
  private socket: Socket | null = null;
  private socketUrl = 'http://localhost:5000';
  
  private newMessageSubject = new Subject<ChatMessage>();
  private newChatSubject = new Subject<Chat>();
  private connectionStatusSubject = new Subject<boolean>();
  
  public newMessage$ = this.newMessageSubject.asObservable();
  public newChat$ = this.newChatSubject.asObservable();
  public connectionStatus$ = this.connectionStatusSubject.asObservable();

  constructor() {}

  connect(token: string): void {
    if (this.socket) {
      this.socket.disconnect();
    }

    this.socket = io(this.socketUrl, {
      transports: ['websocket'],
      auth: {
        token
      }
    });

    this.setupEventListeners();
    this.authenticate(token);
  }

  private authenticate(token: string): void {
    if (!this.socket) return;
    
    this.socket.emit('auth', { token });
  }

  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('WebSocket connected');
      this.connectionStatusSubject.next(true);
    });

    this.socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
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

    this.socket.on('error', (error) => {
      console.error('WebSocket error', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  sendMessage(token: string, chatId: number, text: string): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('message_create', {
      token,
      chat_id: chatId,
      text
    });
  }

  createChat(token: string, participants: number[], isGroup: boolean = false): void {
    if (!this.socket) {
      console.error('WebSocket not connected');
      return;
    }

    this.socket.emit('chat_create', {
      token,
      participants,
      is_group: isGroup
    });
  }
}