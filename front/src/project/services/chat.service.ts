import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { WebSocketService, Chat, ChatMessage } from './websocket.service';

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private apiUrl = 'http://localhost:8000/api';

  constructor(
    private http: HttpClient,
    private webSocketService: WebSocketService
  ) {}

  getHeaders(): HttpHeaders {
    const token = localStorage.getItem('access_token');
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getChats(): Observable<Chat[]> {
    return this.http.get<Chat[]>(`${this.apiUrl}/chats/`, {
      headers: this.getHeaders()
    });
  }

  getChat(id: number): Observable<Chat> {
    return this.http.get<Chat>(`${this.apiUrl}/chats/${id}/`, {
      headers: this.getHeaders()
    });
  }

  getMessages(chatId: number): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(`${this.apiUrl}/messages/?chat=${chatId}`, {
      headers: this.getHeaders()
    });
  }

  createChatViaHttp(participants: number[], name: string = '', isGroup: boolean = false): Observable<Chat> {
    return this.http.post<Chat>(`${this.apiUrl}/chats/`, {
      name,
      participants,
      is_group: isGroup
    }, {
      headers: this.getHeaders()
    });
  }

  sendMessageViaHttp(chatId: number, text: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(`${this.apiUrl}/messages/`, {
      chat: chatId,
      text
    }, {
      headers: this.getHeaders()
    });
  }

  connectToWebSocket(): void {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.webSocketService.connect(token);
    }
  }

  disconnectWebSocket(): void {
    this.webSocketService.disconnect();
  }

  sendMessageViaWebSocket(chatId: number, text: string): void {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.webSocketService.sendMessage(token, chatId, text);
    }
  }

  createChatViaWebSocket(participants: number[], isGroup: boolean = false): void {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.webSocketService.createChat(token, participants, isGroup);
    }
  }

  onNewMessage(): Observable<ChatMessage> {
    return this.webSocketService.newMessage$;
  }

  onNewChat(): Observable<Chat> {
    return this.webSocketService.newChat$;
  }

  onConnectionStatus(): Observable<boolean> {
    return this.webSocketService.connectionStatus$;
  }
}