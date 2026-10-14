import { useState } from 'react';
import type { Permission, PermissionOverrides } from '../types';
import { useStore } from '../store';
import { PERMISSION_GROUPS } from '../lib/permissions';
import { Badge, Button, Modal } from './ui';

type Choice = 'inherit' | 'allow' | 'deny';
const toChoice = (value: boolean | undefined): Choice => (value === true ? 'allow' : value === false ? 'deny' : 'inherit');

/**
 * Настройка прав поверх роли (для сотрудника) или поверх роли сотрудника (для должности).
 * base — права «по умолчанию» для сотрудника; для должности не задаётся.
 */
export function AccessEditor({
  title,
  description,
  base,
  overrides,
  onSave,
  onClose,
}: {
  title: string;
  description: string;
  base?: Set<Permission>;
  overrides: PermissionOverrides;
  onSave: (next: PermissionOverrides) => boolean;
  onClose: () => void;
}) {
  const { access } = useStore();
  const [draft, setDraft] = useState<PermissionOverrides>({ ...overrides });

  const change = (key: Permission, choice: Choice) =>
    setDraft((d) => {
      const next = { ...d };
      if (choice === 'inherit') delete next[key];
      else next[key] = choice === 'allow';
      return next;
    });

  const changed = Object.keys(draft).length;

  return (
    <Modal
      title={title}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button onClick={() => setDraft({})} disabled={changed === 0}>
            Сбросить настройки
          </Button>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={() => onSave(draft) && onClose()}>
            Сохранить права
          </Button>
        </>
      }
    >
      <p className="confirm-text">{description}</p>
      {PERMISSION_GROUPS.map((group) => (
        <section key={group.title} className="perm-group">
          <h3 className="section-title">{group.title}</h3>
          <div className="perm-rows">
            {group.items.map((item) => {
              const choice = toChoice(draft[item.key]);
              const effective = draft[item.key] ?? base?.has(item.key);
              // выдать право, которого нет у самого себя, нельзя (кроме администратора)
              const allowLocked = !access.canGrant(item.key) && overrides[item.key] !== true;
              return (
                <div key={item.key} className="perm-row">
                  <div className="perm-text">
                    <div className="perm-label">{item.label}</div>
                    {item.hint && <div className="muted small">{item.hint}</div>}
                  </div>
                  <select
                    className="select select-sm"
                    aria-label={item.label}
                    value={choice}
                    onChange={(e) => change(item.key, e.target.value as Choice)}
                  >
                    <option value="inherit">
                      {base ? `По умолчанию (${base.has(item.key) ? 'да' : 'нет'})` : 'Не задано'}
                    </option>
                    <option value="allow" disabled={allowLocked}>
                      Разрешить{allowLocked ? ' — нет у вас' : ''}
                    </option>
                    <option value="deny">Запретить</option>
                  </select>
                  {base && (
                    <span className="perm-result">
                      {effective ? <Badge tone="green">Да</Badge> : <Badge tone="gray">Нет</Badge>}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </Modal>
  );
}
