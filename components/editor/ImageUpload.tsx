'use client'

import { useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { normalizeUrl } from '@/lib/normalizeUrl'

interface ImageUploadProps {
  onInsert: (url: string) => void
  onClose: () => void
  folder?: string
}

type Tab = 'upload' | 'url'

export default function ImageUpload({ onInsert, onClose, folder = 'posts' }: ImageUploadProps) {
  const [tab,          setTab]          = useState<Tab>('upload')
  const [urlInput,     setUrlInput]     = useState('')
  const [uploading,    setUploading]    = useState(false)
  const [error,        setError]        = useState<string | null>(null)
  const [preview,      setPreview]      = useState<string | null>(null)
  const [dragOver,     setDragOver]     = useState(false)
  const fileRef                         = useRef<HTMLInputElement>(null)

  async function uploadFile(file: File) {
    setError(null)
    if (!file.type.startsWith('image/')) { setError('File must be an image.'); return }
    if (file.size > 10 * 1024 * 1024)   { setError('Image must be under 10 MB.'); return }
    setUploading(true)
    try {
      const supabase = createClient()
      const ext      = file.name.split('.').pop()
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const path     = `${folder}/${filename}`
      const { error: uploadError } = await supabase.storage.from('media').upload(path, file, { upsert: false, contentType: file.type })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('media').getPublicUrl(path)
      onInsert(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
    }
  }

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    await uploadFile(file)
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    setPreview(URL.createObjectURL(file))
    await uploadFile(file)
  }, [])

  const handleUrlInsert = useCallback(() => {
    if (!urlInput.trim()) return
    onInsert(normalizeUrl(urlInput))
  }, [urlInput, onInsert])

  return (
    <>
      <style>{`
        .img-upload { border-top: 1px solid rgba(255,255,255,0.06); border-bottom: 1px solid rgba(255,255,255,0.06); background: var(--navy-deep); padding: 16px; }
        .img-upload-tabs { display: flex; gap: 0; margin-bottom: 16px; border-bottom: 1px solid rgba(255,255,255,0.08); }
        .img-tab-btn { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; padding: 8px 16px; background: none; border: none; color: var(--grey-mid); cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -1px; transition: all 0.15s ease; }
        .img-tab-btn:hover { color: var(--white); }
        .img-tab-btn.active { color: var(--orange); border-bottom-color: var(--orange); }
        .img-drop-zone { border: 2px dashed rgba(255,255,255,0.1); padding: 32px 24px; text-align: center; cursor: pointer; transition: all 0.15s ease; }
        .img-drop-zone.drag-over { border-color: var(--orange); background: rgba(219,103,39,0.06); }
        .img-drop-zone:hover { border-color: rgba(255,255,255,0.2); }
        .img-drop-label { font-size: 13px; color: var(--grey-mid); margin-bottom: 8px; }
        .img-drop-hint { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 8px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--grey-dark); }
        .img-drop-btn { display: inline-block; margin-top: 12px; font-family: var(--font-mono, 'Space Mono', monospace); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; padding: 8px 16px; border: 1px solid rgba(255,255,255,0.15); color: var(--grey-mid); cursor: pointer; background: none; transition: all 0.15s ease; }
        .img-drop-btn:hover { color: var(--white); border-color: rgba(255,255,255,0.3); }
        .img-preview { margin-top: 12px; position: relative; }
        .img-preview img { max-height: 120px; max-width: 100%; object-fit: contain; border: 1px solid rgba(255,255,255,0.08); }
        .img-uploading { position: absolute; inset: 0; background: rgba(7,22,40,0.7); display: flex; align-items: center; justify-content: center; font-family: var(--font-mono, 'Space Mono', monospace); font-size: 9px; letter-spacing: 0.15em; text-transform: uppercase; color: var(--orange); }
        .img-url-row { display: flex; gap: 8px; }
        .img-url-input { flex: 1; background: var(--navy-mid); border: 1px solid rgba(255,255,255,0.08); color: var(--white); font-size: 13px; padding: 10px 14px; outline: none; transition: border-color 0.15s ease; }
        .img-url-input:focus { border-color: var(--orange); }
        .img-url-input::placeholder { color: var(--grey-dark); }
        .img-url-btn { background: var(--orange); color: var(--white); border: none; font-size: 12px; padding: 10px 20px; cursor: pointer; white-space: nowrap; transition: background 0.15s ease; }
        .img-url-btn:hover { background: var(--orange-f, #C4521A); }
        .img-error { margin-top: 8px; font-size: 12px; color: var(--error); background: rgba(232,69,69,0.08); border: 1px solid rgba(232,69,69,0.2); padding: 8px 12px; }
        .img-upload-footer { display: flex; justify-content: flex-end; margin-top: 12px; }
        .img-cancel { font-family: var(--font-mono, 'Space Mono', monospace); font-size: 9px; letter-spacing: 0.12em; text-transform: uppercase; background: none; border: 1px solid rgba(255,255,255,0.08); color: var(--grey-mid); padding: 7px 14px; cursor: pointer; transition: all 0.15s ease; }
        .img-cancel:hover { color: var(--white); border-color: rgba(255,255,255,0.2); }
      `}</style>

      <div className="img-upload">
        <div className="img-upload-tabs">
          <button type="button" className={`img-tab-btn ${tab === 'upload' ? 'active' : ''}`} onClick={() => setTab('upload')}>Upload file</button>
          <button type="button" className={`img-tab-btn ${tab === 'url' ? 'active' : ''}`} onClick={() => setTab('url')}>From URL</button>
        </div>

        {tab === 'upload' && (
          <div>
            <div
              className={`img-drop-zone ${dragOver ? 'drag-over' : ''}`}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <div className="img-drop-label">Drop an image here, or click to browse</div>
              <div className="img-drop-hint">PNG, JPG, GIF, WEBP — max 10 MB</div>
              <button type="button" className="img-drop-btn" onClick={(e) => { e.stopPropagation(); fileRef.current?.click() }}>Browse files</button>
              <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
            </div>
            {preview && (
              <div className="img-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={preview} alt="Preview" />
                {uploading && <div className="img-uploading">Uploading...</div>}
              </div>
            )}
          </div>
        )}

        {tab === 'url' && (
          <div className="img-url-row">
            <input className="img-url-input" type="url" placeholder="https://example.com/image.jpg"
              value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleUrlInsert() }} autoFocus />
            <button type="button" className="img-url-btn" onClick={handleUrlInsert}>Insert</button>
          </div>
        )}

        {error && <div className="img-error">{error}</div>}
        <div className="img-upload-footer">
          <button type="button" className="img-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </>
  )
}
