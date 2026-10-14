import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  BookOpen,
  ChevronDown,
  Ellipsis,
  FlaskConical,
  House,
  Inbox,
  ListChecks,
  RotateCcw,
  Search,
  Settings,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useStore } from '../store';
import {
  REQUEST_STATUS,
  ROLE,
  ROLE_ORDER,
  TASK_STATUS,
  byName,
  daysBetween,
  dueLabel,
  matches,
  stripHtml,
  today,
  type Tone,
} from '../lib/utils';
import { Avatar, Button, IconButton, Modal, useUi } from './ui';
import { ErrorBoundary } from './ErrorBoundary';

interface NavEntry {
  to: string;
  label: string;
  short?: string;
  icon: LucideIcon;
  end?: boolean;
  adminOnly?: boolean;
}

const NAV: NavEntry[] = [
  { to: '/', label: 'Главная', icon: House, end: true },
  { to: '/kb', label: 'База знаний', short: 'Знания', icon: BookOpen },
  { to: '/tasks', label: 'Задачи', icon: ListChecks },
  { to: '/requests', label: 'Заявки', icon: Inbox },
  { to: '/people', label: 'Сотрудники', icon: Users },
  { to: '/admin', label: 'Администрирование', icon: Settings, adminOnly: true },
];

function useClickOutside(ref: RefObject<HTMLElement | null>, active: boolean, onClose: () => void) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!active) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) closeRef.current();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, active]);
}

/* ---------- Поиск по всему порталу ---------- */

