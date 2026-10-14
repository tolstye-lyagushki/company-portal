import { Link } from 'react-router-dom';
import { BookOpen, ChevronRight, CircleAlert, FileText, Inbox, ListChecks, Plus, Users } from 'lucide-react';
import { useStore } from '../store';
import { PRIORITY, REQUEST_STATUS, TASK_STATUS, dueLabel, formatDateTime, formatDayLong, today } from '../lib/utils';
import { Badge, EmptyState } from '../components/ui';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'Доброй ночи';
  if (h < 12) return 'Доброе утро';
  if (h < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export default function Home() {
  const { state, me, can, empName } = useStore();
  const now = today();
  const lead = can('request.viewAll');

  const myTasks = state.tasks
    .filter((t) => t.assigneeId === me.id && t.status !== 'done')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const overdue = myTasks.filter((t) => t.dueDate < now).length;

  const requests = (lead ? state.requests : state.requests.filter((r) => r.authorId === me.id))
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const pending = requests.filter((r) => r.status === 'new' || r.status === 'reviewing').length;

  const articles = [...state.articles].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);

  const stats = [
    { to: '/tasks', icon: ListChecks, value: myTasks.length, label: 'Мои задачи в работе', tone: 'blue' },
    { to: '/tasks', icon: CircleAlert, value: overdue, label: 'Просрочено', tone: overdue ? 'red' : 'gray' },
    { to: '/requests', icon: Inbox, value: pending, label: lead ? 'Заявки ждут решения' : 'Мои заявки в работе', tone: 'amber' },
    { to: '/kb', icon: BookOpen, value: state.articles.length, label: 'Статей в базе знаний', tone: 'teal' },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">
            {greeting()}, {me.name.split(' ')[0]}!
          </h1>
          <p className="page-sub">
            {formatDayLong(now)} · {me.position}
          </p>
        </div>
      </div>

      <div className="quick">
        <Link to="/tasks?new=1" className="quick-item">
          <span className="quick-icon tone-blue"><Plus size={18} /></span> Новая задача
        </Link>
        <Link to="/requests?new=1" className="quick-item">
          <span className="quick-icon tone-amber"><Inbox size={18} /></span> Создать заявку
        </Link>
        <Link to="/kb/new" className="quick-item">
          <span className="quick-icon tone-teal"><FileText size={18} /></span> Написать статью
        </Link>
        <Link to="/people" className="quick-item">
          <span className="quick-icon tone-violet"><Users size={18} /></span> Найти коллегу
        </Link>
      </div>

      <div className="stats">
        {stats.map((s) => (
          <Link key={s.label} to={s.to} className="stat">
            <span className={`stat-icon tone-${s.tone}`}><s.icon size={18} /></span>
            <span className="stat-value">{s.value}</span>
            <span className="stat-label">{s.label}</span>
          </Link>
        ))}
      </div>

      <div className="home-grid">
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

        <section className="card">
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
              </Link>
            ))}
            {articles.length === 0 && <EmptyState title="Статей пока нет" />}
          </div>
        </section>
      </div>
    </>
  );
}
