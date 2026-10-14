import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { EmptyState } from './ui';

export function AccessDenied({ section, text }: { section?: string; text?: string }) {
  return (
    <div className="card">
      <EmptyState
        icon={<ShieldX size={22} />}
        title={section ? `Нет доступа к разделу «${section}»` : 'Нет доступа'}
        text={
          text ??
          'У вашей учётной записи нет нужного права. Если доступ нужен для работы, обратитесь к администратору портала. ' +
            'Для показа можно войти под другим сотрудником в меню пользователя.'
        }
        action={<Link to="/" className="btn btn-secondary">На главную</Link>}
      />
    </div>
  );
}

/** Закрывает раздел, если права нет: и при переходе из меню, и при открытии прямой ссылки. */
export function RequireAccess({ allowed, section, children }: { allowed: boolean; section: string; children: ReactNode }) {
  return allowed ? <>{children}</> : <AccessDenied section={section} />;
}
