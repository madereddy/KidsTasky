// src/server/modules/lists/routes.ts
import { Router } from 'express';
import { listsService } from './service.js';

export const listsRouter = Router();

listsRouter.get('/parents/:parentId/lists', (req, res) => {
  try {
    const lists = listsService.getLists(req.params.parentId);
    res.json(lists);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.get('/lists/:listId/items', (req, res) => {
  try {
    const items = listsService.getListItems(req.params.listId);
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
