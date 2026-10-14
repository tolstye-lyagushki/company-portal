import { useRef, type ReactNode } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Quote,
  Redo2,
  Strikethrough,
  Underline,
  Undo2,
} from 'lucide-react';
import { useUi } from './ui';

const MAX_FILE_BYTES = 10 * 1024 * 1024;
const MAX_SIDE = 1280;

/** Уменьшает изображение и возвращает data URL: картинки хранятся в браузере, место ограничено. */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) return reject(new Error('canvas'));
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image'));
    };
    img.src = url;
  });
}

function ToolButton({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`tool-btn${active ? ' active' : ''}`}
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export function RichEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const { toast } = useUi();
  const fileRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }),
      Image.configure({ allowBase64: true }),
    ],
    content: value,
    shouldRerenderOnTransaction: true,
    editorProps: { attributes: { class: 'prose editor-content', 'aria-label': 'Текст статьи' } },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) return <div className="editor editor-loading" />;

  const chain = () => editor.chain().focus();

  const setLink = () => {
    const previous = (editor.getAttributes('link').href as string | undefined) ?? '';
    const url = window.prompt('Адрес ссылки (оставьте пустым, чтобы убрать ссылку)', previous || 'https://');
    if (url === null) return;
    const trimmed = url.trim();
    if (!trimmed || trimmed === 'https://') {
      chain().extendMarkRange('link').unsetLink().run();
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(trimmed)) {
      toast('Ссылка должна начинаться с http://, https:// или mailto:', 'error');
      return;
    }
    chain().extendMarkRange('link').setLink({ href: trimmed }).run();
  };

  const addImage = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast('Выберите файл изображения', 'error');
    if (file.size > MAX_FILE_BYTES) return toast('Изображение больше 10 МБ', 'error');
    try {
      const src = await fileToDataUrl(file);
      chain().setImage({ src, alt: file.name }).run();
    } catch {
      toast('Не удалось прочитать изображение', 'error');
    }
  };

  return (
    <div className="editor">
      <div className="editor-toolbar" role="toolbar" aria-label="Форматирование">
        <ToolButton label="Жирный" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}>
          <Bold size={16} />
        </ToolButton>
        <ToolButton label="Курсив" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}>
          <Italic size={16} />
        </ToolButton>
        <ToolButton label="Подчёркнутый" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}>
          <Underline size={16} />
        </ToolButton>
        <ToolButton label="Зачёркнутый" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}>
          <Strikethrough size={16} />
        </ToolButton>
        <span className="tool-sep" />
        <ToolButton label="Заголовок" active={editor.isActive('heading', { level: 2 })} onClick={() => chain().toggleHeading({ level: 2 }).run()}>
          <Heading2 size={16} />
        </ToolButton>
        <ToolButton label="Подзаголовок" active={editor.isActive('heading', { level: 3 })} onClick={() => chain().toggleHeading({ level: 3 }).run()}>
          <Heading3 size={16} />
        </ToolButton>
        <span className="tool-sep" />
        <ToolButton label="Маркированный список" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}>
          <List size={16} />
        </ToolButton>
        <ToolButton label="Нумерованный список" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}>
          <ListOrdered size={16} />
        </ToolButton>
        <ToolButton label="Цитата" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}>
          <Quote size={16} />
        </ToolButton>
        <ToolButton label="Код" active={editor.isActive('codeBlock')} onClick={() => chain().toggleCodeBlock().run()}>
          <Code size={16} />
        </ToolButton>
        <span className="tool-sep" />
        <ToolButton label="Ссылка" active={editor.isActive('link')} onClick={setLink}>
          <LinkIcon size={16} />
        </ToolButton>
        <ToolButton label="Вставить изображение" onClick={() => fileRef.current?.click()}>
          <ImageIcon size={16} />
        </ToolButton>
        <span className="tool-sep" />
        <ToolButton label="Отменить" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}>
          <Undo2 size={16} />
        </ToolButton>
        <ToolButton label="Повторить" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}>
          <Redo2 size={16} />
        </ToolButton>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void addImage(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
