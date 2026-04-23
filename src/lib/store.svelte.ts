import type { Day, Student } from './types';
import { STUDENT_COLORS } from './types';
import { supabase } from './supabase';

const LEGACY_STORAGE_KEY = 'tutoring-students-v2';

const ST_PATS_URL =
	'https://accounts.google.com/v3/signin/identifier?continue=https%3A%2F%2Fclassroom.google.com&dsh=S637937633%3A1760973764720838&ifkv=AfYwgwVOHrGgkiHl6xJRwKSCnWWOWIG2LeulFBEcp1tM5qEYuz4yNLOnkgPfZ59dAMrq54AzVhUbIQ&passive=true&flowName=GlifWebSignIn&flowEntry=ServiceLogin';
const BS_URL =
	'https://accounts.google.com/ServiceLogin?continue=https%3A%2F%2Fclassroom.google.com&passive=true';
const GOOGLE_CLASSROOM = 'https://classroom.google.com/?pli=1';

function colorForId(id: string): string {
	let h = 0;
	for (let i = 0; i < id.length; i++) h = ((h * 31) + id.charCodeAt(i)) >>> 0;
	return STUDENT_COLORS[h % STUDENT_COLORS.length];
}

function blank(partial: Partial<Student> & Pick<Student, 'id' | 'name'>): Student {
	return {
		grade: 0,
		school: '',
		schoolUrl: '',
		username: '',
		password: '',
		days: [],
		phone: '',
		email: '',
		notes: '',
		contacts: [],
		projects: [],
		extraLogins: [],
		courses: [],
		hiatus: false,
		color: colorForId(partial.id),
		...partial
	};
}

