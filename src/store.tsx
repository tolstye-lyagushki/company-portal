import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AppState,
  Article,
  ArticleStatus,
  Employee,
  PermissionOverrides,
  Priority,
  RequestStatus,
  Role,
  Task,
  TaskStatus,
  WorkRequest,
} from './types';
import { createSeed } from './data/seed';
import { migrate } from './lib/migrate';
import { PERMISSION_LABEL, cleanOverrides, createAccess, forbiddenGrants, type Access } from './lib/permissions';
import { REQUEST_STATUS, ROLE, TASK_STATUS, uid } from './lib/utils';
import { useUi } from './components/ui';

// Имя ключа не меняем при смене формата: по нему находятся ранее сохранённые данные.
export const STORAGE_KEY = 'company-portal:v1';
/** Сюда откладываются сохранённые данные, которые не удалось прочитать, чтобы не потерять их молча. */
const BACKUP_KEY = 'company-portal:unreadable-backup';
const LOG_LIMIT = 300;

export { migrate };

function load(): AppState {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const migrated = migrate(JSON.parse(raw));
      if (migrated) return migrated;
    }
  } catch {
    // хранилище недоступно или данные повреждены
  }
  if (raw) {
    try {
      localStorage.setItem(BACKUP_KEY, raw);
    } catch {
      // некуда сохранить копию — продолжаем с демонстрационным набором
    }
  }
  return createSeed();
}

const meOf = (s: AppState) => s.employees.find((e) => e.id === s.currentUserId) ?? s.employees[0];

/* ---------- Действия ---------- */

export interface ArticleInput {
  title: string;
  categoryId: string | null;
  content: string;
  status: ArticleStatus;
}
export interface TaskInput {
  title: string;
  description: string;
  assigneeId: string | null;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
}
export interface RequestInput {
  title: string;
  description: string;
  category: string;
}
export interface EmployeeInput {
  name: string;
  position: string;
  department: string;
  role: Role;
  email: string;
  phone: string;
  about: string;
}

/*
 * Каждое действие само проверяет права текущего пользователя и при отказе ничего не меняет.
 * Действия, возвращающие строку, при отказе возвращают null; остальные — false.
 */
interface Actions {
  switchUser: (id: string) => void;
  resetDemo: () => void;
  saveArticle: (input: ArticleInput, id?: string) => string | null;
  setArticleStatus: (id: string, status: ArticleStatus) => boolean;
  deleteArticle: (id: string) => boolean;
  saveTask: (input: TaskInput, id?: string) => string | null;
  setTaskStatus: (id: string, status: TaskStatus) => boolean;
  deleteTask: (id: string) => boolean;
  addTaskComment: (id: string, text: string) => boolean;
  saveRequest: (input: RequestInput, id?: string) => string | null;
  setRequestStatus: (id: string, status: RequestStatus) => boolean;
  deleteRequest: (id: string) => boolean;
  addRequestComment: (id: string, text: string) => boolean;
  saveEmployee: (input: EmployeeInput, id?: string) => string | null;
  setRole: (id: string, role: Role) => boolean;
  setEmployeePermissions: (id: string, overrides: PermissionOverrides) => boolean;
  deleteEmployee: (id: string) => boolean;
  savePosition: (name: string, id?: string) => boolean;
  setPositionPermissions: (id: string, overrides: PermissionOverrides) => boolean;
  deletePosition: (id: string) => boolean;
  saveCategory: (name: string, id?: string) => boolean;
  deleteCategory: (id: string) => boolean;
}

interface Store {
  state: AppState;
  me: Employee;
  /** Права текущего пользователя и проверки для интерфейса. */
  access: Access;
  emp: (id: string | null | undefined) => Employee | undefined;
  empName: (id: string | null | undefined) => string;
  actions: Actions;
}

const StoreContext = createContext<Store | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore вызван вне StoreProvider');
  return ctx;
}

