import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';

export default function Chat() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const pollRef = useRef(null);

  useEffect(() => {
    loadRooms();
    loadUsers();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  useEffect(() => {
    if (selectedRoom) {
      loadMessages(selectedRoom.id);
      const poll = () => { pollRef.current = setInterval(() => loadMessages(selectedRoom.id), 3000); };
      poll();
      const handleVisibility = () => {
        if (document.hidden) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        } else {
          loadMessages(selectedRoom.id);
          poll();
        }
      };
      document.addEventListener('visibilitychange', handleVisibility);
      return () => {
        clearInterval(pollRef.current);
        document.removeEventListener('visibilitychange', handleVisibility);
      };
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [selectedRoom?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadRooms = async () => {
    try {
      const res = await api.get('/chat/rooms');
      setRooms(res.data);
    } catch (err) { toast.error('خطا در بارگذاری اتاق‌ها'); }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/chat/users');
      setUsers(res.data);
    } catch (err) { toast.error('خطا در بارگذاری کاربران'); }
  };

  const loadMessages = async (roomId) => {
    try {
      const res = await api.get(`/chat/rooms/${roomId}/messages`);
      setMessages(res.data);
    } catch (err) { toast.error('خطا در بارگذاری پیام‌ها'); }
  };

  const startChat = async (userId) => {
    try {
      const res = await api.post('/chat/rooms', { user_id: userId, type: 'direct' });
      const roomId = res.data.id;
      await loadRooms();
      const updatedRooms = await api.get('/chat/rooms');
      const room = updatedRooms.data.find(r => r.id === roomId) || { id: roomId, display_name: users.find(u => u.id === userId)?.full_name, type: 'direct' };
      setSelectedRoom(room);
      setShowNewChat(false);
    } catch (err) { toast.error('خطا در ایجاد چت'); }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedRoom) return;
    try {
      await api.post(`/chat/rooms/${selectedRoom.id}/messages`, { message: newMessage });
      setNewMessage('');
      loadMessages(selectedRoom.id);
      loadRooms();
    } catch (err) { toast.error('خطا در ارسال'); }
  };

  return (
    <div className="animate-fade-in h-[calc(100vh-120px)]">
      <div className="bg-gradient-to-l from-primary-500 to-primary-700 text-white rounded-2xl p-4 mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">💬 چت داخلی</h1>
        <button onClick={() => setShowNewChat(!showNewChat)} className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-xl text-sm">
          + چت جدید
        </button>
      </div>

      {showNewChat && (
        <div className="bg-white rounded-2xl p-4 shadow-sm mb-4 max-h-48 overflow-y-auto">
          <h3 className="font-bold text-sm text-gray-700 mb-3">انتخاب کاربر</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {users.map(u => (
              <button key={u.id} onClick={() => startChat(u.id)}
                className="flex items-center gap-2 p-2 rounded-xl hover:bg-primary-50 text-right text-sm">
                <span className="w-8 h-8 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs font-bold">
                  {u.full_name?.[0]}
                </span>
                <div>
                  <p className="font-medium text-xs">{u.full_name}</p>
                  <p className="text-[10px] text-gray-400">{u.id}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex h-[calc(100%-100px)] bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="w-72 border-l border-gray-200 overflow-y-auto">
          {rooms.length === 0 ? (
            <div className="p-4 text-center text-gray-400 text-xs">چتی وجود ندارد</div>
          ) : rooms.map(r => (
            <div key={r.id} onClick={() => setSelectedRoom(r)}
              className={`p-3 border-b border-gray-100 cursor-pointer transition-all hover:bg-gray-50 ${
                selectedRoom?.id === r.id ? 'bg-primary-50 border-r-2 border-r-primary-500' : ''
              }`}>
              <div className="flex items-center gap-3">
                <span className="w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {r.display_name?.[0] || '#'}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm truncate">{r.display_name || r.name}</span>
                    {r.unread_count > 0 && (
                      <span className="bg-primary-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{r.unread_count}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 truncate">{r.last_message || 'شروع چت'}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex-1 flex flex-col">
          {selectedRoom ? (
            <>
              <div className="p-3 border-b border-gray-200 bg-gray-50">
                <span className="font-bold text-sm">{selectedRoom.display_name || selectedRoom.name}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.map(m => (
                  <div key={m.id} className={`flex ${m.user_id === user.id ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${
                      m.user_id === user.id
                        ? 'bg-primary-500 text-white rounded-br-sm'
                        : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                    }`}>
                      {m.user_id !== user.id && (
                        <p className="text-[10px] font-bold text-primary-600 mb-1">{m.user_name}</p>
                      )}
                      <p className="text-sm whitespace-pre-wrap">{m.message}</p>
                      <p className={`text-[10px] mt-1 ${m.user_id === user.id ? 'text-primary-200' : 'text-gray-400'}`}>
                        {new Date(m.created_at).toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
              <div className="p-3 border-t border-gray-200">
                <div className="flex gap-2">
                  <input value={newMessage} onChange={e => setNewMessage(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-primary-500"
                    placeholder="پیام..." />
                  <button onClick={sendMessage}
                    className="bg-primary-500 text-white px-5 py-2.5 rounded-xl text-sm hover:bg-primary-600 transition-all">
                    ارسال
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-5xl mb-4">💬</p>
                <p>یک چت را انتخاب کنید</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
