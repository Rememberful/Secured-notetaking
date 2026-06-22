import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — must match backend
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function MediaThumbnail({ mediaItem, apiUrl, token, onDelete, deletable }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl = null;

    if (mediaItem.previewUrl) {
      setObjectUrl(mediaItem.previewUrl);
      return () => { cancelled = true; };
    }

    fetch(`${apiUrl}/media/${mediaItem.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Could not load image');
        return res.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        createdUrl = URL.createObjectURL(blob);
        setObjectUrl(createdUrl);
      })
      .catch(() => { if (!cancelled) setError(true); });

    return () => {
      cancelled = true;
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [mediaItem.id, mediaItem.previewUrl, apiUrl, token]);

  if (error) return <div className="media-thumb media-thumb-error">Failed to load</div>;

  return (
    <div className="media-thumb">
      {objectUrl
        ? <img src={objectUrl} alt={mediaItem.filename} />
        : <div className="media-thumb-loading" />
      }
      {deletable && (
        <button
          type="button"
          className="media-thumb-delete"
          onClick={() => onDelete(mediaItem)}
          aria-label={`Remove ${mediaItem.filename}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default function MediaGallery({
  noteId,
  media,
  onMediaChange,
  readOnly = false,
  pendingRef = null,
}) {
  const { apiUrl, token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!pendingRef) return;
    pendingRef.current = {
      flush: async (savedNoteId) => {
        const pending = media.filter((m) => m.pending);
        if (pending.length === 0) return [];

        const uploaded = [];
        for (const item of pending) {
          try {
            const formData = new FormData();
            formData.append('file', item.file);
            const res = await fetch(`${apiUrl}/notes/${savedNoteId}/media`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${token}` },
              body: formData,
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Upload failed');
            URL.revokeObjectURL(item.previewUrl);
            uploaded.push(data);
          } catch (err) {
            console.error('Pending upload failed:', err.message);
          }
        }
        return uploaded;
      },
    };
  }, [media, apiUrl, token, pendingRef]);

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setUploadError('');

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setUploadError('Only JPEG, PNG, GIF, and WebP images are supported.');
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setUploadError('Image is too large (max 2MB).');
      return;
    }

    if (!noteId) {
      const previewUrl = URL.createObjectURL(file);
      onMediaChange([...(media || []), {
        id: `pending-${Date.now()}`,
        filename: file.name,
        mime_type: file.type,
        size_bytes: file.size,
        pending: true,
        previewUrl,
        file,
      }]);
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${apiUrl}/notes/${noteId}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onMediaChange([...(media || []), data]);
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(item) {
    if (item.pending) {
      URL.revokeObjectURL(item.previewUrl);
      onMediaChange((media || []).filter((m) => m.id !== item.id));
      return;
    }

    try {
      const res = await fetch(`${apiUrl}/media/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) throw new Error('Could not remove image');
      onMediaChange((media || []).filter((m) => m.id !== item.id));
    } catch (err) {
      setUploadError(err.message);
    }
  }

  const hasMedia = media && media.length > 0;
  if (!hasMedia && readOnly) return null;

  return (
    <div className="media-gallery">
      {uploadError && <div className="media-error">{uploadError}</div>}
      {hasMedia && (
        <div className="media-grid">
          {media.map((m) => (
            <MediaThumbnail
              key={m.id}
              mediaItem={m}
              apiUrl={apiUrl}
              token={token}
              onDelete={handleDelete}
              deletable={!readOnly}
            />
          ))}
        </div>
      )}
      {!readOnly && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            onChange={handleFileSelect}
            disabled={uploading}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="media-add-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading…' : '+ Add image'}
          </button>
        </>
      )}
    </div>
  );
}