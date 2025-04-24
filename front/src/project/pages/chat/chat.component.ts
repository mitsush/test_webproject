import { Component, Inject, PLATFORM_ID, OnInit, OnDestroy } from '@angular/core';
import { HttpClientModule, HttpClient, HttpHeaders } from '@angular/common/http';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { isPlatformBrowser } from '@angular/common';
import { Subscription } from 'rxjs';
import { CreateChatComponent } from '../../components/create-chat/create-chat.component';
import { WebSocketService } from '../../services/websocket.service';
import { User } from '../../models/user.model';
import { UserService } from '../../services/user.service';

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
  userData: User | null = null;
  chats: Chat[] = [];
  selectedChat: Chat | null = null;
  messages: ChatMessage[] = [];
  newMessage: string = '';
  isSocketConnected = false;
  showCreateChatModal = false;
  
  // Track user online status
  onlineUserIds: Set<number> = new Set();
  
  // Cache user details
  userDetailsCache: Map<number, User> = new Map();
  
  private apiUrl = 'http://localhost:8000/api';
  private socketUrl = 'http://localhost:5000';
  private subscriptions: Subscription[] = [];

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    private router: Router,
    private http: HttpClient,
    private webSocketService: WebSocketService,
    private userService: UserService
  ) {}
  
  getParticipantAvatar(chat: Chat): string {
    if (!chat || chat.participants.length === 0) {
      return 'assets/default-avatar.png';
    }
    
    const otherParticipantId = this.getOtherParticipantId(chat);
    const cachedUser = this.userDetailsCache.get(otherParticipantId);
    
    if (cachedUser && cachedUser.avatar_url) {
      return cachedUser.avatar_url;
    }
    
    this.userService.getAvatarUrl(otherParticipantId).subscribe(url => {
      if (this.userDetailsCache.has(otherParticipantId)) {
        const user = this.userDetailsCache.get(otherParticipantId);
        if (user) {
          user.avatar_url = url;
          this.userDetailsCache.set(otherParticipantId, user);
        }
      }
    });
    
    return 'assets/default-avatar.png';
  }

  ngOnInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      const token = localStorage.getItem('access_token');
      if (!token) {
        this.router.navigate(['/login']);
        return;
      }
      
      // Connect to WebSocket
      this.connectToSocket();
      this.setupWebSocketListeners();
      
      this.loadChats();
      this.loadUserData();
    }
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.webSocketService.disconnect();
  }

  connectToSocket(): void {
    const token = localStorage.getItem('access_token');
    if (token) {
      this.webSocketService.connect(token);
      
      // Subscribe to connection status
      const statusSub = this.webSocketService.connectionStatus$.subscribe(
        (isConnected) => {
          this.isSocketConnected = isConnected;
          console.log('WebSocket connection status:', isConnected);
        }
      );
      this.subscriptions.push(statusSub);
    }
  }
  
  setupWebSocketListeners(): void {
    // Listen for new messages
    const messageSub = this.webSocketService.newMessage$.subscribe(
      (message) => {
        console.log('New message received from WebSocket:', message);
        
        // Add message to current chat if it matches
        if (this.selectedChat && message.chat === this.selectedChat.id) {
          this.messages.push(message);
        }
        
        // Update last message in chat list
        const chatIndex = this.chats.findIndex(c => c.id === message.chat);
        if (chatIndex !== -1) {
          this.chats[chatIndex].last_message = message;
          
          // Move chat to top of list
          const chat = this.chats[chatIndex];
          this.chats.splice(chatIndex, 1);
          this.chats.unshift(chat);
        }
      }
    );
    
    // Listen for new chats
    const chatSub = this.webSocketService.newChat$.subscribe(
      (chat) => {
        console.log('New chat created from WebSocket:', chat);
        
        // Check if chat already exists
        const existingIndex = this.chats.findIndex(c => c.id === chat.id);
        if (existingIndex === -1) {
          this.chats.unshift(chat);
          
          // Request online status of participants
          this.requestOnlineStatus(chat.participants);
        }
      }
    );
    
    // Listen for user status changes
    const userStatusSub = this.webSocketService.userStatus$.subscribe(
      (status) => {
        console.log('User status changed:', status);
        
        if (status.isOnline) {
          this.onlineUserIds.add(status.userId);
        } else {
          this.onlineUserIds.delete(status.userId);
        }
      }
    );
    
    this.subscriptions.push(messageSub, chatSub, userStatusSub);
  }

  loadUserData(): void {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });

    this.http.get<User>(`${this.apiUrl}/users/me/`, { headers })
      .subscribe({
        next: (user) => {
          this.userData = user;
          console.log('User data loaded:', user);
          
          // Add current user to cache
          this.userDetailsCache.set(user.id, user);
        },
        error: (error) => {
          console.error('Error loading user data:', error);
        }
      });
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
          
          // Load user details for all chat participants
          const userIds = new Set<number>();
          chats.forEach(chat => {
            chat.participants.forEach(userId => userIds.add(userId));
          });
          
          // Request online status of all participants
          this.requestOnlineStatus(Array.from(userIds));
        },
        error: (error) => {
          console.error('Error loading chats:', error);
        }
      });
  }

  requestOnlineStatus(userIds: number[]): void {
    if (!userIds.length || !this.isSocketConnected) return;
    
    const token = localStorage.getItem('access_token');
    if (token) {
      this.webSocketService.getOnlineStatus(token, userIds);
    }
  }

  selectChat(chat: Chat): void {
    this.selectedChat = chat;
    this.loadMessages(chat.id);
    
    // Load user details for participants if not already cached
    this.loadChatParticipantsDetails(chat);
  }

  loadChatParticipantsDetails(chat: Chat): void {
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
    
    // Find participants that aren't cached yet
    const uncachedUserIds = chat.participants.filter(
      userId => !this.userDetailsCache.has(userId)
    );
    
    // Load each uncached user's details
    uncachedUserIds.forEach(userId => {
      this.http.get<User>(`${this.apiUrl}/users/${userId}/`, { headers })
        .subscribe({
          next: (user) => {
            this.userDetailsCache.set(userId, user);
          },
          error: (error) => {
            console.error(`Error loading user ${userId} details:`, error);
          }
        });
    });
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
    
    if (this.isSocketConnected) {
      // Send via WebSocket if connected
      this.webSocketService.sendMessage(token!, this.selectedChat.id, this.newMessage.trim());
      // Clear input right away for better UX
      this.newMessage = '';
    } else {
      // Fallback to HTTP
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
            console.log('Message sent via HTTP:', message);
          },
          error: (error) => {
            console.error('Error sending message:', error);
          }
        });
    }
  }

  createNewChat(): void {
    this.showCreateChatModal = true;
  }
  
  onChatCreated(chatData: { participants: number[], name: string, isGroup: boolean }): void {
    console.log('Chat creation data received:', chatData);
    this.showCreateChatModal = false;
    
    if (!chatData.participants || chatData.participants.length === 0) {
      console.error('No participants selected for the chat');
      return;
    }
  
    // Try HTTP method first for reliability
    const token = localStorage.getItem('access_token');
    const headers = new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  
    const chatPayload = {
      participants: chatData.participants,
      name: chatData.name || '',
      is_group: chatData.isGroup
    };
    
    console.log('Sending chat creation request with payload:', chatPayload);
    
    this.http.post<Chat>(`${this.apiUrl}/chats/`, chatPayload, { headers })
      .subscribe({
        next: (chat) => {
          console.log('Chat created successfully:', chat);
          this.chats.unshift(chat);
          this.selectChat(chat);
        },
        error: (error) => {
          console.error('Error creating chat:', error);
          alert('Failed to create chat. Please try again.');
          
          // If HTTP fails, try WebSocket as fallback (if connected)
          if (this.isSocketConnected) {
            console.log('Trying WebSocket fallback for chat creation');
            this.webSocketService.createChat(token!, chatData.participants, chatData.isGroup, chatData.name);
          }
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
    return this.chats.filter(chat => {
      // Search by name if available
      if (chat.name && chat.name.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      // If no name, search by participant usernames
      for (const userId of chat.participants) {
        const user = this.userDetailsCache.get(userId);
        if (user && user.username.toLowerCase().includes(searchTerm)) {
          return true;
        }
      }
      
      // Search by last message text
      if (chat.last_message && chat.last_message.text.toLowerCase().includes(searchTerm)) {
        return true;
      }
      
      return false;
    });
  }
  
  getInitials(name: string): string {
    if (name) {
      const words = name.split(' ');
      if (words.length === 1) {
        return name.substring(0, 2).toUpperCase();
      }
      return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
    }
    
    // If no name, try to get from other participant
    if (this.selectedChat && !this.selectedChat.is_group) {
      const otherParticipantId = this.getOtherParticipantId(this.selectedChat);
      const otherUser = this.userDetailsCache.get(otherParticipantId);
      if (otherUser) {
        return otherUser.username.substring(0, 2).toUpperCase();
      }
    }
    
    return 'ЧТ'; // Default
  }
  
  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  isCurrentUserMessage(senderId: number): boolean {
    const userId = localStorage.getItem('user_id');
    return userId ? parseInt(userId) === senderId : false;
  }
  
  isChatParticipantOnline(chat: Chat): boolean {
    if (chat.is_group) return false;
    
    const otherParticipantId = this.getOtherParticipantId(chat);
    return this.onlineUserIds.has(otherParticipantId);
  }
  
  getOtherParticipantId(chat: Chat): number {
    const currentUserId = Number(localStorage.getItem('user_id'));
    return chat.participants.find(id => id !== currentUserId) || 0;
  }
  
  getChatNameFromParticipants(chat: Chat): string {
    if (chat.name) return chat.name;
    if (chat.is_group) return 'Group Chat';
    
    const otherParticipantId = this.getOtherParticipantId(chat);
    const otherUser = this.userDetailsCache.get(otherParticipantId);
    
    if (otherUser) {
      return otherUser.username;
    }
    
    return 'Chat';
  }
}