type LogText = string | ((prev: AppState) => string);

export function StoreProvider({ children }: { children: ReactNode }) {
  const { toast } = useUi();
  const [state, setState] = useState<AppState>(load);
  const saveFailed = useRef(false);
  // актуальное состояние для проверок прав внутри действий
  const stateRef = useRef(state);
  stateRef.current = state;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      saveFailed.current = false;
    } catch {
      if (!saveFailed.current) {
        saveFailed.current = true;
        toast('Изменения не сохранены: хранилище браузера переполнено или недоступно', 'error');
      }
    }
  }, [state, toast]);

  // Изменения из другой вкладки этого же браузера
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        // другая вкладка может быть открыта со старой версией портала
        const next = migrate(JSON.parse(e.newValue));
        if (next) setState(next);
      } catch {
        // игнорируем повреждённое значение
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const actions = useMemo<Actions>(() => {
    const now = () => new Date().toISOString();

    const apply = (fn: (prev: AppState) => AppState, section?: string, text?: LogText) =>
      setState((prev) => {
        const next = fn(prev);
        if (next === prev || !section || !text) return next;
        const entry = {
          id: uid(),
          at: now(),
          userId: prev.currentUserId,
          section,
          text: typeof text === 'function' ? text(prev) : text,
        };
        return { ...next, log: [entry, ...next.log].slice(0, LOG_LIMIT) };
      });

    /** Текущее состояние и права текущего пользователя. */
    const ctx = () => {
      const s = stateRef.current;
      return { s, acc: createAccess(s, meOf(s)) };
    };
    const deny = (what: string): false => {
      toast(`Недостаточно прав: ${what}`, 'error');
      return false;
    };
    const nameOf = (s: AppState, id: string) => s.employees.find((e) => e.id === id)?.name ?? 'сотрудник';

    return {
      // демо-управление: переключение пользователя и сброс доступны всем, это не вход по паролю
      switchUser: (id) =>
        apply(
          (s) => (s.employees.some((e) => e.id === id) ? { ...s, currentUserId: id } : s),
          'Система',
          (s) => `Демо-вход под пользователем ${nameOf(s, id)}`,
        ),

      resetDemo: () => setState(createSeed()),

      /* ----- база знаний ----- */

      saveArticle: (input, id) => {
        const { s, acc } = ctx();
        const existing = id ? s.articles.find((a) => a.id === id) : undefined;
        if (id && !existing) return null;
        if (existing ? !acc.canEditArticle(existing) : !acc.has('kb.create')) {
          return deny(existing ? 'редактирование статьи' : 'создание статей') || null;
        }
        // менять статус публикации может только тот, у кого есть право публикации
        const status: ArticleStatus = acc.has('kb.publish') ? input.status : (existing?.status ?? 'draft');
        const articleId = id ?? uid();
        apply(
          (prev) => {
            if (id) {
              return {
                ...prev,
                articles: prev.articles.map((a) => (a.id === id ? { ...a, ...input, status, updatedAt: now() } : a)),
              };
            }
            const created: Article = { id: articleId, ...input, status, authorId: prev.currentUserId, createdAt: now(), updatedAt: now() };
            return { ...prev, articles: [created, ...prev.articles] };
          },
          'База знаний',
          `${id ? 'Изменена' : 'Создана'} статья «${input.title}»${status === 'draft' ? ' (черновик)' : ''}`,
        );
        return articleId;
      },

      setArticleStatus: (id, status) => {
        const { s, acc } = ctx();
        const article = s.articles.find((a) => a.id === id);
        if (!article) return false;
        if (!acc.has('kb.publish')) return deny('публикация статей');
        apply(
          (prev) => ({ ...prev, articles: prev.articles.map((a) => (a.id === id ? { ...a, status, updatedAt: now() } : a)) }),
          'База знаний',
          `Статья «${article.title}» ${status === 'published' ? 'опубликована' : 'снята с публикации'}`,
        );
        return true;
      },

      deleteArticle: (id) => {
        const { s, acc } = ctx();
        const article = s.articles.find((a) => a.id === id);
        if (!article) return false;
        if (!acc.canDeleteArticle(article)) return deny('удаление статьи');
        apply((prev) => ({ ...prev, articles: prev.articles.filter((a) => a.id !== id) }), 'База знаний', `Удалена статья «${article.title}»`);
        return true;
      },

      /* ----- задачи ----- */

      saveTask: (input, id) => {
        const { s, acc } = ctx();
        const existing = id ? s.tasks.find((t) => t.id === id) : undefined;
        if (id && !existing) return null;
        if (existing ? !acc.canEditTask(existing) : !(acc.has('tasks.access') && acc.has('tasks.create'))) {
          return deny(existing ? 'редактирование задачи' : 'создание задач') || null;
        }
        const me = acc.me;
        // без права назначения исполнитель не меняется: новая задача — себе, существующая — как была
        const assigneeId = acc.has('tasks.assign') ? input.assigneeId : existing ? existing.assigneeId : me.id;
        // без права смены статуса статус не меняется: новая задача — «Новая»
        const status = acc.has('tasks.status') ? input.status : existing ? existing.status : 'new';
        const data = { ...input, assigneeId, status };
        const taskId = id ?? uid();
        apply(
          (prev) => {
            if (id) {
              return { ...prev, tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...data, updatedAt: now() } : t)) };
            }
            const created: Task = { id: taskId, ...data, creatorId: prev.currentUserId, comments: [], createdAt: now(), updatedAt: now() };
            return { ...prev, tasks: [created, ...prev.tasks] };
          },
          'Задачи',
          `${id ? 'Изменена' : 'Создана'} задача «${input.title}»`,
        );
        return taskId;
      },

      setTaskStatus: (id, status) => {
        const { s, acc } = ctx();
        const task = s.tasks.find((t) => t.id === id);
        if (!task) return false;
        if (!acc.canChangeTaskStatus(task)) return deny('изменение статуса задачи');
        if (task.status === status) return true;
        apply(
          (prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: now() } : t)) }),
          'Задачи',
          `Задача «${task.title}»: статус «${TASK_STATUS[status].label}»`,
        );
        return true;
      },

      deleteTask: (id) => {
        const { s, acc } = ctx();
        const task = s.tasks.find((t) => t.id === id);
        if (!task) return false;
        if (!acc.canDeleteTask(task)) return deny('удаление задачи');
        apply((prev) => ({ ...prev, tasks: prev.tasks.filter((t) => t.id !== id) }), 'Задачи', `Удалена задача «${task.title}»`);
        return true;
      },

      addTaskComment: (id, text) => {
        const { s, acc } = ctx();
        const task = s.tasks.find((t) => t.id === id);
        if (!task) return false;
        if (!acc.canCommentTask(task)) return deny('комментарии к задаче');
        apply(
          (prev) => ({
            ...prev,
            tasks: prev.tasks.map((t) =>
              t.id === id
                ? { ...t, comments: [...t.comments, { id: uid(), authorId: prev.currentUserId, text, createdAt: now() }], updatedAt: now() }
                : t,
            ),
          }),
          'Задачи',
          `Добавлен комментарий к задаче «${task.title}»`,
        );
        return true;
      },

      /* ----- заявки ----- */

      saveRequest: (input, id) => {
        const { s, acc } = ctx();
        const existing = id ? s.requests.find((r) => r.id === id) : undefined;
        if (id && !existing) return null;
        if (existing ? !acc.canEditRequest(existing) : !acc.has('requests.access')) {
          return deny(existing ? 'редактирование заявки' : 'создание заявок') || null;
        }
        const requestId = id ?? uid();
        apply(
          (prev) => {
            if (id) {
              return {
                ...prev,
                requests: prev.requests.map((r) =>
                  r.id === id
                    ? {
                        ...r,
                        ...input,
                        updatedAt: now(),
                        history: [...r.history, { id: uid(), authorId: prev.currentUserId, text: 'Заявка отредактирована', at: now() }],
                      }
                    : r,
                ),
              };
            }
            const created: WorkRequest = {
              id: requestId,
              ...input,
              authorId: prev.currentUserId,
              status: 'new',
              comments: [],
              history: [{ id: uid(), authorId: prev.currentUserId, text: 'Заявка создана', at: now() }],
              createdAt: now(),
              updatedAt: now(),
            };
            return { ...prev, requests: [created, ...prev.requests] };
          },
          'Заявки',
          `${id ? 'Изменена' : 'Создана'} заявка «${input.title}»`,
        );
        return requestId;
      },

      setRequestStatus: (id, status) => {
        const { s, acc } = ctx();
        const request = s.requests.find((r) => r.id === id);
        if (!request) return false;
        if (!acc.has('requests.decide')) return deny('решения по заявкам');
        if (request.status === status) return true;
        const text = `Статус изменён: «${REQUEST_STATUS[request.status].label}» → «${REQUEST_STATUS[status].label}»`;
        apply(
          (prev) => ({
            ...prev,
            requests: prev.requests.map((r) =>
              r.id === id
                ? { ...r, status, updatedAt: now(), history: [...r.history, { id: uid(), authorId: prev.currentUserId, text, at: now() }] }
                : r,
            ),
          }),
          'Заявки',
          `Заявка «${request.title}»: статус «${REQUEST_STATUS[status].label}»`,
        );
        return true;
      },

      deleteRequest: (id) => {
        const { s, acc } = ctx();
        const request = s.requests.find((r) => r.id === id);
        if (!request) return false;
        if (!acc.canDeleteRequest(request)) return deny('удаление заявки');
        apply((prev) => ({ ...prev, requests: prev.requests.filter((r) => r.id !== id) }), 'Заявки', `Удалена заявка «${request.title}»`);
        return true;
      },

      addRequestComment: (id, text) => {
        const { s, acc } = ctx();
        const request = s.requests.find((r) => r.id === id);
        if (!request) return false;
        if (!acc.canViewRequest(request)) return deny('комментарии к заявке');
        apply(
          (prev) => ({
            ...prev,
            requests: prev.requests.map((r) =>
              r.id === id
                ? {
                    ...r,
                    updatedAt: now(),
                    comments: [...r.comments, { id: uid(), authorId: prev.currentUserId, text, createdAt: now() }],
                    history: [...r.history, { id: uid(), authorId: prev.currentUserId, text: 'Добавлен комментарий', at: now() }],
                  }
                : r,
            ),
          }),
          'Заявки',
          `Добавлен комментарий к заявке «${request.title}»`,
        );
        return true;
      },

      /* ----- сотрудники, должности, права ----- */

      saveEmployee: (input, id) => {
        const { s, acc } = ctx();
        const existing = id ? s.employees.find((e) => e.id === id) : undefined;
        if (id && !existing) return null;
        const manage = acc.has('employees.manage');
        if (existing ? !acc.canEditProfile(existing) : !manage) {
          return deny(existing ? 'изменение данных сотрудника' : 'добавление сотрудников') || null;
        }
        if (input.position && !s.positions.some((p) => p.name === input.position)) {
          toast('Выберите должность из списка', 'error');
          return null;
        }
        // без права управления сотрудниками можно изменить только свои контакты и «О себе»
        let data: Partial<Employee> = manage ? { ...input } : { phone: input.phone, about: input.about };
        // роль меняется только при праве назначения ролей и не у самого себя
        const roleAllowed = existing
          ? acc.canManageAccessOf(existing) && acc.canAssignRole(input.role)
          : acc.has('access.manage') && acc.canAssignRole(input.role);
        if (!roleAllowed) {
          const { role: _role, ...rest } = data;
          data = rest;
        }
        if (existing && data.role && existing.role === 'admin' && data.role !== 'admin' && s.employees.filter((e) => e.role === 'admin').length === 1) {
          toast('В портале должен остаться хотя бы один администратор', 'error');
          return null;
        }
        const employeeId = id ?? uid();
        apply(
          (prev) => {
            if (id) return { ...prev, employees: prev.employees.map((e) => (e.id === id ? { ...e, ...data } : e)) };
            const created: Employee = {
              id: employeeId,
              ...input,
              role: roleAllowed ? input.role : 'employee',
              hiredAt: now().slice(0, 10),
              permissions: {},
            };
            return { ...prev, employees: [...prev.employees, created] };
          },
          'Администрирование',
          `${id ? 'Изменены данные сотрудника' : 'Добавлен сотрудник'} ${input.name}`,
        );
        return employeeId;
      },

      setRole: (id, role) => {
        const { s, acc } = ctx();
        const target = s.employees.find((e) => e.id === id);
        if (!target) return false;
        if (!acc.canManageAccessOf(target) || !acc.canAssignRole(role)) {
          return deny(target.id === acc.me.id ? 'изменение собственной роли' : 'назначение этой роли');
        }
        if (target.role === 'admin' && role !== 'admin' && s.employees.filter((e) => e.role === 'admin').length === 1) {
          toast('В портале должен остаться хотя бы один администратор', 'error');
          return false;
        }
        apply(
          (prev) => ({ ...prev, employees: prev.employees.map((e) => (e.id === id ? { ...e, role } : e)) }),
          'Администрирование',
          `Сотруднику ${target.name} назначена роль «${ROLE[role].label}»`,
        );
        return true;
      },

      setEmployeePermissions: (id, overrides) => {
        const { s, acc } = ctx();
        const target = s.employees.find((e) => e.id === id);
        if (!target) return false;
        if (!acc.canManageAccessOf(target)) {
          return deny(target.id === acc.me.id ? 'изменение собственных прав' : 'изменение прав сотрудника');
        }
        const next = cleanOverrides(overrides);
        const forbidden = forbiddenGrants(acc, next, target.permissions);
        if (forbidden.length) return deny(`выдача прав, которых нет у вас: ${forbidden.map((p) => PERMISSION_LABEL[p]).join(', ')}`);
        apply(
          (prev) => ({ ...prev, employees: prev.employees.map((e) => (e.id === id ? { ...e, permissions: next } : e)) }),
          'Администрирование',
          `Изменены индивидуальные права: ${target.name}`,
        );
        return true;
      },

      deleteEmployee: (id) => {
        const { s, acc } = ctx();
        const target = s.employees.find((e) => e.id === id);
        if (!target) return false;
        if (!acc.canDeleteEmployee(target)) return deny(target.id === acc.me.id ? 'удаление самого себя' : 'удаление сотрудника');
        if (target.role === 'admin' && s.employees.filter((e) => e.role === 'admin').length === 1) {
          toast('В портале должен остаться хотя бы один администратор', 'error');
          return false;
        }
        apply(
          (prev) => ({
            ...prev,
            employees: prev.employees.filter((e) => e.id !== id),
            tasks: prev.tasks.map((t) => (t.assigneeId === id ? { ...t, assigneeId: null } : t)),
          }),
          'Администрирование',
          `Удалён сотрудник ${target.name}`,
        );
        return true;
      },

      savePosition: (name, id) => {
        const { s, acc } = ctx();
        if (!acc.has('employees.manage')) return deny('управление должностями');
        const value = name.trim();
        if (!value) return false;
        if (s.positions.some((p) => p.id !== id && p.name.toLowerCase() === value.toLowerCase())) {
          toast('Такая должность уже есть', 'error');
          return false;
        }
        const old = id ? s.positions.find((p) => p.id === id) : undefined;
        if (id && !old) return false;
        apply(
          (prev) => {
            if (!old) return { ...prev, positions: [...prev.positions, { id: uid(), name: value, permissions: {} }] };
            // переименование должности переносится на сотрудников
            return {
              ...prev,
              positions: prev.positions.map((p) => (p.id === id ? { ...p, name: value } : p)),
              employees: prev.employees.map((e) => (e.position === old.name ? { ...e, position: value } : e)),
            };
          },
          'Администрирование',
          old ? `Должность «${old.name}» переименована в «${value}»` : `Добавлена должность «${value}»`,
        );
        return true;
      },

      setPositionPermissions: (id, overrides) => {
        const { s, acc } = ctx();
        const position = s.positions.find((p) => p.id === id);
        if (!position) return false;
        if (!acc.has('access.manage')) return deny('изменение прав должности');
        const next = cleanOverrides(overrides);
        const forbidden = forbiddenGrants(acc, next, position.permissions);
        if (forbidden.length) return deny(`выдача прав, которых нет у вас: ${forbidden.map((p) => PERMISSION_LABEL[p]).join(', ')}`);
        apply(
          (prev) => ({ ...prev, positions: prev.positions.map((p) => (p.id === id ? { ...p, permissions: next } : p)) }),
          'Администрирование',
          `Изменены права должности «${position.name}»`,
        );
        return true;
      },

      deletePosition: (id) => {
        const { s, acc } = ctx();
        const position = s.positions.find((p) => p.id === id);
        if (!position) return false;
        if (!acc.has('employees.manage')) return deny('управление должностями');
        if (s.employees.some((e) => e.position === position.name)) {
          toast('Сначала назначьте сотрудникам с этой должностью другую', 'error');
          return false;
        }
        apply((prev) => ({ ...prev, positions: prev.positions.filter((p) => p.id !== id) }), 'Администрирование', `Удалена должность «${position.name}»`);
        return true;
      },

      /* ----- категории ----- */

      saveCategory: (name, id) => {
        const { acc } = ctx();
        if (!acc.has('kb.categories')) return deny('управление категориями');
        apply(
          (prev) =>
            id
              ? { ...prev, categories: prev.categories.map((c) => (c.id === id ? { ...c, name } : c)) }
              : { ...prev, categories: [...prev.categories, { id: uid(), name }] },
          'Администрирование',
          `${id ? 'Переименована' : 'Добавлена'} категория «${name}»`,
        );
        return true;
      },

      deleteCategory: (id) => {
        const { s, acc } = ctx();
        if (!acc.has('kb.categories')) return deny('управление категориями');
        const category = s.categories.find((c) => c.id === id);
        if (!category) return false;
        apply(
          (prev) => ({
            ...prev,
            categories: prev.categories.filter((c) => c.id !== id),
            articles: prev.articles.map((a) => (a.categoryId === id ? { ...a, categoryId: null } : a)),
          }),
          'Администрирование',
          `Удалена категория «${category.name}»`,
        );
        return true;
      },
    };
  }, [toast]);

  // Только в режиме разработки: доступ к действиям из консоли для проверки, что запреты срабатывают и в обход интерфейса.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __portal?: unknown }).__portal = { actions, getState: () => stateRef.current };
  }, [actions]);

  const me = meOf(state);
  const access = useMemo(() => createAccess(state, me), [state, me]);

  const emp = useCallback(
    (id: string | null | undefined) => (id ? state.employees.find((e) => e.id === id) : undefined),
    [state.employees],
  );
  const empName = useCallback(
    (id: string | null | undefined) => (id ? (emp(id)?.name ?? 'Удалённый сотрудник') : 'Не назначен'),
    [emp],
  );

  const value = useMemo(() => ({ state, me, access, emp, empName, actions }), [state, me, access, emp, empName, actions]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
