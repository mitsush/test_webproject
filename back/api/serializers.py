from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Chat, Message, Image
import os

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password']

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

    def get_avatar(self, obj):
        if obj.avatar and hasattr(obj.avatar, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None
    
    def update(self, instance, validated_data):
        avatar_file = self.context['request'].FILES.get('avatar') if 'request' in self.context else None
        
        if avatar_file:
            if instance.avatar:
                try:
                    if os.path.isfile(instance.avatar.path):
                        os.remove(instance.avatar.path)
                except (ValueError, OSError):
                    pass
            
            instance.avatar = avatar_file
        
        return super().update(instance, validated_data)


class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'bio', 'avatar', 'avatar_url', 'is_online', 'last_active']
        read_only_fields = ['avatar_url', 'last_active']
    
    def get_avatar_url(self, obj):
        if obj.avatar and hasattr(obj.avatar, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class MessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = ['id', 'sender', 'chat', 'text', 'image', 'sent_at', 'is_read', 'sender_username']
    
    def get_sender_username(self, obj):
        return obj.sender.username


class LastMessageSerializer(serializers.ModelSerializer):
    sender_username = serializers.SerializerMethodField()
    
    class Meta:
        model = Message
        fields = ['id', 'sender', 'text', 'sent_at', 'is_read', 'sender_username']
    
    def get_sender_username(self, obj):
        return obj.sender.username


class ChatParticipantSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()
    
    class Meta:
        model = User
        fields = ['id', 'username', 'avatar_url', 'is_online']
    
    def get_avatar_url(self, obj):
        if obj.avatar and hasattr(obj.avatar, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None


class ChatSerializer(serializers.ModelSerializer):
    last_message = serializers.SerializerMethodField()
    participants_details = serializers.SerializerMethodField()
    
    class Meta:
        model = Chat
        fields = ['id', 'name', 'participants', 'participants_details', 'is_group', 'created_at', 'last_message']
    
    def get_last_message(self, obj):
        last_message = obj.messages.order_by('-sent_at').first()
        if last_message:
            return LastMessageSerializer(last_message).data
        return None
    
    def get_participants_details(self, obj):
        participants = obj.participants.all()
        return ChatParticipantSerializer(participants, many=True, context=self.context).data


class ImageSerializer(serializers.ModelSerializer):
    uploader_username = serializers.SerializerMethodField()
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Image
        fields = ['id', 'uploader', 'uploader_username', 'image', 'image_url', 'caption', 'uploaded_at']
    
    def get_uploader_username(self, obj):
        return obj.uploader.username
    
    def get_image_url(self, obj):
        if obj.image and hasattr(obj.image, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.image.url)
            return obj.image.url
        return None