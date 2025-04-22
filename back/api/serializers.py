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
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'bio', 'avatar', 'is_online']
        read_only_fields = ['avatar_url']
    
    def get_avatar_url(self, obj):
        if obj.avatar and hasattr(obj.avatar, 'url'):
            request = self.context.get('request')
            if request:
                return request.build_absolute_uri(obj.avatar.url)
            return obj.avatar.url
        return None



class ChatSerializer(serializers.ModelSerializer):
    class Meta:
        model = Chat
        fields = '__all__'


class MessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Message
        fields = '__all__'


class ImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = Image
        fields = '__all__'
