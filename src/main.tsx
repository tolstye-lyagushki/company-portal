import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { UiProvider } from './components/ui';
import { StoreProvider } from './store';
import { Layout } from './components/Layout';
import Home from './pages/Home';
import { ArticleEdit, ArticleView, KnowledgeList } from './pages/Knowledge';
import Tasks from './pages/Tasks';
import Requests from './pages/Requests';
import { EmployeeList, EmployeeProfile } from './pages/Employees';
import Admin from './pages/Admin';
import NotFound from './pages/NotFound';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <UiProvider>
      <StoreProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="kb" element={<KnowledgeList />} />
              <Route path="kb/new" element={<ArticleEdit key="new" />} />
              <Route path="kb/:id" element={<ArticleView />} />
              <Route path="kb/:id/edit" element={<ArticleEdit />} />
              <Route path="tasks/:id?" element={<Tasks />} />
              <Route path="requests/:id?" element={<Requests />} />
              <Route path="people" element={<EmployeeList />} />
              <Route path="people/:id" element={<EmployeeProfile />} />
              <Route path="admin" element={<Admin />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </HashRouter>
      </StoreProvider>
    </UiProvider>
  </StrictMode>,
);
