import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import type { Permission } from './types';
import { UiProvider } from './components/ui';
import { StoreProvider, useStore } from './store';
import { Layout } from './components/Layout';
import { RequireAccess } from './components/AccessDenied';
import Home from './pages/Home';
import { ArticleEdit, ArticleView, KnowledgeList } from './pages/Knowledge';
import Tasks from './pages/Tasks';
import Requests from './pages/Requests';
import { EmployeeList, EmployeeProfile } from './pages/Employees';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';
import './styles.css';

/** Раздел открывается только при наличии права — и из меню, и по прямой ссылке. */
function Section({ perm, title, children }: { perm: Permission; title: string; children: ReactNode }) {
  const { access } = useStore();
  return (
    <RequireAccess allowed={access.has(perm)} section={title}>
      {children}
    </RequireAccess>
  );
}

function AdminSection() {
  const { access } = useStore();
  return (
    <RequireAccess allowed={access.canOpenAdmin()} section="Администрирование">
      <Admin />
    </RequireAccess>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiProvider>
      <StoreProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="kb" element={<Section perm="kb.view" title="База знаний"><KnowledgeList /></Section>} />
              <Route path="kb/new" element={<Section perm="kb.view" title="База знаний"><ArticleEdit key="new" /></Section>} />
              <Route path="kb/:id" element={<Section perm="kb.view" title="База знаний"><ArticleView /></Section>} />
              <Route path="kb/:id/edit" element={<Section perm="kb.view" title="База знаний"><ArticleEdit /></Section>} />
              <Route path="tasks/:id?" element={<Section perm="tasks.access" title="Задачи"><Tasks /></Section>} />
              <Route path="requests/:id?" element={<Section perm="requests.access" title="Заявки"><Requests /></Section>} />
              <Route path="people" element={<Section perm="employees.view" title="Сотрудники"><EmployeeList /></Section>} />
              {/* свой профиль открыт всегда, чужой — по праву на справочник (проверка внутри страницы) */}
              <Route path="people/:id" element={<EmployeeProfile />} />
              <Route path="admin" element={<AdminSection />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
      </StoreProvider>
    </UiProvider>
  </StrictMode>,
);
