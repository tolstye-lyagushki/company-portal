import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  AppState,
  Article,
  Employee,
  Priority,
  RequestStatus,
  Role,
  Task,
  TaskStatus,
  WorkRequest,
} from './types';
import { createSeed, SEED_VERSION } from './data/seed';
import { REQUEST_STATUS, ROLE, TASK_STATUS, uid } from './lib/utils';
import { useUi } from './components/ui';

// Имя ключа не меняем при смене формата: по нему находятся ранее сохранённые данные.
export const STORAGE_KEY = 'company-portal:v1';
/** Сюда откладываются сохранённые данные, которые не удалось прочитать, чтобы не потерять их молча. */
const BACKUP_KEY = 'company-portal:unreadable-backup';
const LOG_LIMIT = 300;

type Loose = Record<string, unknown>;
const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null;
const hasId = (value: unknown): value is Loose => isObject(value) && typeof value.id === 'string';
/** Пустые даты по умолчанию: интерфейс показывает их как «—», а сортировка по строкам не ломается. */
const STAMPS = { createdAt: '', updatedAt: '' };
const fixComment = (c: Loose) => ({ authorId: '', text: '', createdAt: '', ...c });

/**
 * Приводит сохранённые данные к текущему формату, не теряя записей.
 * Версия 1 содержала графики смен: поля shiftOverrides, pattern и patternOffset отбрасываются,
 * записи журнала раздела «График» удаляются. Недостающие необязательные поля заполняются пустыми значениями.
 * Возвращает null, если данные непригодны.
 */
export function migrate(raw: unknown): AppState | null {
  if (!isObject(raw) || typeof raw.version !== 'number' || raw.version > SEED_VERSION) return null;

  const employees = list<unknown>(raw.employees)
    .filter((e): e is Loose => hasId(e) && typeof e.name === 'string')
    .map(({ pattern: _pattern, patternOffset: _offset, ...e }) => ({
      position: '',
      department: '',
      email: '',
      phone: '',
      hiredAt: '',
      about: '',
      ...e,
      role: typeof e.role === 'string' && e.role in ROLE ? e.role : 'employee',
    })) as Employee[];
  if (employees.length === 0) return null;

  const seed = createSeed();
  const currentUserId = employees.some((e) => e.id === raw.currentUserId) ? (raw.currentUserId as string) : employees[0].id;

  const migrated: AppState = {
    version: SEED_VERSION,
    currentUserId,
    employees,
    categories: list<unknown>(raw.categories).filter(hasId) as unknown as AppState['categories'],
    requestCategories: Array.isArray(raw.requestCategories)
      ? list<unknown>(raw.requestCategories).filter((c): c is string => typeof c === 'string')
      : seed.requestCategories,
    articles: list<unknown>(raw.articles)
      .filter(hasId)
      .map((a) => ({ ...STAMPS, title: '', content: '', categoryId: null, authorId: '', ...a })) as unknown as Article[],
    tasks: list<unknown>(raw.tasks)
      .filter(hasId)
      .map((t) => ({
        ...STAMPS,
        title: '',
        description: '',
        assigneeId: null,
        creatorId: '',
        dueDate: '',
        priority: 'medium',
        status: 'new',
        ...t,
        comments: list<unknown>(t.comments).filter(hasId).map(fixComment),
      })) as unknown as Task[],
    requests: list<unknown>(raw.requests)
      .filter(hasId)
      .map((r) => ({
        ...STAMPS,
        title: '',
        description: '',
        category: '',
        authorId: '',
        status: 'new',
        ...r,
        comments: list<unknown>(r.comments).filter(hasId).map(fixComment),
        history: list<unknown>(r.history).filter(hasId).map((h) => ({ authorId: '', text: '', at: '', ...h })),
      })) as unknown as WorkRequest[],
    log: list<unknown>(raw.log)
      .filter((l): l is Loose => hasId(l) && l.section !== 'График')
      .map((l) => ({ at: '', userId: '', section: '', text: '', ...l })) as unknown as AppState['log'],
  };
  return raw.version < 2 ? replaceLegacyTexts(migrated) : migrated;
}

/*
 * Демо-записи версии 1 упоминали графики смен. Заменяем такие тексты, только если они
 * совпадают с исходными дословно — то, что пользователь успел отредактировать, не трогаем.
 */
