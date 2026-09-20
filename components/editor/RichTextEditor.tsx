'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Image from '@tiptap/extension-image'
import Link from '@tiptap/extension-link'
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle } from '@tiptap/extension-text-style'
import Color from '@tiptap/extension-color'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Youtube from '@tiptap/extension-youtube'
import { Placeholder } from '@tiptap/extensions'
import { useCallback, useState } from 'react'
import { normalizeUrl } from '@/lib/normalizeUrl'
import ImageUpload from './ImageUpload'

interface RichTextEditorProps {
  content: string
  onChange: (html: string) => void
  placeholder?: string
  imageFolder?: string
}

type Level = 1 | 2 | 3 | 4

function ToolbarButton({
  onClick, active, disabled, title, children,
}: {
  onClick: () => void
  active?: boolean
  disabled?: boolean
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title}
      className={`tbar-btn ${active ? 'tbar-btn-active' : ''}`}
    >
      {children}
    </button>
  )
}

function ToolbarDivider() {
  return <div className="tbar-divider" />
}

export default function RichTextEditor({ content, onChange, placeholder = 'Start writing...', imageFolder }: RichTextEditorProps) {
  const [showImageUpload,  setShowImageUpload]  = useState(false)
  const [showLinkInput,    setShowLinkInput]    = useState(false)
  const [linkUrl,          setLinkUrl]          = useState('')
  const [showYoutubeInput, setShowYoutubeInput] = useState(false)
  const [youtubeUrl,       setYoutubeUrl]       = useState('')

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3, 4] },
        link: false,
        underline: false,
      }),
      Image.configure({ inline: false, allowBase64: false }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'editor-link' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Underline,
      Highlight.configure({ multicolor: true }),
      Youtube.configure({ width: 640, height: 360 }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: (props: { editor: { getHTML: () => string } }) => onChange(props.editor.getHTML()),
    editorProps: {
      attributes: { class: 'tiptap-editor' },
    },
  })

  const insertImage = useCallback((url: string) => {
    if (!editor) return
    editor.chain().focus().setImage({ src: url }).run()
    setShowImageUpload(false)
  }, [editor])

  const insertLink = useCallback(() => {
    if (!editor || !linkUrl) return
    const normalized = normalizeUrl(linkUrl)
    if (editor.state.selection.empty) {
      editor.chain().focus().insertContent(`<a href="${normalized}">${normalized}</a>`).run()
    } else {
      editor.chain().focus().setLink({ href: normalized }).run()
    }
    setLinkUrl('')
    setShowLinkInput(false)
  }, [editor, linkUrl])

  const insertYoutube = useCallback(() => {
    if (!editor || !youtubeUrl) return
    editor.chain().focus().setYoutubeVideo({ src: youtubeUrl }).run()
    setYoutubeUrl('')
    setShowYoutubeInput(false)
  }, [editor, youtubeUrl])

  const insertTable = useCallback(() => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }, [editor])

  if (!editor) return null

  return (
    <>
      <style>{`
        .rte-wrap { border: 1px solid rgba(255,255,255,0.1); background: var(--navy-mid); display: flex; flex-direction: column; }
        .rte-wrap:focus-within { border-color: var(--orange); }
        .tbar { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; padding: 8px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); background: var(--navy); position: sticky; top: 0; z-index: 10; }
        .tbar-btn { display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 2px; background: none; border: none; cursor: pointer; color: var(--grey-mid); font-size: 12px; font-weight: 600; transition: all 0.1s ease; flex-shrink: 0; }
        .tbar-btn:hover { background: rgba(255,255,255,0.08); color: var(--white); }
        .tbar-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .tbar-btn-active { background: rgba(219,103,39,0.15); color: var(--orange); }
        .tbar-btn-active:hover { background: rgba(219,103,39,0.25); color: var(--orange); }
        .tbar-divider { width: 1px; height: 20px; background: rgba(255,255,255,0.08); margin: 0 4px; }
        .tbar-select { background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--grey-mid); font-size: 11px; padding: 3px 6px; cursor: pointer; outline: none; height: 28px; }
        .tbar-select:focus { border-color: var(--orange); color: var(--white); }
        .tbar-color { width: 28px; height: 28px; border: 1px solid rgba(255,255,255,0.08); cursor: pointer; background: none; padding: 3px; }
        .tbar-color input[type="color"] { width: 100%; height: 100%; border: none; cursor: pointer; background: none; }
        .tbar-popover { display: flex; align-items: center; gap: 6px; padding: 6px 8px; background: var(--navy-deep); border: 1px solid rgba(255,255,255,0.1); margin: 4px 0; width: 100%; }
        .tbar-popover-input { flex: 1; background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-size: 12px; padding: 5px 10px; outline: none; }
        .tbar-popover-input:focus { border-color: var(--orange); }
        .tbar-popover-btn { background: var(--orange); color: var(--white); border: none; font-size: 11px; padding: 5px 12px; cursor: pointer; white-space: nowrap; transition: background 0.1s ease; }
        .tbar-popover-btn:hover { background: var(--orange-f, #C4521A); }
        .tbar-popover-cancel { background: none; color: var(--grey-mid); border: 1px solid rgba(255,255,255,0.08); font-size: 11px; padding: 5px 10px; cursor: pointer; transition: all 0.1s ease; }
        .tbar-popover-cancel:hover { color: var(--white); }
        .tiptap-editor { padding: 24px; min-height: 400px; outline: none; color: var(--off-white); font-family: var(--font-dm, 'DM Sans', sans-serif); font-size: 15px; line-height: 1.75; }
        .tiptap-editor > * + * { margin-top: 1em; }
        .tiptap-editor h1 { font-family: var(--font-exo2, 'Exo 2', sans-serif); font-weight: 800; font-size: 2em; letter-spacing: -1px; color: var(--white); }
        .tiptap-editor h2 { font-family: var(--font-exo2, 'Exo 2', sans-serif); font-weight: 700; font-size: 1.6em; letter-spacing: -0.5px; color: var(--white); }
        .tiptap-editor h3 { font-family: var(--font-exo2, 'Exo 2', sans-serif); font-weight: 700; font-size: 1.3em; color: var(--white); }
        .tiptap-editor h4 { font-family: var(--font-exo2, 'Exo 2', sans-serif); font-weight: 600; font-size: 1.1em; color: var(--white); }
        .tiptap-editor p { color: var(--off-white); }
        .tiptap-editor strong { color: var(--white); font-weight: 700; }
        .tiptap-editor em { font-style: italic; }
        .tiptap-editor u { text-decoration: underline; }
        .tiptap-editor s { text-decoration: line-through; }
        .tiptap-editor code { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 0.85em; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.08); padding: 2px 6px; border-radius: 2px; color: var(--teal); }
        .tiptap-editor pre { background: var(--navy-deep); border: 1px solid rgba(255,255,255,0.06); padding: 16px 20px; overflow-x: auto; }
        .tiptap-editor pre code { background: none; border: none; padding: 0; font-size: 13px; color: var(--teal); }
        .tiptap-editor blockquote { border-left: 3px solid var(--orange); padding-left: 16px; color: var(--grey-mid); font-style: italic; }
        .tiptap-editor ul { list-style: disc; padding-left: 24px; }
        .tiptap-editor ol { list-style: decimal; padding-left: 24px; }
        .tiptap-editor li { margin: 4px 0; }
        .tiptap-editor a.editor-link { color: var(--orange); text-decoration: underline; }
        .tiptap-editor img { max-width: 100%; height: auto; display: block; margin: 16px 0; border: 1px solid rgba(255,255,255,0.06); }
        .tiptap-editor hr { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 24px 0; }
        .tiptap-editor mark { background: rgba(212,168,67,0.3); color: var(--white); padding: 0 2px; }
        .tiptap-editor table { border-collapse: collapse; width: 100%; margin: 16px 0; }
        .tiptap-editor th, .tiptap-editor td { border: 1px solid rgba(255,255,255,0.1); padding: 8px 12px; font-size: 13px; text-align: left; }
        .tiptap-editor th { background: rgba(255,255,255,0.06); color: var(--white); font-family: var(--font-mono, 'Space Mono', monospace); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; }
        .tiptap-editor .selectedCell { background: rgba(219,103,39,0.1); }
        .tiptap-editor p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: var(--grey-dark); pointer-events: none; float: left; height: 0; }
        .rte-footer { padding: 8px 16px; border-top: 1px solid rgba(255,255,255,0.06); background: var(--navy); display: flex; align-items: center; justify-content: flex-end; gap: 16px; }
        .rte-word-count { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-dark); }
      `}</style>

      <div className="rte-wrap">
        <div className="tbar">
          <select
            className="tbar-select"
            value={
              editor.isActive('heading', { level: 1 }) ? '1' :
              editor.isActive('heading', { level: 2 }) ? '2' :
              editor.isActive('heading', { level: 3 }) ? '3' :
              editor.isActive('heading', { level: 4 }) ? '4' : '0'
            }
            onChange={(e) => {
              const val = Number(e.target.value)
              if (val === 0) editor.chain().focus().setParagraph().run()
              else editor.chain().focus().toggleHeading({ level: val as Level }).run()
            }}
            title="Heading level"
          >
            <option value="0">Paragraph</option>
            <option value="1">Heading 1</option>
            <option value="2">Heading 2</option>
            <option value="3">Heading 3</option>
            <option value="4">Heading 4</option>
          </select>

          <ToolbarDivider />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Bold"><b>B</b></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italic"><i>I</i></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Underline"><u>U</u></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Strikethrough"><s>S</s></ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} title="Inline code">{`<>`}</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="Highlight">H</ToolbarButton>

          <ToolbarDivider />
          <label className="tbar-color" title="Text color">
            <input type="color" onInput={(e) => editor.chain().focus().setColor((e.target as HTMLInputElement).value).run()} defaultValue="#DB6727" />
          </label>

          <ToolbarDivider />
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={editor.isActive({ textAlign: 'left' })} title="Align left">⬡</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={editor.isActive({ textAlign: 'center' })} title="Align center">⬡</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={editor.isActive({ textAlign: 'right' })} title="Align right">⬡</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} active={editor.isActive({ textAlign: 'justify' })} title="Justify">⬡</ToolbarButton>

          <ToolbarDivider />
          <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Bullet list">•≡</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Numbered list">1≡</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Blockquote">&ldquo;</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="Code block">{`{}`}</ToolbarButton>

          <ToolbarDivider />
          <ToolbarButton onClick={() => { setShowLinkInput(!showLinkInput); setShowYoutubeInput(false); setShowImageUpload(false) }} active={editor.isActive('link') || showLinkInput} title="Insert link">🔗</ToolbarButton>
          {editor.isActive('link') && (
            <ToolbarButton onClick={() => editor.chain().focus().unsetLink().run()} title="Remove link">✕</ToolbarButton>
          )}
          <ToolbarButton onClick={() => { setShowImageUpload(!showImageUpload); setShowLinkInput(false); setShowYoutubeInput(false) }} title="Insert image" active={showImageUpload}>🖼</ToolbarButton>
          <ToolbarButton onClick={() => { setShowYoutubeInput(!showYoutubeInput); setShowLinkInput(false); setShowImageUpload(false) }} title="Embed YouTube" active={showYoutubeInput}>▶</ToolbarButton>
          <ToolbarButton onClick={insertTable} title="Insert table">⊞</ToolbarButton>
          {editor.isActive('table') && (
            <>
              <ToolbarButton onClick={() => editor.chain().focus().addColumnAfter().run()} title="Add column">+col</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().addRowAfter().run()} title="Add row">+row</ToolbarButton>
              <ToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} title="Delete table">✕tbl</ToolbarButton>
            </>
          )}

          <ToolbarDivider />
          <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">—</ToolbarButton>

          <ToolbarDivider />
          <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">↩</ToolbarButton>
          <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">↪</ToolbarButton>
        </div>

        {showLinkInput && (
          <div className="tbar-popover">
            <input className="tbar-popover-input" type="url" placeholder="https://example.com" value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') insertLink() }} autoFocus />
            <button type="button" className="tbar-popover-btn" onClick={insertLink}>Insert</button>
            <button type="button" className="tbar-popover-cancel" onClick={() => setShowLinkInput(false)}>Cancel</button>
          </div>
        )}

        {showYoutubeInput && (
          <div className="tbar-popover">
            <input className="tbar-popover-input" type="url" placeholder="https://www.youtube.com/watch?v=..." value={youtubeUrl}
              onChange={(e) => setYoutubeUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') insertYoutube() }} autoFocus />
            <button type="button" className="tbar-popover-btn" onClick={insertYoutube}>Embed</button>
            <button type="button" className="tbar-popover-cancel" onClick={() => setShowYoutubeInput(false)}>Cancel</button>
          </div>
        )}

        {showImageUpload && (
          <ImageUpload onInsert={insertImage} onClose={() => setShowImageUpload(false)} folder={imageFolder} />
        )}

        <EditorContent editor={editor} />

        <div className="rte-footer">
          <span className="rte-word-count">
            {editor.storage.characterCount?.words?.() ?? 0} words · {editor.storage.characterCount?.characters?.() ?? 0} chars
          </span>
        </div>
      </div>
    </>
  )
}
