import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

export default function NotFound() {
  return (
    <div className="card">
      <EmptyState
        title="Страница не найдена"
        text="Проверьте адрес или вернитесь на главную."
        action={<Link to="/" className="btn btn-primary">На главную</Link>}
      />
    </div>
  );
}