const LEGACY_TEXT: [string, string][] = [
  ['Склад, приёмка и отгрузки. Составляет графики сменных сотрудников.', 'Склад, приёмка и отгрузки. Отвечает за договоры с перевозчиками.'],
  ['Утвердить график смен на следующий месяц', 'Утвердить план отгрузок на следующий месяц'],
  ['Согласовать график поддержки и склада, учесть отпуска.', 'Согласовать объёмы отгрузок с отделом продаж и складом, учесть отпуска.'],
  ['Черновик графика готов, посмотрите раздел «Графики».', 'Черновик плана готов, таблица во вложении к письму.'],
  ['Перенос смены', 'Отгул на один день'],
  ['Создана заявка «Перенос смены»', 'Создана заявка «Отгул на один день»'],
];
const LEGACY_FRAGMENTS: [string, string][] = [
  ['базу знаний, задачи, заявки и графики смен.', 'базу знаний, задачи, заявки и справочник сотрудников.'],
  ['<li><strong>Графики</strong> — расписание смен по сотрудникам и датам.</li>', '<li><strong>Сотрудники</strong> — контакты коллег, должности и подразделения.</li>'],
  ['Если у вас смены — предупредите', 'Если вы работаете с клиентами или на складе — предупредите'],
];
const legacyText = (value: string) => LEGACY_TEXT.find(([from]) => from === value)?.[1] ?? value;
// в повреждённых данных поле может оказаться не строкой — тогда оставляем как есть
const replaceIn = (value: string, from: string | RegExp, to: string) => (typeof value === 'string' ? value.replace(from, to) : value);

function replaceLegacyTexts(state: AppState): AppState {
  return {
    ...state,
    employees: state.employees.map((e) => ({ ...e, about: legacyText(e.about) })),
    articles: state.articles.map((a) => ({
      ...a,
      content: LEGACY_FRAGMENTS.reduce((html, [from, to]) => replaceIn(html, from, to), a.content),
    })),
    tasks: state.tasks.map((t) => ({
      ...t,
      title: legacyText(t.title),
      description: legacyText(t.description),
      comments: t.comments.map((c) => ({ ...c, text: legacyText(c.text) })),
    })),
    requests: state.requests.map((r) => ({
      ...r,
      title: legacyText(r.title),
      description: replaceIn(
        r.description,
        /^Прошу перенести мою смену с (\d{2}\.\d{2}\.\d{4}) на следующий день по семейным обстоятельствам\.$/,
        'Прошу предоставить отгул $1 по семейным обстоятельствам.',
      ),
    })),
    log: state.log.map((l) => ({ ...l, text: legacyText(l.text) })),
  };
}

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

/* ---------- Права (демонстрационные, не защита доступа) ---------- */

export type Permission =
  | 'article.edit'
  | 'task.edit'
  | 'task.status'
  | 'request.viewAll'
  | 'request.status'
  | 'request.edit'
  | 'request.delete'
  | 'employee.edit'
  | 'admin';

function check(me: Employee, permission: Permission, target?: Article | Task | WorkRequest | Employee): boolean {
  const lead = me.role === 'manager' || me.role === 'admin';
  switch (permission) {
    case 'article.edit':
      return lead || (target as Article | undefined)?.authorId === me.id;
    case 'task.edit':
      return lead || (target as Task | undefined)?.creatorId === me.id;
    case 'task.status': {
      const t = target as Task | undefined;
      return lead || t?.creatorId === me.id || t?.assigneeId === me.id;
    }
    case 'request.viewAll':
    case 'request.status':
      return lead;
    case 'request.edit': {
      const r = target as WorkRequest | undefined;
      return r?.authorId === me.id && r.status === 'new';
    }
    case 'request.delete': {
      const r = target as WorkRequest | undefined;
      return me.role === 'admin' || (r?.authorId === me.id && r.status === 'new');
    }
    case 'employee.edit':
      return me.role === 'admin' || (target as Employee | undefined)?.id === me.id;
    case 'admin':
      return me.role === 'admin';
  }
}

/* ---------- Действия ---------- */

