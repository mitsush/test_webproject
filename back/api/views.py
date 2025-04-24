from rest_framework import viewsets, generics, permissions, status, filters
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from django.contrib.auth import get_user_model
from django.db.models import Q
from django.core.exceptions import PermissionDenied

from .models import Chat, Message, Image
from .serializers import (
    RegisterSerializer, UserSerializer,
    ChatSerializer, MessageSerializer, ImageSerializer
)

User = get_user_model()


class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    serializer_class = RegisterSerializer


class CustomAuthToken(ObtainAuthToken):
    def post(self, request, *args, **kwargs):
        response = super().post(request, *args, **kwargs)
        token = Token.objects.get(key=response.data['token'])
        return Response({
            'token': token.key,
            'user_id': token.user_id,
            'username': token.user.username
        })


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]
    filter_backends = [filters.SearchFilter]
    search_fields = ['username', 'email']

    def get_queryset(self):
        queryset = User.objects.all()
        
        search = self.request.query_params.get('search', None)
        if search:
            queryset = queryset.filter(
                Q(username__icontains=search) | 
                Q(email__icontains=search)
            )
        
        return queryset

    def get_object(self):
        lookup = self.kwargs.get('pk')
        if lookup == 'me':
            return self.request.user
            
        return super().get_object()
    
    @action(detail=True, methods=['POST'], parser_classes=[MultiPartParser])
    def upload_avatar(self, request, pk=None):
        user = self.get_object()
        
        if 'avatar' not in request.FILES:
            return Response({'error': 'No avatar file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        if user.avatar:
            import os
            old_path = user.avatar.path
            if os.path.isfile(old_path):
                os.remove(old_path)
        
        user.avatar = request.FILES['avatar']
        user.save()
        
        print(f"Avatar updated for user {user.id}. Path: {user.avatar.path}, URL: {user.avatar.url}")
        
        return Response({
            'avatar': request.build_absolute_uri(user.avatar.url),
            'message': 'Avatar updated successfully'
        })
    
    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        
        data = request.data.copy() if hasattr(request.data, 'copy') else request.data
        
        if 'avatar' in request.FILES:
            if instance.avatar:
                try:
                    import os
                    old_path = instance.avatar.path
                    if os.path.isfile(old_path):
                        os.remove(old_path)
                except (ValueError, OSError) as e:
                    print(f"Error removing old avatar: {e}")
            
            instance.avatar = request.FILES['avatar']
            instance.save()
            print(f"Avatar updated via update method for user {instance.id}. Path: {instance.avatar.path}")
        
        serializer = self.get_serializer(instance, data=data, partial=partial)
        
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
        except Exception as e:
            print(f"Error updating user: {e}")
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.data)
    
    @action(detail=True, methods=['GET'], permission_classes=[permissions.AllowAny])
    def public_profile(self, request, pk=None):
        user = self.get_object()
        serializer = UserSerializer(user, context={'request': request})
        data = {
            'id': serializer.data['id'],
            'username': serializer.data['username'],
            'avatar_url': serializer.data['avatar_url'],
            'is_online': serializer.data['is_online']
        }
        return Response(data)


class ChatViewSet(viewsets.ModelViewSet):
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Chat.objects.filter(participants=self.request.user)
    
    def create(self, request, *args, **kwargs):
        print(f"Chat creation request received: {request.data}")
        
        participants_ids = request.data.get('participants', [])
        
        try:
            participants_ids = [int(pid) for pid in participants_ids]
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid participant IDs"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not User.objects.filter(id__in=participants_ids).count() == len(participants_ids):
            return Response(
                {"error": "One or more participants do not exist"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        chat = serializer.save()
        
        participant_ids = set(participants_ids)
        if request.user.id not in participant_ids:
            chat.participants.add(request.user)
        
        for participant_id in participants_ids:
            try:
                user = User.objects.get(id=participant_id)
                chat.participants.add(user)
            except User.DoesNotExist:
                pass
        
        return Response(
            self.get_serializer(chat).data,
            status=status.HTTP_201_CREATED
        )

class MessageViewSet(viewsets.ModelViewSet):
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        chat_id = self.request.query_params.get('chat', None)
        queryset = Message.objects.all()
        
        if chat_id:
            try:
                chat = Chat.objects.get(id=chat_id, participants=self.request.user)
                queryset = queryset.filter(chat=chat)
            except Chat.DoesNotExist:
                return Message.objects.none()
        else:
            user_chats = Chat.objects.filter(participants=self.request.user)
            queryset = queryset.filter(chat__in=user_chats)
            
        return queryset.order_by('sent_at')
    
    def perform_create(self, serializer):
        chat_id = serializer.validated_data.get('chat').id
        
        try:
            chat = Chat.objects.get(id=chat_id, participants=self.request.user)
        except Chat.DoesNotExist:
            raise PermissionDenied("You are not a participant in this chat.")
        
        serializer.save(sender=self.request.user)


class ImageViewSet(viewsets.ModelViewSet):
    queryset = Image.objects.all()
    serializer_class = ImageSerializer
    permission_classes = [permissions.IsAuthenticated]
    
    def get_queryset(self):
        return Image.objects.filter(uploader=self.request.user)
    
    def perform_create(self, serializer):
        serializer.save(uploader=self.request.user)