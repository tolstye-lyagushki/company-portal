import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { CircleAlert, CircleCheck, Info, X } from 'lucide-react';
import { avatarColor, initials, type Tone } from '../lib/utils';

/* ---------- Кнопки ---------- */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'secondary',
  size,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' }) {
  return (
    <button
      type="button"
      {...rest}
      className={`btn btn-${variant}${size === 'sm' ? ' btn-sm' : ''} ${className}`}
    />
  );
}

export function IconButton({
  label,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button type="button" aria-label={label} title={label} {...rest} className={`icon-btn ${className}`} />;
}

/* ---------- Мелкие элементы ---------- */

export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge tone-${tone}`}>{children}</span>;
}

export function Avatar({ name, id, size }: { name: string; id: string; size?: 'sm' | 'lg' | 'xl' }) {
  return (
    <span className={`avatar${size ? ` avatar-${size}` : ''}`} style={{ background: avatarColor(id) }} aria-hidden="true">
      {initials(name)}
    </span>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
  className = '',
}: {
  label: string;
  error?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon?: ReactNode;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      {icon && <div className="empty-icon">{icon}</div>}
      <div className="empty-title">{title}</div>
      {text && <div className="empty-text">{text}</div>}
      {action && <div className="empty-action">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; title?: string }[];
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          title={o.title}
          className={`seg-btn${o.value === value ? ' active' : ''}`}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------- Модальное окно ---------- */

const modalStack: string[] = [];

export function Modal({
  title,
  onClose,
  children,
  footer,
  size = 'md',
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
}) {
  const id = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    modalStack.push(id);
    document.body.classList.add('no-scroll');
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack[modalStack.length - 1] === id) closeRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      modalStack.splice(modalStack.indexOf(id), 1);
      if (modalStack.length === 0) document.body.classList.remove('no-scroll');
    };
  }, [id]);

  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <h2 className="modal-title">{title}</h2>
          <IconButton label="Закрыть" onClick={onClose}>
            <X size={18} />
          </IconButton>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/* ---------- Уведомления и подтверждения ---------- */

type ToastTone = 'success' | 'error' | 'info';
interface Toast {
  id: number;
  text: string;
  tone: ToastTone;
}
interface ConfirmOptions {
  title: string;
  text?: string;
  confirmLabel?: string;
  danger?: boolean;
}
interface Ui {
  toast: (text: string, tone?: ToastTone) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const UiContext = createContext<Ui | null>(null);

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi вызван вне UiProvider');
  return ctx;
}

const TOAST_ICON = { success: CircleCheck, error: CircleAlert, info: Info };

export function UiProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const toast = useCallback(
    (text: string, tone: ToastTone = 'success') => {
      const id = nextId.current++;
      setToasts((list) => [...list.slice(-3), { id, text, tone }]);
      window.setTimeout(() => dismiss(id), tone === 'error' ? 7000 : 3500);
    },
    [dismiss],
  );

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...options, resolve })),
    [],
  );

  const answer = (ok: boolean) => {
    dialog?.resolve(ok);
    setDialog(null);
  };

  const value = useMemo(() => ({ toast, confirm }), [toast, confirm]);

  return (
    <UiContext.Provider value={value}>
      {children}
      {dialog && (
        <Modal
          title={dialog.title}
          size="sm"
          onClose={() => answer(false)}
          footer={
            <>
              <Button onClick={() => answer(false)}>Отмена</Button>
              <Button variant={dialog.danger ? 'danger' : 'primary'} onClick={() => answer(true)} autoFocus>
                {dialog.confirmLabel ?? 'Подтвердить'}
              </Button>
            </>
          }
        >
          {dialog.text && <p className="confirm-text">{dialog.text}</p>}
        </Modal>
      )}
      {createPortal(
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => {
            const Icon = TOAST_ICON[t.tone];
            return (
              <div key={t.id} className={`toast toast-${t.tone}`}>
                <Icon size={18} />
                <span>{t.text}</span>
                <button type="button" className="toast-close" aria-label="Скрыть" onClick={() => dismiss(t.id)}>
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body,
      )}
    </UiContext.Provider>
  );
}