export interface ArticleInput {
  title: string;
  categoryId: string | null;
  content: string;
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

interface Actions {
  switchUser: (id: string) => void;
  resetDemo: () => void;
  saveArticle: (input: ArticleInput, id?: string) => string;
  deleteArticle: (id: string) => void;
  saveTask: (input: TaskInput, id?: string) => string;
  setTaskStatus: (id: string, status: TaskStatus) => void;
  deleteTask: (id: string) => void;
  addTaskComment: (id: string, text: string) => void;
  saveRequest: (input: RequestInput, id?: string) => string;
  setRequestStatus: (id: string, status: RequestStatus) => void;
  deleteRequest: (id: string) => void;
  addRequestComment: (id: string, text: string) => void;
  saveEmployee: (input: EmployeeInput, id?: string) => string;
  setRole: (id: string, role: Role) => void;
  deleteEmployee: (id: string) => void;
  saveCategory: (name: string, id?: string) => void;
  deleteCategory: (id: string) => void;
}

interface Store {
  state: AppState;
  me: Employee;
  emp: (id: string | null | undefined) => Employee | undefined;
  empName: (id: string | null | undefined) => string;
  can: (permission: Permission, target?: Article | Task | WorkRequest | Employee) => boolean;
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

    const nameOf = (s: AppState, id: string) => s.employees.find((e) => e.id === id)?.name ?? 'сотрудник';

