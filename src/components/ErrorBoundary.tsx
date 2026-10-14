import { Component, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { EmptyState } from './ui';

/**
 * Не даёт ошибке на одной странице погасить весь портал: меню и шапка остаются,
 * а вместо страницы показывается сообщение. Сбрасывается при переходе на другой адрес (через key).
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Ошибка на странице портала:', error);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="card">
        <EmptyState
          icon={<CircleAlert size={22} />}
          title="Не удалось показать страницу"
          text="Возможно, в сохранённых данных браузера что-то повреждено. Откройте другой раздел или сбросьте демо-данные в меню пользователя."
          action={<a href="#/" className="btn btn-primary">На главную</a>}
        />
      </div>
    );
  }
}
