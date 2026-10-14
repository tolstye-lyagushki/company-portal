import type {
  AppState,
  Article,
  Employee,
  Permission,
  PermissionOverrides,
  Position,
  Role,
  Task,
  WorkRequest,
} from '../types';

/*
 * Единая проверка прав для всех разделов и действий.
 * Важно: это демонстрационная модель — проверки выполняются в браузере и не защищают данные
 * от пользователя, который может изменить код страницы или содержимое localStorage.
 */

export interface PermissionInfo {
  key: Permission;
  label: string;
  hint?: string;
}

export const PERMISSION_GROUPS: { title: string; items: PermissionInfo[] }[] = [
  {
    title: 'База знаний',
    items: [
      { key: 'kb.view', label: 'Просмотр опубликованных статей' },
      { key: 'kb.create', label: 'Создание статей', hint: 'Черновики и правка своих статей' },
      { key: 'kb.edit', label: 'Редактирование любых статей' },
      { key: 'kb.publish', label: 'Публикация статей', hint: 'Публикация, снятие с публикации, просмотр черновиков' },
      { key: 'kb.delete', label: 'Удаление статей' },
      { key: 'kb.categories', label: 'Управление категориями' },
    ],
  },
  {
    title: 'Задачи',
    items: [
      { key: 'tasks.access', label: 'Доступ к задачнику', hint: 'Без права «Просмотр всех задач» — только свои задачи' },
      { key: 'tasks.viewAll', label: 'Просмотр всех задач' },
      { key: 'tasks.create', label: 'Создание задач' },
      { key: 'tasks.edit', label: 'Редактирование задач' },
      { key: 'tasks.assign', label: 'Назначение исполнителей' },
      { key: 'tasks.status', label: 'Изменение статуса' },
      { key: 'tasks.delete', label: 'Удаление задач' },
    ],
  },
  {
    title: 'Заявки',
    items: [
      { key: 'requests.access', label: 'Доступ к заявкам', hint: 'Создание и просмотр своих заявок' },
      { key: 'requests.viewAll', label: 'Просмотр всех заявок' },
      { key: 'requests.decide', label: 'Решения по заявкам' },
      { key: 'requests.delete', label: 'Удаление любых заявок' },
    ],
  },
  {
    title: 'Сотрудники и система',
    items: [
      { key: 'employees.view', label: 'Справочник сотрудников' },
      { key: 'employees.manage', label: 'Управление сотрудниками и должностями' },
      { key: 'access.manage', label: 'Назначение ролей и прав' },
      { key: 'system.log', label: 'Журнал действий' },
      { key: 'system.settings', label: 'Данные портала', hint: 'Сведения о хранилище и сброс в админ-панели' },
    ],
  },
];

export const ALL_PERMISSIONS: Permission[] = PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => i.key));
const KNOWN = new Set<string>(ALL_PERMISSIONS);
export const isPermission = (value: string): value is Permission => KNOWN.has(value);

export const PERMISSION_LABEL = Object.fromEntries(
  PERMISSION_GROUPS.flatMap((g) => g.items.map((i) => [i.key, i.label])),
) as Record<Permission, string>;

export const ROLES: Role[] = ['employee', 'editor', 'manager', 'admin'];

/** Права роли по умолчанию. Администратор получает все права всегда, независимо от настроек. */
export const ROLE_DEFAULTS: Record<Role, Permission[]> = {
  employee: ['kb.view', 'requests.access', 'employees.view'],
  editor: ['kb.view', 'kb.create', 'kb.edit', 'kb.publish', 'requests.access', 'employees.view'],
  manager: [
    'kb.view',
    'tasks.access',
    'tasks.viewAll',
    'tasks.create',
    'tasks.edit',
    'tasks.assign',
    'tasks.status',
    'requests.access',
    'requests.viewAll',
    'requests.decide',
    'employees.view',
  ],
  admin: ALL_PERMISSIONS,
};

/** Убирает из набора переопределений неизвестные ключи и не-булевы значения (например, из повреждённых данных). */
export function cleanOverrides(value: unknown): PermissionOverrides {
  if (typeof value !== 'object' || value === null) return {};
  const result: PermissionOverrides = {};
  for (const [key, flag] of Object.entries(value)) {
    if (isPermission(key) && typeof flag === 'boolean') result[key] = flag;
  }
  return result;
}

function applyOverrides(set: Set<Permission>, overrides: PermissionOverrides | undefined) {
  for (const [key, flag] of Object.entries(cleanOverrides(overrides))) {
    if (flag) set.add(key as Permission);
    else set.delete(key as Permission);
  }
}

