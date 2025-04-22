from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    bio = models.TextField(blank=True)
    avatar = models.ImageField(upload_to='avatars/', null=True, blank=True)
    is_online = models.BooleanField(default=False)

    def __str__(self):
        return self.username


class Chat(models.Model):
    name = models.CharField(max_length=255, blank=True)
    participants = models.ManyToManyField(User, related_name='chats')
    is_group = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name if self.name else f"Chat {self.pk}"


class Message(models.Model):
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='messages')
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='messages')
    text = models.TextField(blank=True)
    image = models.ImageField(upload_to='messages/', null=True, blank=True)
    sent_at = models.DateTimeField(auto_now_add=True)
    is_read = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.sender.username}: {self.text[:30]}"


class Image(models.Model):
    uploader = models.ForeignKey(User, on_delete=models.CASCADE, related_name='images')
    image = models.ImageField(upload_to='user_images/')
    caption = models.CharField(max_length=255, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Image by {self.uploader.username}"
