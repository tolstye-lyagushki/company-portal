import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Check, KeyRound, Pencil, Plus, RotateCcw, Search, ShieldCheck, Trash2, UserPlus } from 'lucide-react';
import type { Category, Employee, Position, Role } from '../types';
import { useStore } from '../store';
import { PERMISSION_GROUPS, ROLE_DEFAULTS, effectivePermissions, inheritedPermissions } from '../lib/permissions';
import { ROLE, ROLE_ORDER, byName, formatDateTime, matches, plural } from '../lib/utils';
import { Avatar, Badge, Button, EmptyState, Field, IconButton, Modal, useUi } from '../components/ui';
import { EmployeeForm } from '../components/EmployeeForm';
import { AccessEditor } from '../components/AccessEditor';

type Tab = 'users' | 'positions' | 'roles' | 'categories' | 'log' | 'data';

/* ---------- Сотрудники: роли, индивидуальные права ---------- */

function UsersTab() {
  const { state, access, actions } = useStore();
  const { confirm, toast } = useUi();
  const [query, setQuery] = useState('');
  const [form, setForm] = useState<Employee | 'new' | null>(null);
  const [rights, setRights] = useState<Employee | null>(null);
  const manage = access.has('employees.manage');

  const changeRole = (employee: Employee, role: Role) => {
    if (actions.setRole(employee.id, role)) toast(`${employee.name}: роль «${ROLE[role].label}»`);
  };

  const remove = async (employee: Employee) => {
    const tasks = state.tasks.filter((t) => t.assigneeId === employee.id).length;
    const ok = await confirm({
      title: 'Удалить сотрудника?',
      text: `${employee.name} будет удалён из портала.${tasks ? ` Его задачи (${tasks}) останутся без ответственного.` : ''}`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (ok && actions.deleteEmployee(employee.id)) toast('Сотрудник удалён');
  };

  /** Краткая сводка доступа к задачнику — главное, что настраивается отдельно от роли. */
  const tasksAccess = (e: Employee) => {
    const perms = effectivePermissions(e, state.positions);
    if (!perms.has('tasks.access')) return <Badge tone="gray">Нет</Badge>;
    if (perms.has('tasks.viewAll')) return <Badge tone="green">Все задачи</Badge>;
    return <Badge tone="blue">Свои задачи</Badge>;
  };

  const people = state.employees.filter((e) => matches(query, e.name, e.position, e.department)).sort(byName);
  const rightsTarget = rights ? state.employees.find((e) => e.id === rights.id) : undefined;

  return (
    <>
      <div className="toolbar">
        <div className="search toolbar-grow">
          <Search size={16} className="search-icon" />
          <input className="input search-input" type="search" placeholder="Поиск сотрудника" aria-label="Поиск сотрудника" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        {manage && (
          <Button variant="primary" onClick={() => setForm('new')}>
            <UserPlus size={16} /> Добавить сотрудника
          </Button>
        )}
      </div>
      <div className="card rows rows-users">
        <div className="row row-head">
          <span>Сотрудник</span>
          <span>Роль</span>
          <span>Задачник</span>
          <span />
        </div>
        {people.map((e) => {
          const canAccess = access.canManageAccessOf(e);
          const personal = Object.keys(e.permissions).length;
          return (
            <div key={e.id} className="row">
              <Link to={`/people/${e.id}`} className="person-inline">
                <Avatar name={e.name} id={e.id} size="sm" />
                <span>
                  <span className="row-title">{e.name}</span>
                  <span className="muted small"> {e.position}</span>
                </span>
              </Link>
              {canAccess ? (
                <select className="select select-sm" aria-label={`Роль: ${e.name}`} value={e.role} onChange={(ev) => changeRole(e, ev.target.value as Role)}>
                  {ROLE_ORDER.filter((r) => access.canAssignRole(r) || r === e.role).map((r) => (
                    <option key={r} value={r}>{ROLE[r].label}</option>
                  ))}
                </select>
              ) : (
                <span><Badge tone={ROLE[e.role].tone}>{ROLE[e.role].label}</Badge></span>
              )}
              <span className="badges">
                {tasksAccess(e)}
                {personal > 0 && <Badge tone="violet">Свои права: {personal}</Badge>}
              </span>
              <span className="row-actions">
                {canAccess && (
                  <IconButton label="Права доступа" onClick={() => setRights(e)}>
                    <KeyRound size={16} />
                  </IconButton>
                )}
                {manage && access.canEditProfile(e) && (
                  <IconButton label="Редактировать" onClick={() => setForm(e)}>
                    <Pencil size={16} />
                  </IconButton>
                )}
                {access.canDeleteEmployee(e) && (
                  <IconButton label="Удалить" className="danger-text" onClick={() => remove(e)}>
                    <Trash2 size={16} />
                  </IconButton>
                )}
              </span>
            </div>
          );
        })}
        {people.length === 0 && <EmptyState title="Сотрудники не найдены" />}
      </div>
      <p className="note">
        <ShieldCheck size={15} /> Свою роль и свои права изменить нельзя — это делает другой сотрудник с правом «Назначение ролей и прав».
      </p>
      {form && <EmployeeForm employee={form === 'new' ? undefined : form} onClose={() => setForm(null)} />}
      {rightsTarget && (
        <AccessEditor
          title={`Права: ${rightsTarget.name}`}
          description={
            rightsTarget.role === 'admin'
              ? 'Администратор всегда имеет все права; индивидуальные настройки на него не действуют.'
              : `Роль «${ROLE[rightsTarget.role].label}», должность «${rightsTarget.position}». ` +
                '«По умолчанию» — то, что дают роль и должность. Индивидуальная настройка важнее их.'
          }
          base={inheritedPermissions(rightsTarget, state.positions)}
          overrides={rightsTarget.permissions}
          onSave={(next) => {
            const ok = actions.setEmployeePermissions(rightsTarget.id, next);
            if (ok) toast('Права сохранены и уже действуют');
            return ok;
          }}
          onClose={() => setRights(null)}
        />
      )}
    </>
  );
}

/* ---------- Должности ---------- */

function PositionsTab() {
  const { state, access, actions } = useStore();
  const { confirm, toast } = useUi();
  const [editing, setEditing] = useState<Position | 'new' | null>(null);
  const [rights, setRights] = useState<Position | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const manage = access.has('employees.manage');
  const canRights = access.has('access.manage');

  const open = (p: Position | 'new') => {
    setEditing(p);
    setName(p === 'new' ? '' : p.name);
    setError('');
  };
  const save = () => {
    if (!name.trim()) return setError('Укажите название должности');
    if (actions.savePosition(name, editing && editing !== 'new' ? editing.id : undefined)) {
      toast(editing === 'new' ? 'Должность добавлена' : 'Должность переименована');
      setEditing(null);
    }
  };
  const remove = async (p: Position) => {
    const ok = await confirm({ title: 'Удалить должность?', text: `Должность «${p.name}» будет удалена.`, confirmLabel: 'Удалить', danger: true });
    if (ok && actions.deletePosition(p.id)) toast('Должность удалена');
  };

  const positions = [...state.positions].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const rightsTarget = rights ? state.positions.find((p) => p.id === rights.id) : undefined;

  return (
    <>
      <div className="toolbar">
        <span className="toolbar-grow muted">Права должности действуют для всех сотрудников на ней — поверх их роли.</span>
        {manage && (
          <Button variant="primary" onClick={() => open('new')}>
            <Plus size={16} /> Добавить должность
          </Button>
        )}
      </div>
      <div className="card rows rows-positions">
        <div className="row row-head">
          <span>Должность</span>
          <span>Сотрудников</span>
          <span>Настройки прав</span>
          <span />
        </div>
        {positions.map((p) => {
          const people = state.employees.filter((e) => e.position === p.name).length;
          const grants = Object.values(p.permissions).filter(Boolean).length;
          const denies = Object.values(p.permissions).filter((v) => v === false).length;
          return (
            <div key={p.id} className="row">
              <span className="row-title">{p.name}</span>
              <span className="muted">{people}</span>
              <span className="badges">
                {p.permissions['tasks.access'] === true && <Badge tone="blue">Задачник</Badge>}
                {p.permissions['tasks.access'] === false && <Badge tone="red">Без задачника</Badge>}
                {grants + denies === 0 ? <span className="muted small">По ролям</span> : (
                  <span className="muted small">
                    {grants > 0 && `+${grants}`} {denies > 0 && `−${denies}`}
                  </span>
                )}
              </span>
              <span className="row-actions">
                {canRights && (
                  <IconButton label="Права должности" onClick={() => setRights(p)}>
                    <KeyRound size={16} />
                  </IconButton>
                )}
                {manage && (
                  <>
                    <IconButton label="Переименовать" onClick={() => open(p)}>
                      <Pencil size={16} />
                    </IconButton>
                    <IconButton label="Удалить" className="danger-text" onClick={() => remove(p)}>
                      <Trash2 size={16} />
                    </IconButton>
                  </>
                )}
              </span>
            </div>
          );
        })}
        {positions.length === 0 && <EmptyState title="Должностей пока нет" />}
      </div>
      {editing && (
        <Modal
          title={editing === 'new' ? 'Новая должность' : 'Переименовать должность'}
          size="sm"
          onClose={() => setEditing(null)}
          footer={
            <>
              <Button onClick={() => setEditing(null)}>Отмена</Button>
              <Button variant="primary" onClick={save}>Сохранить</Button>
            </>
          }
        >
          <form onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Название" error={error} hint={editing !== 'new' ? 'Новое название получат все сотрудники на этой должности' : undefined}>
              <input className="input" autoFocus maxLength={60} value={name} onChange={(e) => { setName(e.target.value); setError(''); }} />
            </Field>
          </form>
        </Modal>
      )}
      {rightsTarget && (
        <AccessEditor
          title={`Права должности: ${rightsTarget.name}`}
          description="«Не задано» — право определяет роль сотрудника. «Разрешить» и «Запретить» действуют для всех на этой должности; индивидуальные права сотрудника важнее."
          overrides={rightsTarget.permissions}
          onSave={(next) => {
            const ok = actions.setPositionPermissions(rightsTarget.id, next);
            if (ok) toast('Права должности сохранены и уже действуют');
            return ok;
          }}
          onClose={() => setRights(null)}
        />
      )}
    </>
  );
}

/* ---------- Роли: права по умолчанию ---------- */

function RolesTab() {
  const { state } = useStore();
  return (
    <>
      <div className="grid grid-4">
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
              <th>Право по умолчанию</th>
              {ROLE_ORDER.map((r) => (
                <th key={r}>{ROLE[r].label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <MatrixGroup key={group.title} title={group.title}>
                {group.items.map((item) => (
                  <tr key={item.key}>
                    <td>{item.label}</td>
                    {ROLE_ORDER.map((r) => (
                      <td key={r} className="matrix-cell">
                        {ROLE_DEFAULTS[r].includes(item.key) ? (
                          <Check size={16} className="ok-text" aria-label="Да" />
                        ) : (
                          <span className="muted" aria-label="Нет">—</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </MatrixGroup>
            ))}
          </tbody>
        </table>
      </div>
      <p className="note">
        <ShieldCheck size={15} /> Роль задаёт права по умолчанию. Их можно дополнить или урезать для должности (вкладка «Должности»)
        и для отдельного сотрудника (кнопка с ключом на вкладке «Сотрудники»). Проверки выполняются в браузере — это
        демонстрация, а не защита данных.
      </p>
    </>
  );
}

function MatrixGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <tr className="matrix-group">
        <td colSpan={ROLE_ORDER.length + 1}>{title}</td>
      </tr>
      {children}
    </>
  );
}

/* ---------- Категории базы знаний ---------- */

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
    if (!actions.saveCategory(value, currentId)) return;
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
    if (ok && actions.deleteCategory(category.id)) toast('Категория удалена');
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
          <form onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Field label="Название" error={error}>
              <input className="input" autoFocus maxLength={40} value={name} onChange={(e) => { setName(e.target.value); setError(''); }} />
            </Field>
          </form>
        </Modal>
      )}
    </>
  );
}

/* ---------- Журнал ---------- */

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

/* ---------- Данные ---------- */

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
    ['Должности', state.positions.length],
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
        <p className="muted small">Обычно браузер выделяет сайту около 5 МБ. Больше всего места занимают изображения в статьях.</p>
      </div>
      <div className="card card-pad">
        <h2 className="card-title">Сброс демо-данных</h2>
        <p className="muted">
          Вернёт исходный набор: сотрудников, должности, права, статьи, задачи и заявки. После сброса вы войдёте как
          пользователь по умолчанию.
        </p>
        <Button variant="danger" onClick={reset}>
          <RotateCcw size={16} /> Сбросить демо-данные
        </Button>
      </div>
    </div>
  );
}

export default function Admin() {
  const { access } = useStore();
  const tabs = (
    [
      { id: 'users', label: 'Сотрудники', show: access.has('employees.manage') || access.has('access.manage') },
      { id: 'positions', label: 'Должности', show: access.has('employees.manage') || access.has('access.manage') },
      { id: 'roles', label: 'Роли', show: access.has('access.manage') },
      { id: 'categories', label: 'Категории', show: access.has('kb.categories') },
      { id: 'log', label: 'Журнал', show: access.has('system.log') },
      { id: 'data', label: 'Данные', show: access.has('system.settings') },
    ] as { id: Tab; label: string; show: boolean }[]
  ).filter((t) => t.show);
  const [chosen, setChosen] = useState<Tab | null>(null);
  // если право на открытую вкладку пропало, показываем первую доступную
  const tab = tabs.some((t) => t.id === chosen) ? chosen : tabs[0]?.id;

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Администрирование</h1>
          <p className="page-sub">Сотрудники, должности, роли и права доступа, категории, журнал</p>
        </div>
      </div>
      <div className="tabs tabs-page" role="tablist">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} className={`tab${tab === t.id ? ' active' : ''}`} onClick={() => setChosen(t.id)}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'users' && <UsersTab />}
      {tab === 'positions' && <PositionsTab />}
      {tab === 'roles' && <RolesTab />}
      {tab === 'categories' && <CategoriesTab />}
      {tab === 'log' && <LogTab />}
      {tab === 'data' && <DataTab />}
    </>
  );
}
