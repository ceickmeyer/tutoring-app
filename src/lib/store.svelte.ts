import type { Day, SkillBankItem, Student, StudentSkill } from './types';
import { STUDENT_COLORS } from './types';
import { supabase } from './supabase';

const LEGACY_STORAGE_KEY = 'tutoring-students-v2';

function colorForId(id: string): string {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) >>> 0;
	return STUDENT_COLORS[h % STUDENT_COLORS.length];
}

function migrate(s: unknown): Student {
	const raw = s as Student & { day?: string };
	return {
		...raw,
		courses: raw.courses ?? [],
		homework: raw.homework ?? [],
		skills: (raw.skills ?? []).map((sk: StudentSkill) => ({
			...sk,
			itemEntries: sk.itemEntries ?? {},
			notes: sk.notes ?? '',
			statusHistory: sk.statusHistory ?? []
		})),
		days: raw.days ?? (raw.day ? [raw.day as Day] : []),
		hiatus: raw.hiatus ?? false,
		color: raw.color ?? colorForId(raw.id)
	};
}

class StudentStore {
	list = $state<Student[]>([]);
	skillBank = $state<SkillBankItem[]>([]);
	loading = $state(true);
	private userId: string | null = null;

	async init(userId: string) {
		if (this.userId === userId) return;
		this.userId = userId;

		const { data } = await supabase
			.from('user_data')
			.select('students')
			.eq('user_id', userId)
			.single();

		if (data?.students) {
			const raw = data.students as unknown;
			if (Array.isArray(raw)) {
				// Legacy format: bare array of students
				this.list = (raw as Record<string, unknown>[]).map(migrate);
				this.skillBank = [];
			} else {
				const wrapper = raw as { students: Record<string, unknown>[]; skillBank: SkillBankItem[] };
				this.list = (wrapper.students ?? []).map(migrate);
				this.skillBank = (wrapper.skillBank ?? []).map((s) => ({ ...s, example: s.example ?? '' }));
			}
		} else {
			// First login: migrate from localStorage if present, else start empty
			const localRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
			if (localRaw) {
				try {
					this.list = (JSON.parse(localRaw) as Record<string, unknown>[]).map(migrate);
				} catch {
					this.list = [];
				}
			} else {
				this.list = [];
			}
			this.skillBank = [];
			await this.persist();
		}
		this.loading = false;
	}

	private async persist() {
		if (!this.userId) return;
		const payload = { students: $state.snapshot(this.list), skillBank: $state.snapshot(this.skillBank) };
		const { error } = await supabase.from('user_data').upsert(
			{ user_id: this.userId, students: payload, updated_at: new Date().toISOString() },
			{ onConflict: 'user_id' }
		);
		if (error) console.error('persist failed:', error.message);
	}

	addSkill(skill: SkillBankItem) {
		this.skillBank = [...this.skillBank, skill];
		this.persist();
	}

	updateSkill(id: string, updated: Omit<SkillBankItem, 'id'>) {
		this.skillBank = this.skillBank.map((s) => s.id === id ? { ...s, ...updated } : s);
		this.persist();
	}

	removeSkill(id: string) {
		this.skillBank = this.skillBank.filter((s) => s.id !== id);
		// Remove from every student too
		this.list = this.list.map((s) => ({
			...s,
			skills: s.skills.filter((sk) => sk.skillId !== id)
		}));
		this.persist();
	}

	add(student: Student) {
		this.list = [...this.list, student];
		this.persist();
	}

	update(id: string, updated: Student) {
		this.list = this.list.map((s) => (s.id === id ? updated : s));
		this.persist();
	}

	remove(id: string) {
		this.list = this.list.filter((s) => s.id !== id);
		this.persist();
	}

	toggleHiatus(id: string) {
		this.list = this.list.map((s) => (s.id === id ? { ...s, hiatus: !s.hiatus } : s));
		this.persist();
	}

	find(id: string): Student | undefined {
		return this.list.find((s) => s.id === id);
	}

	clear() {
		this.list = [];
		this.skillBank = [];
		this.userId = null;
		this.loading = true;
	}
}

export const store = new StudentStore();

export function slugify(name: string): string {
	return name
		.toLowerCase()
		.trim()
		.replace(/\s+/g, '-')
		.replace(/[^a-z0-9-]/g, '');
}

export function uniqueSlug(name: string): string {
	const base = slugify(name);
	if (!store.list.some((s) => s.id === base)) return base;
	let i = 2;
	while (store.list.some((s) => s.id === base + '-' + i)) i++;
	return base + '-' + i;
}
