import os
import django
import socketio
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from datetime import timedelta

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "back.settings")
django.setup()

from api.models import Chat, Message, User
from api.serializers import ChatSerializer, MessageSerializer, UserSerializer

sio = socketio.Server(cors_allowed_origins="*")
app = socketio.WSGIApp(sio)

connected_users = {}

def get_user_from_token(token):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user = User.objects.get(id=payload["user_id"])
        return user
    except Exception as e:
        print(f"Error decoding token: {e}")
        return None

def broadcast_user_status(user_id, is_online):
    """Broadcast user online status to all relevant users"""
    user = User.objects.get(id=user_id)
    
    user_chats = Chat.objects.filter(participants=user)
    
    contact_ids = set()
    for chat in user_chats:
        for participant in chat.participants.all():
            if participant.id != user_id:  # Don't include the user themselves
                contact_ids.add(participant.id)
    
    user.is_online = is_online
    user.save()
    
    for contact_id in contact_ids:
        if contact_id in connected_users:
            contact_sid = connected_users[contact_id]['sid']
            sio.emit("user_status_changed", {
                "user_id": user_id,
                "is_online": is_online
            }, to=contact_sid)

@sio.event
def connect(sid, environ):
    print(f"Connected: {sid}")

@sio.event
def disconnect(sid):
    print(f"Disconnected: {sid}")
    user_id = None
    
    for uid, data in connected_users.items():
        if data['sid'] == sid:
            user_id = uid
            del connected_users[uid]
            break
    
    if user_id:
        broadcast_user_status(user_id, False)

@sio.event
def auth(sid, data):
    token = data.get("token")
    user = get_user_from_token(token)
    
    if user:
        if user.id in connected_users:
            old_sid = connected_users[user.id]['sid']
            if old_sid != sid:
                sio.disconnect(old_sid)
        
        connected_users[user.id] = {
            'sid': sid,
            'last_active': django.utils.timezone.now()
        }
        
        broadcast_user_status(user.id, True)
        
        sio.emit("auth_success", {"user_id": user.id}, to=sid)
    else:
        sio.emit("auth_error", {"message": "Invalid token"}, to=sid)

@sio.event
def chat_create(sid, data):
    user = get_user_from_token(data.get("token"))
    if not user:
        return sio.emit("error", {"message": "Unauthorized"}, to=sid)

    participants_ids = data.get("participants", [])
    chat_name = data.get("name", "")
    is_group = data.get("is_group", False)
    
    chat = Chat.objects.create(name=chat_name, is_group=is_group)
    
    user_ids = list(set(participants_ids + [user.id]))
    chat.participants.set(User.objects.filter(id__in=user_ids))
    
    serializer = ChatSerializer(chat)
    
    for uid in user_ids:
        if uid in connected_users:
            sio.emit("chat:created", serializer.data, to=connected_users[uid]['sid'])

@sio.event
def message_create(sid, data):
    user = get_user_from_token(data.get("token"))
    if not user:
        return sio.emit("error", {"message": "Unauthorized"}, to=sid)

    chat_id = data.get("chat_id")
    text = data.get("text")
    
    try:
        chat = Chat.objects.get(id=chat_id)
        if not chat.participants.filter(id=user.id).exists():
            return sio.emit("error", {"message": "You are not a participant in this chat"}, to=sid)
        
        message = Message.objects.create(chat=chat, sender=user, text=text)
        serializer = MessageSerializer(message)
        
        for participant in chat.participants.all():
            if participant.id in connected_users:
                sio.emit("message:created", serializer.data, to=connected_users[participant.id]['sid'])
        
        if user.id in connected_users:
            connected_users[user.id]['last_active'] = django.utils.timezone.now()
        
    except Chat.DoesNotExist:
        sio.emit("error", {"message": "Chat not found"}, to=sid)
    except Exception as e:
        sio.emit("error", {"message": str(e)}, to=sid)

@sio.event
def get_online_users(sid, data):
    """Get online status of specific users"""
    user = get_user_from_token(data.get("token"))
    if not user:
        return sio.emit("error", {"message": "Unauthorized"}, to=sid)
    
    user_ids = data.get("user_ids", [])
    if not user_ids:
        return
    
    online_users = {}
    for uid in user_ids:
        try:
            status_user = User.objects.get(id=uid)
            is_online = uid in connected_users
            online_users[uid] = is_online
            
            if status_user.is_online != is_online:
                status_user.is_online = is_online
                status_user.save()
        except User.DoesNotExist:
            online_users[uid] = False
    
    sio.emit("online_users", online_users, to=sid)

@sio.event
def search_users(sid, data):
    user = get_user_from_token(data.get("token"))
    if not user:
        return sio.emit("error", {"message": "Unauthorized"}, to=sid)
    
    search_term = data.get("search", "")
    if not search_term or len(search_term) < 1:
        return sio.emit("search_results", {"users": []}, to=sid)
    
    from django.db.models import Q
    search_results = User.objects.filter(
        Q(username__icontains=search_term) | 
        Q(email__icontains=search_term)
    ).exclude(id=user.id)[:20]
    
    serializer = UserSerializer(search_results, many=True)
    sio.emit("search_results", {"users": serializer.data}, to=sid)

@sio.event
def heartbeat(sid, data):
    """Update user's last active time to keep track of active users"""
    user = get_user_from_token(data.get("token"))
    if user and user.id in connected_users:
        connected_users[user.id]['last_active'] = django.utils.timezone.now()
        if not user.is_online:
            user.is_online = True
            user.save()

if __name__ == '__main__':
    import eventlet
    import eventlet.wsgi
    
    def check_inactive_users():
        while True:
            try:
                now = django.utils.timezone.now()
                inactive_threshold = now - timedelta(minutes=5)
            
                for user_id, data in list(connected_users.items()):
                    if data['last_active'] < inactive_threshold:
                        sio.disconnect(data['sid'])
                        del connected_users[user_id]
                        
                        try:
                            user = User.objects.get(id=user_id)
                            if user.is_online:
                                user.is_online = False
                                user.save()
                                broadcast_user_status(user_id, False)
                        except User.DoesNotExist:
                            pass
            except Exception as e:
                print(f"Error in inactive users check: {e}")
            
            eventlet.sleep(60)
    
    eventlet.spawn(check_inactive_users)
    
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5000)), app)