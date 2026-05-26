// src/server/modules/photos/routes.ts
import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { requireAuth } from '../../middleware/auth.js';
import { photosService } from './service.js';
import { ensurePhotosUploadsDir, getPhotosUploadsDir } from './storage.js';

import { randomUUID } from 'crypto';

export const photosRouter = Router();

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    try {
      const uploadsDir = ensurePhotosUploadsDir();
      cb(null, uploadsDir);
    } catch (error) {
      cb(error as Error, getPhotosUploadsDir());
    }
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || ".jpg");
    cb(null, `${Date.now()}-${randomUUID()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) return cb(null, true);
    return cb(new Error("Only image files allowed"));
  }
});

photosRouter.post('/photos/upload', requireAuth, upload.single("photo"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });
  const parentId = (req as any).user?.role === "parent" ? (req as any).user.uid : (req as any).user?.parentId;
  if (!parentId) return res.status(403).json({ error: "Missing parent context" });

  const url = `/uploads/photos/${req.file.filename}`;
  const result = photosService.addPhoto(parentId, url);
  return res.status(201).json(result);
});

photosRouter.get("/parents/:parentId/photos", requireAuth, (req, res) => {
  const photos = photosService.getPhotos(String(req.params.parentId));
  res.json(photos);
});

photosRouter.put("/photos/:id/caption", requireAuth, (req, res) => {
  photosService.updateCaption(String(req.params.id), String(req.body?.caption ?? ""));
  res.json({ success: true });
});

photosRouter.delete("/photos/:id", requireAuth, (req, res) => {
  const url = photosService.deletePhoto(String(req.params.id));
  if (url) {
    const filePath = path.resolve(url.replace(/^\//, ""));
    fs.unlink(filePath, () => {});
  }
  res.json({ success: true });
});
