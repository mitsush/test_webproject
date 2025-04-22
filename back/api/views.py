from rest_framework import viewsets, generics, permissions
from rest_framework.authtoken.views import ObtainAuthToken
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from django.contrib.auth import get_user_model

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

from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser
from rest_framework.response import Response
from rest_framework import status
import os

User = get_user_model()


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        lookup = self.kwargs.get('pk')
        if lookup == 'me':
            return self.request.user
        obj = super().get_object()
        if obj != self.request.user and not self.request.user.is_staff:
            raise PermissionDenied("You can only access your own user data.")
        return obj
    
    @action(detail=True, methods=['POST'], parser_classes=[MultiPartParser])
    def upload_avatar(self, request, pk=None):
        user = self.get_object()
        
        if 'avatar' not in request.FILES:
            return Response({'error': 'No avatar file provided'}, status=status.HTTP_400_BAD_REQUEST)
        
        if user.avatar:
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
        partial = kwargs.pop('partial', True)  # По умолчанию используем partial=True для PATCH
        instance = self.get_object()
        
        # Сохраняем копию данных запроса, чтобы можно было их модифицировать
        data = request.data.copy() if hasattr(request.data, 'copy') else request.data
        
        # Обработка аватарки, если она есть в запросе
        if 'avatar' in request.FILES:
            # Если есть старая аватарка, удаляем её
            if instance.avatar:
                try:
                    old_path = instance.avatar.path
                    if os.path.isfile(old_path):
                        os.remove(old_path)
                except (ValueError, OSError) as e:
                    print(f"Error removing old avatar: {e}")
            
            # Сохраняем новую аватарку
            instance.avatar = request.FILES['avatar']
            instance.save()
            print(f"Avatar updated via update method for user {instance.id}. Path: {instance.avatar.path}")
        
        # Продолжаем обычную обработку
        serializer = self.get_serializer(instance, data=data, partial=partial)
        
        try:
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
        except Exception as e:
            print(f"Error updating user: {e}")
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
        
        return Response(serializer.data)


class ChatViewSet(viewsets.ModelViewSet):
    queryset = Chat.objects.all()
    serializer_class = ChatSerializer
    permission_classes = [permissions.IsAuthenticated]


class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]


class ImageViewSet(viewsets.ModelViewSet):
    queryset = Image.objects.all()
    serializer_class = ImageSerializer
    permission_classes = [permissions.IsAuthenticated]
