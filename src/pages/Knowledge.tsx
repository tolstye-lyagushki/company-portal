import { Suspense, lazy, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import DOMPurify from 'dompurify';
import { ArrowLeft, BookOpen, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useStore } from '../store';
import { excerpt, formatDate, formatDateTime, matches, stripHtml } from '../lib/utils';
import { Avatar, Badge, Button, EmptyState, Field, useUi } from '../components/ui';

// Редактор тяжёлый — грузим его только при открытии формы статьи
const RichEditor = lazy(() => import('../components/RichEditor').then((m) => ({ default: m.RichEditor })));

const NO_CATEGORY = 'none';

export function KnowledgeList() {
  const { state, empName } = useStore();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [sort, setSort] = useState<'updated' | 'title'>('updated');

  const categoryName = (id: string | null) => state.categories.find((c) => c.id === id)?.name ?? 'Без категории';
  const uncategorized = state.articles.filter((a) => !state.categories.some((c) => c.id === a.categoryId)).length;

  const articles = useMemo(() => {
    const known = new Set(state.categories.map((c) => c.id));
    return state.articles
      .filter((a) => {
        if (category === 'all') return true;
        if (category === NO_CATEGORY) return !a.categoryId || !known.has(a.categoryId);
        return a.categoryId === category;
      })
      .filter((a) => matches(query, a.title, stripHtml(a.content)))
      .sort((a, b) => (sort === 'title' ? a.title.localeCompare(b.title, 'ru') : b.updatedAt.localeCompare(a.updatedAt)));
  }, [state.articles, state.categories, category, query, sort]);

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">База знаний</h1>
          <p className="page-sub">Инструкции, регламенты и ответы на частые вопросы</p>
        </div>
        <Link to="/kb/new" className="btn btn-primary">
          <Plus size={16} /> Новая статья
        </Link>
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
          Все <span className="chip-count">{state.articles.length}</span>
        </button>
        {state.categories.map((c) => (
          <button key={c.id} type="button" className={`chip${category === c.id ? ' active' : ''}`} onClick={() => setCategory(c.id)}>
            {c.name} <span className="chip-count">{state.articles.filter((a) => a.categoryId === c.id).length}</span>
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
              <Badge tone="blue">{categoryName(a.categoryId)}</Badge>
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
  const { state, can, actions, empName, emp } = useStore();
  const { confirm, toast } = useUi();
  const navigate = useNavigate();
  const article = state.articles.find((a) => a.id === id);
  const html = useMemo(() => (article ? DOMPurify.sanitize(article.content) : ''), [article]);

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
    actions.deleteArticle(article.id);
    toast('Статья удалена');
    navigate('/kb');
  };

  return (
    <article className="article">
      <div className="article-top">
        <Link to="/kb" className="back-link">
          <ArrowLeft size={16} /> База знаний
        </Link>
        {can('article.edit', article) && (
          <div className="actions">
            <Link to={`/kb/${article.id}/edit`} className="btn btn-secondary">
              <Pencil size={16} /> Редактировать
            </Link>
            <Button variant="danger" onClick={remove}>
              <Trash2 size={16} /> Удалить
            </Button>
          </div>
        )}
      </div>
      <div className="card article-body">
        <Badge tone="blue">{category}</Badge>
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
  const { state, can, actions } = useStore();
  const { toast } = useUi();
  const navigate = useNavigate();
  const existing = id ? state.articles.find((a) => a.id === id) : undefined;

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
  if (existing && !can('article.edit', existing)) {
    return (
      <div className="card">
        <EmptyState
          title="Недостаточно прав"
          text="Редактировать статью может её автор, руководитель или администратор."
          action={<Link to={`/kb/${existing.id}`} className="btn btn-secondary">Вернуться к статье</Link>}
        />
      </div>
    );
  }

  const back = existing ? `/kb/${existing.id}` : '/kb';

  const save = () => {
    if (!title.trim()) return setError('Укажите заголовок статьи');
    if (!stripHtml(content) && !content.includes('<img')) return setError('Добавьте текст статьи');
    const savedId = actions.saveArticle({ title: title.trim(), categoryId: categoryId || null, content }, existing?.id);
    toast(existing ? 'Статья сохранена' : 'Статья опубликована');
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
        {error && <div className="form-error" role="alert">{error}</div>}
        <div className="form-actions">
          <Button onClick={() => navigate(back)}>Отмена</Button>
          <Button variant="primary" onClick={save}>
            {existing ? 'Сохранить' : 'Опубликовать'}
          </Button>
        </div>
      </div>
    </div>
  );
}
