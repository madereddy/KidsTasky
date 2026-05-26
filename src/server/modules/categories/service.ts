import { db } from '../../db.js';
import { randomBytes } from 'crypto';

export const categoryService = {
  createCategory: (cat: any) => {
    const id = "cat_" + randomBytes(8).toString('hex');
    db.prepare("INSERT INTO categories (id, name, icon, color, parentId) VALUES (?, ?, ?, ?, ?)").run(id, cat.name, cat.icon, cat.color, cat.parentId);
    return id;
  },
  
  updateCategory: (id: string, cat: any) => {
    db.prepare("UPDATE categories SET name = ?, icon = ?, color = ?, parentId = ? WHERE id = ?").run(cat.name, cat.icon, cat.color, cat.parentId, id);
  },
  
  deleteCategory: (id: string) => {
    db.prepare("DELETE FROM categories WHERE id = ?").run(id);
  },
  
  getCategories: (parentId: string) => {
    return db.prepare("SELECT * FROM categories WHERE parentId = ?").all(parentId);
  },

  getCategoryById: (id: string) => {
    return db.prepare("SELECT * FROM categories WHERE id = ?").get(id) as { parentId: string } | undefined;
  }
};
