import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Clipboard, ClipboardCheck } from 'lucide-react';
import { listsClientService } from '../../services/lists';
import { AppList, AppListItem } from '../../types';
import { ListSidebar } from './ListSidebar';
import { cn } from '../../lib/utils';

interface Props {
  parentId: string;
}

export function ListsView({ parentId }: Props) {
  const [lists, setLists] = useState<AppList[]>([]);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [items, setItems] = useState<AppListItem[]>([]);
  const [newListTitle, setNewListTitle] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchLists = useCallback(async () => {
    const l = await listsClientService.getLists(parentId);
    setLists(l || []);
    if (l && l.length > 0 && !selectedListId) {
      setSelectedListId(l[0].id);
    }
  }, [parentId]);

  const fetchItems = useCallback(async () => {
    if (!selectedListId) { setItems([]); return; }
    const i = await listsClientService.getItems(selectedListId);
    setItems(i || []);
  }, [selectedListId]);

  useEffect(() => { fetchLists(); }, [fetchLists]);
  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleCreateList = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newListTitle.trim()) return;
    const list = await listsClientService.createList(newListTitle.trim());
    setNewListTitle('');
    setLists(prev => [...prev, list]);
    setSelectedListId(list.id);
  };

  const handleDeleteList = async (id: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this list?')) return;
    await listsClientService.deleteList(id);
    setLists(prev => prev.filter(l => l.id !== id));
    if (selectedListId === id) {
      const remaining = lists.filter(l => l.id !== id);
      setSelectedListId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const handleAddItem = async (text: string) => {
    if (!selectedListId) return;
    const item = await listsClientService.addItem(selectedListId, text);
    setItems(prev => [...prev, item]);
  };

  const handleToggleItem = async (itemId: string, completed: boolean) => {
    await listsClientService.toggleItem(itemId, completed);
    setItems(prev => prev.map(it => it.id === itemId ? { ...it, completed: completed ? 1 : 0 } : it));
  };

  const handleDeleteItem = async (itemId: string) => {
    if (typeof window !== 'undefined' && !window.confirm('Are you sure you want to delete this item?')) return;
    await listsClientService.deleteItem(itemId);
    setItems(prev => prev.filter(it => it.id !== itemId));
  };

  const handleCopyItems = () => {
    const unchecked = items.filter(it => it.completed === 0).map(it => it.text).join('\n');
    navigator.clipboard.writeText(unchecked);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const selectedList = lists.find(l => l.id === selectedListId);

  return (
    <div className="flex h-[calc(100vh-200px)] bg-white rounded-2xl border border-ui overflow-hidden shadow-sm">
      <div className="w-64 shrink-0 border-r border-ui flex flex-col bg-ui-soft">
        <div className="p-4 border-b border-ui">
          <h2 className="font-bold text-ui-primary text-lg">My Lists</h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {lists.map(list => {
            const count = list.id === selectedListId ? items.length : undefined;
            return (
              <button
                key={list.id}
                onClick={() => setSelectedListId(list.id)}
                className={cn(
                  "w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center justify-between group",
                  selectedListId === list.id
                    ? "bg-blue-500 text-white shadow-sm"
                    : "text-ui-secondary hover:bg-white hover:shadow-sm"
                )}
              >
                <span className="truncate flex-1">{list.title}</span>
                <div className="flex items-center gap-1 shrink-0">
                  {count !== undefined && (
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded-full",
                      selectedListId === list.id ? "bg-blue-400 text-white" : "bg-ui-soft-3 text-ui-muted"
                    )}>{count}</span>
                  )}
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteList(list.id); }}
                    className={cn(
                      "p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-all",
                      selectedListId === list.id ? "hover:bg-blue-400 text-white" : "hover:bg-red-100 text-ui-muted-2 hover:text-red-500"
                    )}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </button>
            );
          })}
          {lists.length === 0 && (
            <p className="text-xs text-ui-muted-2 text-center py-6">No lists yet</p>
          )}
        </div>
        <div className="p-3 border-t border-ui">
          <form onSubmit={handleCreateList} className="flex gap-2">
            <input
              value={newListTitle}
              onChange={e => setNewListTitle(e.target.value)}
              placeholder="New list…"
              className="flex-1 border border-ui rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
            />
            <button type="submit" className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors">
              <Plus size={14} />
            </button>
          </form>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        {selectedList ? (
          <>
            <div className="px-4 py-3 border-b border-ui flex items-center justify-between bg-white shrink-0">
              <h3 className="font-bold text-ui-primary text-lg">{selectedList.title}</h3>
              <button
                onClick={handleCopyItems}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border",
                  copied ? "bg-emerald-50 text-emerald-600 border-emerald-200" : "bg-white text-ui-muted border-ui hover:bg-ui-soft"
                )}
              >
                {copied ? <ClipboardCheck size={14} /> : <Clipboard size={14} />}
                {copied ? "Copied!" : "Copy items"}
              </button>
            </div>
            <ListSidebar
              listTitle={selectedList.title}
              items={items}
              isOpen={true}
              inline={true}
              onToggleItem={handleToggleItem}
              onAddItem={handleAddItem}
              onDeleteItem={handleDeleteItem}
              onDeleteList={() => handleDeleteList(selectedList.id)}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-ui-muted-2">
            <div className="text-center">
              <p className="text-lg font-semibold">No list selected</p>
              <p className="text-sm mt-1">Create a list to get started</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

