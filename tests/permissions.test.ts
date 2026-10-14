// Проверка модели прав и миграции данных. Запуск: npm test (Node.js 22.18+ выполняет TypeScript без сборки).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AppState, Employee } from '../src/types.ts';
import { createSeed } from '../src/data/seed.ts';
import { migrate } from '../src/lib/migrate.ts';
import { ALL_PERMISSIONS, createAccess, effectivePermissions, forbiddenGrants } from '../src/lib/permissions.ts';

const seed = () => createSeed();
const emp = (s: AppState, id: string) => s.employees.find((e) => e.id === id)!;
const accessOf = (s: AppState, id: string) => createAccess(s, emp(s, id));
const task = (s: AppState, id: string) => s.tasks.find((t) => t.id === id)!;

test('сотрудник по умолчанию: статьи читает, задачника и создания статей нет', () => {
  const s = seed();
  const newcomer: Employee = { ...emp(s, 'e12'), id: 'x1', position: 'Маркетолог', permissions: {} };
  const a = createAccess(s, newcomer);
  assert.equal(a.has('kb.view'), true);
  assert.equal(a.has('kb.create'), false);
  assert.equal(a.has('tasks.access'), false);
  assert.equal(a.has('requests.access'), true);
  assert.equal(a.canOpenAdmin(), false);
  assert.equal(a.canViewTask(task(s, 't1')), false);
});

test('задачник по должности: только свои задачи, чужие не видны', () => {
  const s = seed();
  const a = accessOf(s, 'e8'); // специалист поддержки
  assert.equal(a.has('tasks.access'), true);
  assert.equal(a.has('tasks.viewAll'), false);
  assert.equal(a.canViewTask(task(s, 't10')), true, 'своя задача');
  assert.equal(a.canViewTask(task(s, 't1')), false, 'чужая задача');
  assert.equal(a.canChangeTaskStatus(task(s, 't10')), true);
  assert.equal(a.canEditTask(task(s, 't10')), false, 'редактирования по должности нет');
  assert.equal(a.canDeleteTask(task(s, 't10')), false);
  assert.equal(a.has('tasks.create'), false);
});

test('задачник по индивидуальному праву (маркетолог)', () => {
  const s = seed();
  const a = accessOf(s, 'e12');
  assert.equal(a.has('tasks.access'), true);
  assert.equal(a.has('tasks.create'), true);
  assert.equal(a.has('tasks.assign'), false);
  assert.equal(a.canViewTask(task(s, 't12')), true, 'назначена ему');
  assert.equal(a.canViewTask(task(s, 't3')), true, 'поставлена им');
  assert.equal(a.canViewTask(task(s, 't9')), false);
});

test('руководитель не получает полный доступ автоматически', () => {
  const s = seed();
  const a = accessOf(s, 'e1');
  assert.equal(a.has('tasks.viewAll'), true);
  assert.equal(a.has('tasks.delete'), false);
  assert.equal(a.has('kb.create'), false);
  assert.equal(a.has('employees.manage'), false);
  assert.equal(a.has('access.manage'), false);
  assert.equal(a.canOpenAdmin(), false);
  assert.equal(a.canManageAccessOf(emp(s, 'e8')), false);
});

test('право на статьи у руководителя появляется через должность', () => {
  const s = seed();
  assert.equal(accessOf(s, 'e3').has('kb.create'), true); // руководитель отдела продаж
  assert.equal(accessOf(s, 'e4').has('kb.create'), false); // руководитель логистики
});

test('редактор базы знаний: публикация и черновики, без управления сотрудниками', () => {
  const s = seed();
  const editor = accessOf(s, 'e5');
  const draft = s.articles.find((x) => x.id === 'a12')!;
  assert.equal(draft.status, 'draft');
  assert.equal(editor.has('kb.publish'), true);
  assert.equal(editor.canViewArticle(draft), true);
  assert.equal(editor.has('employees.manage'), false);
  assert.equal(editor.has('access.manage'), false);
  assert.equal(accessOf(s, 'e8').canViewArticle(draft), false, 'сотрудник не видит черновик');
  assert.equal(accessOf(s, 'e1').canViewArticle(draft), false, 'руководитель без права публикации не видит черновик');
});

test('администратор: все права, но не может менять права самому себе', () => {
  const s = seed();
  const admin = accessOf(s, 'e2');
  for (const p of ALL_PERMISSIONS) assert.equal(admin.has(p), true, p);
  assert.equal(admin.canManageAccessOf(emp(s, 'e2')), false);
  assert.equal(admin.canManageAccessOf(emp(s, 'e1')), true);
});

