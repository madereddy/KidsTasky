// src/server/modules/photos/routes.ts
import { Router, Request, Response } from 'express';
import { photosService } from './service.js';

export const photosRouter = Router();

photosRouter.post('/photos/upload', (req: Request, res: Response) => {
  // We assume middleware places 'parentId' and uploaded file info here.
  const parentId = 'parent_123'; // Mocked for minimal implementation parsing
  const url = '/uploads/photo.jpg';
  
  const result = photosService.addPhoto(parentId, url);

  res.status(200).json(result);
});
