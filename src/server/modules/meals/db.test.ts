// src/server/modules/meals/db.test.ts
// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { db } from '../../db.js';

describe('Meals Database Schema', () => {
  it('should create and retrieve recipes and meal plans', () => {
    // Delete items to avoid primary key collisions if test retries
    db.prepare('DELETE FROM recipes WHERE id = ?').run('recipe_1');
    db.prepare('DELETE FROM meal_plans WHERE id = ?').run('meal_1');

    const rStmt = db.prepare(`INSERT INTO recipes (id, parentId, name, ingredients) VALUES (?, ?, ?, ?)`);
    rStmt.run('recipe_1', 'parent_1', 'Pancakes', JSON.stringify(['Eggs', 'Flour', 'Milk']));
    
    const mStmt = db.prepare(`INSERT INTO meal_plans (id, parentId, date, mealType, recipeId) VALUES (?, ?, ?, ?, ?)`);
    mStmt.run('meal_1', 'parent_1', '2026-04-25', 'Breakfast', 'recipe_1');
    
    const recipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get('recipe_1') as any;
    const meal = db.prepare('SELECT * FROM meal_plans WHERE id = ?').get('meal_1') as any;
    
    expect(recipe.name).toBe('Pancakes');
    expect(meal.mealType).toBe('Breakfast');
  });
});
