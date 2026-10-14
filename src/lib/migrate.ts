import type { AppState, Article, Employee, Position, Task, WorkRequest } from '../types';
// расширения .ts в путях нужны, чтобы модуль запускался и в тестах под Node.js
import { createSeed, SEED_POSITIONS, SEED_VERSION } from '../data/seed.ts';
import { ROLES, cleanOverrides } from './permissions.ts';

type Loose = Record<string, unknown>;
const list = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);
const isObject = (value: unknown): value is Loose => typeof value === 'object' && value !== null;
const hasId = (value: unknown): value is Loose => isObject(value) && typeof value.id === 'string';
/** Пустые даты по умолчанию: интерфейс показывает их как «—», а сортировка по строкам не ломается. */
const STAMPS = { createdAt: '', updatedAt: '' };
const fixComment = (c: Loose) => ({ authorId: '', text: '', createdAt: '', ...c });

/**
 * Должности. До версии 3 их не было: создаём из названий, указанных у сотрудников,
 * а права берём у одноимённых должностей демо-набора — так задачник остаётся у тех, у кого он есть в демо.
 */
function migratePositions(raw: unknown, employees: Employee[]): Position[] {
  const positions: Position[] = list<unknown>(raw)
    .filter((p): p is Loose => hasId(p) && typeof p.name === 'string')
    .map((p) => ({ id: p.id as string, name: (p.name as string).trim(), permissions: cleanOverrides(p.permissions) }));
  const known = new Set(positions.map((p) => p.name));
  let n = positions.length;
  for (const e of employees) {
    const name = e.position.trim();
    if (!name || known.has(name)) continue;
    known.add(name);
    const template = SEED_POSITIONS.find((p) => p.name === name);
    positions.push({ id: `pm${++n}`, name, permissions: { ...(template?.permissions ?? {}) } });
  }
  return positions;
}

/**
 * Приводит сохранённые данные к текущему формату, не теряя записей.
 * v1 → графики смен отбрасываются; v2 → появляются должности, индивидуальные права и статус статей
 * (все существующие статьи считаются опубликованными). Недостающие поля заполняются пустыми значениями.
 * Возвращает null, если данные непригодны.
 */
export function migrate(raw: unknown): AppState | null {
  if (!isObject(raw) || typeof raw.version !== 'number' || raw.version > SEED_VERSION) return null;

  const employees = list<unknown>(raw.employees)
    .filter((e): e is Loose => hasId(e) && typeof e.name === 'string')
    .map(({ pattern: _pattern, patternOffset: _offset, ...e }) => ({
      department: '',
      email: '',
      phone: '',
      hiredAt: '',
      about: '',
      ...e,
      position: typeof e.position === 'string' ? e.position : '',
      role: typeof e.role === 'string' && (ROLES as string[]).includes(e.role) ? e.role : 'employee',
      permissions: cleanOverrides(e.permissions),
    })) as Employee[];
  if (employees.length === 0) return null;

  const seed = createSeed();
  const currentUserId = employees.some((e) => e.id === raw.currentUserId) ? (raw.currentUserId as string) : employees[0].id;

  const migrated: AppState = {
    version: SEED_VERSION,
    currentUserId,
    employees,
    positions: migratePositions(raw.positions, employees),
    categories: list<unknown>(raw.categories).filter(hasId) as unknown as AppState['categories'],
    requestCategories: Array.isArray(raw.requestCategories)
      ? list<unknown>(raw.requestCategories).filter((c): c is string => typeof c === 'string')
      : seed.requestCategories,
    articles: list<unknown>(raw.articles)
      .filter(hasId)
      .map((a) => ({
        ...STAMPS,
        title: '',
        content: '',
        categoryId: null,
        authorId: '',
        ...a,
        status: a.status === 'draft' ? 'draft' : 'published',
      })) as unknown as Article[],
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
