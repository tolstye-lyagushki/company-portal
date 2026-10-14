export type Role = 'employee' | 'editor' | 'manager' | 'admin';
export type TaskStatus = 'new' | 'in_progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type RequestStatus = 'new' | 'reviewing' | 'approved' | 'rejected' | 'done';
export type ArticleStatus = 'draft' | 'published';

/** Отдельные права. Роль задаёт набор по умолчанию, должность и сотрудник могут его дополнять или урезать. */
export type Permission =
  | 'kb.view'
  | 'kb.create'
  | 'kb.edit'
  | 'kb.publish'
  | 'kb.delete'
  | 'kb.categories'
  | 'tasks.access'
  | 'tasks.viewAll'
  | 'tasks.create'
  | 'tasks.edit'
  | 'tasks.assign'
  | 'tasks.status'
  | 'tasks.delete'
  | 'requests.access'
  | 'requests.viewAll'
  | 'requests.decide'
  | 'requests.delete'
  | 'employees.view'
  | 'employees.manage'
  | 'access.manage'
  | 'system.log'
  | 'system.settings';

/** true — разрешить, false — запретить; отсутствие ключа — оставить как задано ролью (и должностью). */
export type PermissionOverrides = Partial<Record<Permission, boolean>>;

export interface Position {
  id: string;
  name: string;
  permissions: PermissionOverrides;
}

export interface Employee {
  id: string;
  name: string;
  /** Название должности; совпадает с Position.name. */
  position: string;
  department: string;
  role: Role;
  email: string;
  phone: string;
  hiredAt: string;
  about: string;
  /** Индивидуальные права поверх роли и должности. */
  permissions: PermissionOverrides;
}

export interface Category {
  id: string;
  name: string;
}

export interface Article {
  id: string;
  title: string;
  categoryId: string | null;
  content: string;
  authorId: string;
  status: ArticleStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  assigneeId: string | null;
  creatorId: string;
  dueDate: string;
  priority: Priority;
  status: TaskStatus;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  authorId: string;
  text: string;
  at: string;
}

export interface WorkRequest {
  id: string;
  title: string;
  description: string;
  category: string;
  authorId: string;
  status: RequestStatus;
  comments: Comment[];
  history: HistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface LogEntry {
  id: string;
  at: string;
  userId: string;
  section: string;
  text: string;
}

export interface AppState {
  version: number;
  currentUserId: string;
  employees: Employee[];
  positions: Position[];
  categories: Category[];
  requestCategories: string[];
  articles: Article[];
  tasks: Task[];
  requests: WorkRequest[];
  log: LogEntry[];
}
