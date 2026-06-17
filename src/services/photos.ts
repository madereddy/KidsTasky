import { API_BASE, fetchAPI, HttpError } from "./http";
import { FamilyPhoto } from "../types";

export const photosClientService = {
  getPhotos: (parentId: string): Promise<FamilyPhoto[]> =>
    fetchAPI(`/parents/${parentId}/photos`),
  uploadPhoto: async (file: File): Promise<FamilyPhoto> => {
    const token = localStorage.getItem("kidtasker_token");
    const formData = new FormData();
    formData.append("photo", file);

    const res = await fetch(`${API_BASE}/photos/upload`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData
    });
    if (!res.ok) {
      let msg = `Upload failed (${res.status})`;
      try {
        const err = await res.json();
        if (err?.error) msg = err.error;
      } catch {}
      throw new HttpError(res.status, msg);
    }
    return res.json();
  },
  updateCaption: (id: string, caption: string): Promise<{ success: boolean }> =>
    fetchAPI(`/photos/${id}/caption`, { method: "PUT", body: JSON.stringify({ caption }) }),
  deletePhoto: (id: string): Promise<{ success: boolean }> =>
    fetchAPI(`/photos/${id}`, { method: "DELETE" }),
  createGooglePickerSession: (parentId: string): Promise<{ sessionId: string; pickerUri: string }> =>
    fetchAPI(`/parents/${parentId}/google-photos/picker/session`, { method: 'POST', body: JSON.stringify({}) }),
  getGooglePickerMediaItems: (
    parentId: string,
    sessionId: string,
    pageSize = 50,
    pageToken?: string
  ): Promise<{ items: Array<{ id: string; baseUrl: string; filename?: string }>; nextPageToken?: string | null }> =>
    fetchAPI(`/parents/${parentId}/google-photos/picker/sessions/${encodeURIComponent(sessionId)}/media-items?pageSize=${pageSize}${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`),
  importGooglePickerItems: (
    parentId: string,
    sessionId: string,
    items: Array<{ id: string; baseUrl: string; filename?: string }>
  ): Promise<{ success: boolean; imported: number; skipped?: number; unresolved?: number }> =>
    fetchAPI(`/parents/${parentId}/google-photos/picker/import`, { method: 'POST', body: JSON.stringify({ sessionId, items }) }),
};
