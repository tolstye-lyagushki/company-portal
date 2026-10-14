import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Kanban, List, ListChecks, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { Priority, Task, TaskStatus } from '../types';
import { useStore, type TaskInput } from '../store';
import {
  PRIORITY,
  PRIORITY_ORDER,
  TASK_STATUS,
  TASK_STATUS_ORDER,
  addDays,
  byName,
  dueLabel,
  formatDate,
  formatDateTime,
  matches,
  today,
} from '../lib/utils';
import { Avatar, Badge, Button, EmptyState, Field, Modal, Segmented, useUi } from '../components/ui';
import { Comments } from '../components/Comments';

const VIEW_KEY = 'company-portal:tasks-view';

function TaskForm({ task, onClose }: { task?: Task; onClose: () => void }) {
  const { state, me, actions } = useStore();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [form, setForm] = useState<TaskInput>({
    title: task?.title ?? '',
    description: task?.description ?? '',
    assigneeId: task ? task.assigneeId : me.id,
    dueDate: task?.dueDate ?? addDays(today(), 3),
    priority: task?.priority ?? 'medium',
    status: task?.status ?? 'new',
  });
  const [error, setError] = useState('');
  const set = <K extends keyof TaskInput>(key: K, value: TaskInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const save = () => {
    if (!form.title.trim()) return setError('Укажите название задачи');
    if (!form.dueDate) return setError('Укажите срок выполнения');
    const id = actions.saveTask({ ...form, title: form.title.trim(), description: form.description.trim() }, task?.id);
    toast(task ? 'Задача сохранена' : 'Задача создана');
    onClose();
    if (!task) navigate(`/tasks/${id}`);
  };

  return (
    <Modal
      title={task ? 'Редактирование задачи' : 'Новая задача'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={save}>
            {task ? 'Сохранить' : 'Создать задачу'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Название" className="span-2">
          <input
            className="input"
            autoFocus
            maxLength={160}
            value={form.title}
            placeholder="Что нужно сделать"
            onChange={(e) => {
              set('title', e.target.value);
              setError('');
            }}
          />
        </Field>
        <Field label="Описание" className="span-2">
          <textarea className="textarea" rows={4} value={form.description} placeholder="Подробности, ожидаемый результат" onChange={(e) => set('description', e.target.value)} />
        </Field>
        <Field label="Ответственный">
          <select className="select" value={form.assigneeId ?? ''} onChange={(e) => set('assigneeId', e.target.value || null)}>
            <option value="">Не назначен</option>
            {[...state.employees].sort(byName).map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Срок выполнения">
          <input
            className="input"
            type="date"
            value={form.dueDate}
            onChange={(e) => {
              set('dueDate', e.target.value);
              setError('');
            }}
          />
        </Field>
        <Field label="Приоритет">
          <select className="select" value={form.priority} onChange={(e) => set('priority', e.target.value as Priority)}>
            {PRIORITY_ORDER.map((p) => (
              <option key={p} value={p}>{PRIORITY[p].label}</option>
            ))}
          </select>
        </Field>
        <Field label="Статус">
          <select className="select" value={form.status} onChange={(e) => set('status', e.target.value as TaskStatus)}>
            {TASK_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{TASK_STATUS[s].label}</option>
            ))}
          </select>
        </Field>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}

function TaskDetails({ task, onClose, onEdit }: { task: Task; onClose: () => void; onEdit: () => void }) {
  const { actions, can, emp, empName } = useStore();
  const { confirm, toast } = useUi();
  const assignee = emp(task.assigneeId);
  const overdue = task.status !== 'done' && task.dueDate < today();

  const remove = async () => {
    const ok = await confirm({
      title: 'Удалить задачу?',
      text: `Задача «${task.title}» и её комментарии будут удалены.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    actions.deleteTask(task.id);
    toast('Задача удалена');
    onClose();
  };

  return (
    <Modal
      title={task.title}
      size="lg"
      onClose={onClose}
      footer={
        can('task.edit', task) ? (
          <>
            <Button variant="danger" onClick={remove}>
              <Trash2 size={16} /> Удалить
            </Button>
            <Button onClick={onEdit}>
              <Pencil size={16} /> Редактировать
            </Button>
          </>
        ) : undefined
      }
    >
      <div className="kv">
        <div>
          <div className="kv-label">Статус</div>
          {can('task.status', task) ? (
            <select
              className="select select-sm"
              aria-label="Статус задачи"
              value={task.status}
              onChange={(e) => {
                const status = e.target.value as TaskStatus;
                actions.setTaskStatus(task.id, status);
                toast(`Статус: ${TASK_STATUS[status].label.toLowerCase()}`);
              }}
            >
              {TASK_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{TASK_STATUS[s].label}</option>
              ))}
            </select>
          ) : (
            <Badge tone={TASK_STATUS[task.status].tone}>{TASK_STATUS[task.status].label}</Badge>
          )}
        </div>
        <div>
          <div className="kv-label">Ответственный</div>
          {assignee ? (
            <Link to={`/people/${assignee.id}`} className="person-inline link">
              <Avatar name={assignee.name} id={assignee.id} size="sm" /> {assignee.name}
            </Link>
          ) : (
            <span className="muted">{empName(task.assigneeId)}</span>
          )}
        </div>
        <div>
          <div className="kv-label">Срок</div>
          <span className={overdue ? 'danger-text' : ''}>
            {formatDate(task.dueDate)}
            {overdue && ' · просрочена'}
          </span>
        </div>
        <div>
          <div className="kv-label">Приоритет</div>
          <Badge tone={PRIORITY[task.priority].tone}>{PRIORITY[task.priority].label}</Badge>
        </div>
        <div>
          <div className="kv-label">Постановщик</div>
          {empName(task.creatorId)}
        </div>
        <div>
          <div className="kv-label">Создана</div>
          {formatDateTime(task.createdAt)}
        </div>
      </div>

      <h3 className="section-title">Описание</h3>
      <p className="pre-wrap">{task.description || <span className="muted">Описание не добавлено.</span>}</p>

      <h3 className="section-title">Комментарии · {task.comments.length}</h3>
      <Comments items={task.comments} onAdd={(text) => actions.addTaskComment(task.id, text)} />
    </Modal>
  );
}

export default function Tasks() {
  const { id } = useParams();
  const { state, me, empName } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'open' | TaskStatus>('all');
  const [assignee, setAssignee] = useState('all');
  // выбранный вид запоминается в этом браузере отдельным ключом, данные портала он не трогает
  const [view, setView] = useState<'list' | 'board'>(() => {
    try {
      return localStorage.getItem(VIEW_KEY) === 'board' ? 'board' : 'list';
    } catch {
      return 'list';
    }
  });
  const changeView = (next: 'list' | 'board') => {
    setView(next);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // хранилище недоступно — вид просто не запомнится
    }
  };
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (params.get('new')) {
      setCreating(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const selected = id ? state.tasks.find((t) => t.id === id) : undefined;
  const now = today();

  const tasks = useMemo(
    () =>
      state.tasks
        .filter((t) => (status === 'all' ? true : status === 'open' ? t.status !== 'done' : t.status === status))
        .filter((t) => {
          if (assignee === 'all') return true;
          if (assignee === 'me') return t.assigneeId === me.id;
          if (assignee === 'none') return !t.assigneeId;
          return t.assigneeId === assignee;
        })
        .filter((t) => matches(query, t.title, t.description))
        .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.dueDate.localeCompare(b.dueDate)),
    [state.tasks, status, assignee, query, me.id],
  );

  const filtered = status !== 'all' || assignee !== 'all' || query.trim() !== '';
  const resetFilters = () => {
    setQuery('');
    setStatus('all');
    setAssignee('all');
  };

  const dueCell = (t: Task) => (
    <span className={t.status !== 'done' && t.dueDate < now ? 'danger-text' : ''}>{dueLabel(t.dueDate)}</span>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Задачи</h1>
          <p className="page-sub">Поручения с ответственными, сроками и приоритетами</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Новая задача
        </Button>
      </div>

      <div className="toolbar">
        <div className="search toolbar-grow">
          <Search size={16} className="search-icon" />
          <input className="input search-input" type="search" placeholder="Поиск по задачам" aria-label="Поиск по задачам" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="select" aria-label="Статус" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Все статусы</option>
          <option value="open">Все незавершённые</option>
          {TASK_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{TASK_STATUS[s].label}</option>
          ))}
        </select>
        <select className="select" aria-label="Ответственный" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="all">Все ответственные</option>
          <option value="me">Мои задачи</option>
          <option value="none">Не назначен</option>
          {[...state.employees].sort(byName).map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
        <Segmented
          label="Вид"
          value={view}
          onChange={changeView}
          options={[
            { value: 'list', label: <List size={16} />, title: 'Список' },
            { value: 'board', label: <Kanban size={16} />, title: 'Доска' },
          ]}
        />
      </div>

      {tasks.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<ListChecks size={22} />}
            title={filtered ? 'Задачи не найдены' : 'Задач пока нет'}
            text={filtered ? 'Измените условия поиска или фильтры.' : 'Создайте первую задачу.'}
            action={filtered ? <Button onClick={resetFilters}>Сбросить фильтры</Button> : <Button variant="primary" onClick={() => setCreating(true)}>Новая задача</Button>}
          />
        </div>
      ) : view === 'list' ? (
        <div className="card rows rows-tasks">
          <div className="row row-head">
            <span>Задача</span>
            <span>Ответственный</span>
            <span>Срок</span>
            <span>Приоритет</span>
            <span>Статус</span>
          </div>
          {tasks.map((t) => (
            <Link key={t.id} to={`/tasks/${t.id}`} className="row">
              <span className="row-title">{t.title}</span>
              <span className="person-inline">
                {t.assigneeId && <Avatar name={empName(t.assigneeId)} id={t.assigneeId} size="sm" />}
                <span className={t.assigneeId ? '' : 'muted'}>{empName(t.assigneeId)}</span>
              </span>
              <span data-label="Срок">{dueCell(t)}</span>
              <span><Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge></span>
              <span><Badge tone={TASK_STATUS[t.status].tone}>{TASK_STATUS[t.status].label}</Badge></span>
            </Link>
          ))}
        </div>
      ) : (
        <div className="board">
          {TASK_STATUS_ORDER.map((s) => {
            const column = tasks.filter((t) => t.status === s);
            return (
              <div key={s} className="board-col">
                <div className="board-head">
                  <Badge tone={TASK_STATUS[s].tone}>{TASK_STATUS[s].label}</Badge>
                  <span className="muted small">{column.length}</span>
                </div>
                {column.map((t) => (
                  <Link key={t.id} to={`/tasks/${t.id}`} className="card card-link board-card">
                    <div className="row-title">{t.title}</div>
                    <div className="board-meta">
                      <Badge tone={PRIORITY[t.priority].tone}>{PRIORITY[t.priority].label}</Badge>
                      <span className="small">{dueCell(t)}</span>
                    </div>
                    <div className="person-inline small">
                      {t.assigneeId && <Avatar name={empName(t.assigneeId)} id={t.assigneeId} size="sm" />}
                      <span className="muted">{empName(t.assigneeId)}</span>
                    </div>
                  </Link>
                ))}
                {column.length === 0 && <div className="board-empty muted small">Нет задач</div>}
              </div>
            );
          })}
        </div>
      )}

      {id && !selected && (
        <Modal title="Задача не найдена" size="sm" onClose={() => navigate('/tasks')} footer={<Button variant="primary" onClick={() => navigate('/tasks')}>К списку задач</Button>}>
          <p className="confirm-text">Возможно, задачу удалили.</p>
        </Modal>
      )}
      {selected && !editing && <TaskDetails task={selected} onClose={() => navigate('/tasks')} onEdit={() => setEditing(true)} />}
      {selected && editing && <TaskForm task={selected} onClose={() => setEditing(false)} />}
      {creating && <TaskForm onClose={() => setCreating(false)} />}
    </>
  );
}
