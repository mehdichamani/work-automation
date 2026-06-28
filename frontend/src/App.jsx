import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leave = lazy(() => import('./pages/Leave'));
const Letters = lazy(() => import('./pages/Letters'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Restaurant = lazy(() => import('./pages/Restaurant'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const JobApplication = lazy(() => import('./pages/JobApplication'));

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-lg">در حال بارگذاری...</div></div>;
  if (!user) return <Navigate to="/login" />;
  return <Layout>{children}</Layout>;
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontFamily: 'Vazirmatn, Tahoma', direction: 'rtl' } }} />
      <BrowserRouter>
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="text-lg">در حال بارگذاری...</div></div>}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/leave" element={<PrivateRoute><Leave /></PrivateRoute>} />
          <Route path="/letters" element={<PrivateRoute><Letters /></PrivateRoute>} />
          <Route path="/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
          <Route path="/restaurant" element={<PrivateRoute><Restaurant /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute><AdminPanel /></PrivateRoute>} />
          <Route path="/job-application" element={<PrivateRoute><JobApplication /></PrivateRoute>} />
        </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
