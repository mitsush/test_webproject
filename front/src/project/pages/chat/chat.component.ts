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
  participants_details?: any[]; // Will contain avatar_url and other data
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
  // Cache avatar URLs
  avatarUrlCache: Map<number, string> = new Map();
  
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
  
  // Add this method to get the ID of the other participant in a chat
getOtherParticipantId(chat: Chat): number {
  const currentUserId = Number(localStorage.getItem('user_id'));
  return chat.participants.find(id => id !== currentUserId) || 0;
}

// Add this method to load messages for a chat
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
      // Store in the avatar cache
      this.avatarUrlCache.set(otherParticipantId, url);
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
          
          // Cache avatar URL
          if (user.avatar_url) {
            this.avatarUrlCache.set(user.id, user.avatar_url);
          }
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
          
          // Process participants details if available
          chats.forEach(chat => {
            if (chat.participants_details) {
              chat.participants_details.forEach(participant => {
                if (participant.id && participant.avatar_url) {
                  this.avatarUrlCache.set(participant.id, participant.avatar_url);
                }
              });
            }
          });
          
          // Load user details for all chat participants
          const userIds = new Set<number>();
          chats.forEach(chat => {
            chat.participants.forEach(userId => userIds.add(userId));
          });
          
          // Request online status of all participants
          this.requestOnlineStatus(Array.from(userIds));
          
          // Preload avatars for all participants
          this.preloadParticipantAvatars(Array.from(userIds));
        },
        error: (error) => {
          console.error('Error loading chats:', error);
        }
      });
  }
  
  // New method to preload all participant avatars
  preloadParticipantAvatars(userIds: number[]): void {
    userIds.forEach(userId => {
      if (!this.avatarUrlCache.has(userId)) {
        this.userService.getAvatarUrl(userId).subscribe(url => {
          this.avatarUrlCache.set(userId, url);
        });
      }
    });
  }

  // Add all these methods to your ChatComponent class

  // Navigation methods
  toggleSidebar(): void {
    this.isSidebarOpen = !this.isSidebarOpen;
  }

  createNewChat(): void {
    this.showCreateChatModal = true;
  }

  hideCreateChatModal(): void {
    this.showCreateChatModal = false;
  }

  // Chat display methods
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

  // Chat avatar and user methods
  getInitials(name: string): string {
    if (!name) return 'CH';
    
    const words = name.split(' ');
    if (words.length === 1) {
      return name.substring(0, 2).toUpperCase();
    }
    return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase();
  }

  isChatParticipantOnline(chat: Chat): boolean {
    if (!chat || chat.is_group) return false;
    
    const otherParticipantId = this.getOtherParticipantId(chat);
    return this.onlineUserIds.has(otherParticipantId);
  }

  isCurrentUserMessage(senderId: number): boolean {
    const userId = localStorage.getItem('user_id');
    return userId ? parseInt(userId) === senderId : false;
  }

  formatTime(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  // Message methods
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

  // Add these methods to your ChatComponent class

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

  getChatAvatar(chat: Chat): string | null {
    if (!chat) return null;
    
    if (chat.is_group) {
      return null;
    } else {
      const otherParticipantId = this.getOtherParticipantId(chat);
      
      if (this.avatarUrlCache.has(otherParticipantId)) {
        const url = this.avatarUrlCache.get(otherParticipantId);
        // If it's a server URL, you could potentially add size parameters
        return url || null;
      }
      
      this.userService.getAvatarUrl(otherParticipantId).subscribe(url => {
        if (url && url !== 'assets/default-avatar.png') {
          this.avatarUrlCache.set(otherParticipantId, url);
        }
      });
      
      return null;
    }
  }
  
  // Handle avatar loading errors
  onAvatarError(event: any, chat: Chat): void {
    event.target.style.display = 'none';
    
    // If avatar fails to load, remove from cache
    if (!chat.is_group) {
      const otherParticipantId = this.getOtherParticipantId(chat);
      this.avatarUrlCache.delete(otherParticipantId);
    }
  }

  // Chat creation handling
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
            
            // If user has an avatar_url, cache it
            if (user.avatar_url) {
              this.avatarUrlCache.set(userId, user.avatar_url);
            } 
            // Otherwise fetch it using the service
            else if (user.avatar) {
              this.userService.getAvatarUrl(userId).subscribe(url => {
                this.avatarUrlCache.set(userId, url);
              });
            }
          },
          error: (error) => {
            console.error(`Error loading user ${userId} details:`, error);
          }
        });
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
}