import { useState } from 'react';
import type { Employee, Role } from '../types';
import { useStore, type EmployeeInput } from '../store';
import { ROLE, ROLE_ORDER } from '../lib/utils';
import { Button, Field, Modal, useUi } from './ui';

/**
 * Форма сотрудника. Набор полей зависит от прав: без права управления сотрудниками
 * доступны только свои контакты и «О себе», роль меняется только при праве назначения ролей.
 */
export function EmployeeForm({ employee, onClose }: { employee?: Employee; onClose: () => void }) {
  const { state, access, actions } = useStore();
  const { toast } = useUi();
  const restricted = !access.has('employees.manage');
  const canRole = employee ? access.canManageAccessOf(employee) : access.has('access.manage');
  const [form, setForm] = useState<EmployeeInput>({
    name: employee?.name ?? '',
    position: employee?.position ?? state.positions[0]?.name ?? '',
    department: employee?.department ?? '',
    role: employee?.role ?? 'employee',
    email: employee?.email ?? '',
    phone: employee?.phone ?? '',
    about: employee?.about ?? '',
  });
  const [error, setError] = useState('');
  const set = <K extends keyof EmployeeInput>(key: K, value: EmployeeInput[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };

  const departments = [...new Set(state.employees.map((e) => e.department))].sort((a, b) => a.localeCompare(b, 'ru'));
  const positions = [...state.positions].sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  const lastAdmin = employee?.role === 'admin' && state.employees.filter((e) => e.role === 'admin').length === 1;
  const roles = ROLE_ORDER.filter((r) => access.canAssignRole(r) || r === employee?.role);

  const save = () => {
    if (!restricted) {
      if (!form.name.trim()) return setError('Укажите имя и фамилию');
      if (!form.position.trim()) return setError('Выберите должность');
      if (!form.department.trim()) return setError('Укажите подразделение');
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) return setError('Проверьте адрес электронной почты');
      if (lastAdmin && form.role !== 'admin') return setError('В портале должен остаться хотя бы один администратор');
    }
    const id = actions.saveEmployee(
      {
        ...form,
        name: form.name.trim(),
        department: form.department.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        about: form.about.trim(),
      },
      employee?.id,
    );
    if (!id) return;
    toast(employee ? 'Данные сотрудника сохранены' : 'Сотрудник добавлен');
    onClose();
  };

  return (
    <Modal
      title={employee ? (restricted ? 'Мой профиль' : 'Данные сотрудника') : 'Новый сотрудник'}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Отмена</Button>
          <Button variant="primary" onClick={save}>
            {employee ? 'Сохранить' : 'Добавить'}
          </Button>
        </>
      }
    >
      <div className="form-grid">
        {!restricted && (
          <>
            <Field label="Имя и фамилия" className="span-2">
              <input className="input" autoFocus maxLength={80} value={form.name} placeholder="Например: Иван Петров" onChange={(e) => set('name', e.target.value)} />
            </Field>
            <Field label="Должность" hint="Список должностей — в админ-панели">
              <select className="select" value={form.position} onChange={(e) => set('position', e.target.value)}>
                {!positions.some((p) => p.name === form.position) && <option value={form.position}>{form.position || '—'}</option>}
                {positions.map((p) => (
                  <option key={p.id} value={p.name}>{p.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Подразделение">
              <input className="input" maxLength={60} list="departments" value={form.department} onChange={(e) => set('department', e.target.value)} />
              <datalist id="departments">
                {departments.map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </Field>
            {canRole ? (
              <Field label="Роль" hint="Роль задаёт права по умолчанию">
                <select className="select" value={form.role} onChange={(e) => set('role', e.target.value as Role)}>
                  {roles.map((r) => (
                    <option key={r} value={r}>{ROLE[r].label}</option>
                  ))}
                </select>
              </Field>
            ) : (
              <Field label="Роль" hint="Менять роль может сотрудник с правом «Назначение ролей и прав»">
                <input className="input" value={ROLE[form.role].label} disabled />
              </Field>
            )}
            <Field label="Электронная почта" hint="Только вымышленные адреса">
              <input className="input" type="email" maxLength={80} value={form.email} placeholder="name@example.com" onChange={(e) => set('email', e.target.value)} />
            </Field>
          </>
        )}
        <Field label="Телефон" hint="Демо: не указывайте настоящий номер">
          <input className="input" type="tel" maxLength={30} value={form.phone} autoFocus={restricted} onChange={(e) => set('phone', e.target.value)} />
        </Field>
        <Field label="О себе" className="span-2">
          <textarea className="textarea" rows={3} maxLength={400} value={form.about} onChange={(e) => set('about', e.target.value)} />
        </Field>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
    </Modal>
  );
}