    return {
      switchUser: (id) =>
        apply(
          (s) => ({ ...s, currentUserId: id }),
          'Система',
          (s) => `Демо-вход под пользователем ${nameOf(s, id)}`,
        ),

      resetDemo: () => setState(createSeed()),

      saveArticle: (input, id) => {
        const articleId = id ?? uid();
        apply(
          (s) => {
            if (id) {
              return {
                ...s,
                articles: s.articles.map((a) => (a.id === id ? { ...a, ...input, updatedAt: now() } : a)),
              };
            }
            const created: Article = { id: articleId, ...input, authorId: s.currentUserId, createdAt: now(), updatedAt: now() };
            return { ...s, articles: [created, ...s.articles] };
          },
          'База знаний',
          `${id ? 'Изменена' : 'Создана'} статья «${input.title}»`,
        );
        return articleId;
      },

      deleteArticle: (id) =>
        apply(
          (s) => ({ ...s, articles: s.articles.filter((a) => a.id !== id) }),
          'База знаний',
          (s) => `Удалена статья «${s.articles.find((a) => a.id === id)?.title ?? ''}»`,
        ),

      saveTask: (input, id) => {
        const taskId = id ?? uid();
        apply(
          (s) => {
            if (id) {
              return { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...input, updatedAt: now() } : t)) };
            }
            const created: Task = { id: taskId, ...input, creatorId: s.currentUserId, comments: [], createdAt: now(), updatedAt: now() };
            return { ...s, tasks: [created, ...s.tasks] };
          },
          'Задачи',
          `${id ? 'Изменена' : 'Создана'} задача «${input.title}»`,
        );
        return taskId;
      },

      setTaskStatus: (id, status) =>
        apply(
          (s) => {
            const task = s.tasks.find((t) => t.id === id);
            if (!task || task.status === status) return s;
            return { ...s, tasks: s.tasks.map((t) => (t.id === id ? { ...t, status, updatedAt: now() } : t)) };
          },
          'Задачи',
          (s) => `Задача «${s.tasks.find((t) => t.id === id)?.title ?? ''}»: статус «${TASK_STATUS[status].label}»`,
        ),

      deleteTask: (id) =>
        apply(
          (s) => ({ ...s, tasks: s.tasks.filter((t) => t.id !== id) }),
          'Задачи',
          (s) => `Удалена задача «${s.tasks.find((t) => t.id === id)?.title ?? ''}»`,
        ),

      addTaskComment: (id, text) =>
        apply(
          (s) => ({
            ...s,
            tasks: s.tasks.map((t) =>
              t.id === id
                ? { ...t, comments: [...t.comments, { id: uid(), authorId: s.currentUserId, text, createdAt: now() }], updatedAt: now() }
                : t,
            ),
          }),
          'Задачи',
          (s) => `Добавлен комментарий к задаче «${s.tasks.find((t) => t.id === id)?.title ?? ''}»`,
        ),

      saveRequest: (input, id) => {
        const requestId = id ?? uid();
        apply(
          (s) => {
            if (id) {
              return {
                ...s,
                requests: s.requests.map((r) =>
                  r.id === id
                    ? {
                        ...r,
                        ...input,
                        updatedAt: now(),
                        history: [...r.history, { id: uid(), authorId: s.currentUserId, text: 'Заявка отредактирована', at: now() }],
                      }
                    : r,
                ),
              };
            }
            const created: WorkRequest = {
              id: requestId,
              ...input,
              authorId: s.currentUserId,
              status: 'new',
              comments: [],
              history: [{ id: uid(), authorId: s.currentUserId, text: 'Заявка создана', at: now() }],
              createdAt: now(),
              updatedAt: now(),
            };
            return { ...s, requests: [created, ...s.requests] };
          },
          'Заявки',
          `${id ? 'Изменена' : 'Создана'} заявка «${input.title}»`,
        );
        return requestId;
      },

      setRequestStatus: (id, status) =>
        apply(
          (s) => {
            const request = s.requests.find((r) => r.id === id);
            if (!request || request.status === status) return s;
            const text = `Статус изменён: «${REQUEST_STATUS[request.status].label}» → «${REQUEST_STATUS[status].label}»`;
            return {
              ...s,
              requests: s.requests.map((r) =>
                r.id === id
                  ? { ...r, status, updatedAt: now(), history: [...r.history, { id: uid(), authorId: s.currentUserId, text, at: now() }] }
                  : r,
              ),
            };
          },
          'Заявки',
          (s) => `Заявка «${s.requests.find((r) => r.id === id)?.title ?? ''}»: статус «${REQUEST_STATUS[status].label}»`,
        ),

      deleteRequest: (id) =>
        apply(
          (s) => ({ ...s, requests: s.requests.filter((r) => r.id !== id) }),
          'Заявки',
          (s) => `Удалена заявка «${s.requests.find((r) => r.id === id)?.title ?? ''}»`,
        ),

      addRequestComment: (id, text) =>
        apply(
          (s) => ({
            ...s,
            requests: s.requests.map((r) =>
              r.id === id
                ? {
                    ...r,
                    updatedAt: now(),
                    comments: [...r.comments, { id: uid(), authorId: s.currentUserId, text, createdAt: now() }],
                    history: [...r.history, { id: uid(), authorId: s.currentUserId, text: 'Добавлен комментарий', at: now() }],
                  }
                : r,
            ),
          }),
          'Заявки',
          (s) => `Добавлен комментарий к заявке «${s.requests.find((r) => r.id === id)?.title ?? ''}»`,
        ),

      saveEmployee: (input, id) => {
        const employeeId = id ?? uid();
        apply(
          (s) => {
            if (id) {
              return { ...s, employees: s.employees.map((e) => (e.id === id ? { ...e, ...input } : e)) };
            }
            const created: Employee = {
              id: employeeId,
              ...input,
              hiredAt: now().slice(0, 10),
            };
            return { ...s, employees: [...s.employees, created] };
          },
          'Администрирование',
          `${id ? 'Изменены данные сотрудника' : 'Добавлен сотрудник'} ${input.name}`,
        );
        return employeeId;
      },

      setRole: (id, role) =>
        apply(
          (s) => ({ ...s, employees: s.employees.map((e) => (e.id === id ? { ...e, role } : e)) }),
          'Администрирование',
          (s) => `Сотруднику ${nameOf(s, id)} назначена роль «${ROLE[role].label}»`,
        ),

      deleteEmployee: (id) =>
        apply(
          (s) => {
            if (id === s.currentUserId) return s;
            return {
              ...s,
              employees: s.employees.filter((e) => e.id !== id),
              tasks: s.tasks.map((t) => (t.assigneeId === id ? { ...t, assigneeId: null } : t)),
            };
          },
          'Администрирование',
          (s) => `Удалён сотрудник ${nameOf(s, id)}`,
        ),

      saveCategory: (name, id) =>
        apply(
          (s) =>
            id
              ? { ...s, categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)) }
              : { ...s, categories: [...s.categories, { id: uid(), name }] },
          'Администрирование',
          `${id ? 'Переименована' : 'Добавлена'} категория «${name}»`,
        ),

      deleteCategory: (id) =>
        apply(
          (s) => ({
            ...s,
            categories: s.categories.filter((c) => c.id !== id),
            articles: s.articles.map((a) => (a.categoryId === id ? { ...a, categoryId: null } : a)),
          }),
          'Администрирование',
          (s) => `Удалена категория «${s.categories.find((c) => c.id === id)?.name ?? ''}»`,
        ),
    };
  }, []);

  const me = state.employees.find((e) => e.id === state.currentUserId) ?? state.employees[0];

  const emp = useCallback(
    (id: string | null | undefined) => (id ? state.employees.find((e) => e.id === id) : undefined),
    [state.employees],
  );
  const empName = useCallback(
    (id: string | null | undefined) => (id ? (emp(id)?.name ?? 'Удалённый сотрудник') : 'Не назначен'),
    [emp],
  );
  const can = useCallback<Store['can']>((permission, target) => check(me, permission, target), [me]);

  const value = useMemo(() => ({ state, me, emp, empName, can, actions }), [state, me, emp, empName, can, actions]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}
