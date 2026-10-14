'use client'

import { useState, useRef } from 'react'
import { createClient } from '@nextrium/supabase/client'

interface CoverImageUploadProps {
  value: string
  onChange: (url: string) => void
  folder?: string
}

export default function CoverImageUpload({
  value,
  onChange,
  folder = 'covers',
}: CoverImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const fileRef                   = useRef<HTMLInputElement>(null)

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('File must be an image.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image must be under 10 MB.')
      return
    }

    setError(null)
    setUploading(true)

    try {
      const supabase = createClient()
      const ext      = file.name.split('.').pop()
      const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const path     = `${folder}/${filename}`

      const { error: uploadError } = await supabase.storage
        .from('media')
        .upload(path, file, { upsert: false, contentType: file.type })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('media').getPublicUrl(path)
      onChange(data.publicUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <>
      <style>{`
        .cover-upload-wrap { display: flex; flex-direction: column; gap: 8px; }
        .cover-upload-row { display: flex; gap: 8px; align-items: stretch; }
        .cover-upload-input {
          flex: 1; background: var(--navy); border: 1px solid rgba(255,255,255,0.08);
          color: var(--white); font-family: var(--font-dm); font-size: 14px;
          padding: 10px 14px; outline: none; transition: border-color 0.15s ease;
          min-width: 0;
        }
        .cover-upload-input:focus { border-color: var(--orange); }
        .cover-upload-input::placeholder { color: var(--grey-dark); }
        .cover-upload-btn {
          font-family: var(--font-mono); font-size: 9px;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 10px 14px; background: none;
          border: 1px solid rgba(255,255,255,0.15);
          color: var(--grey-mid); cursor: pointer;
          transition: all 0.15s ease; white-space: nowrap; flex-shrink: 0;
        }
        .cover-upload-btn:hover:not(:disabled) { color: var(--white); border-color: rgba(255,255,255,0.3); }
        .cover-upload-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .cover-upload-error { font-size: 12px; color: var(--error); }
        .cover-preview {
          width: 100%; aspect-ratio: 16/9; object-fit: cover;
          border: 1px solid rgba(255,255,255,0.08); display: block;
        }
        .cover-preview-wrap { position: relative; }
        .cover-preview-remove {
          position: absolute; top: 8px; right: 8px;
          font-family: var(--font-mono); font-size: 8px;
          letter-spacing: 0.1em; text-transform: uppercase;
          padding: 5px 10px; background: rgba(7,22,40,0.85);
          border: 1px solid rgba(232,69,69,0.4); color: var(--error);
          cursor: pointer; transition: all 0.15s ease;
        }
        .cover-preview-remove:hover { background: rgba(232,69,69,0.15); }
      `}</style>

      <div className="cover-upload-wrap">
        <div className="cover-upload-row">
          <input
            className="cover-upload-input"
            type="url"
            placeholder="https:// or upload from device"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <button
            type="button"
            className="cover-upload-btn"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : '↑ Upload'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleFile}
            style={{ display: 'none' }}
          />
        </div>

        {error && <div className="cover-upload-error">{error}</div>}

        {value && (
          <div className="cover-preview-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={value} alt="Cover preview" className="cover-preview" />
            <button
              type="button"
              className="cover-preview-remove"
              onClick={() => onChange('')}
            >
              Remove
            </button>
          </div>
        )}
      </div>
    </>
  )
}