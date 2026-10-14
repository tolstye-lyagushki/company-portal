import type { Employee, Priority, RequestStatus, Role, TaskStatus } from '../types';

export type Tone = 'blue' | 'amber' | 'violet' | 'green' | 'red' | 'gray' | 'teal';

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

/* ---------- Даты ---------- */

const pad = (n: number) => String(n).padStart(2, '0');

export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toISODate(new Date());

export function parseISODate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, n: number) {
  const d = parseISODate(iso);
  d.setDate(d.getDate() + n);
  return toISODate(d);
}

export const daysBetween = (from: string, to: string) =>
  Math.round((parseISODate(to).getTime() - parseISODate(from).getTime()) / 86_400_000);

/** Разбирает дату; для пустых и повреждённых значений (например, из старых сохранений) возвращает null. */
function asDate(iso: string | null | undefined) {
  if (typeof iso !== 'string' || !iso) return null;
  const d = iso.length === 10 ? parseISODate(iso) : new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

const NO_DATE = '—';
const dfLong = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const dfShort = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' });
const dfTime = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });
const dfWeekdayLong = new Intl.DateTimeFormat('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

const formatWith = (df: Intl.DateTimeFormat, iso: string) => {
  const d = asDate(iso);
  return d ? df.format(d) : NO_DATE;
};

export const formatDate = (iso: string) => formatWith(dfLong, iso).replace(' г.', '');
export const formatShort = (iso: string) => formatWith(dfShort, iso).replace('.', '');
export const formatDayLong = (iso: string) => formatWith(dfWeekdayLong, iso);

export function formatDateTime(iso: string) {
  const d = asDate(iso);
  if (!d) return NO_DATE;
  const day = toISODate(d);
  const time = dfTime.format(d);
  if (day === today()) return `сегодня, ${time}`;
  if (day === addDays(today(), -1)) return `вчера, ${time}`;
  return `${formatShort(day)}, ${time}`;
}

export function dueLabel(iso: string) {
  if (!asDate(iso)) return NO_DATE;
  const diff = daysBetween(today(), iso);
  if (diff === 0) return 'сегодня';
  if (diff === 1) return 'завтра';
  if (diff === -1) return 'вчера';
  return formatShort(iso);
}

/* ---------- Текст ---------- */

export function stripHtml(html: string) {
  // пробел после блочных элементов, иначе абзацы и заголовки склеиваются: «сотрудников.Разделы»
  const spaced = (html ?? '').replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>|<br\s*\/?>/gi, '$& ');
  const doc = new DOMParser().parseFromString(spaced, 'text/html');
  return (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export const excerpt = (html: string, max = 140) => {
  const text = stripHtml(html);
  return text.length > max ? text.slice(0, max).trimEnd() + '…' : text;
};

export const matches = (query: string, ...fields: (string | undefined | null)[]) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => f && f.toLowerCase().includes(q));
};

export function plural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function initials(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

// тёплая палитра фирменного стиля: киноварь, индиго, маття, графит, охра, слива, морская волна, каштан
const AVATAR_COLORS = ['#b8262e', '#2c4f7c', '#4f7a2c', '#3a3632', '#a86a12', '#7a3b6e', '#1f6a60', '#7a3f22'];

export function avatarColor(seed: string | null | undefined) {
  const s = seed ?? '';
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

/* ---------- Справочники ---------- */

export const TASK_STATUS: Record<TaskStatus, { label: string; tone: Tone }> = {
  new: { label: 'Новая', tone: 'blue' },
  in_progress: { label: 'В работе', tone: 'amber' },
  review: { label: 'На проверке', tone: 'violet' },
  done: { label: 'Выполнена', tone: 'green' },
};
export const TASK_STATUS_ORDER: TaskStatus[] = ['new', 'in_progress', 'review', 'done'];

export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  high: { label: 'Высокий', tone: 'red' },
  medium: { label: 'Средний', tone: 'amber' },
  low: { label: 'Низкий', tone: 'gray' },
};
export const PRIORITY_ORDER: Priority[] = ['high', 'medium', 'low'];

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  new: { label: 'Новая', tone: 'blue' },
  reviewing: { label: 'Рассматривается', tone: 'amber' },
  approved: { label: 'Одобрена', tone: 'green' },
  rejected: { label: 'Отклонена', tone: 'red' },
  done: { label: 'Выполнена', tone: 'teal' },
};
export const REQUEST_STATUS_ORDER: RequestStatus[] = ['new', 'reviewing', 'approved', 'rejected', 'done'];

export const ROLE: Record<Role, { label: string; tone: Tone }> = {
  employee: { label: 'Сотрудник', tone: 'gray' },
  editor: { label: 'Редактор базы знаний', tone: 'teal' },
  manager: { label: 'Руководитель', tone: 'blue' },
  admin: { label: 'Администратор', tone: 'violet' },
};
export const ROLE_ORDER: Role[] = ['employee', 'editor', 'manager', 'admin'];

export const byName = (a: Employee, b: Employee) => a.name.localeCompare(b.name, 'ru');