function GlobalSearch({ autoFocus, onPick }: { autoFocus?: boolean; onPick?: () => void }) {
  const { state, me, can } = useStore();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  useClickOutside(boxRef, open, () => setOpen(false));

  const groups = useMemo(() => {
    if (query.trim().length < 2) return null;
    const requests = can('request.viewAll') ? state.requests : state.requests.filter((r) => r.authorId === me.id);
    return [
      {
        title: 'База знаний',
        items: state.articles
          .filter((a) => matches(query, a.title, stripHtml(a.content)))
          .slice(0, 5)
          .map((a) => ({ key: a.id, to: `/kb/${a.id}`, text: a.title, note: 'Статья' })),
      },
      {
        title: 'Задачи',
        items: state.tasks
          .filter((t) => matches(query, t.title, t.description))
          .slice(0, 5)
          .map((t) => ({ key: t.id, to: `/tasks/${t.id}`, text: t.title, note: TASK_STATUS[t.status].label })),
      },
      {
        title: 'Заявки',
        items: requests
          .filter((r) => matches(query, r.title, r.description, r.category))
          .slice(0, 5)
          .map((r) => ({ key: r.id, to: `/requests/${r.id}`, text: r.title, note: REQUEST_STATUS[r.status].label })),
      },
      {
        title: 'Сотрудники',
        items: state.employees
          .filter((e) => matches(query, e.name, e.position, e.department))
          .slice(0, 5)
          .map((e) => ({ key: e.id, to: `/people/${e.id}`, text: e.name, note: e.position })),
      },
    ].filter((g) => g.items.length > 0);
  }, [query, state, me.id, can]);

  const go = (to: string) => {
    setQuery('');
    setOpen(false);
    onPick?.();
    navigate(to);
  };

  return (
    <div className="search" ref={boxRef}>
      <Search size={16} className="search-icon" />
      <input
        className="input search-input"
        type="search"
        placeholder="Поиск по порталу"
        aria-label="Поиск по порталу"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && groups?.[0]) go(groups[0].items[0].to);
        }}
      />
      {open && groups && (
        <div className="popover search-results">
          {groups.length === 0 && <div className="popover-empty">Ничего не найдено</div>}
          {groups.map((g) => (
            <div key={g.title} className="search-group">
              <div className="popover-label">{g.title}</div>
              {g.items.map((item) => (
                <button key={item.key} type="button" className="popover-item" onClick={() => go(item.to)}>
                  <span className="popover-item-text">{item.text}</span>
                  <span className="muted small">{item.note}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Уведомления ---------- */

function useNotifications() {
  const { state, me, can, empName } = useStore();
  return useMemo(() => {
    const now = today();
    const list: { key: string; to: string; text: string; tone: Tone }[] = [];
    for (const t of state.tasks) {
      if (t.status === 'done') continue;
      if (t.assigneeId === me.id) {
        const left = daysBetween(now, t.dueDate);
        if (left < 0) list.push({ key: `o${t.id}`, to: `/tasks/${t.id}`, tone: 'red', text: `Просрочена задача «${t.title}»` });
        else if (left <= 1) list.push({ key: `d${t.id}`, to: `/tasks/${t.id}`, tone: 'amber', text: `Срок ${dueLabel(t.dueDate)}: «${t.title}»` });
      }
      if (t.status === 'review' && t.creatorId === me.id && t.assigneeId !== me.id) {
        list.push({ key: `r${t.id}`, to: `/tasks/${t.id}`, tone: 'violet', text: `Ждёт вашей проверки: «${t.title}»` });
      }
    }
    for (const r of state.requests) {
      if (can('request.viewAll') && r.status === 'new' && r.authorId !== me.id) {
        list.push({ key: `n${r.id}`, to: `/requests/${r.id}`, tone: 'blue', text: `Новая заявка от ${empName(r.authorId)}: «${r.title}»` });
      }
      const last = r.history[r.history.length - 1];
      if (r.authorId === me.id && last && last.authorId !== me.id && daysBetween(last.at.slice(0, 10), now) <= 7) {
        list.push({ key: `u${r.id}`, to: `/requests/${r.id}`, tone: REQUEST_STATUS[r.status].tone, text: `Ваша заявка «${r.title}»: ${REQUEST_STATUS[r.status].label.toLowerCase()}` });
      }
    }
    return list;
  }, [state.tasks, state.requests, me.id, can, empName]);
}

function Notifications() {
  const items = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useClickOutside(ref, open, () => setOpen(false));

  return (
    <div className="popover-anchor" ref={ref}>
      <IconButton label="Уведомления" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <Bell size={19} />
        {items.length > 0 && <span className="dot">{items.length}</span>}
      </IconButton>
      {open && (
        <div className="popover popover-right notif">
          <div className="popover-label">Уведомления</div>
          {items.length === 0 && <div className="popover-empty">Новых уведомлений нет</div>}
          {items.map((n) => (
            <Link key={n.key} to={n.to} className="popover-item notif-item" onClick={() => setOpen(false)}>
              <span className={`notif-dot tone-${n.tone}`} />
              <span>{n.text}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- Демо-режим: переключение пользователя и сброс ---------- */

function UserSwitchList({ onPick }: { onPick: () => void }) {
  const { state, me, actions } = useStore();
  const { toast } = useUi();
  return (
    <div className="switch-list">
      {[...ROLE_ORDER].reverse().map((role) => {
        const people = state.employees.filter((e) => e.role === role).sort(byName);
        if (people.length === 0) return null;
        return (
          <div key={role}>
            <div className="popover-label">{ROLE[role].label}</div>
            {people.map((e) => (
              <button
                key={e.id}
                type="button"
                className={`popover-item switch-item${e.id === me.id ? ' current' : ''}`}
                onClick={() => {
                  if (e.id !== me.id) {
                    actions.switchUser(e.id);
                    toast(`Вы вошли как ${e.name} — ${ROLE[e.role].label.toLowerCase()}`, 'info');
                  }
                  onPick();
                }}
              >
                <Avatar name={e.name} id={e.id} size="sm" />
                <span className="popover-item-text">
                  {e.name}
                  <span className="muted small switch-pos">{e.position}</span>
                </span>
              </button>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function useResetDemo() {
  const { actions } = useStore();
  const { confirm, toast } = useUi();
  const navigate = useNavigate();
  return async () => {
    const ok = await confirm({
      title: 'Сбросить демо-данные?',
      text: 'Все изменения в этом браузере будут удалены, портал вернётся к исходному демонстрационному набору.',
      confirmLabel: 'Сбросить',
      danger: true,
    });
    if (!ok) return false;
    actions.resetDemo();
    navigate('/');
    toast('Демо-данные возвращены к исходному состоянию');
    return true;
  };
}

function DemoInfo({ onClose }: { onClose: () => void }) {
  const reset = useResetDemo();
  return (
    <Modal
      title="Демонстрационный режим"
      onClose={onClose}
      footer={
        <>
          <Button
            variant="danger"
            onClick={async () => {
              if (await reset()) onClose();
            }}
          >
            <RotateCcw size={16} /> Сбросить демо-данные
          </Button>
          <Button variant="primary" onClick={onClose}>
            Понятно
          </Button>
        </>
      }
    >
      <div className="prose">
        <p>Это прототип для показа. Он работает целиком в вашем браузере, без сервера.</p>
        <ul>
          <li>Все сотрудники, статьи, задачи и заявки — вымышленные.</li>
          <li>Изменения сохраняются только в этом браузере и не видны другим людям и на других устройствах.</li>
          <li>Переключение пользователя в правом верхнем углу нужно для показа ролей. Это не вход по паролю и не защита доступа.</li>
          <li>Не вносите сюда настоящие персональные данные и пароли.</li>
        </ul>
      </div>
    </Modal>
  );
}

function UserMenu() {
  const { me } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const reset = useResetDemo();
  useClickOutside(ref, open, () => setOpen(false));

  return (
    <div className="popover-anchor" ref={ref}>
      <button type="button" className="user-btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label="Меню пользователя">
        <Avatar name={me.name} id={me.id} size="sm" />
        <span className="user-btn-text">
          <span className="user-btn-name">{me.name}</span>
          <span className="muted small">{ROLE[me.role].label}</span>
        </span>
        <ChevronDown size={16} className="user-btn-caret" />
      </button>
      {open && (
        <div className="popover popover-right user-menu">
          <Link to={`/people/${me.id}`} className="popover-item" onClick={() => setOpen(false)}>
            Мой профиль
          </Link>
          <div className="popover-divider" />
          <div className="popover-hint">Демо: войти как другой сотрудник</div>
          <UserSwitchList onPick={() => setOpen(false)} />
          <div className="popover-divider" />
          <button
            type="button"
            className="popover-item danger-text"
            onClick={() => {
              setOpen(false);
              void reset();
            }}
          >
            <RotateCcw size={15} /> Сбросить демо-данные
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Каркас ---------- */

export function Layout() {
  const { state, me, can } = useStore();
  const location = useLocation();
  const [demoOpen, setDemoOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const reset = useResetDemo();

  useEffect(() => {
    window.scrollTo(0, 0);
    setMoreOpen(false);
    setSearchOpen(false);
  }, [location.pathname]);

  const nav = NAV.filter((n) => !n.adminOnly || can('admin'));
  const counts: Record<string, number> = {
    '/tasks': state.tasks.filter((t) => t.assigneeId === me.id && t.status !== 'done').length,
    '/requests': can('request.viewAll')
      ? state.requests.filter((r) => r.status === 'new' || r.status === 'reviewing').length
      : state.requests.filter((r) => r.authorId === me.id && (r.status === 'new' || r.status === 'reviewing')).length,
  };
  const bottom = nav.slice(0, 4);
  const more = nav.slice(4);
  const moreActive = more.some((n) => location.pathname.startsWith(n.to));

  return (
    <div className="app">
      <aside className="sidebar">
        <Link to="/" className="brand">
          <span className="brand-mark">П</span>
          <span className="brand-name">Портал компании</span>
        </Link>
        <nav className="nav" aria-label="Разделы">
          {nav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              <n.icon size={18} />
              <span>{n.label}</span>
              {counts[n.to] ? <span className="nav-count">{counts[n.to]}</span> : null}
            </NavLink>
          ))}
        </nav>
        <button type="button" className="sidebar-foot" onClick={() => setDemoOpen(true)}>
          <FlaskConical size={16} />
          <span>
            <strong>Демо-режим</strong>
            <span className="muted small">Данные хранятся только в этом браузере</span>
          </span>
        </button>
      </aside>

      <div className="main">
        <header className="topbar">
          <Link to="/" className="brand brand-mobile" aria-label="На главную">
            <span className="brand-mark">П</span>
          </Link>
          <div className="topbar-search">
            <GlobalSearch />
          </div>
          <div className="topbar-actions">
            <IconButton label="Поиск" className="only-mobile" onClick={() => setSearchOpen(true)}>
              <Search size={19} />
            </IconButton>
            <button type="button" className="demo-pill" onClick={() => setDemoOpen(true)}>
              <FlaskConical size={14} /> Демо
            </button>
            <Notifications />
            <UserMenu />
          </div>
        </header>

        <main className="content">
          <ErrorBoundary key={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Разделы">
        {bottom.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `bottom-item${isActive ? ' active' : ''}`}>
            <n.icon size={20} />
            <span>{n.short ?? n.label}</span>
          </NavLink>
        ))}
        <button type="button" className={`bottom-item${moreActive ? ' active' : ''}`} onClick={() => setMoreOpen(true)}>
          <Ellipsis size={20} />
          <span>Ещё</span>
        </button>
      </nav>

      {moreOpen && (
        <Modal title="Ещё" onClose={() => setMoreOpen(false)} size="sm">
          <div className="more-list">
            {more.map((n) => (
              <NavLink key={n.to} to={n.to} className="more-item" onClick={() => setMoreOpen(false)}>
                <n.icon size={18} /> {n.label}
              </NavLink>
            ))}
            <button
              type="button"
              className="more-item"
              onClick={() => {
                setMoreOpen(false);
                setDemoOpen(true);
              }}
            >
              <FlaskConical size={18} /> О демо-режиме
            </button>
            <button
              type="button"
              className="more-item danger-text"
              onClick={() => {
                setMoreOpen(false);
                void reset();
              }}
            >
              <RotateCcw size={18} /> Сбросить демо-данные
            </button>
          </div>
          <div className="popover-hint">Демо: войти как другой сотрудник</div>
          <UserSwitchList onPick={() => setMoreOpen(false)} />
        </Modal>
      )}

      {searchOpen && (
        <div className="search-sheet">
          <GlobalSearch autoFocus onPick={() => setSearchOpen(false)} />
          <IconButton label="Закрыть поиск" onClick={() => setSearchOpen(false)}>
            <X size={20} />
          </IconButton>
        </div>
      )}

      {demoOpen && <DemoInfo onClose={() => setDemoOpen(false)} />}
    </div>
  );
}
