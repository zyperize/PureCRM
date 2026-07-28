import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate, useLocation } from 'react-router';
import Layout from './components/layout/Layout';
import AuthGate from './components/auth/AuthGate';
import SetupWizard from './components/setup/SetupWizard';
import { isConfigValid } from './services/supabase';
import { getWorkspaceConfig, isWorkspaceConfigured } from './services/workspaceConfig';
import { trackPageview } from './services/analytics';

function PageviewTracker() {
  const location = useLocation();
  useEffect(() => {
    trackPageview(location.pathname + location.search);
  }, [location]);
  return null;
}

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Leads = lazy(() => import('./pages/Leads'));
const LeadDetail = lazy(() => import('./pages/LeadDetail'));
const LeadMap = lazy(() => import('./components/leads/LeadMap'));
const Calling = lazy(() => import('./pages/Calling'));
const ManageQuestions = lazy(() => import('./pages/ManageQuestions'));
const TasksList = lazy(() => import('./pages/TasksList'));
const FollowUpCalendar = lazy(() => import('./pages/FollowUpCalendar'));
const Settings = lazy(() => import('./pages/Settings'));
const CallingScriptsAdmin = lazy(() => import('./pages/CallingScriptsAdmin'));
const TaskTemplates = lazy(() => import('./pages/TaskTemplates'));
const UploadData = lazy(() => import('./pages/UploadData'));
const SavedSearches = lazy(() => import('./pages/SavedSearches'));
const Reports = lazy(() => import('./pages/Reports'));
const EmailAutomation = lazy(() => import('./pages/Outreach'));
const FollowUpTasks = lazy(() => import('./pages/FollowUpTasks'));
const CallingScripts = lazy(() => import('./pages/CallingScripts'));
const ProfileSettings = lazy(() => import('./pages/ProfileSettings'));
const WorkspaceSettings = lazy(() => import('./pages/WorkspaceSettings'));
const Customers = lazy(() => import('./pages/Customers'));
const Duplicates = lazy(() => import('./pages/Duplicates'));

function RouteFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-charcoal-800 px-4 py-3 text-sm text-gray-300">
        <div className="h-4 w-4 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
        Loading workspace
      </div>
    </div>
  );
}

function App() {
  const workspaceConfig = getWorkspaceConfig();
  if (!isConfigValid || !isWorkspaceConfigured(workspaceConfig)) return <SetupWizard />;
  const Router = '__TAURI_INTERNALS__' in window ? HashRouter : BrowserRouter;

  return (
      <Router>
        <AuthGate>
          <PageviewTracker />
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
              <Route path="leads" element={<Suspense fallback={<RouteFallback />}><Leads /></Suspense>} />
              <Route path="leads/:id" element={<Suspense fallback={<RouteFallback />}><LeadDetail /></Suspense>} />
              <Route path="customers" element={<Suspense fallback={<RouteFallback />}><Customers /></Suspense>} />
              <Route path="duplicates" element={<Suspense fallback={<RouteFallback />}><Duplicates /></Suspense>} />
              <Route path="map" element={<Suspense fallback={<RouteFallback />}><LeadMap /></Suspense>} />
              <Route path="calling" element={<Suspense fallback={<RouteFallback />}><Calling /></Suspense>} />
              <Route path="qualification" element={<Suspense fallback={<RouteFallback />}><ManageQuestions /></Suspense>} />
              <Route path="tasks" element={<Suspense fallback={<RouteFallback />}><TasksList /></Suspense>} />
              <Route path="tasks/calendar" element={<Suspense fallback={<RouteFallback />}><FollowUpCalendar /></Suspense>} />
              <Route path="upload-data" element={<Suspense fallback={<RouteFallback />}><UploadData /></Suspense>} />
              <Route path="saved-searches" element={<Suspense fallback={<RouteFallback />}><SavedSearches /></Suspense>} />
              <Route path="reports" element={<Suspense fallback={<RouteFallback />}><Reports /></Suspense>} />
              <Route path="automation" element={<Suspense fallback={<RouteFallback />}><EmailAutomation /></Suspense>} />
              <Route path="outreach" element={<Navigate to="/automation" replace />} />
              <Route path="follow-up-tasks" element={<Suspense fallback={<RouteFallback />}><FollowUpTasks /></Suspense>} />
              <Route path="calling-scripts" element={<Suspense fallback={<RouteFallback />}><CallingScripts /></Suspense>} />
              <Route path="settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
              <Route path="settings/profile" element={<Suspense fallback={<RouteFallback />}><ProfileSettings /></Suspense>} />
              <Route path="settings/workspace" element={<Suspense fallback={<RouteFallback />}><WorkspaceSettings /></Suspense>} />
              <Route path="settings/scripts" element={<Suspense fallback={<RouteFallback />}><CallingScriptsAdmin /></Suspense>} />
              <Route path="settings/tasks" element={<Suspense fallback={<RouteFallback />}><TaskTemplates /></Suspense>} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthGate>
      </Router>
  );
}

export default App;
