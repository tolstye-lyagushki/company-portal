import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, CircleAlert, FileText, Inbox, ListChecks, Plus, Users, type LucideIcon } from 'lucide-react';
import { useStore } from '../store';
import type { Tone } from '../lib/utils';
import { PRIORITY, REQUEST_STATUS, TASK_STATUS, dueLabel, formatDateTime, formatDayLong, today } from '../lib/utils';
import { Badge, EmptyState } from '../components/ui';
import { TakoyakiIllustration } from '../components/Brand';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export default function Home() {
  const { state, me, access, empName } = useStore();
  const now = today();
  const tasksOn = access.has('tasks.access');
  const requestsOn = access.has('requests.access');
  const kbOn = access.has('kb.view');
  const lead = access.has('requests.viewAll');

  const myTasks = state.tasks
    .filter((t) => t.assigneeId === me.id && t.status !== 'done' && access.canViewTask(t))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = myTasks.filter((t) => t.dueDate < now).length;

  const requests = state.requests.filter(access.canViewRequest).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pending = requests.filter((r) => r.status === 'new' || r.status === 'reviewing').length;

  const visibleArticles = state.articles.filter(access.canViewArticle);
  const articles = [...visibleArticles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  const quick: { to: string; icon: LucideIcon; tone: Tone; label: string }[] = [];
  if (tasksOn && access.has('tasks.create')) quick.push({ to: '/tasks?new=1', icon: Plus, tone: 'blue', label: 'Новая задача' });
  if (requestsOn) quick.push({ to: '/requests?new=1', icon: Inbox, tone: 'amber', label: 'Создать заявку' });
  if (kbOn && access.has('kb.create')) quick.push({ to: '/kb/new', icon: FileText, tone: 'teal', label: 'Написать статью' });
  if (access.has('employees.view')) quick.push({ to: '/people', icon: Users, tone: 'violet', label: 'Найти коллегу' });

  const stats: { to: string; icon: LucideIcon; value: number; label: string; tone: Tone }[] = [];
  if (tasksOn) {
    stats.push({ to: '/tasks', icon: ListChecks, value: myTasks.length, label: 'Мои задачи в работе', tone: 'blue' });
    stats.push({ to: '/tasks', icon: CircleAlert, value: overdue, label: 'Просрочено', tone: overdue ? 'red' : 'gray' });
  }
  if (requestsOn) {
    stats.push({ to: '/requests', icon: Inbox, value: pending, label: lead ? 'Заявки ждут решения' : 'Мои заявки в работе', tone: 'amber' });
  }
  if (kbOn) stats.push({ to: '/kb', icon: BookOpen, value: visibleArticles.length, label: 'Статей в базе знаний', tone: 'teal' });

  return (
    <>
      <section className="hero">
        <div className="hero-text">
          <span className="hero-kicker">Такояки · Такояки-мисэ · Санкт-Петербург</span>
          <h1 className="hero-title">
            {greeting()}, {me.name.split(' ')[0]}!
          </h1>
          <p className="hero-sub">
            {formatDayLong(now)} · {me.position}
          </p>
        </div>
        <TakoyakiIllustration className="hero-art" />
      </section>

      {quick.length > 0 && (
        <div className="quick">
          {quick.map((q) => (
            <Link key={q.to} to={q.to} className="quick-item">
              <span className={`quick-icon tone-${q.tone}`}><q.icon size={18} /></span> {q.label}
            </Link>
          ))}
        </div>
      )}

      {stats.length > 0 && (
        <div className="stats">
          {stats.map((s) => (
            <Link key={s.label} to={s.to} className="stat">
              <span className={`stat-icon tone-${s.tone}`}><s.icon size={18} /></span>
              <span className="stat-value">{s.value}</span>
              <span className="stat-label">{s.label}</span>
            </Link>
          ))}
        </div>
      )}

      <div className="home-grid">
        {tasksOn && (
          <section className="card">
            <div className="card-head">
              <h2 className="card-title">Мои задачи</h2>
              <Link to="/tasks" className="link-more">Все задачи <ChevronRight size={15} /></Link>
            </div>
            {myTasks.length === 0 ? (
              <EmptyState title="Открытых задач нет" text="Новые поручения появятся здесь." />
            ) : (
              <div className="list">
                {myTasks.slice(0, 6).map((t) => (
                  <Link key={t.id} to={`/tasks/${t.id}`} className="list-item">
                    <div className="list-main">
                      <div className="list-title">{t.title}</div>
                      <div className={`small ${t.dueDate < now ? 'danger-text' : 'muted'}`}>
                        Срок: {dueLabel(t.dueDate)} · приоритет {PRIORITY[t.priority].label.toLowerCase()}
                      </div>
                    </div>
                    <Badge tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {requestsOn && (
          <section className={`card${tasksOn ? '' : ' span-all'}`}>
            <div className="card-head">
              <h2 className="card-title">{lead ? 'Последние заявки' : 'Мои заявки'}</h2>
              <Link to="/requests" className="link-more">Все заявки <ChevronRight size={15} /></Link>
            </div>
            {requests.length === 0 ? (
              <EmptyState title="Заявок пока нет" text="Создайте заявку на отпуск, оборудование или доступы." />
            ) : (
              <div className="list">
                {requests.slice(0, 5).map((r) => (
                  <Link key={r.id} to={`/requests/${r.id}`} className="list-item">
                    <div className="list-main">
                      <div className="list-title">{r.title}</div>
                      <div className="muted small">
                        {r.category} · {empName(r.authorId)} · {formatDateTime(r.updatedAt)}
                      </div>
                    </div>
                    <Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </section>
        )}

        {kbOn && (
          <section className="card span-all">
            <div className="card-head">
              <h2 className="card-title">Последние статьи</h2>
              <Link to="/kb" className="link-more">База знаний <ChevronRight size={15} /></Link>
            </div>
            <div className="list">
              {articles.map((a) => (
                <Link key={a.id} to={`/kb/${a.id}`} className="list-item">
                  <div className="list-main">
                    <div className="list-title">{a.title}</div>
                    <div className="muted small">
                      {state.categories.find((c) => c.id === a.categoryId)?.name ?? 'Без категории'} · {empName(a.authorId)} ·
                      обновлена {formatDateTime(a.updatedAt)}
                    </div>
                  </div>
                  {a.status === 'draft' && <Badge tone="amber">Черновик</Badge>}
                </Link>
              ))}
              {articles.length === 0 && <EmptyState title="Статей пока нет" />}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
