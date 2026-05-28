import React, { useEffect, useRef, useState } from 'react';
import { FamilyPhoto } from '../../types';
import { photosClientService } from '../../services/photos';

interface Props {
  parentId: string;
  refreshToken?: number;
}

export function PhotoManager({ parentId, refreshToken = 0 }: Props) {
  const [photos, setPhotos] = useState<FamilyPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [captionDraft, setCaptionDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const refresh = async () => {
    const data = await photosClientService.getPhotos(parentId);
    setPhotos(data || []);
  };

  useEffect(() => {
    refresh().catch(() => {});
  }, [parentId, refreshToken]);

  const onFilesSelected = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setLoading(true);
    setError('');
    try {
      for (const file of Array.from(files)) {
        await photosClientService.uploadPhoto(file);
      }
      await refresh();
    } catch (e: any) {
      setError(e?.message || 'Upload failed');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={loading}
          className="px-3 py-2 min-h-[44px] bg-blue-500 text-white rounded-lg text-sm font-semibold hover:bg-blue-600 transition-colors disabled:opacity-60"
        >
          {loading ? 'Uploading...' : 'Upload Photos'}
        </button>
        <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => onFilesSelected(e.target.files)} />
        {error && <span className="text-xs text-rose-600">{error}</span>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {photos.map((photo) => (
          <div key={photo.id} className="border border-ui rounded-xl overflow-hidden bg-white shadow-sm">
            <img src={photo.url} alt={photo.caption || 'Family photo'} className="w-full h-28 object-cover" />
            <div className="p-2 space-y-2">
              {editingId === photo.id ? (
                <input
                  autoFocus
                  value={captionDraft}
                  onChange={(e) => setCaptionDraft(e.target.value)}
                  onBlur={async () => {
                    await photosClientService.updateCaption(photo.id, captionDraft);
                    setEditingId(null);
                    refresh().catch(() => {});
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      await photosClientService.updateCaption(photo.id, captionDraft);
                      setEditingId(null);
                      refresh().catch(() => {});
                    }
                    if (e.key === 'Escape') {
                      setCaptionDraft(photo.caption || '');
                      setEditingId(null);
                    }
                  }}
                  className="w-full text-xs border border-ui rounded px-2 py-1 bg-white text-ui-primary"
                />
              ) : (
                <button
                  className="text-xs text-left text-ui-secondary hover:text-ui-primary w-full"
                  onClick={() => {
                    setEditingId(photo.id);
                    setCaptionDraft(photo.caption || '');
                  }}
                >
                  {photo.caption || 'Add caption...'}
                </button>
              )}
              <button
                className="text-xs text-rose-600"
                onClick={async () => {
                  if (!confirm('Delete this photo?')) return;
                  await photosClientService.deletePhoto(photo.id);
                  refresh().catch(() => {});
                }}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

