import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { History, Inbox, MessageSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import type { RequestStatus, WorkRequest } from '../types';
import { useStore, type RequestInput } from '../store';
import { REQUEST_STATUS, REQUEST_STATUS_ORDER, formatDateTime, matches } from '../lib/utils';
import { Avatar, Badge, Button, EmptyState, Field, Modal, Segmented, useUi } from '../components/ui';
import { Comments } from '../components/Comments';

const TRANSITIONS: Record<RequestStatus, { to: RequestStatus; label: string; variant?: 'primary' | 'danger' }[]> = {
  new: [
    { to: 'reviewing', label: 'Взять в рассмотрение', variant: 'primary' },
    { to: 'rejected', label: 'Отклонить', variant: 'danger' },
  ],
  reviewing: [
    { to: 'approved', label: 'Одобрить', variant: 'primary' },
    { to: 'rejected', label: 'Отклонить', variant: 'danger' },
  ],
  approved: [
    { to: 'done', label: 'Отметить выполненной', variant: 'primary' },
    { to: 'reviewing', label: 'Вернуть на рассмотрение' },
  ],
  rejected: [{ to: 'reviewing', label: 'Вернуть на рассмотрение' }],
  done: [{ to: 'reviewing', label: 'Вернуть на рассмотрение' }],
};

function RequestForm({ request, onClose }: { request?: WorkRequest; onClose: () => void }) {
  const { state, actions } = useStore();
  const { toast } = useUi();
  const navigate = useNavigate();
  const [form, setForm] = useState<RequestInput>({
    title: request?.title ?? '',
    description: request?.description ?? '',
    category: request?.category ?? state.requestCategories[0] ?? '',
  });
  const [error, setError] = useState('');

  const save = () => {
    if (!form.title.trim()) return setError('Укажите тему заявки');
    if (!form.description.trim()) return setError('Опишите, что требуется');
    const id = actions.saveRequest({ ...form, title: form.title.trim(), description: form.description.trim() }, request?.id);
    if (!id) return;
    toast(request ? 'Заявка сохранена' : 'Заявка отправлена на рассмотрение');
    onClose();
    if (!request) navigate(`/requests/${id}`);
  };

  return (
    <Modal
      title={request ? 'Редактирование заявки' : 'Новая заявка'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={save}>
            {request ? 'Сохранить' : 'Отправить заявку'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Категория" className="span-2">
          <select className="select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {state.requestCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </Field>
        <Field label="Тема" className="span-2">
          <input
            className="input"
            autoFocus
            maxLength={160}
            value={form.title}
            placeholder="Коротко: о чём заявка"
            onChange={(e) => {
              setForm({ ...form, title: e.target.value });
              setError('');
            }}
          />
        </Field>
        <Field label="Описание" className="span-2">
          <textarea
            className="textarea"
            rows={5}
            value={form.description}
            placeholder="Что нужно, к какому сроку и почему"
            onChange={(e) => {
              setForm({ ...form, description: e.target.value });
              setError('');
            }}
          />
        </Field>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}

function RequestDetails({ request, onClose, onEdit }: { request: WorkRequest; onClose: () => void; onEdit: () => void }) {
  const { actions, access, emp, empName } = useStore();
  const { confirm, toast } = useUi();
  const [tab, setTab] = useState<'comments' | 'history'>('comments');
  const author = emp(request.authorId);

  const remove = async () => {
    const ok = await confirm({
      title: 'Удалить заявку?',
      text: `Заявка «${request.title}» будет удалена вместе с комментариями и историей.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    if (!actions.deleteRequest(request.id)) return;
    toast('Заявка удалена');
    onClose();
  };

  const canEdit = access.canEditRequest(request);
  const canDelete = access.canDeleteRequest(request);

  return (
    <Modal
      title={request.title}
      size="lg"
      onClose={onClose}
      footer={
        canEdit || canDelete ? (
          <>
            {canDelete && (
              <Button variant="danger" onClick={remove}>
                <Trash2 size={16} /> Удалить
              </Button>
            )}
            {canEdit && (
              <Button onClick={onEdit}>
                <Pencil size={16} /> Редактировать
              </Button>
            )}
          </>
        ) : undefined
      }
    >
      <div className="kv">
        <div>
          <div className="kv-label">Статус</div>
          <Badge tone={REQUEST_STATUS[request.status].tone}>{REQUEST_STATUS[request.status].label}</Badge>
        </div>
        <div>
          <div className="kv-label">Категория</div>
          {request.category}
        </div>
        <div>
          <div className="kv-label">Автор</div>
          {author ? (
            <Link to={`/people/${author.id}`} className="person-inline link">
              <Avatar name={author.name} id={author.id} size="sm" /> {author.name}
            </Link>
          ) : (
            empName(request.authorId)
          )}
        </div>
        <div>
          <div className="kv-label">Создана</div>
          {formatDateTime(request.createdAt)}
        </div>
      </div>

      {access.has('requests.decide') && (
        <div className="decision">
          <span className="kv-label">Решение руководителя</span>
          <div className="actions">
            {TRANSITIONS[request.status].map((t) => (
              <Button
                key={t.to}
                variant={t.variant ?? 'secondary'}
                size="sm"
                onClick={() => {
                  if (actions.setRequestStatus(request.id, t.to)) toast(`Статус заявки: ${REQUEST_STATUS[t.to].label.toLowerCase()}`);
                }}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      )}

      <h3 className="section-title">Описание</h3>
      <p className="pre-wrap">{request.description}</p>

      <div className="tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'comments'} className={`tab${tab === 'comments' ? ' active' : ''}`} onClick={() => setTab('comments')}>
          <MessageSquare size={15} /> Комментарии · {request.comments.length}
        </button>
        <button type="button" role="tab" aria-selected={tab === 'history'} className={`tab${tab === 'history' ? ' active' : ''}`} onClick={() => setTab('history')}>
          <History size={15} /> История · {request.history.length}
        </button>
      </div>

      {tab === 'comments' ? (
        <Comments items={request.comments} onAdd={(text) => actions.addRequestComment(request.id, text)} />
      ) : (
        <ol className="timeline">
          {[...request.history].reverse().map((h) => (
            <li key={h.id}>
              <div>{h.text}</div>
              <div className="muted small">
                {empName(h.authorId)} · {formatDateTime(h.at)}
              </div>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

export default function Requests() {
  const { id } = useParams();
  const { state, me, access, empName } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const lead = access.has('requests.viewAll');

  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | RequestStatus>('all');
  const [category, setCategory] = useState('all');
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (params.get('new')) {
      setCreating(true);
      setParams({}, { replace: true });
    }
  }, [params, setParams]);

  const visible = useMemo(
    () => (lead && scope === 'all' ? state.requests : state.requests.filter((r) => r.authorId === me.id)),
    [state.requests, lead, scope, me.id],
  );

  const requests = useMemo(
    () =>
      visible
        .filter((r) => status === 'all' || r.status === status)
        .filter((r) => category === 'all' || r.category === category)
        .filter((r) => matches(query, r.title, r.description, empName(r.authorId)))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
    [visible, status, category, query, empName],
  );

  const found = id ? state.requests.find((r) => r.id === id) : undefined;
  const selected = found && access.canViewRequest(found) ? found : undefined;
  const filtered = status !== 'all' || category !== 'all' || query.trim() !== '';

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">Заявки</h1>
          <p className="page-sub">
            {lead ? 'Обращения сотрудников: отпуска, оборудование, доступы, документы' : 'Ваши обращения к руководителю и службам компании'}
          </p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)}>
          <Plus size={16} /> Новая заявка
        </Button>
      </div>

      <div className="toolbar">
        <div className="search toolbar-grow">
          <Search size={16} className="search-icon" />
          <input className="input search-input" type="search" placeholder="Поиск по заявкам" aria-label="Поиск по заявкам" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <select className="select" aria-label="Статус" value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
          <option value="all">Все статусы</option>
          {REQUEST_STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{REQUEST_STATUS[s].label}</option>
          ))}
        </select>
        <select className="select" aria-label="Категория" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">Все категории</option>
          {state.requestCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {lead && (
          <Segmented
            label="Чьи заявки"
            value={scope}
            onChange={setScope}
            options={[
              { value: 'all', label: 'Все' },
              { value: 'mine', label: 'Мои' },
            ]}
          />
        )}
      </div>

      {requests.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Inbox size={22} />}
            title={filtered ? 'Заявки не найдены' : 'Заявок пока нет'}
            text={filtered ? 'Измените условия поиска или фильтры.' : 'Создайте заявку — руководитель увидит её в этом разделе.'}
            action={
              filtered ? (
                <Button
                  onClick={() => {
                    setQuery('');
                    setStatus('all');
                    setCategory('all');
                  }}
                >
                  Сбросить фильтры
                </Button>
              ) : (
                <Button variant="primary" onClick={() => setCreating(true)}>Новая заявка</Button>
              )
            }
          />
        </div>
      ) : (
        <div className="card rows rows-requests">
          <div className="row row-head">
            <span>Заявка</span>
            <span>Автор</span>
            <span>Категория</span>
            <span>Обновлена</span>
            <span>Статус</span>
          </div>
          {requests.map((r) => (
            <Link key={r.id} to={`/requests/${r.id}`} className="row">
              <span className="row-title">{r.title}</span>
              <span className="person-inline">
                <Avatar name={empName(r.authorId)} id={r.authorId} size="sm" />
                {empName(r.authorId)}
              </span>
              <span className="muted">{r.category}</span>
              <span className="muted">{formatDateTime(r.updatedAt)}</span>
              <span><Badge tone={REQUEST_STATUS[r.status].tone}>{REQUEST_STATUS[r.status].label}</Badge></span>
            </Link>
          ))}
        </div>
      )}

      {id && !selected && (
        <Modal
          title={found ? 'Заявка недоступна' : 'Заявка не найдена'}
          size="sm"
          onClose={() => navigate('/requests')}
          footer={<Button variant="primary" onClick={() => navigate('/requests')}>К списку заявок</Button>}
        >
          <p className="confirm-text">
            {found ? 'Чужие заявки видят только сотрудники с правом «Просмотр всех заявок».' : 'Возможно, заявку удалили.'}
          </p>
        </Modal>
      )}
      {selected && !editing && <RequestDetails request={selected} onClose={() => navigate('/requests')} onEdit={() => setEditing(true)} />}
      {selected && editing && <RequestForm request={selected} onClose={() => setEditing(false)} />}
      {creating && <RequestForm onClose={() => setCreating(false)} />}
    </>
  );
}