export const positionOf = (employee: Employee, positions: Position[]) => positions.find((p) => p.name === employee.position);

/** Права без индивидуальных настроек: роль, затем должность. Нужны, чтобы показать, что даёт «по умолчанию». */
export function inheritedPermissions(employee: Employee, positions: Position[]): Set<Permission> {
  if (employee.role === 'admin') return new Set(ALL_PERMISSIONS);
  const set = new Set<Permission>(ROLE_DEFAULTS[employee.role] ?? ROLE_DEFAULTS.employee);
  applyOverrides(set, positionOf(employee, positions)?.permissions);
  return set;
}

/** Итоговые права: роль → должность → индивидуальные настройки (последнее слово за индивидуальными). */
export function effectivePermissions(employee: Employee, positions: Position[]): Set<Permission> {
  if (employee.role === 'admin') return new Set(ALL_PERMISSIONS);
  const set = inheritedPermissions(employee, positions);
  applyOverrides(set, employee.permissions);
  return set;
}

export const ADMIN_PAGE_PERMISSIONS: Permission[] = [
  'employees.manage',
  'access.manage',
  'kb.categories',
  'system.log',
  'system.settings',
];

export type Access = ReturnType<typeof createAccess>;

/** Все проверки для текущего пользователя в одном месте: и для интерфейса, и для действий в хранилище. */
export function createAccess(state: Pick<AppState, 'employees' | 'positions'>, me: Employee) {
  const perms = effectivePermissions(me, state.positions);
  const has = (p: Permission) => perms.has(p);
  const isAdmin = me.role === 'admin';

  const canViewTask = (t: Task) =>
    has('tasks.access') && (has('tasks.viewAll') || t.assigneeId === me.id || t.creatorId === me.id);
  const canEditRequest = (r: WorkRequest) => has('requests.access') && r.authorId === me.id && r.status === 'new';
  const canManageAccessOf = (e: Employee) =>
    has('access.manage') && e.id !== me.id && (isAdmin || e.role !== 'admin');

  return {
    me,
    perms,
    has,
    isAdmin,

    // база знаний
    canViewArticle: (a: Article) =>
      has('kb.view') && (a.status === 'published' || has('kb.publish') || (has('kb.create') && a.authorId === me.id)),
    canEditArticle: (a: Article) => has('kb.edit') || (has('kb.create') && a.authorId === me.id),
    canDeleteArticle: (a: Article) => has('kb.delete') || (has('kb.create') && a.authorId === me.id && a.status === 'draft'),

    // задачи
    canViewTask,
    canEditTask: (t: Task) => canViewTask(t) && has('tasks.edit'),
    canChangeTaskStatus: (t: Task) => canViewTask(t) && has('tasks.status'),
    canDeleteTask: (t: Task) => canViewTask(t) && has('tasks.delete'),
    canCommentTask: canViewTask,

    // заявки
    canViewRequest: (r: WorkRequest) => has('requests.access') && (has('requests.viewAll') || r.authorId === me.id),
    canEditRequest,
    canDeleteRequest: (r: WorkRequest) => has('requests.delete') || canEditRequest(r),

    // сотрудники и права
    canViewProfile: (e: Employee) => has('employees.view') || e.id === me.id,
    canEditProfile: (e: Employee) => (has('employees.manage') && (isAdmin || e.role !== 'admin' || e.id === me.id)) || e.id === me.id,
    canManageAccessOf,
    /** Нельзя выдать другим право, которого нет у тебя самого (кроме администратора). */
    canGrant: (p: Permission) => isAdmin || has(p),
    /** Назначать роль администратора может только администратор. */
    canAssignRole: (role: Role) => isAdmin || role !== 'admin',
    canDeleteEmployee: (e: Employee) => has('employees.manage') && e.id !== me.id && (isAdmin || e.role !== 'admin'),
    canOpenAdmin: () => ADMIN_PAGE_PERMISSIONS.some(has),
  };
}

/** Проверяет набор переопределений, который пользователь пытается сохранить: нельзя выдать то, чего нет у самого. */
export function forbiddenGrants(access: Access, next: PermissionOverrides, previous: PermissionOverrides): Permission[] {
  return (Object.entries(cleanOverrides(next)) as [Permission, boolean][])
    .filter(([key, flag]) => flag && previous[key] !== true && !access.canGrant(key))
    .map(([key]) => key);
}
