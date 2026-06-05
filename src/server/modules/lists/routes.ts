import { Router } from 'express';
import { authenticateUser, assertParentScope, enforceEditUnlocked, getParentId, requireAuth } from '../../middleware/auth.js';
import { listsService } from './service.js';
import { logger } from '../../lib/logger.js';

export const listsRouter = Router();

listsRouter.get('/parents/:parentId/lists', authenticateUser, assertParentScope, (req, res) => {
  try {
    const lists = listsService.getLists(String(req.params.parentId));
    res.json(lists);
  } catch (error: any) {
    logger.error({ parentId: req.params.parentId, error: error.message }, 'get_lists_error');
    res.status(500).json({ error: error.message });
  }
});

listsRouter.get('/parents/:parentId/list-items', authenticateUser, assertParentScope, (req, res) => {
  try {
    const items = listsService.getAllParentItems(String(req.params.parentId));
    res.json(items);
  } catch (error: any) {
    logger.error({ parentId: req.params.parentId, error: error.message }, 'get_parent_items_error');
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
    logger.error({ listId: req.params.listId, error: error.message }, 'get_list_items_error');
    res.status(500).json({ error: error.message });
  }
});

listsRouter.post('/lists', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const { title, category, isRoutine, locationName } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }
    // Scope to the family, not the individual uid — a kid/co-parent uid is not
    // the family key and would orphan the list from the rest of the household.
    const list = listsService.createList(getParentId(req), title, category, isRoutine, locationName);
    res.status(201).json(list);
  } catch (error: any) {
    logger.error({ error: error.message, body: req.body, params: req.params }, 'lists_mutation_error');
    res.status(500).json({ error: error.message });
  }
});

listsRouter.put('/lists/:id', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const list = listsService.getListById(String(req.params.id));
    if (!list) return res.status(404).json({ error: 'Not found' });
    if (list.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const { title, category, isRoutine, locationName } = req.body;
    const updated = listsService.updateList(String(req.params.id), title, category, isRoutine, locationName);
    res.json(updated);
  } catch (error: any) {
    logger.error({ error: error.message, body: req.body, params: req.params }, 'lists_mutation_error');
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
    logger.error({ error: error.message, body: req.body, params: req.params }, 'lists_mutation_error');
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
    logger.error({ error: error.message, body: req.body, params: req.params }, 'lists_mutation_error');
    res.status(500).json({ error: error.message });
  }
});

listsRouter.post('/list-items/batch', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const { listIds, text } = req.body as { listIds?: string[]; text?: string };
    if (!Array.isArray(listIds) || listIds.length === 0) {
      return res.status(400).json({ error: 'listIds is required' });
    }
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    const uniqueListIds = Array.from(new Set(listIds.map(String)));
    const lists = listsService.getListsByIds(uniqueListIds);
    if (lists.length !== uniqueListIds.length) {
      return res.status(404).json({ error: 'One or more lists were not found' });
    }
    if (lists.some((list) => list.parentId !== getParentId(req))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const items = listsService.addItemsToLists(uniqueListIds, text);
    res.status(201).json(items);
  } catch (error: any) {
    logger.error({ error: error.message, body: req.body, params: req.params }, 'lists_mutation_error');
    res.status(500).json({ error: error.message });
  }
});

listsRouter.put('/list-items/:itemId', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const ownerParentId = listsService.getItemParentId(String(req.params.itemId));
    if (!ownerParentId) return res.status(404).json({ error: 'Not found' });
    if (ownerParentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    listsService.toggleItem(String(req.params.itemId), req.body.completed, req.body.text);
    res.json({ success: true });
  } catch (error: any) {
    logger.error({ error: error.message, body: req.body, params: req.params }, 'lists_mutation_error');
    res.status(500).json({ error: error.message });
  }
});

listsRouter.post('/list-items/:itemId/copy', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const ownerParentId = listsService.getItemParentId(String(req.params.itemId));
    if (!ownerParentId) return res.status(404).json({ error: 'Not found' });
    if (ownerParentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const { listIds } = req.body as { listIds?: string[] };
    if (!Array.isArray(listIds) || listIds.length === 0) {
      return res.status(400).json({ error: 'listIds is required' });
    }

    const uniqueListIds = Array.from(new Set(listIds.map(String)));
    const lists = listsService.getListsByIds(uniqueListIds);
    if (lists.length !== uniqueListIds.length) {
      return res.status(404).json({ error: 'One or more lists were not found' });
    }
    if (lists.some((list) => list.parentId !== getParentId(req))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const items = listsService.copyItemToLists(String(req.params.itemId), uniqueListIds);
    res.status(201).json(items);
  } catch (error: any) {
    logger.error({ error: error.message, body: req.body, params: req.params }, 'lists_mutation_error');
    res.status(500).json({ error: error.message });
  }
});

listsRouter.post('/list-items/:itemId/move', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const ownerParentId = listsService.getItemParentId(String(req.params.itemId));
    if (!ownerParentId) return res.status(404).json({ error: 'Not found' });
    if (ownerParentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const { targetListId } = req.body as { targetListId?: string };
    if (!targetListId || typeof targetListId !== 'string') {
      return res.status(400).json({ error: 'targetListId is required' });
    }

    const targetList = listsService.getListById(targetListId);
    if (!targetList) return res.status(404).json({ error: 'Target list not found' });
    if (targetList.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const updated = listsService.moveItemToList(String(req.params.itemId), targetListId);
    res.json(updated);
  } catch (error: any) {
    logger.error({ error: error.message, body: req.body, params: req.params }, 'lists_mutation_error');
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
    logger.error({ error: error.message, body: req.body, params: req.params }, 'lists_mutation_error');
    res.status(500).json({ error: error.message });
  }
});
