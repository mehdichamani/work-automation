import { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const savedUser = localStorage.getItem('user');
    const token = localStorage.getItem('token');
    if (savedUser && token) {
      try {
        const u = JSON.parse(savedUser);
        setUser(u);
        loadPermissions(u);
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }
  }, []);

  const loadPermissions = async (u) => {
    try {
      const res = await api.get('/permissions/my');
      setPermissions(res.data);
    } catch (err) {
      setPermissions([]);
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = (moduleKey) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const perm = permissions.find(p => p.module_key === moduleKey);
    return perm ? perm.is_enabled === 1 : false;
  };

  const login = async (username, password) => {
    const res = await api.post('/auth/login', { username, password });
    localStorage.setItem('token', res.data.token);
    localStorage.setItem('user', JSON.stringify(res.data.user));
    setUser(res.data.user);
    await loadPermissions(res.data.user);
    return res.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setPermissions([]);
  };

  const refreshPermissions = async () => {
    if (user) await loadPermissions(user);
  };

  const updateUserFields = (fields) => {
    setUser(prev => {
      if (!prev) return prev;
      const next = { ...prev, ...fields };
      localStorage.setItem('user', JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, permissions, hasPermission, login, logout, loading, refreshPermissions, updateUserFields }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
