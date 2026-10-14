import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, Mail, Pencil, Phone, Search, Users } from 'lucide-react';
import type { Role } from '../types';
import { useStore } from '../store';
import { ROLE, ROLE_ORDER, TASK_STATUS, byName, dueLabel, formatDate, matches, plural, today } from '../lib/utils';
import { Avatar, Badge, Button, EmptyState } from '../components/ui';
import { EmployeeForm } from '../components/EmployeeForm';
import { AccessDenied } from '../components/AccessDenied';

export function EmployeeList() {
  const { state } = useStore();
  const [query, setQuery] = useState('');
  const [department, setDepartment] = useState('all');
  const [role, setRole] = useState<'all' | Role>('all');

  const departments = useMemo(
    () => [...new Set(state.employees.map((e) => e.department))].sort((a, b) => a.localeCompare(b, 'ru')),
    [state.employees],
  );
  const people = state.employees
    .filter((e) => department === 'all' || e.department === department)
    .filter((e) => role === 'all' || e.role === role)
    .filter((e) => matches(query, e.name, e.position, e.department))
    .sort(byName);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Сотрудники</h1>
          <p className="page-sub">
            {state.employees.length} {plural(state.employees.length, 'человек', 'человека', 'человек')} ·{' '}
            {departments.length} {plural(departments.length, 'подразделение', 'подразделения', 'подразделений')}
          </p>
        </div>
      </div>

      <div className="toolbar">
        <div className="search toolbar-grow">
          <Search size={16} className="search-icon" />
          <input className="input search-input" type="search" placeholder="Поиск по имени, должности, подразделению" aria-label="Поиск сотрудников" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="select" aria-label="Подразделение" value={department} onChange={(e) => setDepartment(e.target.value)}>
          <option value="all">Все подразделения</option>
          {departments.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
        <select className="select" aria-label="Роль" value={role} onChange={(e) => setRole(e.target.value as typeof role)}>
          <option value="all">Все роли</option>
          {ROLE_ORDER.map((r) => (
            <option key={r} value={r}>{ROLE[r].label}</option>
          ))}
        </select>
      </div>

      {people.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Users size={22} />}
            title="Сотрудники не найдены"
            text="Измените условия поиска."
            action={
              <Button
                onClick={() => {
                  setQuery('');
                  setDepartment('all');
                  setRole('all');
                }}
              >
                Сбросить фильтры
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-3">
          {people.map((e) => (
            <Link key={e.id} to={`/people/${e.id}`} className="card card-link person-card">
              <Avatar name={e.name} id={e.id} size="lg" />
              <div className="person-card-main">
                <div className="person-card-name">{e.name}</div>
                <div className="muted small">{e.position}</div>
                <div className="person-card-foot">
                  <span className="muted small"><Building2 size={13} /> {e.department}</span>
                  <Badge tone={ROLE[e.role].tone}>{ROLE[e.role].label}</Badge>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function EmployeeProfile() {
  const { id } = useParams();
  const { state, me, access, emp } = useStore();
  const [editing, setEditing] = useState(false);
  const person = emp(id);

  // свой профиль доступен всегда, чужие — при праве на справочник сотрудников
  if (person && !access.canViewProfile(person)) return <AccessDenied section="Сотрудники" />;
  if (!person) {
    return (
      <div className="card">
        <EmptyState icon={<Users size={22} />} title="Сотрудник не найден" action={<Link to="/people" className="btn btn-secondary">К списку сотрудников</Link>} />
      </div>
    );
  }

  const now = today();
  // в профиле только те задачи и статьи, которые текущему пользователю разрешено видеть
  const showTasks = access.has('tasks.access');
  const tasks = state.tasks
    .filter((t) => t.assigneeId === person.id && t.status !== 'done' && access.canViewTask(t))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const articles = state.articles
    .filter((a) => a.authorId === person.id && access.canViewArticle(a))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <>
      <div className="article-top">
        {access.has('employees.view') ? (
          <Link to="/people" className="back-link">
            <ArrowLeft size={16} /> Сотрудники
          </Link>
        ) : (
          <span />
        )}
        {access.canEditProfile(person) && (
          <Button onClick={() => setEditing(true)}>
            <Pencil size={16} /> Редактировать
          </Button>
        )}
      </div>

      <div className="card profile-head">
        <Avatar name={person.name} id={person.id} size="xl" />
        <div className="profile-main">
          <h1 className="page-title">
            {person.name} {person.id === me.id && <span className="muted profile-you">это вы</span>}
          </h1>
          <div className="profile-pos">{person.position}</div>
          <div className="profile-tags">
            <Badge tone="gray">{person.department}</Badge>
            <Badge tone={ROLE[person.role].tone}>{ROLE[person.role].label}</Badge>
          </div>
          {person.about && <p className="profile-about">{person.about}</p>}
        </div>
        <div className="profile-contacts">
          {person.email && (
            <a href={`mailto:${person.email}`} className="contact"><Mail size={16} /> {person.email}</a>
          )}
          {person.phone && (
            <a href={`tel:${person.phone.replace(/[^\d+]/g, '')}`} className="contact"><Phone size={16} /> {person.phone}</a>
          )}
          {person.hiredAt && <span className="muted small">В компании с {formatDate(person.hiredAt)}</span>}
        </div>
      </div>

      <div className="home-grid">
        {showTasks && (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Открытые задачи · {tasks.length}</h2>
          </div>
          {tasks.length === 0 ? (
            <EmptyState title="Открытых задач нет" />
          ) : (
            <div className="list">
              {tasks.map((t) => (
                <Link key={t.id} to={`/tasks/${t.id}`} className="list-item">
                  <div className="list-main">
                    <div className="list-title">{t.title}</div>
                    <div className={`small ${t.dueDate < now ? 'danger-text' : 'muted'}`}>Срок: {dueLabel(t.dueDate)}</div>
                  </div>
                  <Badge tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge>
                </Link>
              ))}
            </div>
          )}
        </section>
        )}

        <section className={`card${showTasks ? '' : ' span-all'}`}>
          <div className="card-head">
            <h2 className="card-title">Статьи в базе знаний · {articles.length}</h2>
          </div>
          {articles.length === 0 ? (
            <EmptyState title="Сотрудник пока не писал статей" />
          ) : (
            <div className="list">
              {articles.map((a) => (
                <Link key={a.id} to={`/kb/${a.id}`} className="list-item">
                  <div className="list-main">
                    <div className="list-title">{a.title}</div>
                    <div className="muted small">Обновлена {formatDate(a.updatedAt)}</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {editing && <EmployeeForm employee={person} onClose={() => setEditing(false)} />}
    </>
  );
}
