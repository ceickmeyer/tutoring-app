import type { HomeworkStatus } from './types';

export const HOMEWORK_STATUS_ORDER: HomeworkStatus[] = ['not_started', 'working', 'completed'];

export const HOMEWORK_STATUS_LABEL: Record<HomeworkStatus, string> = {
	not_started: 'Not started',
	working: 'Working on it',
	completed: 'Completed'
};
