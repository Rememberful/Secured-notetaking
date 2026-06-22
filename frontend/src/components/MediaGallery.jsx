import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext.jsx';

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB — must match the backend's limit
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

// A single authenticated thumbnail. /api/media/:id requires a Bearer token,
// and a plain <img src="..."> can't send custom headers — so we fetch the
// bytes ourselves and turn them into a local object URL the <img> tag can use.
function MediaThumbnail({ mediaItem, apiUrl, token, onDelete, deletable }) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let createdUrl = null;

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
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
      // Object URLs are not garbage collected automatically — must be
      // explicitly revoked or they leak memory for the life of the tab.
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [mediaItem.id, apiUrl, token]);

  if (error) {
    return <div className="media-thumb media-thumb-error">Failed to load</div>;
  }

  return (
    <div className="media-thumb">
      {objectUrl ? (
        <img src={objectUrl} alt={mediaItem.filename} />
      ) : (
        <div className="media-thumb-loading" />
      )}
      {deletable && (
        <button
          type="button"
          className="media-thumb-delete"
          onClick={() => onDelete(mediaItem.id)}
          aria-label={`Remove ${mediaItem.filename}`}
        >
          ×
        </button>
      )}
    </div>
  );
}

// Shows existing images for a note and (optionally) an upload control.
// `noteId` is required for upload to work — pass null/undefined to render
// read-only (used e.g. before a brand-new note has been saved yet).
export default function MediaGallery({ noteId, media, onMediaChange, readOnly = false }) {
  const { apiUrl, token } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef(null);

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    e.target.value = ''; // reset so selecting the same file twice still fires onChange
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

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`${apiUrl}/notes/${noteId}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }, // no Content-Type — browser sets the multipart boundary
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

  async function handleDelete(mediaId) {
    try {
      const res = await fetch(`${apiUrl}/media/${mediaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok && res.status !== 204) throw new Error('Could not remove image');
      onMediaChange((media || []).filter((m) => m.id !== mediaId));
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
            disabled={uploading || !noteId}
            style={{ display: 'none' }}
          />
          <button
            type="button"
            className="media-add-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading || !noteId}
            title={!noteId ? 'Save the note first to attach images' : undefined}
          >
            {uploading ? 'Uploading…' : '+ Add image'}
          </button>
        </>
      )}
    </div>
  );
}