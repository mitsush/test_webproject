# socket_server.py
import os
import django
import socketio
import jwt
from django.conf import settings
from django.contrib.auth import get_user_model

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "back.settings")
django.setup()

from api.models import Chat, Message
from api.serializers import ChatSerializer, MessageSerializer

User = get_user_model()
sio = socketio.Server(cors_allowed_origins="*")
app = socketio.WSGIApp(sio)

connected_users = {}  # user_id -> sid


def get_user_from_token(token):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
        user = User.objects.get(id=payload["user_id"])
        return user
    except Exception:
        return None


@sio.event
def connect(sid, environ):
    print(f"Connected: {sid}")


@sio.event
def disconnect(sid):
    print(f"Disconnected: {sid}")
    for user_id, socket_id in connected_users.items():
        if socket_id == sid:
            del connected_users[user_id]
            break


@sio.event
def auth(sid, data):
    token = data.get("token")
    user = get_user_from_token(token)
    if user:
        connected_users[user.id] = sid
        sio.emit("auth_success", {"user_id": user.id}, to=sid)
    else:
        sio.emit("auth_error", {"message": "Invalid token"}, to=sid)


@sio.event
def chat_create(sid, data):
    user = get_user_from_token(data.get("token"))
    if not user:
        return sio.emit("error", {"message": "Unauthorized"}, to=sid)

    participants_ids = data.get("participants", [])
    chat = Chat.objects.create(is_group=data.get("is_group", False))
    chat.participants.set(User.objects.filter(id__in=participants_ids + [user.id]))
    chat.save()

    serializer = ChatSerializer(chat)
    for uid in participants_ids:
        if uid in connected_users:
            sio.emit("chat:created", serializer.data, to=connected_users[uid])

    sio.emit("chat:created", serializer.data, to=sid)


@sio.event
def message_create(sid, data):
    user = get_user_from_token(data.get("token"))
    if not user:
        return sio.emit("error", {"message": "Unauthorized"}, to=sid)

    chat_id = data.get("chat_id")
    text = data.get("text")
    message = Message.objects.create(chat_id=chat_id, sender=user, text=text)
    serializer = MessageSerializer(message)

    chat = Chat.objects.get(id=chat_id)
    for participant in chat.participants.all():
        if participant.id in connected_users:
            sio.emit("message:created", serializer.data, to=connected_users[participant.id])

# at bottom of socket_server.py
if __name__ == '__main__':
    import eventlet
    import eventlet.wsgi
    eventlet.wsgi.server(eventlet.listen(('0.0.0.0', 5000)), app)
