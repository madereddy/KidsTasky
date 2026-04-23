import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  serverTimestamp, 
  deleteDoc,
  updateDoc,
  increment
} from 'firebase/firestore';
import { db, handleFirestoreError } from '../lib/firebase';
import { Task, TaskCompletion, UserProfile, Category, Invite, EarnedBadge } from '../types';

export const taskService = {
  // User Profile
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      return docSnap.exists() ? docSnap.data() as UserProfile : null;
    } catch (e) {
      handleFirestoreError(e, 'get', `users/${uid}`);
    }
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    try {
      await setDoc(doc(db, 'users', profile.uid), {
        ...profile,
        xp: profile.xp || 0,
        level: profile.level || 1,
        badges: profile.badges || []
      });
    } catch (e) {
      handleFirestoreError(e, 'create', `users/${profile.uid}`);
    }
  },

  async addBadge(uid: string, badgeId: string): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        const badges = data.badges || [];
        if (!badges.some(b => b.id === badgeId)) {
          const newBadge: EarnedBadge = {
            id: badgeId,
            earnedAt: serverTimestamp()
          };
          await updateDoc(userRef, {
            badges: [...badges, newBadge]
          });
        }
      }
    } catch (e) {
      handleFirestoreError(e, 'update', `users/${uid}`);
    }
  },

  async updateUserXP(uid: string, xpChange: number): Promise<void> {
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const data = userSnap.data() as UserProfile;
        const newXP = Math.max(0, (data.xp || 0) + xpChange);
        const newLevel = Math.floor(newXP / 100) + 1;
        await updateDoc(userRef, { 
          xp: newXP,
          level: newLevel
        });
      }
    } catch (e) {
      handleFirestoreError(e, 'update', `users/${uid}`);
    }
  },

  async getKidsForParent(parentId: string): Promise<UserProfile[]> {
    try {
      const q = query(collection(db, 'users'), where('parentId', '==', parentId), where('role', '==', 'kid'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as UserProfile);
    } catch (e) {
      handleFirestoreError(e, 'list', 'users');
    }
  },

  // Tasks
  async createTask(task: Omit<Task, 'id' | 'createdAt' | 'status'>): Promise<string> {
    try {
      const newDocRef = doc(collection(db, 'tasks'));
      const newTask: Task = {
        ...task,
        id: newDocRef.id,
        status: 'active',
        createdAt: serverTimestamp()
      };
      await setDoc(newDocRef, newTask);
      return newDocRef.id;
    } catch (e) {
      handleFirestoreError(e, 'create', 'tasks');
    }
  },

  async getTasksForKid(kidId: string): Promise<Task[]> {
    try {
      const q = query(collection(db, 'tasks'), where('assignedKidId', '==', kidId), where('status', '==', 'active'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Task);
    } catch (e) {
      handleFirestoreError(e, 'list', 'tasks');
    }
  },

  async getTasksForParent(parentId: string): Promise<Task[]> {
    try {
      const q = query(collection(db, 'tasks'), where('parentId', '==', parentId), where('status', '==', 'active'), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Task);
    } catch (e) {
      handleFirestoreError(e, 'list', 'tasks');
    }
  },

  async archiveTask(taskId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'tasks', taskId), { status: 'archived' });
    } catch (e) {
      handleFirestoreError(e, 'update', `tasks/${taskId}`);
    }
  },

  // Completions
  async completeTask(taskId: string, kidId: string, dateString: string, count?: number): Promise<void> {
    try {
      const id = `${taskId}_${dateString}_${count || 1}`;
      const completion: TaskCompletion = {
        id,
        taskId,
        kidId,
        completedAt: serverTimestamp(),
        dateString,
        count
      };
      await setDoc(doc(db, 'completions', id), completion);
    } catch (e) {
      handleFirestoreError(e, 'create', `completions/${taskId}_${dateString}`);
    }
  },

  async uncompleteTask(taskId: string, dateString: string, count?: number): Promise<void> {
    try {
      const completionId = `${taskId}_${dateString}_${count || 1}`;
      await deleteDoc(doc(db, 'completions', completionId));
    } catch (e) {
      handleFirestoreError(e, 'delete', `completions/${taskId}_${dateString}`);
    }
  },

  async getCompletionsForKid(kidId: string, dateString: string): Promise<TaskCompletion[]> {
    try {
      const q = query(collection(db, 'completions'), where('kidId', '==', kidId), where('dateString', '==', dateString));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as TaskCompletion);
    } catch (e) {
      handleFirestoreError(e, 'list', 'completions');
    }
  },

  async getCompletionsForDateRange(kidId: string, startDate: string, endDate: string): Promise<TaskCompletion[]> {
    try {
      const q = query(
        collection(db, 'completions'), 
        where('kidId', '==', kidId), 
        where('dateString', '>=', startDate),
        where('dateString', '<=', endDate)
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as TaskCompletion);
    } catch (e) {
      handleFirestoreError(e, 'list', 'completions');
    }
  },

  // Categories
  async createCategory(category: Omit<Category, 'id'>): Promise<string> {
    try {
      const newDocRef = doc(collection(db, 'categories'));
      const newCategory: Category = {
        ...category,
        id: newDocRef.id
      };
      await setDoc(newDocRef, newCategory);
      return newDocRef.id;
    } catch (e) {
      handleFirestoreError(e, 'create', 'categories');
    }
  },

  async updateCategory(category: Category): Promise<void> {
    try {
      await updateDoc(doc(db, 'categories', category.id), category as any);
    } catch (e) {
      handleFirestoreError(e, 'update', `categories/${category.id}`);
    }
  },

  async deleteCategory(categoryId: string): Promise<void> {
    try {
      await deleteDoc(doc(db, 'categories', categoryId));
    } catch (e) {
      handleFirestoreError(e, 'delete', `categories/${categoryId}`);
    }
  },

  async getCategories(parentId: string): Promise<Category[]> {
    try {
      const q = query(collection(db, 'categories'), where('parentId', '==', parentId));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Category);
    } catch (e) {
      handleFirestoreError(e, 'list', 'categories');
    }
  },

  // Invites
  async createInvite(parentId: string, parentName: string): Promise<string> {
    try {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const invite: Invite = {
        id: code,
        parentId,
        parentName,
        createdAt: serverTimestamp(),
        status: 'active'
      };
      await setDoc(doc(db, 'invites', code), invite);
      return code;
    } catch (e) {
      handleFirestoreError(e, 'create', 'invites');
    }
  },

  async getActiveInvite(parentId: string): Promise<Invite | null> {
    try {
      const q = query(collection(db, 'invites'), where('parentId', '==', parentId), where('status', '==', 'active'));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        return querySnapshot.docs[0].data() as Invite;
      }
      return null;
    } catch (e) {
      handleFirestoreError(e, 'get', 'invites');
    }
  },

  async validateInvite(code: string): Promise<Invite | null> {
    try {
      const docRef = doc(db, 'invites', code.toUpperCase());
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().status === 'active') {
        return docSnap.data() as Invite;
      }
      return null;
    } catch (e) {
      handleFirestoreError(e, 'get', `invites/${code}`);
    }
  },

  // Notifications
  async getUnreadNotifications(parentId: string): Promise<Notification[]> {
    try {
      const q = query(
        collection(db, 'notifications'), 
        where('parentId', '==', parentId), 
        where('status', '==', 'unread'),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => doc.data() as Notification);
    } catch (e) {
      handleFirestoreError(e, 'list', 'notifications');
    }
  },

  async markNotificationRead(notificationId: string): Promise<void> {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { status: 'read' });
    } catch (e) {
      handleFirestoreError(e, 'update', `notifications/${notificationId}`);
    }
  }
};
