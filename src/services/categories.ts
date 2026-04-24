import { fetchAPI } from './http';
import { Category } from '../types';

export const categoryService = {
  async createCategory(category: Omit<Category, 'id'>): Promise<string> {
    const res = await fetchAPI('/categories', {
      method: "POST",
      body: JSON.stringify(category)
    });
    return res.id;
  },

  async updateCategory(category: Category): Promise<void> {
    await fetchAPI('/categories/' + category.id, {
      method: "PUT",
      body: JSON.stringify(category)
    });
  },

  async deleteCategory(categoryId: string): Promise<void> {
    await fetchAPI('/categories/' + categoryId, { method: "DELETE" });
  },

  async getCategories(parentId: string): Promise<Category[]> {
    return await fetchAPI('/parents/' + parentId + '/categories');
  }
};