const INITIAL: Student[] = [
	// ── Sunday ───────────────────────────────────────────────────
	blank({ id: 'maddie-henderson', name: 'Maddie Henderson', grade: 11, school: 'Bullis', schoolUrl: 'https://bullis.instructure.com/?login_success=1', username: 'madeline_henderson@bullis.org', password: 'Blue77012!', days: ['Sunday'], color: STUDENT_COLORS[0] }),
	blank({ id: 'olympia', name: 'Olympia', grade: 6, school: 'DCI', schoolUrl: 'https://web.toddleapp.com/', username: 'olympia.kilcarr@dcinternationalschool.org', password: 'Angel333', days: ['Sunday'], color: STUDENT_COLORS[1] }),
	blank({ id: 'sylvie-carter', name: 'Sylvie Carter', grade: 11, school: 'Burke', schoolUrl: 'https://burkeschool.myschoolapp.com/app?svcId=edu&envId=p-1P26ZieRxka5dSIEOGO9kw&bb_id=1#login', username: 'cars270@burkeschool.org', password: 'Sylvie11Carter', days: ['Sunday', 'Wednesday'], color: STUDENT_COLORS[2] }),
	blank({ id: 'eli-setty', name: 'Eli Setty', grade: 11, school: 'Field', schoolUrl: 'https://fieldschool.myschoolapp.com/app/student#studentmyday/progress', username: 'elisetty27@students.fieldschool.org', password: 'blackwolf101', days: ['Sunday'], color: STUDENT_COLORS[3] }),
	blank({ id: 'truett', name: 'Truett', grade: 11, school: 'St. Andrews', schoolUrl: 'https://saes.instructure.com/', username: 't27engel@saes.org', password: 'Abbots30', days: ['Sunday'], color: STUDENT_COLORS[4] }),
	blank({ id: 'franklin', name: 'Franklin', grade: 7, school: 'St. Patricks', schoolUrl: GOOGLE_CLASSROOM, username: 'haneyfr@s.stpatsdc.org', password: 'tiger447', days: ['Sunday'], color: STUDENT_COLORS[5] }),
	// ── Monday ───────────────────────────────────────────────────
	blank({ id: 'lavinia', name: 'Lavinia', grade: 6, school: 'Maret', schoolUrl: 'https://maret.instructure.com/', username: 'lavinial2032@maret.org', password: 'mLL^^dingo', days: ['Monday'], color: STUDENT_COLORS[6] }),
	blank({ id: 'devon', name: 'Devon', grade: 6, school: 'St. Patricks', schoolUrl: ST_PATS_URL, username: 'myersd@s.stpatsdc.org', password: 'truth2459', days: ['Monday'], color: STUDENT_COLORS[7] }),
	blank({ id: 'kira', name: 'Kira', grade: 6, school: 'St. Patricks', schoolUrl: ST_PATS_URL, username: 'myersk@s.stpatsdc.org', password: 'truth3223', days: ['Monday'], color: STUDENT_COLORS[8] }),
	blank({ id: 'spencer-duncan', name: 'Spencer Duncan', grade: 12, school: 'Ivy Mount', schoolUrl: '', username: '', password: 'Wence3', days: ['Monday', 'Wednesday'], color: STUDENT_COLORS[9] }),
	blank({ id: 'scottie-berman', name: 'Scottie Berman', grade: 9, school: 'Sidwell Friends', schoolUrl: 'https://sfs.instructure.com/login/saml', username: 'sberman29@sidwell.edu', password: 'plkplkS45!', days: ['Monday'], color: STUDENT_COLORS[10] }),
	// ── Tuesday ──────────────────────────────────────────────────
	blank({ id: 'oliver-lisle', name: 'Oliver Lisle', grade: 7, school: 'Hardy MS', schoolUrl: 'https://login.microsoftonline.com/2aa046ee-b34e-4a33-92b7-999df2bc0a32/saml2?SAMLRequest=fZLJbtswEIZfReBdEkUtjghJgRujqIG0NWK3h16KkTiMCXBxScp1376InKC51NfBv8x8mO7%2BYnRyRh%2BUsz0pMkruh249x6N9wl8zhphcjLahJ7O33EFQgVswGHic%2BH79%2BZGzjPKTd9FNTpOrmAcw%2BrYDQkAflbMk%2Bf5WzjJKku2mJz%2Fv6qqgrJQNCJSFWElR4x1tpRgpg0oK1tQtFLKhI0m2Icy4tSGCjT1hlNVpwVK6OjDKacOLJqtp%2FYMkGwxRWYhL1THGU%2BB5rt2zsplRk3fByeisVhazyZmcAdCqQUzHssK0grJMWzau0rZthWTjRKFk%2BcudjCTrt2MenA2zQb9Hf1YTfnt6%2FFc1aTyjX7IdzPG4mPMrB5LsXgl%2BUFYo%2B3wb3ngVBf7pcNilu6%2F7Axm6lzi%2BwPDD7U6DEQREyC5Gd%2Fl7X%2FcFDG43O6fV9Cf56LyB%2BP9ViqxYJkqkcpHy2YYTTkoqFCRZa%2B1%2BP3iEiD2JfkaSD13%2B%2FrWGvw%3D%3D&RelayState=NTIwZThjZWFjM2M0Yjk3ZDQ1MDAyYTJk%3BNGM2M2MxY2Y2MjNkY2U4MmNhYWM%3D%3BaHR0cHM6Ly9jbGV2ZXIuY29tL2luL2F1dGhfY2FsbGJhY2s%3D%3BOWFlOGFhNWQyNzhiNDAxNzZjNDBmZmM5N2Q5YWU0ZDRhNmI3YzkxYzNmOTUwMThlMjhkZWFjZDQ4MTRkMDFhYg%3D%3D%3BY29kZQ%3D%3D%3B', username: '20076210@students.k12.dc.us', password: 'Dc091713', days: ['Tuesday'], color: STUDENT_COLORS[11] }),
	blank({ id: 'pari', name: 'Pari', grade: 8, school: 'Blessed Sacrament', schoolUrl: BS_URL, username: '26pols@bsdc.org', password: 'password', days: ['Tuesday'], color: STUDENT_COLORS[12] }),
	blank({ id: 'lizzie', name: 'Lizzie', grade: 8, school: 'Blessed Sacrament', schoolUrl: BS_URL, username: '26erig@bsdc.org', password: 'ramenmybirthday', days: ['Tuesday'], color: STUDENT_COLORS[13] }),
	blank({ id: 'lily', name: 'Lily', grade: 6, school: 'St. Patricks', schoolUrl: GOOGLE_CLASSROOM, username: 'bieligkl@s.stpatsdc.org', password: 'truth6506', days: ['Tuesday', 'Thursday'], color: STUDENT_COLORS[0] }),
	blank({ id: 'norah', name: 'Norah', grade: 8, school: 'St. Patricks', schoolUrl: GOOGLE_CLASSROOM, username: 'alionblocherno@s.stpatsdc.org', password: 'horse391', days: ['Tuesday'], color: STUDENT_COLORS[1] }),
	blank({ id: 'jack', name: 'Jack', grade: 8, school: 'Little Flower School', schoolUrl: GOOGLE_CLASSROOM, username: 'jdonahue@littleflowerschool.org', password: 'jd602252', days: ['Tuesday'], color: STUDENT_COLORS[2] }),
	blank({ id: 'maren', name: 'Maren', grade: 4, school: 'St. Patricks', schoolUrl: ST_PATS_URL, username: 'bieligkm@s.stpatsdc.org', password: 'truth3223', days: ['Tuesday', 'Thursday'], color: STUDENT_COLORS[3] }),
	// ── Wednesday ────────────────────────────────────────────────
	blank({ id: 'max', name: 'Max', grade: 6, school: 'Maret', schoolUrl: 'https://maret.instructure.com/', username: 'maxr2032@maret.org', password: 'mMR@turtle', days: ['Wednesday'], color: STUDENT_COLORS[4] }),
	blank({ id: 'liza', name: 'Liza', grade: 3, school: 'Key', schoolUrl: 'https://keyschooldc.membershiptoolkit.com/', username: '', password: '', days: ['Wednesday'], color: STUDENT_COLORS[5] }),
	blank({ id: 'campbell-blackford', name: 'Campbell Blackford', grade: 10, school: 'Maret', schoolUrl: 'https://maret.instructure.com/', username: 'cblackford@maret.org', password: 'SweetPea13', days: ['Wednesday'], color: STUDENT_COLORS[6] }),
	blank({ id: 'jay', name: 'Jay', grade: 9, school: 'St. Albans', schoolUrl: 'https://stalbansschool.myschoolapp.com/app?svcid=edu#login', username: 'JCrawford29@stalbansschool.org', password: 'Hockeyplayerong9?!', days: ['Wednesday'], color: STUDENT_COLORS[7] }),
	// ── Thursday ─────────────────────────────────────────────────
	blank({ id: 'kate-rosenberg', name: 'Kate Rosenberg', grade: 9, school: 'Maret', schoolUrl: 'https://maret.instructure.com/', username: 'Kater2029@maret.org', password: 'mKR)koala', days: ['Thursday'], color: STUDENT_COLORS[8] }),
	blank({ id: 'frances', name: 'Frances', grade: 1, school: 'Holy Trinity', schoolUrl: '', username: '', password: '', days: ['Thursday'], color: STUDENT_COLORS[9] }),
	blank({ id: 'nelly', name: 'Nelly', grade: 10, school: 'Sidwell Friends', schoolUrl: 'https://sfs.instructure.com/login/saml', username: 'nberman29@sidwell.edu', password: 'plkplk45N', days: ['Thursday'], color: STUDENT_COLORS[10] }),
	// ── Friday ───────────────────────────────────────────────────
	blank({ id: 'zev', name: 'Zev', grade: 7, school: 'Landon', schoolUrl: 'https://landonschool.instructure.com/login/ldap', username: 'zev_thakkar@landon.net', password: 'fm3fspqJ', days: ['Friday'], color: STUDENT_COLORS[11] }),
	// ── No fixed day ─────────────────────────────────────────────
	blank({ id: 'lauren-chappell', name: 'Lauren Chappell', grade: 11, school: 'St. Andrews', schoolUrl: 'https://saes.instructure.com/', username: 'l27chapp@saes.org', password: 'Swards94', days: [], color: STUDENT_COLORS[12] }),
	blank({ id: 'finley', name: 'Finley', grade: 9, school: 'Holy Child', schoolUrl: '', username: '', password: '', days: [], color: STUDENT_COLORS[13] })
];

function migrate(s: unknown): Student {
	const raw = s as Student & { day?: string };
	return {
		...raw,
		courses: raw.courses ?? [],
		days: raw.days ?? (raw.day ? [raw.day as Day] : []),
		hiatus: raw.hiatus ?? false,
		color: raw.color ?? colorForId(raw.id)
	};
}

class StudentStore {
	list = $state<Student[]>([]);
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
			this.list = (data.students as Record<string, unknown>[]).map(migrate);
		} else {
			// First login: migrate from localStorage if present, else use INITIAL
			const localRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
			if (localRaw) {
				try {
					this.list = (JSON.parse(localRaw) as Record<string, unknown>[]).map(migrate);
				} catch {
					this.list = INITIAL;
				}
			} else {
				this.list = INITIAL;
			}
			await this.persist();
		}
		this.loading = false;
	}

	private async persist() {
		if (!this.userId) return;
		const { error } = await supabase.from('user_data').upsert(
			{ user_id: this.userId, students: this.list, updated_at: new Date().toISOString() },
			{ onConflict: 'user_id' }
		);
		if (error) console.error('persist failed:', error.message);
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
