import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Pencil, Plus, RotateCcw, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import type { Category, Employee, Role } from '../types';
import { useStore } from '../store';
import { ROLE, ROLE_ORDER, byName, formatDateTime, matches, plural } from '../lib/utils';
import { Avatar, Badge, Button, EmptyState, Field, IconButton, Modal, useUi } from '../components/ui';
import { EmployeeForm } from '../components/EmployeeForm';

type Tab = 'users' | 'roles' | 'categories' | 'log' | 'data';
const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Пользователи' },
  { id: 'roles', label: 'Роли' },
  { id: 'categories', label: 'Категории' },
  { id: 'log', label: 'Журнал' },
  { id: 'data', label: 'Данные' },
];

function UsersTab() {
  const { state, me, actions } = useStore();
  const { confirm, toast } = useUi();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<Employee | 'new' | null>(null);
  const admins = state.employees.filter((e) => e.role === 'admin').length;

  const changeRole = (employee: Employee, role: Role) => {
    if (employee.role === 'admin' && role !== 'admin' && admins === 1) {
      toast('В портале должен остаться хотя бы один администратор', 'error');
      return;
    }
    actions.setRole(employee.id, role);
    toast(`${employee.name}: роль «${ROLE[role].label}»`);
  };

  const remove = async (employee: Employee) => {
    const tasks = state.tasks.filter((t) => t.assigneeId === employee.id).length;
    const ok = await confirm({
      title: 'Удалить сотрудника?',
      text: `${employee.name} будет удалён из портала.${tasks ? ` Его задачи (${tasks}) останутся без ответственного.` : ''}`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    actions.deleteEmployee(employee.id);
    toast('Сотрудник удалён');
  };

  const people = state.employees.filter((e) => matches(query, e.name, e.position, e.department)).sort(byName);

  return (
    <>
      <div className="toolbar">
        <div className="search toolbar-grow">
          <Search size={16} className="search-icon" />
          <input className="input search-input" type="search" placeholder="Поиск сотрудника" aria-label="Поиск сотрудника" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Button variant="primary" onClick={() => setForm('new')}>
          <UserPlus size={16} /> Добавить сотрудника
        </Button>
      </div>
      <div className="card rows rows-users">
        <div className="row row-head">
          <span>Сотрудник</span>
          <span>Подразделение</span>
          <span>Роль</span>
          <span />
        </div>
        {people.map((e) => (
          <div key={e.id} className="row">
            <Link to={`/people/${e.id}`} className="person-inline">
              <Avatar name={e.name} id={e.id} size="sm" />
              <span>
                <span className="row-title">{e.name}</span>
                <span className="muted small"> {e.position}</span>
              </span>
            </Link>
            <span className="muted">{e.department}</span>
            <select className="select select-sm" aria-label={`Роль: ${e.name}`} value={e.role} onChange={(ev) => changeRole(e, ev.target.value as Role)}>
              {ROLE_ORDER.map((r) => (
                <option key={r} value={r}>{ROLE[r].label}</option>
              ))}
            </select>
            <span className="row-actions">
              <IconButton label="Редактировать" onClick={() => setForm(e)}>
                <Pencil size={16} />
              </IconButton>
              <IconButton
                label={e.id === me.id ? 'Нельзя удалить себя' : 'Удалить'}
                disabled={e.id === me.id}
                className="danger-text"
                onClick={() => remove(e)}
              >
                <Trash2 size={16} />
              </IconButton>
            </span>
          </div>
        ))}
        {people.length === 0 && <EmptyState title="Сотрудники не найдены" />}
      </div>
      {form && <EmployeeForm employee={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
    </>
  );
}

const MATRIX: { label: string; roles: Role[] }[] = [
  { label: 'Читать базу знаний, создавать статьи, редактировать свои', roles: ['employee', 'manager', 'admin'] },
  { label: 'Редактировать и удалять любые статьи', roles: ['manager', 'admin'] },
  { label: 'Создавать задачи, менять статус своих задач', roles: ['employee', 'manager', 'admin'] },
  { label: 'Редактировать и удалять любые задачи', roles: ['manager', 'admin'] },
  { label: 'Создавать заявки и видеть свои', roles: ['employee', 'manager', 'admin'] },
  { label: 'Видеть все заявки и принимать по ним решения', roles: ['manager', 'admin'] },
  { label: 'Удалять любые заявки', roles: ['admin'] },
  { label: 'Управлять пользователями, ролями и категориями', roles: ['admin'] },
  { label: 'Смотреть журнал действий и сбрасывать данные', roles: ['admin'] },
];

function RolesTab() {
  const { state } = useStore();
  return (
    <>
      <div className="grid grid-3">
        {ROLE_ORDER.map((r) => {
          const people = state.employees.filter((e) => e.role === r).sort(byName);
          return (
            <div key={r} className="card role-card">
              <div className="card-head">
                <Badge tone={ROLE[r].tone}>{ROLE[r].label}</Badge>
                <span className="muted small">
                  {people.length} {plural(people.length, 'человек', 'человека', 'человек')}
                </span>
              </div>
              <div className="role-people">
                {people.map((e) => (
                  <Link key={e.id} to={`/people/${e.id}`} className="person-inline small">
                    <Avatar name={e.name} id={e.id} size="sm" /> {e.name}
                  </Link>
                ))}
                {people.length === 0 && <span className="muted small">Никого нет</span>}
              </div>
            </div>
          );
        })}
      </div>
      <div className="card matrix-wrap">
        <table className="matrix">
          <thead>
            <tr>
              <th>Что разрешено</th>
              {ROLE_ORDER.map((r) => (
                <th key={r}>{ROLE[r].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MATRIX.map((row) => (
              <tr key={row.label}>
                <td>{row.label}</td>
                {ROLE_ORDER.map((r) => (
                  <td key={r} className="matrix-cell">
                    {row.roles.includes(r) ? <Check size={16} className="ok-text" aria-label="Да" /> : <span className="muted" aria-label="Нет">—</span>}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        <ShieldCheck size={15} /> Роль сотрудника назначается на вкладке «Пользователи». В прототипе набор прав для каждой роли
        фиксирован, а проверка выполняется только в браузере — это демонстрация, а не защита доступа.
      </p>
    </>
  );
}

function CategoriesTab() {
  const { state, actions } = useStore();
  const { confirm, toast } = useUi();
  const [editing, setEditing] = useState<Category | 'new' | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const open = (category: Category | 'new') => {
    setEditing(category);
    setName(category === 'new' ? '' : category.name);
    setError('');
  };

  const save = () => {
    const value = name.trim();
    if (!value) return setError('Укажите название категории');
    const currentId = editing && editing !== 'new' ? editing.id : undefined;
    if (state.categories.some((c) => c.id !== currentId && c.name.toLowerCase() === value.toLowerCase())) {
      return setError('Такая категория уже есть');
    }
    actions.saveCategory(value, currentId);
    toast(currentId ? 'Категория переименована' : 'Категория добавлена');
    setEditing(null);
  };

  const remove = async (category: Category) => {
    const count = state.articles.filter((a) => a.categoryId === category.id).length;
    const ok = await confirm({
      title: 'Удалить категорию?',
      text: count
        ? `В категории «${category.name}» ${count} ${plural(count, 'статья', 'статьи', 'статей')}. Они останутся в базе знаний без категории.`
        : `Категория «${category.name}» будет удалена.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    actions.deleteCategory(category.id);
    toast('Категория удалена');
  };

  return (
    <>
      <div className="toolbar">
        <span className="toolbar-grow muted">Категории статей базы знаний</span>
        <Button variant="primary" onClick={() => open('new')}>
          <Plus size={16} /> Добавить категорию
        </Button>
      </div>
      <div className="card rows rows-categories">
        <div className="row row-head">
          <span>Категория</span>
          <span>Статей</span>
          <span />
        </div>
        {state.categories.map((c) => (
          <div key={c.id} className="row">
            <span className="row-title">{c.name}</span>
            <span className="muted">{state.articles.filter((a) => a.categoryId === c.id).length}</span>
            <span className="row-actions">
              <IconButton label="Переименовать" onClick={() => open(c)}>
                <Pencil size={16} />
              </IconButton>
              <IconButton label="Удалить" className="danger-text" onClick={() => remove(c)}>
                <Trash2 size={16} />
              </IconButton>
            </span>
          </div>
        ))}
        {state.categories.length === 0 && <EmptyState title="Категорий пока нет" />}
      </div>
      {editing && (
        <Modal
          title={editing === 'new' ? 'Новая категория' : 'Переименовать категорию'}
          size="sm"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>Отмена</Button>
              <Button variant="primary" onClick={save}>Сохранить</Button>
            </>
          }
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save();
            }}
          >
            <Field label="Название" error={error}>
              <input
                className="input"
                autoFocus
                maxLength={40}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError('');
                }}
              />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

function LogTab() {
  const { state, empName } = useStore();
  const [query, setQuery] = useState('');
  const [section, setSection] = useState('all');
  const sections = useMemo(() => [...new Set(state.log.map((l) => l.section))].sort((a, b) => a.localeCompare(b, 'ru')), [state.log]);
  const entries = state.log
    .filter((l) => section === 'all' || l.section === section)
    .filter((l) => matches(query, l.text, empName(l.userId)));

  return (
    <>
      <div className="toolbar">
        <div className="search toolbar-grow">
          <Search size={16} className="search-icon" />
          <input className="input search-input" type="search" placeholder="Поиск по журналу" aria-label="Поиск по журналу" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="select" aria-label="Раздел" value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="all">Все разделы</option>
          {sections.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="card rows rows-log">
        <div className="row row-head">
          <span>Когда</span>
          <span>Кто</span>
          <span>Раздел</span>
          <span>Действие</span>
        </div>
        {entries.map((l) => (
          <div key={l.id} className="row">
            <span className="muted">{formatDateTime(l.at)}</span>
            <span>{empName(l.userId)}</span>
            <span><Badge tone="gray">{l.section}</Badge></span>
            <span>{l.text}</span>
          </div>
        ))}
        {entries.length === 0 && <EmptyState title="Записей не найдено" />}
      </div>
      <p className="note">Журнал хранит последние 300 действий, выполненных в этом браузере.</p>
    </>
  );
}

function DataTab() {
  const { state, actions } = useStore();
  const { confirm, toast } = useUi();
  // localStorage хранит строки в UTF-16 — по два байта на символ
  const size = useMemo(() => Math.round((JSON.stringify(state).length * 2) / 1024), [state]);

  const reset = async () => {
    const ok = await confirm({
      title: 'Сбросить демо-данные?',
      text: 'Все изменения в этом браузере будут удалены, портал вернётся к исходному демонстрационному набору.',
      confirmLabel: 'Сбросить',
      danger: true,
    });
    if (!ok) return;
    actions.resetDemo();
    toast('Демо-данные возвращены к исходному состоянию');
  };

  const rows = [
    ['Сотрудники', state.employees.length],
    ['Статьи', state.articles.length],
    ['Задачи', state.tasks.length],
    ['Заявки', state.requests.length],
    ['Записи журнала', state.log.length],
  ] as const;

  return (
    <div className="grid grid-2">
      <div className="card card-pad">
        <h2 className="card-title">Что хранится в браузере</h2>
        <dl className="data-list">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div>
            <dt>Занято в хранилище</dt>
            <dd>≈ {size} КБ</dd>
          </div>
        </dl>
        <p className="muted small">
          Обычно браузер выделяет сайту около 5 МБ. Больше всего места занимают изображения в статьях.
        </p>
      </div>
      <div className="card card-pad">
        <h2 className="card-title">Сброс демо-данных</h2>
        <p className="muted">
          Вернёт исходный набор: сотрудников, статьи, задачи и заявки. После сброса вы останетесь в портале, но войдёте
          как пользователь по умолчанию — раздел администрирования может закрыться.
        </p>
        <Button variant="danger" onClick={reset}>
          <RotateCcw size={16} /> Сбросить демо-данные
        </Button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { state, can, actions } = useStore();
  const { toast } = useUi();
  const [tab, setTab] = useState<Tab>('users');

  if (!can('admin')) {
    const admin = state.employees.find((e) => e.role === 'admin');
    return (
      <div className="card">
        <EmptyState
          icon={<ShieldCheck size={22} />}
          title="Раздел доступен администратору"
          text="Для показа можно переключиться на администратора. В рабочей системе это решал бы вход по паролю."
          action={
            admin ? (
              <Button
                variant="primary"
                onClick={() => {
                  actions.switchUser(admin.id);
                  toast(`Вы вошли как ${admin.name} — администратор`, 'info');
                }}
              >
                Войти как администратор
              </Button>
            ) : undefined
          }
        />
      </div>
    );
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Администрирование</h1>
          <p className="page-sub">Пользователи, роли, категории базы знаний и журнал действий</p>
        </div>
      </div>
      <div className="tabs tabs-page" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'log' && <LogTab />}
      {tab === 'data' && <DataTab />}
    </>
  );
}
