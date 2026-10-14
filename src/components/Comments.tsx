import { useState } from 'react';
import { Send } from 'lucide-react';
import type { Comment } from '../types';
import { useStore } from '../store';
import { formatDateTime } from '../lib/utils';
import { Avatar, Button } from './ui';

export function Comments({ items, onAdd }: { items: Comment[]; onAdd: (text: string) => void }) {
  const { empName } = useStore();
  const [text, setText] = useState('');

  const submit = () => {
    const value = text.trim();
    if (!value) return;
    onAdd(value);
    setText('');
  };

  return (
    <div className="comments">
      {items.length === 0 && <p className="muted small">Комментариев пока нет.</p>}
      {items.map((c) => (
        <div key={c.id} className="comment">
          <Avatar name={empName(c.authorId)} id={c.authorId} size="sm" />
          <div className="comment-body">
            <div className="comment-meta">
              <strong>{empName(c.authorId)}</strong>
              <span className="muted small">{formatDateTime(c.createdAt)}</span>
            </div>
            <div className="comment-text">{c.text}</div>
          </div>
        </div>
      ))}
      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <textarea
          className="textarea"
          rows={2}
          placeholder="Написать комментарий…"
          aria-label="Комментарий"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) submit();
          }}
        />
        <Button type="submit" variant="primary" disabled={!text.trim()}>
          <Send size={16} /> Отправить
        </Button>
      </form>
    </div>
  );
}
