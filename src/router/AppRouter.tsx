import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ROUTES } from '@/config/constants';
import ProtectedRoute from '@/components/auth/ProtectedRoute';

// Auth
import LoginPage from '@/pages/auth/LoginPage';

// Public
import PublicElevatorView from '@/pages/public/PublicElevatorView';

// Admin
import AdminDashboard from '@/pages/admin/AdminDashboard';
import ClientsPage from '@/pages/admin/ClientsPage';
import BuildingsPage from '@/pages/admin/BuildingsPage';
import ElevatorsPage from '@/pages/admin/ElevatorsPage';
import AdminServiceReviewPage from '@/pages/admin/AdminServiceReviewPage';
import AdminServiceReviewDetailPage from '@/pages/admin/AdminServiceReviewDetailPage';

// Technician
import TechDashboard from '@/pages/technician/TechDashboard';
import TechnicianElevatorSearch from '@/pages/technician/TechnicianElevatorSearch';
import ServiceRecordForm from '@/pages/technician/ServiceRecordForm';
import ServiceRecordDetail from '@/pages/technician/ServiceRecordDetail';

// Supervisor
import SupervisorDashboard from '@/pages/supervisor/SupervisorDashboard';
import PendingReviewsPage from '@/pages/supervisor/PendingReviewsPage';
import ServiceReviewPage from '@/pages/supervisor/ServiceReviewPage';
import MonthlyReportsPage from '@/pages/supervisor/MonthlyReportsPage';
import MonthlyReportDetailPage from '@/pages/supervisor/MonthlyReportDetailPage';

// Responsible
import ResponsibleDashboard from '@/pages/responsible/ResponsibleDashboard';

export default function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        <Route path={ROUTES.PUBLIC_ELEVATOR} element={<PublicElevatorView />} />

        {/* Admin routes */}
        <Route
          path={ROUTES.ADMIN_DASHBOARD}
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN_CLIENTS}
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ClientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN_BUILDINGS}
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <BuildingsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path={ROUTES.ADMIN_ELEVATORS}
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <ElevatorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/mantenimientos"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <AdminServiceReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/mantenimientos/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'supervisor']}>
              <AdminServiceReviewDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Technician routes */}
        <Route
          path={ROUTES.TECH_DASHBOARD}
          element={
            <ProtectedRoute allowedRoles={['technician', 'admin']}>
              <TechDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tecnico/ascensores"
          element={
            <ProtectedRoute allowedRoles={['technician', 'admin']}>
              <TechnicianElevatorSearch />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tecnico/ascensores/:elevatorId/mantenimiento/nuevo"
          element={
            <ProtectedRoute allowedRoles={['technician', 'admin']}>
              <ServiceRecordForm />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tecnico/mantenimientos"
          element={
            <ProtectedRoute allowedRoles={['technician', 'admin']}>
              <TechDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tecnico/mantenimientos/:id"
          element={
            <ProtectedRoute allowedRoles={['technician', 'admin']}>
              <ServiceRecordDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/tecnico/mantenimientos/:id/editar"
          element={
            <ProtectedRoute allowedRoles={['technician', 'admin']}>
              <ServiceRecordForm />
            </ProtectedRoute>
          }
        />

        {/* Supervisor routes */}
        <Route
          path={ROUTES.SUPERVISOR_DASHBOARD}
          element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <SupervisorDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/revisiones"
          element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <PendingReviewsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/revisiones/:id"
          element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <ServiceReviewPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/informes"
          element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <MonthlyReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/supervisor/informes/:id"
          element={
            <ProtectedRoute allowedRoles={['supervisor', 'admin']}>
              <MonthlyReportDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Responsible routes */}
        <Route
          path={ROUTES.RESPONSIBLE_DASHBOARD}
          element={
            <ProtectedRoute allowedRoles={['responsible']}>
              <ResponsibleDashboard />
            </ProtectedRoute>
          }
        />

        {/* Default redirect */}
        <Route path="/" element={<Navigate to={ROUTES.LOGIN} replace />} />
        <Route path="*" element={<Navigate to={ROUTES.LOGIN} replace />} />
      </Routes>
    </BrowserRouter>
  );
}
