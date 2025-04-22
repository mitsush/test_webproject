import { Component, Inject, PLATFORM_ID, OnInit, OnDestroy } from '@angular/core';
import { HttpClientModule, HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { CreateChatComponent } from '../../components/create-chat/create-chat.component';

interface ChatMessage {
  id: number;
  sender: number;
  chat: number;
  text: string;
  image?: string;
  sent_at: string;
  is_read: boolean;
  sender_username?: string;
}

interface Chat {
  id: number;
  name: string;
  participants: number[];
  is_group: boolean;
  created_at: string;
  last_message?: ChatMessage;
}

@Component({
  selector: 'app-chat',
  imports: [HttpClientModule, FormsModule, RouterModule, CommonModule, CreateChatComponent],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.css',
  standalone: true,
})
export class ChatComponent implements OnInit, OnDestroy {
  searchChat: string = '';
  isSidebarOpen = false;
  userData: any = null;
  chats: Chat[] = [];
  selectedChat: Chat | null = null;
  messages: ChatMessage[] = [];
  newMessage: string = '';
  isSocketConnected = false;
  showCreateChatModal = false;
  
  private apiUrl = 'http://localhost:8000/api';
  private subscriptions: Subscription[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }
      
      this.loadChats();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  loadChats(): void {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<Chat[]>(`${this.apiUrl}/chats/`, { headers })
      .subscribe({
        next: (chats) => {
          this.chats = chats;
          console.log('Chats loaded:', chats);
        },
        error: (error) => {
          console.error('Error loading chats:', error);
        }
      });
  }

  selectChat(chat: Chat): void {
    this.selectedChat = chat;
    this.loadMessages(chat.id);
  }

  loadMessages(chatId: number): void {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<ChatMessage[]>(`${this.apiUrl}/messages/?chat=${chatId}`, { headers })
      .subscribe({
        next: (messages) => {
          this.messages = messages;
          console.log('Messages loaded:', messages);
        },
        error: (error) => {
          console.error('Error loading messages:', error);
        }
      });
  }

  sendMessage(): void {
    if (!this.newMessage.trim() || !this.selectedChat) {
      return;
    }
    
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    const messageData = {
      chat: this.selectedChat.id,
      text: this.newMessage.trim()
    };
    
    this.http.post<ChatMessage>(`${this.apiUrl}/messages/`, messageData, { headers })
      .subscribe({
        next: (message) => {
          this.messages.push(message);
          this.newMessage = '';
          console.log('Message sent:', message);
        },
        error: (error) => {
          console.error('Error sending message:', error);
        }
      });
  }

  createNewChat(): void {
    this.showCreateChatModal = true;
  }
  
  onChatCreated(chatData: { participants: number[], name: string, isGroup: boolean }): void {
    this.showCreateChatModal = false;
    
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    const chatPayload = {
      participants: chatData.participants,
      name: chatData.name,
      is_group: chatData.isGroup
    };
    
    this.http.post<Chat>(`${this.apiUrl}/chats/`, chatPayload, { headers })
      .subscribe({
        next: (chat) => {
          this.chats.unshift(chat);
          this.selectChat(chat);
        },
        error: (error) => {
          console.error('Error creating chat:', error);
        }
      });
  }
  
  hideCreateChatModal(): void {
    this.showCreateChatModal = false;
  }

  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  filteredChats(): Chat[] {
    if (!this.searchChat.trim()) {
      return this.chats;
    }
    
    const searchTerm = this.searchChat.toLowerCase();
    return this.chats.filter(chat => 
      chat.name.toLowerCase().includes(searchTerm)
    );
  }
  
  getInitials(name: string): string {
    if (!name) return 'ЧТ'; // Default for "Chat"
    
    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, 2).toUpperCase();
    }
    
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }
  
  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  isCurrentUserMessage(senderId: number): boolean {
    const userId = localStorage.getItem('user_id');
    return userId ? parseInt(userId) === senderId : false;
  }
}