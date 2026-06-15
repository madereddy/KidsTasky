import { Router } from 'express';
import { authenticateUser, assertParentScope, enforceEditUnlocked, getParentId, requireAuth } from '../../middleware/auth.js';
import { listsService } from './service.js';
import { logger } from '../../lib/logger.js';
import { toErrorMessage } from '../../lib/toErrorMessage.js';

export const listsRouter = Router();

listsRouter.get('/parents/:parentId/lists', authenticateUser, assertParentScope, (req, res) => {
  try {
    const lists = listsService.getLists(String(req.params.parentId));
    return res.json(lists);
  } catch (error: unknown) {
    logger.error({ parentId: req.params.parentId, error: toErrorMessage(error) }, 'get_lists_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.get('/parents/:parentId/list-items', authenticateUser, assertParentScope, (req, res) => {
  try {
    const items = listsService.getAllParentItems(String(req.params.parentId));
    return res.json(items);
  } catch (error: unknown) {
    logger.error({ parentId: req.params.parentId, error: toErrorMessage(error) }, 'get_parent_items_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.get('/parents/:parentId/frequent-items', authenticateUser, assertParentScope, (req, res) => {
  try {
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 5;
    const items = listsService.getFrequentItems(String(req.params.parentId), limit);
    return res.json(items);
  } catch (error: unknown) {
    logger.error({ parentId: req.params.parentId, error: toErrorMessage(error) }, 'get_frequent_items_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.get('/lists/:listId/items', authenticateUser, (req, res) => {
  try {
    const list = listsService.getListById(String(req.params.listId));
    if (!list) return res.status(404).json({ error: 'Not found' });
    
    if (list.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const items = listsService.getListItems(String(req.params.listId));
    return res.json(items);
  } catch (error: unknown) {
    logger.error({ listId: req.params.listId, error: toErrorMessage(error) }, 'get_list_items_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.post('/lists', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const { title, category, isRoutine, locationName } = req.body;
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required' });
    }
    const list = listsService.createList(getParentId(req), title, category, isRoutine, locationName);
    return res.status(201).json(list);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'lists_mutation_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.put('/lists/:id', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const list = listsService.getListById(String(req.params.id));
    if (!list) return res.status(404).json({ error: 'Not found' });
    if (list.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });

    const { title, category, isRoutine, locationName } = req.body;
    const updated = listsService.updateList(String(req.params.id), title, category, isRoutine, locationName);
    return res.json(updated);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'lists_mutation_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.delete('/lists/:id', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const list = listsService.getListById(String(req.params.id));
    if (!list) return res.status(404).json({ error: 'Not found' });
    if (list.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    listsService.deleteList(String(req.params.id));
    return res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'lists_mutation_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.post('/lists/:listId/items', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const list = listsService.getListById(String(req.params.listId));
    if (!list) return res.status(404).json({ error: 'Not found' });
    if (list.parentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    const { text, storeName, locationName } = req.body;
    const item = listsService.addItem(String(req.params.listId), text, storeName, locationName);
    return res.status(201).json(item);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'lists_mutation_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.post('/list-items/batch', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const { listIds, text, storeName, locationName } = req.body as { listIds?: string[]; text?: string; storeName?: string; locationName?: string };
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

    const items = listsService.addItemsToLists(uniqueListIds, text, storeName, locationName);
    return res.status(201).json(items);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'lists_mutation_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.put('/list-items/:itemId', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const ownerParentId = listsService.getItemParentId(String(req.params.itemId));
    if (!ownerParentId) return res.status(404).json({ error: 'Not found' });
    if (ownerParentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    const { completed, text, storeName, locationName } = req.body;
    listsService.toggleItem(String(req.params.itemId), completed, text, storeName, locationName);
    return res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'lists_mutation_error');
    return res.status(500).json({ error: toErrorMessage(error) });
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
    return res.status(201).json(items);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'lists_mutation_error');
    return res.status(500).json({ error: toErrorMessage(error) });
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
    return res.json(updated);
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'lists_mutation_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});

listsRouter.delete('/list-items/:itemId', requireAuth, enforceEditUnlocked, (req, res) => {
  try {
    const ownerParentId = listsService.getItemParentId(String(req.params.itemId));
    if (!ownerParentId) return res.status(404).json({ error: 'Not found' });
    if (ownerParentId !== getParentId(req)) return res.status(403).json({ error: 'Forbidden' });
    listsService.deleteItem(String(req.params.itemId));
    return res.json({ success: true });
  } catch (error: unknown) {
    logger.error({ error: toErrorMessage(error), body: req.body, params: req.params }, 'lists_mutation_error');
    return res.status(500).json({ error: toErrorMessage(error) });
  }
});
