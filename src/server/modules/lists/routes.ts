// src/server/modules/lists/routes.ts
import { Router } from 'express';
import { requireAuth } from '../../middleware/auth.js';
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

listsRouter.post('/lists', requireAuth, (req, res) => {
  try {
    const { title } = req.body;
    const user = (req as any).user;
    const list = listsService.createList(user.uid, title);
    res.status(201).json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.delete('/lists/:id', requireAuth, (req, res) => {
  try {
    listsService.deleteList(req.params.id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.post('/lists/:listId/items', requireAuth, (req, res) => {
  try {
    const item = listsService.addItem(req.params.listId, req.body.text);
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.put('/list-items/:itemId', requireAuth, (req, res) => {
  try {
    listsService.toggleItem(req.params.itemId, req.body.completed);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.delete('/list-items/:itemId', requireAuth, (req, res) => {
  try {
    listsService.deleteItem(req.params.itemId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
