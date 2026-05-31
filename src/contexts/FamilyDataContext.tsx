import { createContext, useContext } from 'react';
import { UserProfile, Category } from '../types';

export interface FamilyDataContextValue {
  kids: UserProfile[];
  categories: Category[];
  memberColorMap: Record<string, string>;
  refreshKids: () => Promise<void>;
  refreshCategories: () => Promise<void>;
}

export const FamilyDataContext = createContext<FamilyDataContextValue>({
  kids: [],
  categories: [],
  memberColorMap: {},
  refreshKids: async () => {},
  refreshCategories: async () => {},
});

export const useFamilyData = () => useContext(FamilyDataContext);
