import { Router } from 'express';
import { authenticateUser, getParentId, requireAuth } from '../../middleware/auth.js';
import { listsService } from './service.js';

export const listsRouter = Router();

listsRouter.get('/parents/:parentId/lists', authenticateUser, (req, res) => {
  try {
    const userParentId = getParentId(req);
    if (userParentId !== req.params.parentId) return res.status(403).json({ error: 'Forbidden' });
    const lists = listsService.getLists(String(req.params.parentId));
    res.json(lists);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.get('/lists/:listId/items', authenticateUser, (req, res) => {
  try {
    const list = listsService.getListById(String(req.params.listId));
    if (!list) return res.status(404).json({ error: 'Not found' });
    
    const userParentId = getParentId(req);
    if (list.parentId !== userParentId) return res.status(403).json({ error: 'Forbidden' });

    const items = listsService.getListItems(String(req.params.listId));
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
    listsService.deleteList(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.post('/lists/:listId/items', requireAuth, (req, res) => {
  try {
    const item = listsService.addItem(String(req.params.listId), req.body.text);
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.put('/list-items/:itemId', requireAuth, (req, res) => {
  try {
    listsService.toggleItem(String(req.params.itemId), req.body.completed);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.delete('/list-items/:itemId', requireAuth, (req, res) => {
  try {
    listsService.deleteItem(String(req.params.itemId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
