export interface Contact {
	name: string;
	relationship: string;
	phone: string;
	email: string;
}

export interface BigProject {
	id: string;
	title: string;
	startDate: string;
	dueDate: string;
}

export interface ExtraLogin {
	id: string;
	site: string;
	url: string;
	username: string;
	password: string;
}

export type Day =
	| ''
	| 'Monday'
	| 'Tuesday'
	| 'Wednesday'
	| 'Thursday'
	| 'Friday'
	| 'Saturday'
	| 'Sunday';

export interface GradeEntry {
	date: string; // YYYY-MM-DD
	grade: number; // 0–100
}

export interface Course {
	id: string;
	name: string;
	color: string;
	entries: GradeEntry[];
}

export const STUDENT_COLORS = [
	'#f4dbd6', // rosewater
	'#f0c6c6', // flamingo
	'#f5bde6', // pink
	'#c6a0f6', // mauve
	'#ed8796', // red
	'#ee99a0', // maroon
	'#f5a97f', // peach
	'#eed49f', // yellow
	'#a6da95', // green
	'#8bd5ca', // teal
	'#91d7e3', // sky
	'#7dc4e4', // sapphire
	'#8aadf4', // blue
	'#b7bdf8'  // lavender
];

export const COURSE_COLORS = [
	'#8aadf4', // blue
	'#ed8796', // red
	'#a6da95', // green
	'#eed49f', // yellow
	'#c6a0f6', // mauve
	'#91d7e3', // sky
	'#f5bde6', // pink
	'#8bd5ca', // teal
	'#f5a97f', // peach
	'#b7bdf8'  // lavender
];

export type SkillType = 'status' | 'scored' | 'multi';
export type SkillStatus = 'not_started' | 'working' | 'mastered';

export interface SkillBankItem {
	id: string;
	name: string;
	category: string;
	description: string;     // shown to parents; same for every student
	example: string;         // a worked example, e.g. "518 = 500+10+8"
	type: SkillType;
	unit: string;            // '%', 'wpm', 'sec', 'min', 'words', '' …
	higherIsBetter: boolean; // for scored: wpm=true, time=false
	goal?: number;           // target value, same for all students using this skill
	items?: string[];        // for 'multi' type: ordered sub-item names (e.g. ['2s','3s','5s'])
}

export interface SkillEntry {
	date: string;  // YYYY-MM-DD
	value: number;
}

export interface StudentSkill {
	skillId: string;
	status: SkillStatus;
	entries: SkillEntry[];
	itemEntries?: Record<string, SkillEntry[]>; // for 'multi' type: item name → entries
	notes?: string; // student-specific notes for this skill
}

export interface Student {
	id: string;
	name: string;
	grade: number;
	school: string;
	schoolUrl: string;
	username: string;
	password: string;
	days: Day[];
	phone: string;
	email: string;
	notes: string;
	contacts: Contact[];
	projects: BigProject[];
	extraLogins: ExtraLogin[];
	courses: Course[];
	skills: StudentSkill[];
	hiatus: boolean;
	color: string;
}