test('запрет на должности сильнее роли, индивидуальная настройка сильнее должности', () => {
  const s = seed();
  s.positions.find((p) => p.name === 'Генеральный директор')!.permissions = { 'tasks.access': false };
  assert.equal(accessOf(s, 'e1').has('tasks.access'), false, 'должность запретила');
  emp(s, 'e1').permissions = { 'tasks.access': true };
  assert.equal(accessOf(s, 'e1').has('tasks.access'), true, 'индивидуально разрешено');
});

test('права применяются сразу после изменения, без пересоздания сотрудника', () => {
  const s = seed();
  assert.equal(effectivePermissions(emp(s, 'e10'), s.positions).has('tasks.delete'), false);
  emp(s, 'e10').permissions = { 'tasks.delete': true };
  assert.equal(effectivePermissions(emp(s, 'e10'), s.positions).has('tasks.delete'), true);
});

test('нельзя повысить себе или другим права сверх своих', () => {
  const s = seed();
  emp(s, 'e1').permissions = { 'access.manage': true }; // руководитель с правом назначения прав
  const a = accessOf(s, 'e1');
  assert.equal(a.canManageAccessOf(emp(s, 'e1')), false, 'себе — нельзя');
  assert.equal(a.canManageAccessOf(emp(s, 'e2')), false, 'администратору — нельзя');
  assert.equal(a.canManageAccessOf(emp(s, 'e8')), true);
  assert.equal(a.canAssignRole('admin'), false);
  assert.equal(a.canAssignRole('editor'), true);
  assert.deepEqual(forbiddenGrants(a, { 'system.log': true, 'tasks.viewAll': true }, {}), ['system.log']);
  // уже выданное ранее право сохранить можно, даже если у самого его нет
  assert.deepEqual(forbiddenGrants(a, { 'system.log': true }, { 'system.log': true }), []);
});

test('миграция v2 → v3: данные сохраняются, появляются должности, статьи опубликованы', () => {
  const s = seed();
  // формат версии 2: без должностей, прав и статуса статей
  const v2 = JSON.parse(JSON.stringify({ ...s, version: 2 }));
  delete v2.positions;
  for (const e of v2.employees) delete e.permissions;
  for (const a of v2.articles) delete a.status;
  v2.articles.push({ id: 'user1', title: 'Статья пользователя', content: '<p>текст</p>', authorId: 'e1', categoryId: null, createdAt: '', updatedAt: '' });
  const m = migrate(v2)!;
  assert.ok(m);
  assert.equal(m.version, 3);
  assert.equal(m.employees.length, s.employees.length);
  assert.equal(m.tasks.length, s.tasks.length);
  assert.equal(m.requests.length, s.requests.length);
  assert.equal(m.articles.length, s.articles.length + 1);
  assert.ok(m.articles.every((a) => a.status === 'published'), 'старые статьи считаются опубликованными');
  assert.ok(m.employees.every((e) => m.positions.some((p) => p.name === e.position)), 'у каждого сотрудника есть должность');
  assert.equal(accessOf(m, 'e8').has('tasks.access'), true, 'права должности взяты из демо-набора');
});

test('миграция v1: графики смен отбрасываются, остальное сохраняется', () => {
  const s = seed();
  const v1 = JSON.parse(JSON.stringify({ ...s, version: 1, shiftOverrides: { 'e1|2026-01-01': 'day' } }));
  delete v1.positions;
  v1.employees[0].pattern = '5x2';
  v1.log.push({ id: 'g1', at: '', userId: 'e1', section: 'График', text: 'Изменён график' });
  const m = migrate(v1)!;
  assert.ok(!('shiftOverrides' in m));
  assert.ok(!('pattern' in m.employees[0]));
  assert.equal(m.log.some((l) => l.section === 'График'), false);
  assert.equal(m.employees.length, s.employees.length);
});

test('миграция чистит повреждённые права и неизвестные роли', () => {
  const s = seed();
  const raw = JSON.parse(JSON.stringify(s));
  raw.employees[0].permissions = { 'tasks.access': 'yes', 'hack.everything': true, 'kb.create': true };
  raw.employees[1].role = 'superuser';
  const m = migrate(raw)!;
  assert.deepEqual(m.employees[0].permissions, { 'kb.create': true });
  assert.equal(m.employees[1].role, 'employee');
});

test('непригодные данные не принимаются', () => {
  assert.equal(migrate(null), null);
  assert.equal(migrate({ version: 99, employees: [] }), null);
  assert.equal(migrate({ version: 3, employees: [] }), null);
});
