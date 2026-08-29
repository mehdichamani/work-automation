import { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import toast from 'react-hot-toast';
import moment from 'moment-jalaali';
import { io } from 'socket.io-client';

export default function Chat() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [users, setUsers] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Search states
  const [roomSearch, setRoomSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [messageSearch, setMessageSearch] = useState('');
  const [showMessageSearch, setShowMessageSearch] = useState(false);

  // Pagination states
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // Typing state
  const [typingUsers, setTypingUsers] = useState({});
  const typingTimeoutRef = useRef(null);

  // Attachment preview before sending
  const [pendingFile, setPendingFile] = useState(null);

  const messagesEndRef = useRef(null);
  const chatScrollContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const socketRef = useRef(null);

  // Sound generator
  const playMessageSound = useCallback(() => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.06, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch (_) {}
  }, []);

  // Initialize socket
  useEffect(() => {
    loadRooms();
    loadUsers();

    const socket = io();
    socketRef.current = socket;
    if (user?.id) {
      socket.emit('user:register', user.id);
    }

    socket.on('chat:notification', () => {
      loadRooms();
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.id]);

  // Handle selected room socket join and listeners
  useEffect(() => {
    if (!selectedRoom?.id || !socketRef.current) return;

    const socket = socketRef.current;
    socket.emit('chat:join', selectedRoom.id);
    loadMessages(selectedRoom.id);
    markRoomAsRead(selectedRoom.id);

    const handleNewMessage = (data) => {
      if (data.roomId === selectedRoom.id) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === data.message.id)) return prev;
          return [...prev, data.message];
        });
        if (data.message.user_id !== user.id) {
          playMessageSound();
          markRoomAsRead(selectedRoom.id);
        }
      }
    };

    const handleTyping = (data) => {
      if (data.roomId === selectedRoom.id && data.userId !== user.id) {
        setTypingUsers((prev) => ({
          ...prev,
          [data.userId]: data.isTyping ? data.userName : null,
        }));
      }
    };

    const handleRead = (data) => {
      if (data.roomId === selectedRoom.id && data.userId !== user.id) {
        setMessages((prev) =>
          prev.map((m) => (m.user_id === user.id ? { ...m, is_read: true } : m))
        );
      }
    };

    socket.on('chat:message', handleNewMessage);
    socket.on('chat:typing', handleTyping);
    socket.on('chat:read', handleRead);

    return () => {
      socket.emit('chat:leave', selectedRoom.id);
      socket.off('chat:message', handleNewMessage);
      socket.off('chat:typing', handleTyping);
      socket.off('chat:read', handleRead);
      setTypingUsers({});
    };
  }, [selectedRoom?.id, user?.id, playMessageSound]);

  // Scroll to bottom on new messages if near bottom
  useEffect(() => {
    if (!loadingMore) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length, loadingMore]);

  const loadRooms = async () => {
    try {
      const res = await api.get('/chat/rooms');
      setRooms(res.data || []);
    } catch (_) {
      toast.error('خطا در بارگذاری لیست گفتگوها');
    }
  };

  const loadUsers = async () => {
    try {
      const res = await api.get('/chat/users');
      setUsers(res.data || []);
    } catch (_) {
      toast.error('خطا در بارگذاری مخاطبین');
    }
  };

  const markRoomAsRead = async (roomId) => {
    try {
      await api.post(`/chat/rooms/${roomId}/read`);
      setRooms((prev) =>
        prev.map((r) => (r.id === roomId ? { ...r, unread_count: 0 } : r))
      );
    } catch (_) {}
  };

  const loadMessages = async (roomId) => {
    try {
      const res = await api.get(`/chat/rooms/${roomId}/messages?limit=50`);
      setMessages(res.data || []);
      setHasMore((res.data || []).length >= 50);
    } catch (_) {
      toast.error('خطا در بارگذاری پیام‌ها');
    }
  };

  const loadOlderMessages = async () => {
    if (!hasMore || loadingMore || messages.length === 0 || !selectedRoom) return;
    const oldestId = messages[0]?.id;
    if (!oldestId) return;

    setLoadingMore(true);
    const container = chatScrollContainerRef.current;
    const prevScrollHeight = container ? container.scrollHeight : 0;
    const prevScrollTop = container ? container.scrollTop : 0;

    try {
      const res = await api.get(`/chat/rooms/${selectedRoom.id}/messages?limit=50&before=${oldestId}`);
      const older = res.data || [];
      if (older.length < 50) {
        setHasMore(false);
      }
      if (older.length > 0) {
        setMessages((prev) => [...older, ...prev]);
        setTimeout(() => {
          if (container) {
            const newScrollHeight = container.scrollHeight;
            container.scrollTop = prevScrollTop + (newScrollHeight - prevScrollHeight);
          }
        }, 50);
      }
    } catch (_) {
      toast.error('خطا در دریافت تاریخچه پیام‌ها');
    } finally {
      setLoadingMore(false);
    }
  };

  const handleScroll = (e) => {
    if (e.target.scrollTop === 0 && hasMore && !loadingMore) {
      loadOlderMessages();
    }
  };

  const handleTypingInput = (e) => {
    setNewMessage(e.target.value);
    if (!selectedRoom || !socketRef.current) return;

    socketRef.current.emit('chat:typing', {
      roomId: selectedRoom.id,
      userId: user.id,
      userName: user.fullName || user.full_name || 'همکار',
      isTyping: true,
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      if (socketRef.current && selectedRoom) {
        socketRef.current.emit('chat:typing', {
          roomId: selectedRoom.id,
          userId: user.id,
          userName: user.fullName || user.full_name || 'همکار',
          isTyping: false,
        });
      }
    }, 2000);
  };

  const startChat = async (targetUserId) => {
    try {
      const res = await api.post('/chat/rooms', { user_id: targetUserId, type: 'direct' });
      const roomId = res.data.id;
      await loadRooms();
      const updatedRooms = await api.get('/chat/rooms');
      const room =
        updatedRooms.data.find((r) => r.id === roomId) || {
          id: roomId,
          display_name: users.find((u) => u.id === targetUserId)?.full_name,
          type: 'direct',
        };
      setSelectedRoom(room);
      setShowNewChat(false);
      setUserSearch('');
    } catch (_) {
      toast.error('خطا در شروع چت');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حداکثر حجم مجاز فایل ۵ مگابایت است.');
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
    if (!allowed.includes(file.type) && !allowed.some(t => file.type.includes(t))) {
      toast.error('فقط فرمت‌های عکس، PDF و متن پشتیبانی می‌شوند.');
      return;
    }
    setPendingFile(file);
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && !pendingFile) || !selectedRoom) return;

    let attachmentUrl = null;
    let messageType = 'text';

    if (pendingFile) {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', pendingFile);
      try {
        const uploadRes = await api.post(`/chat/rooms/${selectedRoom.id}/upload`, formData);
        attachmentUrl = uploadRes.data.url;
        messageType = pendingFile.type.startsWith('image/') ? 'image' : 'file';
      } catch (err) {
        setUploading(false);
        toast.error(err.response?.data?.error || 'خطا در آپلود فایل');
        return;
      }
      setUploading(false);
    }

    const payload = {
      message: newMessage.trim() || (pendingFile ? pendingFile.name : ''),
      message_type: messageType,
      attachment_url: attachmentUrl,
    };

    setNewMessage('');
    setPendingFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      if (socketRef.current) {
        socketRef.current.emit('chat:typing', {
          roomId: selectedRoom.id,
          userId: user.id,
          userName: user.fullName || user.full_name,
          isTyping: false,
        });
      }
      await api.post(`/chat/rooms/${selectedRoom.id}/messages`, payload);
      loadRooms();
    } catch (_) {
      toast.error('خطا در ارسال پیام');
    }
  };

  const filteredRooms = rooms.filter((r) => {
    if (!roomSearch.trim()) return true;
    const q = roomSearch.trim().toLowerCase();
    const nameMatch = (r.display_name || r.name || '').toLowerCase().includes(q);
    const msgMatch = (r.last_message || '').toLowerCase().includes(q);
    return nameMatch || msgMatch;
  });

  const filteredUsers = users.filter((u) => {
    if (!userSearch.trim()) return true;
    const q = userSearch.trim().toLowerCase();
    return (u.full_name || '').toLowerCase().includes(q) || String(u.id).includes(q);
  });

  const filteredMessages = messages.filter((m) => {
    if (!messageSearch.trim()) return true;
    const q = messageSearch.trim().toLowerCase();
    return (m.message || '').toLowerCase().includes(q) || (m.user_name || '').toLowerCase().includes(q);
  });

  const activeTypingText = Object.values(typingUsers).filter(Boolean).join('، ');

  return (
    <div className="animate-fade-in h-[calc(100vh-120px)] flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-l from-primary-600 to-primary-800 text-white rounded-2xl p-4 mb-4 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-2xl">💬</span>
          <div>
            <h1 className="text-lg font-bold">چت و پیام‌رسان داخلی</h1>
            <p className="text-xs text-primary-100">ارتباط سبک و موقت درون‌سازمانی (نگهداری فایل‌ها تا ۲۴ ساعت)</p>
          </div>
        </div>
        <button
          onClick={() => {
            setShowNewChat(!showNewChat);
            setUserSearch('');
          }}
          className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm"
        >
          <span>{showNewChat ? '✕ بستن' : '+ چت جدید'}</span>
        </button>
      </div>

      {/* New Chat Picker Modal/Dropdown */}
      {showNewChat && (
        <div className="bg-white rounded-2xl p-4 shadow-md mb-4 border border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="font-bold text-xs text-gray-700">انتخاب همکار جهت گفتگو</h3>
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="جستجوی نام همکار..."
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 w-64 focus:ring-2 focus:ring-primary-500 outline-none"
            />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 max-h-48 overflow-y-auto p-1">
            {filteredUsers.length === 0 ? (
              <p className="col-span-full text-center text-xs text-gray-400 py-3">همکاری یافت نشد</p>
            ) : (
              filteredUsers.map((u) => (
                <button
                  key={u.id}
                  onClick={() => startChat(u.id)}
                  className="flex items-center gap-2 p-2 rounded-xl hover:bg-primary-50 text-right text-xs border border-gray-100 hover:border-primary-200 transition-all"
                >
                  <span className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold flex-shrink-0">
                    {u.full_name?.[0] || 'U'}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium text-gray-800 truncate">{u.full_name}</p>
                    <p className="text-[10px] text-gray-400 truncate">{u.role || 'کاربر'}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Main Chat Layout */}
      <div className="flex-1 flex bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Rooms Sidebar */}
        <div className="w-80 border-l border-gray-100 flex flex-col bg-gray-50/50">
          {/* Room Search */}
          <div className="p-3 border-b border-gray-100">
            <div className="relative">
              <input
                type="text"
                value={roomSearch}
                onChange={(e) => setRoomSearch(e.target.value)}
                placeholder="جستجو در گفتگوها..."
                className="w-full pl-3 pr-8 py-2 text-xs bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none"
              />
              <span className="absolute right-2.5 top-2.5 text-gray-400 text-xs">🔍</span>
              {roomSearch && (
                <button
                  onClick={() => setRoomSearch('')}
                  className="absolute left-2.5 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Rooms List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {filteredRooms.length === 0 ? (
              <div className="p-6 text-center text-gray-400 text-xs">
                {roomSearch ? 'گفتگویی یافت نشد' : 'هنوز گفتگویی ندارید'}
              </div>
            ) : (
              filteredRooms.map((r) => (
                <div
                  key={r.id}
                  onClick={() => setSelectedRoom(r)}
                  className={`p-3.5 cursor-pointer transition-all hover:bg-white flex items-center gap-3 ${
                    selectedRoom?.id === r.id ? 'bg-white shadow-sm border-r-4 border-primary-500' : ''
                  }`}
                >
                  <div className="relative flex-shrink-0">
                    <span className="w-11 h-11 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-sm">
                      {r.display_name?.[0] || '💬'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-semibold text-xs text-gray-800 truncate">
                        {r.display_name || r.name || 'چت'}
                      </span>
                      {r.last_message_at && (
                        <span className="text-[10px] text-gray-400">
                          {moment(r.last_message_at).format('HH:mm')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className="text-[11px] text-gray-500 truncate">{r.last_message || 'شروع گفتگو'}</p>
                      {r.unread_count > 0 && (
                        <span className="bg-primary-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0">
                          {r.unread_count}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Chat Messages Panel */}
        <div className="flex-1 flex flex-col bg-white">
          {selectedRoom ? (
            <>
              {/* Active Room Header */}
              <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/70 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="w-9 h-9 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center font-bold text-xs">
                    {selectedRoom.display_name?.[0] || '#'}
                  </span>
                  <div>
                    <h2 className="font-bold text-xs text-gray-800">{selectedRoom.display_name || selectedRoom.name}</h2>
                    {activeTypingText ? (
                      <p className="text-[10px] text-primary-600 animate-pulse">{activeTypingText} در حال نوشتن...</p>
                    ) : (
                      <p className="text-[10px] text-gray-400">چت مستقیم سازمانی</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setShowMessageSearch(!showMessageSearch);
                      if (showMessageSearch) setMessageSearch('');
                    }}
                    title="جستجو در پیام‌ها"
                    className={`p-2 rounded-xl text-xs transition-all ${
                      showMessageSearch ? 'bg-primary-100 text-primary-700' : 'text-gray-500 hover:bg-gray-200/60'
                    }`}
                  >
                    🔍 جستجو در پیام‌ها
                  </button>
                </div>
              </div>

              {/* Message Search Bar */}
              {showMessageSearch && (
                <div className="px-4 py-2 bg-primary-50/60 border-b border-primary-100 flex items-center gap-2">
                  <span className="text-xs text-primary-700">جستجو:</span>
                  <input
                    type="text"
                    value={messageSearch}
                    onChange={(e) => setMessageSearch(e.target.value)}
                    placeholder="کلمه مورد نظر را وارد کنید..."
                    className="flex-1 text-xs px-3 py-1.5 bg-white border border-primary-200 rounded-lg outline-none focus:ring-2 focus:ring-primary-500"
                    autoFocus
                  />
                  {messageSearch && (
                    <span className="text-[11px] text-primary-700">
                      {filteredMessages.length} پیام یافت شد
                    </span>
                  )}
                  <button
                    onClick={() => {
                      setMessageSearch('');
                      setShowMessageSearch(false);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xs px-1"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Messages History Container */}
              <div
                ref={chatScrollContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-3 bg-gradient-to-b from-gray-50/30 to-white"
              >
                {hasMore && (
                  <div className="text-center py-1">
                    <button
                      onClick={loadOlderMessages}
                      disabled={loadingMore}
                      className="text-[11px] text-gray-500 bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-full transition-all"
                    >
                      {loadingMore ? 'در حال دریافت پیام‌های قدیمی...' : '⬆ بارگذاری پیام‌های قبلی'}
                    </button>
                  </div>
                )}

                {filteredMessages.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-gray-400 text-xs">
                    {messageSearch ? 'پیامی مطابق جستجو یافت نشد.' : 'پیامی وجود ندارد. اولین پیام را ارسال کنید.'}
                  </div>
                ) : (
                  filteredMessages.map((m) => {
                    const isMine = m.user_id === user.id;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[75%] md:max-w-[60%] rounded-2xl px-4 py-2.5 shadow-sm text-right ${
                            isMine
                              ? 'bg-primary-600 text-white rounded-br-none'
                              : 'bg-white border border-gray-100 text-gray-800 rounded-bl-none'
                          }`}
                        >
                          {!isMine && (
                            <p className="text-[10px] font-bold text-primary-600 mb-1">{m.user_name}</p>
                          )}

                          {/* Image Attachment */}
                          {m.message_type === 'image' && m.attachment_url && (
                            <div className="mb-2 overflow-hidden rounded-xl bg-black/5">
                              <a href={m.attachment_url} target="_blank" rel="noreferrer">
                                <img
                                  src={m.attachment_url}
                                  alt="پیوست"
                                  className="max-h-60 rounded-xl object-contain hover:opacity-90 transition-opacity"
                                  loading="lazy"
                                />
                              </a>
                            </div>
                          )}

                          {/* File Attachment */}
                          {m.message_type === 'file' && m.attachment_url && (
                            <div
                              className={`mb-2 p-2.5 rounded-xl flex items-center justify-between gap-3 text-xs ${
                                isMine ? 'bg-white/10 text-white' : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="text-base">📎</span>
                                <span className="truncate">{m.message || 'دانلود فایل'}</span>
                              </div>
                              <a
                                href={m.attachment_url}
                                target="_blank"
                                rel="noreferrer"
                                download
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold ${
                                  isMine ? 'bg-white text-primary-700' : 'bg-primary-500 text-white'
                                }`}
                              >
                                دانلود
                              </a>
                            </div>
                          )}

                          {/* Text Message Content */}
                          {m.message_type !== 'file' && m.message && (
                            <p className="text-xs leading-relaxed whitespace-pre-wrap select-text">{m.message}</p>
                          )}

                          {/* Footer with timestamp and ticks */}
                          <div
                            className={`flex items-center justify-end gap-1.5 text-[10px] mt-1.5 ${
                              isMine ? 'text-primary-200' : 'text-gray-400'
                            }`}
                          >
                            <span>{moment(m.created_at).format('HH:mm')}</span>
                            {isMine && (
                              <span title={m.is_read ? 'خوانده شده' : 'ارسال شده'} className="text-xs">
                                {m.is_read ? '✓✓' : '✓'}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Pending File Preview */}
              {pendingFile && (
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-gray-700 truncate">
                    <span>📎</span>
                    <span className="font-semibold truncate">{pendingFile.name}</span>
                    <span className="text-[10px] text-gray-400">
                      ({(pendingFile.size / 1024 / 1024).toFixed(2)} MB - نگهداری ۲۴ ساعته)
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      setPendingFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="text-red-500 hover:text-red-700 text-xs px-2"
                  >
                    حذف پیوست ✕
                  </button>
                </div>
              )}

              {/* Input & Send Area */}
              <div className="p-3 border-t border-gray-100 bg-white">
                <div className="flex items-center gap-2">
                  {/* File Upload Button */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    accept="image/*,.pdf,text/plain"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    title="ارسال فایل یا عکس (موقت ۲۴ ساعت)"
                    disabled={uploading}
                    className="p-2.5 text-gray-500 hover:text-primary-600 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    📎
                  </button>

                  <input
                    value={newMessage}
                    onChange={handleTypingInput}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-xs focus:ring-2 focus:ring-primary-500 outline-none"
                    placeholder="پیام خود را بنویسید..."
                    disabled={uploading}
                  />

                  <button
                    onClick={sendMessage}
                    disabled={uploading || (!newMessage.trim() && !pendingFile)}
                    className={`px-5 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm ${
                      uploading || (!newMessage.trim() && !pendingFile)
                        ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                        : 'bg-primary-500 hover:bg-primary-600 text-white'
                    }`}
                  >
                    {uploading ? 'در حال ارسال...' : 'ارسال'}
                  </button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <div className="text-center">
                <p className="text-5xl mb-3">💬</p>
                <p className="text-sm font-medium text-gray-600 mb-1">یک گفتگو را انتخاب کنید</p>
                <p className="text-xs text-gray-400">یا با دکمه «+ چت جدید» گفتگوی جدیدی با همکاران آغاز نمایید</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
