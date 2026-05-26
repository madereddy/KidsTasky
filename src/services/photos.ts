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
    fetchAPI(`/photos/${id}`, { method: "DELETE" })
};
