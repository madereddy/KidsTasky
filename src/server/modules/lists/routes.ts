import { Router } from 'express';
import { authenticateUser, assertParentScope, enforceEditUnlocked, getParentId, requireAuth } from '../../middleware/auth.js';
import { listsService } from './service.js';

export const listsRouter = Router();

listsRouter.get('/parents/:parentId/lists', authenticateUser, assertParentScope, (req, res) => {
  try {
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
    
    if (list.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const items = listsService.getListItems(String(req.params.listId));
    res.json(items);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.post('/lists', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const { title } = req.body;
    // Scope to the family, not the individual uid — a kid/co-parent uid is not
    // the family key and would orphan the list from the rest of the household.
    const list = listsService.createList(getParentId(req), title);
    res.status(201).json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.delete('/lists/:id', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const list = listsService.getListById(String(req.params.id));
    if (!list) return res.status(404).json({ error: 'Not found' });
    if (list.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    listsService.deleteList(String(req.params.id));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.post('/lists/:listId/items', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const list = listsService.getListById(String(req.params.listId));
    if (!list) return res.status(404).json({ error: 'Not found' });
    if (list.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    const item = listsService.addItem(String(req.params.listId), req.body.text);
    res.status(201).json(item);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.put('/list-items/:itemId', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const ownerParentId = listsService.getItemParentId(String(req.params.itemId));
    if (!ownerParentId) return res.status(404).json({ error: 'Not found' });
    if (ownerParentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    listsService.toggleItem(String(req.params.itemId), req.body.completed);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

listsRouter.delete('/list-items/:itemId', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const ownerParentId = listsService.getItemParentId(String(req.params.itemId));
    if (!ownerParentId) return res.status(404).json({ error: 'Not found' });
    if (ownerParentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    listsService.deleteItem(String(req.params.itemId));
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
