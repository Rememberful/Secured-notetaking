import React, { useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Strike from '@tiptap/extension-strike';
import Link from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

function normalizeContent(raw) {
  if (!raw) return '';
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && parsed.type) return parsed;
  } catch {}
  const lines = String(raw).split('\n');
  return {
    type: 'doc',
    content: lines.map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    })),
  };
}

function ToolbarBtn({ onClick, active, title, disabled, children }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`toolbar-btn${active ? ' toolbar-btn-active' : ''}`}
      title={title}
      disabled={disabled}
      aria-label={title}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="toolbar-divider" aria-hidden="true" />;
}

function LinkInput({ editor, onClose }) {
  const existing = editor.getAttributes('link').href || '';
  const [url, setUrl] = useState(existing);

  function apply(e) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
    } else {
      const href = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
      editor.chain().focus().extendMarkRange('link').setLink({ href, target: '_blank' }).run();
    }
    onClose();
  }

  function remove() {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    onClose();
  }

  return (
    <form className="link-input-row" onSubmit={apply}>
      <input
        type="url"
        autoFocus
        placeholder="https://example.com"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        className="link-input-field"
      />
      <button type="submit" className="link-input-btn">Apply</button>
      {existing && (
        <button type="button" className="link-input-btn link-input-btn-remove" onClick={remove}>
          Remove
        </button>
      )}
      <button type="button" className="link-input-btn link-input-btn-cancel" onClick={onClose}>
        Cancel
      </button>
    </form>
  );
}

export default function RichEditor({ content, onChange, placeholder = 'Write something…', readOnly = false }) {
  const [showLinkInput, setShowLinkInput] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        strike: false,
        heading: { levels: [1, 2] },
        codeBlock: { exitOnArrowDown: true },
      }),
      Underline,
      Strike,
      Link.configure({
        openOnClick: readOnly,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Placeholder.configure({ placeholder }),
    ],
    content: normalizeContent(content),
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(JSON.stringify(editor.getJSON()));
    },
  });

  const toggleLink = useCallback(() => {
    if (editor?.isActive('link') || !editor?.state.selection.empty) {
      setShowLinkInput(true);
    }
  }, [editor]);

  if (!editor) return null;

  if (readOnly) {
    return (
      <div className="rich-editor rich-editor-readonly">
        <EditorContent editor={editor} />
      </div>
    );
  }

  return (
    <div className="rich-editor">
      <div className="toolbar" role="toolbar" aria-label="Text formatting">
        <ToolbarBtn onClick={() => editor.chain().focus().undo().run()} title="Undo (Ctrl+Z)" disabled={!editor.can().undo()}>↩</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().redo().run()} title="Redo (Ctrl+Y)" disabled={!editor.can().redo()}>↪</ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Heading 1">H1</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Heading 2">H2</ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold (Ctrl+B)"><b>B</b></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic (Ctrl+I)"><i>I</i></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline (Ctrl+U)"><u>U</u></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">`</ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">• ≡</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1. ≡</ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">" "</ToolbarBtn>
        <ToolbarBtn onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{`< >`}</ToolbarBtn>
        <Divider />
        <ToolbarBtn onClick={toggleLink} active={editor.isActive('link')} title="Insert link">🔗</ToolbarBtn>
      </div>

      {showLinkInput && (
        <LinkInput editor={editor} onClose={() => setShowLinkInput(false)} />
      )}

      <EditorContent editor={editor} className="editor-content" />
    </div>
  );
}