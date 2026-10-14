import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { ArrowLeft, BookOpen, EyeOff, Pencil, Plus, Search, Send, Trash2 } from 'lucide-react';
import type { ArticleStatus } from '../types';
import { useStore } from '../store';
import { excerpt, formatDate, formatDateTime, matches, stripHtml } from '../lib/utils';
import { Avatar, Badge, Button, EmptyState, Field, useUi } from '../components/ui';
import { AccessDenied } from '../components/AccessDenied';

// Редактор тяжёлый — грузим его только при открытии формы статьи
const RichEditor = lazy(() => import('../components/RichEditor').then((m) => ({ default: m.RichEditor })));

const NO_CATEGORY = 'none';

export function KnowledgeList() {
  const { state, access, empName } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'updated' | 'title'>('updated');

  // черновики видят только автор и те, у кого есть право публикации
  const visible = useMemo(() => state.articles.filter(access.canViewArticle), [state.articles, access]);
  const categoryName = (id: string | null) => state.categories.find((c) => c.id === id)?.name ?? 'Без категории';
  const uncategorized = visible.filter((a) => !state.categories.some((c) => c.id === a.categoryId)).length;

  const articles = useMemo(() => {
    const known = new Set(state.categories.map((c) => c.id));
    return visible
      .filter((a) => {
        if (category === 'all') return true;
        if (category === NO_CATEGORY) return !a.categoryId || !known.has(a.categoryId);
        return a.categoryId === category;
      })
      .filter((a) => matches(query, a.title, stripHtml(a.content)))
      .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title, 'ru') : b.updatedAt.localeCompare(a.updatedAt)));
  }, [visible, state.categories, category, query, sort]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">База знаний</h1>
          <p className="page-sub">Инструкции, регламенты и ответы на частые вопросы</p>
        </div>
        {access.has('kb.create') && (
          <Link to="/kb/new" className="btn btn-primary">
            <Plus size={16} /> Новая статья
          </Link>
        )}
      </div>

      <div className="toolbar">
        <div className="search toolbar-grow">
          <Search size={16} className="search-icon" />
          <input
            className="input search-input"
            type="search"
            placeholder="Поиск по заголовкам и тексту статей"
            aria-label="Поиск по статьям"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select className="select" aria-label="Сортировка" value={sort} onChange={(e) => setSort(e.target.value as 'updated' | 'title')}>
          <option value="updated">Сначала обновлённые</option>
          <option value="title">По названию</option>
        </select>
      </div>

      <div className="chips" role="group" aria-label="Категории">
        <button type="button" className={`chip${category === 'all' ? ' active' : ''}`} onClick={() => setCategory('all')}>
          Все <span className="chip-count">{visible.length}</span>
        </button>
        {state.categories.map((c) => (
          <button key={c.id} type="button" className={`chip${category === c.id ? ' active' : ''}`} onClick={() => setCategory(c.id)}>
            {c.name} <span className="chip-count">{visible.filter((a) => a.categoryId === c.id).length}</span>
          </button>
        ))}
        {uncategorized > 0 && (
          <button type="button" className={`chip${category === NO_CATEGORY ? ' active' : ''}`} onClick={() => setCategory(NO_CATEGORY)}>
            Без категории <span className="chip-count">{uncategorized}</span>
          </button>
        )}
      </div>

      {articles.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<BookOpen size={22} />}
            title="Статьи не найдены"
            text="Измените запрос или выберите другую категорию."
            action={
              <Button
                onClick={() => {
                  setQuery('');
                  setCategory('all');
                }}
              >
                Сбросить фильтры
              </Button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-3">
          {articles.map((a) => (
            <Link key={a.id} to={`/kb/${a.id}`} className="card card-link article-card">
              <span className="badges">
                <Badge tone="blue">{categoryName(a.categoryId)}</Badge>
                {a.status === 'draft' && <Badge tone="amber">Черновик</Badge>}
              </span>
              <h2 className="article-card-title">{a.title}</h2>
              <p className="muted article-card-text">{excerpt(a.content)}</p>
              <div className="article-card-foot">
                <Avatar name={empName(a.authorId)} id={a.authorId} size="sm" />
                <span className="small">{empName(a.authorId)}</span>
                <span className="muted small article-card-date">{formatDateTime(a.updatedAt)}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export function ArticleView() {
  const { id } = useParams();
  const { state, access, actions, empName, emp } = useStore();
  const { confirm, toast } = useUi();
  const navigate = useNavigate();
  const article = state.articles.find((a) => a.id === id);
  const html = useMemo(() => (article ? DOMPurify.sanitize(article.content) : ''), [article]);

  if (article && !access.canViewArticle(article)) {
    return <AccessDenied text="Статья ещё не опубликована. Черновики видят автор и редакторы базы знаний." />;
  }
  if (!article) {
    return (
      <div className="card">
        <EmptyState
          icon={<BookOpen size={22} />}
          title="Статья не найдена"
          text="Возможно, её удалили."
          action={<Link to="/kb" className="btn btn-secondary">К базе знаний</Link>}
        />
      </div>
    );
  }

  const author = emp(article.authorId);
  const category = state.categories.find((c) => c.id === article.categoryId)?.name ?? 'Без категории';

  const remove = async () => {
    const ok = await confirm({
      title: 'Удалить статью?',
      text: `Статья «${article.title}» будет удалена без возможности восстановления.`,
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;
    if (!actions.deleteArticle(article.id)) return;
    toast('Статья удалена');
    navigate('/kb');
  };

  const togglePublish = () => {
    const next: ArticleStatus = article.status === 'published' ? 'draft' : 'published';
    if (actions.setArticleStatus(article.id, next)) {
      toast(next === 'published' ? 'Статья опубликована' : 'Статья снята с публикации');
    }
  };

  const canEdit = access.canEditArticle(article);
  const canDelete = access.canDeleteArticle(article);
  const canPublish = access.has('kb.publish');

  return (
    <article className="article">
      <div className="article-top">
        <Link to="/kb" className="back-link">
          <ArrowLeft size={16} /> База знаний
        </Link>
        {(canEdit || canDelete || canPublish) && (
          <div className="actions">
            {canPublish && (
              <Button onClick={togglePublish}>
                {article.status === 'published' ? <><EyeOff size={16} /> Снять с публикации</> : <><Send size={16} /> Опубликовать</>}
              </Button>
            )}
            {canEdit && (
              <Link to={`/kb/${article.id}/edit`} className="btn btn-secondary">
                <Pencil size={16} /> Редактировать
              </Link>
            )}
            {canDelete && (
              <Button variant="danger" onClick={remove}>
                <Trash2 size={16} /> Удалить
              </Button>
            )}
          </div>
        )}
      </div>
      <div className="card article-body">
        <span className="badges">
          <Badge tone="blue">{category}</Badge>
          {article.status === 'draft' && <Badge tone="amber">Черновик — видят только автор и редакторы</Badge>}
        </span>
        <h1 className="article-title">{article.title}</h1>
        <div className="article-meta">
          <Avatar name={empName(article.authorId)} id={article.authorId} />
          <div>
            {author ? (
              <Link to={`/people/${author.id}`} className="link">{author.name}</Link>
            ) : (
              <span>{empName(article.authorId)}</span>
            )}
            <div className="muted small">
              Обновлена {formatDateTime(article.updatedAt)} · создана {formatDate(article.createdAt)}
            </div>
          </div>
        </div>
        <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </article>
  );
}

export function ArticleEdit() {
  const { id } = useParams();
  const { state, access, actions } = useStore();
  const { toast } = useUi();
  const navigate = useNavigate();
  const existing = id ? state.articles.find((a) => a.id === id) : undefined;
  const canPublish = access.has('kb.publish');

  const [title, setTitle] = useState(existing?.title ?? '');
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? state.categories[0]?.id ?? '');
  const [content, setContent] = useState(existing?.content ?? '');
  const [error, setError] = useState('');

  if (id && !existing) {
    return (
      <div className="card">
        <EmptyState title="Статья не найдена" action={<Link to="/kb" className="btn btn-secondary">К базе знаний</Link>} />
      </div>
    );
  }
  if (existing ? !access.canEditArticle(existing) : !access.has('kb.create')) {
    return (
      <AccessDenied
        text={
          existing
            ? 'Редактировать статью могут её автор (при праве создания статей) и редакторы базы знаний.'
            : 'Создавать статьи могут сотрудники с правом «Создание статей». Обратитесь к администратору.'
        }
      />
    );
  }

  const back = existing ? `/kb/${existing.id}` : '/kb';

  const save = (status: ArticleStatus) => {
    if (!title.trim()) return setError('Укажите заголовок статьи');
    if (!stripHtml(content) && !content.includes('<img')) return setError('Добавьте текст статьи');
    const savedId = actions.saveArticle({ title: title.trim(), categoryId: categoryId || null, content, status }, existing?.id);
    if (!savedId) return;
    const saved = canPublish ? status : (existing?.status ?? 'draft');
    toast(saved === 'published' ? 'Статья сохранена и опубликована' : 'Черновик сохранён');
    navigate(`/kb/${savedId}`);
  };

  return (
    <div className="article">
      <div className="article-top">
        <Link to={back} className="back-link">
          <ArrowLeft size={16} /> {existing ? 'К статье' : 'База знаний'}
        </Link>
      </div>
      <div className="card article-body">
        <h1 className="page-title">{existing ? 'Редактирование статьи' : 'Новая статья'}</h1>
        <div className="form-grid">
          <Field label="Заголовок" className="span-2">
            <input
              className="input"
              value={title}
              autoFocus={!existing}
              maxLength={160}
              placeholder="Например: Как оформить командировку"
              onChange={(e) => {
                setTitle(e.target.value);
                setError('');
              }}
            />
          </Field>
          <Field label="Категория">
            <select className="select" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="">Без категории</option>
            </select>
          </Field>
        </div>
        <div className="field">
          <span className="field-label">Текст статьи</span>
          <Suspense fallback={<div className="editor editor-loading" />}>
            <RichEditor
              value={content}
              onChange={(html) => {
                setContent(html);
                setError('');
              }}
            />
          </Suspense>
          <span className="field-hint">
            Изображения уменьшаются и сохраняются в браузере вместе со статьёй, поэтому не добавляйте их слишком много.
          </span>
        </div>
        {!canPublish && (
          <p className="field-hint">
            {existing?.status === 'published'
              ? 'Статья останется опубликованной. Снять её с публикации может редактор базы знаний.'
              : 'Статья сохранится черновиком. Опубликовать её может редактор базы знаний.'}
          </p>
        )}
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <Button onClick={() => navigate(back)}>Отмена</Button>
          {canPublish ? (
            <>
              <Button onClick={() => save('draft')}>Сохранить черновик</Button>
              <Button variant="primary" onClick={() => save('published')}>
                Опубликовать
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => save(existing?.status ?? 'draft')}>
              {existing ? 'Сохранить' : 'Сохранить черновик'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
