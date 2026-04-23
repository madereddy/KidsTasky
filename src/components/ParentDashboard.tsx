import React, { useState, useEffect } from 'react';
import { Trash2, Calendar, Clock, CalendarDays, Tag, Plus, ShieldCheck, Bell, Send, CheckCircle2, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { Task, UserProfile, Category, Invite, Notification, Reward, RewardManager } from '../types';
import { taskService } from '../services/taskService';
import { AddTaskModal } from './AddTaskModal';
import { CategoryManager } from './CategoryManager';

// ... I will need to move all the dependencies and subcomponents too ...
// Wait, the prompt says "make sure the whole codebase is modular". 
// Moving components out is a good start.
