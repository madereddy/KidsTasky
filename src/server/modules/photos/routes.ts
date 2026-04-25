// src/server/modules/photos/routes.ts
import { Router, Request, Response } from 'express';
import { db } from '../../db.js';
import { randomUUID } from 'crypto';

export const photosRouter = Router();

photosRouter.post('/photos/upload', (req: Request, res: Response) => {
  // We assume middleware places 'parentId' and uploaded file info here.
  const parentId = 'parent_123'; // Mocked for minimal implementation parsing
  const url = '/uploads/photo.jpg';
  const id = randomUUID();
  
  db.prepare('INSERT INTO family_photos (id, parentId, url, uploadedAt) VALUES (?, ?, ?, ?)').run(
    id, parentId, url, new Date().toISOString()
  );

  res.status(200).json({ url, id });
});
