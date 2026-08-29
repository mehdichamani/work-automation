import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leave = lazy(() => import('./pages/Leave'));
const Overtime = lazy(() => import('./pages/Overtime'));
const Letters = lazy(() => import('./pages/Letters'));
const Inventory = lazy(() => import('./pages/Inventory'));
const Restaurant = lazy(() => import('./pages/Restaurant'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const JobApplication = lazy(() => import('./pages/JobApplication'));
const Shifts = lazy(() => import('./pages/Shifts'));
const UserImportCsv = lazy(() => import('./pages/UserImportCsv'));
const Purchase = lazy(() => import('./pages/Purchase'));
const Mission = lazy(() => import('./pages/Mission'));
const WorkOrder = lazy(() => import('./pages/WorkOrder'));
const Payment = lazy(() => import('./pages/Payment'));
const Repair = lazy(() => import('./pages/Repair'));
const RepairExternal = lazy(() => import('./pages/RepairExternal'));
const ITRequest = lazy(() => import('./pages/ITRequest'));
const Conference = lazy(() => import('./pages/Conference'));
const SecurityReport = lazy(() => import('./pages/SecurityReport'));
const DailyOutput = lazy(() => import('./pages/DailyOutput'));
const ProjectSupply = lazy(() => import('./pages/ProjectSupply'));
const Inspection = lazy(() => import('./pages/Inspection'));
const Reports = lazy(() => import('./pages/Reports'));
const WorkflowBuilder = lazy(() => import('./pages/WorkflowBuilder'));
const SignatureManager = lazy(() => import('./pages/SignatureManager'));
const Chat = lazy(() => import('./pages/Chat'));
const AuditLog = lazy(() => import('./pages/AuditLog'));
const Profile = lazy(() => import('./pages/Profile'));
const DailyWorkReport = lazy(() => import('./pages/DailyWorkReport'));
const LearningViewer = lazy(() => import('./pages/LearningViewer'));
const EducationalManager = lazy(() => import('./pages/EducationalManager'));
const NotFound = lazy(() => import('./pages/NotFound'));

function PrivateRoute({ children, allowedRoles, requiredPermission }) {
  const { user, loading, hasPermission } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-lg">در حال بارگذاری...</div></div>;
  if (!user) return <Navigate to="/login" />;
  if (allowedRoles && !allowedRoles.includes(user.role)) return <Navigate to="/" />;
  if (requiredPermission && !hasPermission(requiredPermission)) return <Navigate to="/" />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  const isLogin = location.pathname === '/login';

  return isLogin ? (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="*" element={<Navigate to="/login" />} />
    </Routes>
  ) : (
    <Layout>
      <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="text-lg text-gray-400">در حال بارگذاری...</div></div>}>
        <Routes location={location}>
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/leave" element={<PrivateRoute><Leave /></PrivateRoute>} />
          <Route path="/overtime" element={<PrivateRoute><Overtime /></PrivateRoute>} />
          <Route path="/letters" element={<PrivateRoute><Letters /></PrivateRoute>} />
          <Route path="/inventory" element={<PrivateRoute><Inventory /></PrivateRoute>} />
          <Route path="/restaurant" element={<PrivateRoute><Restaurant /></PrivateRoute>} />
          <Route path="/admin" element={<PrivateRoute allowedRoles={['admin']}><AdminPanel /></PrivateRoute>} />
          <Route path="/workflow" element={<PrivateRoute><WorkflowBuilder /></PrivateRoute>} />
          <Route path="/signature" element={<PrivateRoute><SignatureManager /></PrivateRoute>} />
          <Route path="/chat" element={<PrivateRoute requiredPermission="chat_view"><Chat /></PrivateRoute>} />
          <Route path="/job-application" element={<PrivateRoute><JobApplication /></PrivateRoute>} />
          <Route path="/shifts" element={<PrivateRoute requiredPermission="shifts_manage"><Shifts /></PrivateRoute>} />
          <Route path="/admin/import-users" element={<PrivateRoute requiredPermission="user_import_csv"><UserImportCsv /></PrivateRoute>} />
          <Route path="/purchase" element={<PrivateRoute><Purchase /></PrivateRoute>} />
          <Route path="/mission" element={<PrivateRoute><Mission /></PrivateRoute>} />
          <Route path="/work-order" element={<PrivateRoute><WorkOrder /></PrivateRoute>} />
          <Route path="/payment" element={<PrivateRoute><Payment /></PrivateRoute>} />
          <Route path="/repair" element={<PrivateRoute><Repair /></PrivateRoute>} />
          <Route path="/repair-external" element={<PrivateRoute><RepairExternal /></PrivateRoute>} />
          <Route path="/it" element={<PrivateRoute><ITRequest /></PrivateRoute>} />
          <Route path="/conference" element={<PrivateRoute><Conference /></PrivateRoute>} />
          <Route path="/security" element={<PrivateRoute><SecurityReport /></PrivateRoute>} />
          <Route path="/daily-output" element={<PrivateRoute><DailyOutput /></PrivateRoute>} />
          <Route path="/project-supply" element={<PrivateRoute><ProjectSupply /></PrivateRoute>} />
          <Route path="/inspection" element={<PrivateRoute><Inspection /></PrivateRoute>} />
          <Route path="/reports" element={<PrivateRoute allowedRoles={['admin','manager']}><Reports /></PrivateRoute>} />
          <Route path="/audit-log" element={<PrivateRoute allowedRoles={['admin']}><AuditLog /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/daily-work-report" element={<PrivateRoute><DailyWorkReport /></PrivateRoute>} />
          <Route path="/learning" element={<PrivateRoute requiredPermission="learning_view"><LearningViewer /></PrivateRoute>} />
          <Route path="/admin/educational" element={<PrivateRoute requiredPermission="learning_manage"><EducationalManager /></PrivateRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <Toaster position="top-center" toastOptions={{ duration: 3000, style: { fontFamily: 'Vazirmatn, Tahoma', direction: 'rtl' } }} />
      <BrowserRouter>
        <ErrorBoundary>
          <AppRoutes />
        </ErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
