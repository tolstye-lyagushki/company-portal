export type Role = 'employee' | 'manager' | 'admin';
export type TaskStatus = 'new' | 'in_progress' | 'review' | 'done';
export type Priority = 'low' | 'medium' | 'high';
export type RequestStatus = 'new' | 'reviewing' | 'approved' | 'rejected' | 'done';

export interface Employee {
  id: string;
  name: string;
  position: string;
  department: string;
  role: Role;
  email: string;
  phone: string;
  hiredAt: string;
  about: string;
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
  categories: Category[];
  requestCategories: string[];
  articles: Article[];
  tasks: Task[];
  requests: WorkRequest[];
  log: LogEntry[];
}
