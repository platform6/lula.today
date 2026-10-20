import { Navigate, Route, Routes, useParams } from 'react-router-dom';
import { useAuth } from './auth/AuthProvider';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { ResetPassword } from './pages/ResetPassword';
import { Today } from './pages/Today';
import { Inbox } from './pages/Inbox';
import { InboxSort } from './pages/InboxSort';
import { Areas } from './pages/Areas';
import { AreaPage } from './pages/AreaPage';
import { Board, RealmBoard } from './pages/Board';
import { ProjectSettings } from './pages/ProjectSettings';
import { AllTasks } from './pages/AllTasks';
import { Search } from './pages/Search';
import { Archive } from './pages/Archive';
import { Settings } from './pages/Settings';

/** Areas are shown as "Realms"; old /areas links keep working. */
function AreasRedirect() {
  const rest = useParams()['*'];
  return <Navigate to={rest ? `/realms/${rest}` : '/realms'} replace />;
}

export function App() {
  const { user, loading, recovering } = useAuth();

  if (loading) return <div className="grid h-full place-items-center text-muted">Loading…</div>;
  if (recovering) return <ResetPassword />;
  if (!user) return <Login />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Today />} />
        <Route path="inbox" element={<Inbox />} />
        <Route path="inbox/sort" element={<InboxSort />} />
        <Route path="realms" element={<Areas />} />
        <Route path="realms/:id" element={<RealmBoard />} />
        <Route path="realms/:id/options" element={<AreaPage />} />
        <Route path="areas/*" element={<AreasRedirect />} />
        <Route path="projects" element={<Navigate to="/realms" replace />} />
        <Route path="projects/:id" element={<Board />} />
        <Route path="projects/:id/settings" element={<ProjectSettings />} />
        <Route path="tasks" element={<AllTasks />} />
        <Route path="search" element={<Search />} />
        <Route path="archive" element={<Archive />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
