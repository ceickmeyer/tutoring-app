<script lang="ts">
	import { goto } from '$app/navigation';
	import GradeChart from '$lib/GradeChart.svelte';
	import SkillMultiChart from '$lib/SkillMultiChart.svelte';
	import SkillSparkline from '$lib/SkillSparkline.svelte';
	import { getOrCreateShareUrl } from '$lib/share';
	import { store } from '$lib/store.svelte';
	import { COURSE_COLORS } from '$lib/types';
	import type { BigProject, Day, HomeworkItem, HomeworkStatus, SkillBankItem, SkillStatus, StatusChangeEntry, StudentSkill } from '$lib/types';
	import { computeSkillStatus, SKILL_STATUS_LABEL } from '$lib/skillStatus';
	import { HOMEWORK_STATUS_LABEL, HOMEWORK_STATUS_ORDER } from '$lib/homeworkStatus';

	const WEEK_DAYS: Day[] = [
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday'
	];
	const DAY_ABBR: Record<string, string> = {
		Monday: 'Mon',
		Tuesday: 'Tue',
		Wednesday: 'Wed',
		Thursday: 'Thu',
		Friday: 'Fri',
		Saturday: 'Sat',
		Sunday: 'Sun'
	};

	const today = new Date().toISOString().slice(0, 10);

	let { data } = $props();

	const student = $derived(store.find(data.slug));

	let showDeleteConfirm = $state(false);
	let showResetGradesConfirm = $state(false);

	// ── Header identity (name/grade/school/days) ──────────────────
	let editingHeader = $state(false);
	let headerName = $state('');
	let headerGrade = $state<number>(0);
	let headerSchool = $state('');
	let headerDays = $state<Day[]>([]);

	function startEditHeader() {
		if (!student) return;
		headerName = student.name;
		headerGrade = student.grade;
		headerSchool = student.school;
		headerDays = [...student.days];
		editingHeader = true;
	}

	function toggleHeaderDay(day: Day) {
		headerDays = headerDays.includes(day) ? headerDays.filter((d) => d !== day) : [...headerDays, day];
	}

	function saveHeader() {
		if (!student) return;
		store.update(student.id, { ...student, name: headerName.trim(), grade: headerGrade, school: headerSchool.trim(), days: headerDays });
		editingHeader = false;
	}

	function deleteStudent() {
		if (!student) return;
		store.remove(student.id);
		goto('/');
	}

	function resetGrades() {
		if (!student) return;
		store.update(student.id, {
			...student,
			courses: student.courses.map((c) => ({ ...c, entries: [] }))
		});
		showResetGradesConfirm = false;
	}

	// ── Skills ───────────────────────────────────────────────────
	let showAssignSkill = $state(false);
	let assignSkillSearch = $state('');
	let selectedToAssign = $state<Set<string>>(new Set());
	let activeSkillLog = $state<string | null>(null);
	let skillLogDate = $state(today);
	let skillLogValue = $state<number>(0);
	let editingSkillEntry = $state<{ skillId: string; idx: number } | null>(null);
	let editSkillEntryDate = $state(today);
	let editSkillEntryValue = $state<number>(0);
	let expandedHistory = $state<Set<string>>(new Set());
	let activeSkillLogItem = $state<{ skillId: string; item: string } | null>(null);
	let multiLogDate = $state(today);
	let multiLogValue = $state<number>(0);
	let editingMultiEntry = $state<{ skillId: string; item: string; idx: number } | null>(null);
	let editMultiEntryDate = $state(today);
	let editMultiEntryValue = $state<number>(0);
	let expandedMultiHistory = $state<Set<string>>(new Set());
	let editingSkillNotes = $state<string | null>(null);
	let skillNotesInput = $state('');
	let expandedStatusHistory = $state<Set<string>>(new Set());

	function toggleStatusHistory(skillId: string) {
		const next = new Set(expandedStatusHistory);
		if (next.has(skillId)) next.delete(skillId);
		else next.add(skillId);
		expandedStatusHistory = next;
	}

	function toggleHistory(skillId: string) {
		const next = new Set(expandedHistory);
		if (next.has(skillId)) next.delete(skillId);
		else next.add(skillId);
		expandedHistory = next;
	}

	function toggleMultiHistory(skillId: string, item: string) {
		const key = skillId + '::' + item;
		const next = new Set(expandedMultiHistory);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		expandedMultiHistory = next;
	}

	function openMultiLog(skillId: string, item: string, lastValue: number) {
		activeSkillLogItem = { skillId, item };
		multiLogDate = today;
		multiLogValue = lastValue;
		editingMultiEntry = null;
	}

	function submitMultiLog(skillId: string, item: string) {
		if (!student || isNaN(multiLogValue)) return;
		store.update(student.id, {
			...student,
			skills: student.skills.map((sk) =>
				sk.skillId !== skillId ? sk : {
					...sk,
					itemEntries: {
						...(sk.itemEntries ?? {}),
						[item]: [...((sk.itemEntries ?? {})[item] ?? []), { date: multiLogDate, value: multiLogValue }]
							.sort((a, b) => a.date.localeCompare(b.date))
					}
				}
			)
		});
		activeSkillLogItem = null;
	}

	function deleteMultiEntry(skillId: string, item: string, idx: number) {
		if (!student) return;
		store.update(student.id, {
			...student,
			skills: student.skills.map((sk) =>
				sk.skillId !== skillId ? sk : {
					...sk,
					itemEntries: {
						...(sk.itemEntries ?? {}),
						[item]: ((sk.itemEntries ?? {})[item] ?? []).filter((_, i) => i !== idx)
					}
				}
			)
		});
	}

	function startEditMultiEntry(skillId: string, item: string, idx: number, date: string, value: number) {
		editingMultiEntry = { skillId, item, idx };
		editMultiEntryDate = date;
		editMultiEntryValue = value;
		activeSkillLogItem = null;
	}

	function saveMultiEntry() {
		if (!student || !editingMultiEntry) return;
		const { skillId, item, idx } = editingMultiEntry;
		store.update(student.id, {
			...student,
			skills: student.skills.map((sk) =>
				sk.skillId !== skillId ? sk : {
					...sk,
					itemEntries: {
						...(sk.itemEntries ?? {}),
						[item]: ((sk.itemEntries ?? {})[item] ?? [])
							.map((e, i) => i === idx ? { date: editMultiEntryDate, value: editMultiEntryValue } : e)
							.sort((a, b) => a.date.localeCompare(b.date))
					}
				}
			)
		});
		editingMultiEntry = null;
	}

	const assignedSkillIds = $derived(new Set((student?.skills ?? []).map((sk) => sk.skillId)));
	const availableSkills = $derived(store.skillBank.filter((s) => !assignedSkillIds.has(s.id)));
	const filteredAvailableSkills = $derived.by(() => {
		const q = assignSkillSearch.trim().toLowerCase();
		if (!q) return availableSkills;
		return availableSkills.filter(
			(s) => s.name.toLowerCase().includes(q) || s.category.toLowerCase().includes(q)
		);
	});
	const availableSkillCategories = $derived([
		...new Set(filteredAvailableSkills.map((s) => s.category))
	].sort());
	function availableSkillsInCategory(cat: string) {
		return filteredAvailableSkills.filter((s) => s.category === cat);
	}
	const assignedCategories = $derived.by(() => {
		if (!student) return [];
		const cats = student.skills
			.map((sk) => store.skillBank.find((b) => b.id === sk.skillId)?.category)
			.filter((c): c is string => !!c);
		return [...new Set(cats)].sort();
	});

	function toggleSelectToAssign(skillId: string) {
		const next = new Set(selectedToAssign);
		if (next.has(skillId)) next.delete(skillId);
		else next.add(skillId);
		selectedToAssign = next;
	}

	function toggleSelectAllInCategory(cat: string) {
		const idsInCat = availableSkillsInCategory(cat).map((s) => s.id);
		const allSelected = idsInCat.every((id) => selectedToAssign.has(id));
		const next = new Set(selectedToAssign);
		if (allSelected) idsInCat.forEach((id) => next.delete(id));
		else idsInCat.forEach((id) => next.add(id));
		selectedToAssign = next;
	}

	function assignSelectedSkills() {
		if (!student || selectedToAssign.size === 0) return;
		const newSkills = [...selectedToAssign].map((skillId) => ({
			skillId,
			status: 'not_started' as const,
			entries: [],
			itemEntries: {},
			notes: ''
		}));
		store.update(student.id, {
			...student,
			skills: [...student.skills, ...newSkills]
		});
		selectedToAssign = new Set();
		showAssignSkill = false;
		assignSkillSearch = '';
	}

	function closeAssignSkill() {
		showAssignSkill = false;
		assignSkillSearch = '';
		selectedToAssign = new Set();
	}

	function startEditSkillNotes(skillId: string, current: string) {
		editingSkillNotes = skillId;
		skillNotesInput = current;
	}

	function saveSkillNotes(skillId: string) {
		if (!student) return;
		store.update(student.id, {
			...student,
			skills: student.skills.map((sk) => (sk.skillId !== skillId ? sk : { ...sk, notes: skillNotesInput }))
		});
		editingSkillNotes = null;
	}

	function removeStudentSkill(skillId: string) {
		if (!student) return;
		store.update(student.id, {
			...student,
			skills: student.skills.filter((sk) => sk.skillId !== skillId)
		});
	}

	function setSkillStatus(skillId: string, status: SkillStatus) {
		if (!student) return;
		store.update(student.id, {
			...student,
			skills: student.skills.map((sk) => {
				if (sk.skillId !== skillId || sk.status === status) return sk;
				const entry: StatusChangeEntry = { date: new Date().toISOString(), from: sk.status, to: status, by: 'tutor' };
				return { ...sk, status, statusHistory: [...(sk.statusHistory ?? []), entry] };
			})
		});
	}

	function openSkillLog(skillId: string, lastValue: number) {
		activeSkillLog = skillId;
		skillLogDate = today;
		skillLogValue = lastValue;
		editingSkillEntry = null;
	}

	function deleteSkillEntry(skillId: string, idx: number) {
		if (!student) return;
		store.update(student.id, {
			...student,
			skills: student.skills.map((sk) =>
				sk.skillId !== skillId ? sk : { ...sk, entries: sk.entries.filter((_, i) => i !== idx) }
			)
		});
	}

	function startEditSkillEntry(skillId: string, idx: number, date: string, value: number) {
		editingSkillEntry = { skillId, idx };
		editSkillEntryDate = date;
		editSkillEntryValue = value;
		activeSkillLog = null;
	}

	function saveSkillEntry() {
		if (!student || !editingSkillEntry) return;
		const { skillId, idx } = editingSkillEntry;
		store.update(student.id, {
			...student,
			skills: student.skills.map((sk) =>
				sk.skillId !== skillId ? sk : {
					...sk,
					entries: sk.entries
						.map((e, i) => i === idx ? { date: editSkillEntryDate, value: editSkillEntryValue } : e)
						.sort((a, b) => a.date.localeCompare(b.date))
				}
			)
		});
		editingSkillEntry = null;
	}

	function submitSkillLog(skillId: string) {
		if (!student || isNaN(skillLogValue)) return;
		store.update(student.id, {
			...student,
			skills: student.skills.map((sk) =>
				sk.skillId !== skillId ? sk : {
					...sk,
					entries: [...sk.entries, { date: skillLogDate, value: skillLogValue }]
						.sort((a, b) => a.date.localeCompare(b.date))
				}
			)
		});
		activeSkillLog = null;
	}

	const STATUS_LABELS: Record<SkillStatus, string> = {
		not_started: 'Not started',
		working: 'Working',
		mastered: 'Mastered'
	};
	const STATUS_ACTIVE: Record<SkillStatus, string> = {
		not_started: 'bg-ctp-surface2 text-ctp-subtext1',
		working: 'bg-ctp-yellow/20 text-ctp-yellow border border-ctp-yellow/30',
		mastered: 'bg-ctp-green/20 text-ctp-green border border-ctp-green/30'
	};

	// ── Clipboard ────────────────────────────────────────────────
	let copied = $state<string | null>(null);

	async function copy(text: string, key: string) {
		await navigator.clipboard.writeText(text);
		copied = key;
		setTimeout(() => {
			if (copied === key) copied = null;
		}, 1500);
	}

	// ── AI-friendly skills summary ─────────────────────────────────
	function aiStatusLabel(def: SkillBankItem, sk: StudentSkill): string {
		return SKILL_STATUS_LABEL[computeSkillStatus(def, sk)];
	}

	function buildAiSkillsSummary(categoryFilter?: string): string {
		if (!student) return '';
		const cats = categoryFilter ? [categoryFilter] : assignedCategories;
		const lines: string[] = [`# ${student.name} — ${categoryFilter ?? 'Skills Summary'}`, ''];

		for (const cat of cats) {
			if (!categoryFilter) lines.push(`## ${cat}`);
			const catSkills = student.skills.filter(
				(sk) => store.skillBank.find((b) => b.id === sk.skillId)?.category === cat
			);
			for (const sk of catSkills) {
				const def = store.skillBank.find((b) => b.id === sk.skillId);
				if (!def) continue;
				lines.push(`- ${def.name} — **${aiStatusLabel(def, sk)}**`);

				if (def.type === 'scored') {
					const last = sk.entries.at(-1);
					if (last) {
						const goalStr = def.goal !== undefined ? ` (goal: ${def.goal}${def.unit ? ' ' + def.unit : ''})` : '';
						lines.push(`  Last result: ${last.value}${def.unit ? ' ' + def.unit : ''}${goalStr}`);
					}
				} else if (def.type === 'multi') {
					for (const item of def.items ?? []) {
						const last = (sk.itemEntries?.[item] ?? []).at(-1);
						if (!last) {
							lines.push(`  - ${item}: not started`);
						} else {
							const met =
								def.goal !== undefined &&
								(def.higherIsBetter ? last.value >= def.goal : last.value <= def.goal);
							const goalStr = def.goal !== undefined ? ` (goal: ${def.goal}${def.unit ? ' ' + def.unit : ''})` : '';
							lines.push(`  - ${item}: ${last.value}${def.unit ? ' ' + def.unit : ''}${goalStr}${met ? ' ✓' : ''}`);
						}
					}
				}

				if (def.description) lines.push(`  ${def.description}`);
				if (def.example) lines.push(`  Example: ${def.example}`);
				if (sk.notes) lines.push(`  Note: ${sk.notes}`);
			}
			lines.push('');
		}

		return lines.join('\n').trim();
	}

	async function copySkillsForAI(category: string) {
		const text = buildAiSkillsSummary(category);
		if (!text) return;
		await copy(text, `ai-skills-${category}`);
	}

	// ── Password reveal ──────────────────────────────────────────
	let revealed = $state<Set<string>>(new Set());

	function toggleReveal(key: string) {
		const next = new Set(revealed);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		revealed = next;
	}

	// ── Student contact (phone/email) ─────────────────────────────
	let editingStudentContact = $state(false);
	let studentPhoneInput = $state('');
	let studentEmailInput = $state('');

	function startEditStudentContact() {
		if (!student) return;
		studentPhoneInput = student.phone;
		studentEmailInput = student.email;
		editingStudentContact = true;
	}

	function saveStudentContact() {
		if (!student) return;
		store.update(student.id, { ...student, phone: studentPhoneInput.trim(), email: studentEmailInput.trim() });
		editingStudentContact = false;
	}

	// ── Parent/guardian contacts ───────────────────────────────────
	let inlineContactId = $state<string | null>(null);
	let inlineContactName = $state('');
	let inlineContactRelationship = $state('');
	let inlineContactPhone = $state('');
	let inlineContactEmail = $state('');

	function addContactInline() {
		if (!student) return;
		const newIndex = student.contacts.length;
		store.update(student.id, {
			...student,
			contacts: [...student.contacts, { name: '', relationship: '', phone: '', email: '' }]
		});
		inlineContactId = 'idx-' + newIndex;
		inlineContactName = '';
		inlineContactRelationship = '';
		inlineContactPhone = '';
		inlineContactEmail = '';
	}

	function startEditContactInline(i: number) {
		if (!student) return;
		const c = student.contacts[i];
		inlineContactId = 'idx-' + i;
		inlineContactName = c.name;
		inlineContactRelationship = c.relationship;
		inlineContactPhone = c.phone;
		inlineContactEmail = c.email;
	}

	function saveContactInline(i: number) {
		if (!student) return;
		store.update(student.id, {
			...student,
			contacts: student.contacts.map((c, idx) =>
				idx !== i ? c : { name: inlineContactName, relationship: inlineContactRelationship, phone: inlineContactPhone, email: inlineContactEmail }
			)
		});
		inlineContactId = null;
	}

	function removeContactInline(i: number) {
		if (!student) return;
		store.update(student.id, { ...student, contacts: student.contacts.filter((_, idx) => idx !== i) });
		inlineContactId = null;
	}

	// ── School login + extra logins ("Logins" section) ─────────────
	let editingSchoolLogin = $state(false);
	let schoolLoginUrl = $state('');
	let schoolLoginUsername = $state('');
	let schoolLoginPassword = $state('');

	function startEditSchoolLogin() {
		if (!student) return;
		schoolLoginUrl = student.schoolUrl;
		schoolLoginUsername = student.username;
		schoolLoginPassword = student.password;
		editingSchoolLogin = true;
	}

	function saveSchoolLogin() {
		if (!student) return;
		store.update(student.id, { ...student, schoolUrl: schoolLoginUrl.trim(), username: schoolLoginUsername.trim(), password: schoolLoginPassword });
		editingSchoolLogin = false;
	}

	let inlineLoginId = $state<string | null>(null);
	let inlineLoginSite = $state('');
	let inlineLoginUrl = $state('');
	let inlineLoginUsername = $state('');
	let inlineLoginPassword = $state('');

	function addExtraLoginInline() {
		if (!student) return;
		const id = crypto.randomUUID();
		store.update(student.id, {
			...student,
			extraLogins: [...student.extraLogins, { id, site: '', url: '', username: '', password: '' }]
		});
		inlineLoginId = id;
		inlineLoginSite = '';
		inlineLoginUrl = '';
		inlineLoginUsername = '';
		inlineLoginPassword = '';
	}

	function startEditExtraLoginInline(login: { id: string; site: string; url: string; username: string; password: string }) {
		inlineLoginId = login.id;
		inlineLoginSite = login.site;
		inlineLoginUrl = login.url;
		inlineLoginUsername = login.username;
		inlineLoginPassword = login.password;
	}

	function saveExtraLoginInline() {
		if (!student || !inlineLoginId) return;
		const id = inlineLoginId;
		store.update(student.id, {
			...student,
			extraLogins: student.extraLogins.map((l) =>
				l.id !== id ? l : { ...l, site: inlineLoginSite, url: inlineLoginUrl, username: inlineLoginUsername, password: inlineLoginPassword }
			)
		});
		inlineLoginId = null;
	}

	function removeExtraLoginInline(id: string) {
		if (!student) return;
		store.update(student.id, { ...student, extraLogins: student.extraLogins.filter((l) => l.id !== id) });
		if (inlineLoginId === id) inlineLoginId = null;
	}

	// ── Grades: view-mode logging (saves immediately) ────────────
	let activeCourseLog = $state<string | null>(null);
	let logDate = $state(today);
	let logGradeInput = $state<number>(0);

	function openLog(courseId: string) {
		activeCourseLog = courseId;
		logDate = today;
		logGradeInput = 0;
	}

	function submitLog() {
		if (!student || !activeCourseLog || isNaN(logGradeInput)) return;
		const updated = {
			...student,
			courses: student.courses.map((c) =>
				c.id === activeCourseLog
					? {
							...c,
							entries: [...c.entries, { date: logDate, grade: logGradeInput }].sort((a, b) =>
								a.date.localeCompare(b.date)
							)
						}
					: c
			)
		};
		store.update(student.id, updated);
		activeCourseLog = null;
	}

	// ── Grades: course management (inline) ────────────────────────
	let inlineCourseId = $state<string | null>(null);
	let inlineCourseName = $state('');

	function addCourseInline() {
		if (!student) return;
		const id = crypto.randomUUID();
		store.update(student.id, {
			...student,
			courses: [
				...student.courses,
				{ id, name: '', color: COURSE_COLORS[student.courses.length % COURSE_COLORS.length], entries: [] }
			]
		});
		inlineCourseId = id;
		inlineCourseName = '';
	}

	function startEditCourseInline(course: { id: string; name: string }) {
		inlineCourseId = course.id;
		inlineCourseName = course.name;
	}

	function saveCourseInline() {
		if (!student || !inlineCourseId) return;
		const id = inlineCourseId;
		store.update(student.id, {
			...student,
			courses: student.courses.map((c) => (c.id !== id ? c : { ...c, name: inlineCourseName }))
		});
		inlineCourseId = null;
	}

	function removeCourse(id: string) {
		if (!student) return;
		store.update(student.id, { ...student, courses: student.courses.filter((c) => c.id !== id) });
		if (inlineCourseId === id) inlineCourseId = null;
	}

	function removeGradeEntry(courseId: string, entryIdx: number) {
		if (!student) return;
		store.update(student.id, {
			...student,
			courses: student.courses.map((c) =>
				c.id === courseId ? { ...c, entries: c.entries.filter((_, i) => i !== entryIdx) } : c
			)
		});
	}

	let expandedCourseHistory = $state<Set<string>>(new Set());

	function toggleCourseHistory(courseId: string) {
		const next = new Set(expandedCourseHistory);
		if (next.has(courseId)) next.delete(courseId);
		else next.add(courseId);
		expandedCourseHistory = next;
	}

	function autoselect(node: HTMLInputElement) {
		node.focus();
		node.select();
	}

	// ── Big projects ─────────────────────────────────────────────
	let inlineProjectId = $state<string | null>(null);
	let inlineProjectTitle = $state('');
	let inlineProjectStart = $state(today);
	let inlineProjectDue = $state(today);
	let editingNotes = $state(false);
	let notesInput = $state('');

	// ── Homework ─────────────────────────────────────────────────
	let inlineHomeworkId = $state<string | null>(null);
	let inlineHomeworkTitle = $state('');
	let inlineHomeworkDue = $state(today);
	let inlineHomeworkCourseId = $state('');
	let inlineHomeworkNotes = $state('');

	const HOMEWORK_STATUS_ACTIVE: Record<HomeworkStatus, string> = {
		not_started: 'bg-ctp-surface2 text-ctp-subtext1',
		working: 'bg-ctp-yellow/20 text-ctp-yellow border border-ctp-yellow/30',
		completed: 'bg-ctp-green/20 text-ctp-green border border-ctp-green/30'
	};

	function homeworkUrgencyBorder(hw: HomeworkItem): string {
		if (hw.status === 'completed') return 'border-l-ctp-green/60';
		if (!hw.dueDate) return 'border-l-ctp-surface1';
		if (hw.dueDate < today) return 'border-l-ctp-red';
		const daysLeft = Math.ceil((new Date(hw.dueDate + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24));
		if (daysLeft <= 1) return 'border-l-ctp-red';
		if (daysLeft <= 3) return 'border-l-ctp-yellow';
		return 'border-l-ctp-surface1';
	}

	function addHomeworkInline() {
		if (!student) return;
		const id = crypto.randomUUID();
		store.update(student.id, {
			...student,
			homework: [
				...student.homework,
				{ id, title: '', dueDate: today, notes: '', status: 'not_started', addedDate: today }
			]
		});
		inlineHomeworkId = id;
		inlineHomeworkTitle = '';
		inlineHomeworkDue = today;
		inlineHomeworkCourseId = '';
		inlineHomeworkNotes = '';
	}

	function startEditHomeworkInline(hw: HomeworkItem) {
		inlineHomeworkId = hw.id;
		inlineHomeworkTitle = hw.title;
		inlineHomeworkDue = hw.dueDate;
		inlineHomeworkCourseId = hw.courseId ?? '';
		inlineHomeworkNotes = hw.notes;
	}

	function saveHomeworkInline() {
		if (!student || !inlineHomeworkId) return;
		const id = inlineHomeworkId;
		store.update(student.id, {
			...student,
			homework: student.homework.map((h) =>
				h.id !== id
					? h
					: { ...h, title: inlineHomeworkTitle, dueDate: inlineHomeworkDue, courseId: inlineHomeworkCourseId || undefined, notes: inlineHomeworkNotes }
			)
		});
		inlineHomeworkId = null;
	}

	function removeHomeworkInline(id: string) {
		if (!student) return;
		store.update(student.id, { ...student, homework: student.homework.filter((h) => h.id !== id) });
		if (inlineHomeworkId === id) inlineHomeworkId = null;
	}

	function setHomeworkStatus(id: string, status: HomeworkStatus) {
		if (!student) return;
		store.update(student.id, {
			...student,
			homework: student.homework.map((h) => {
				if (h.id !== id || h.status === status) return h;
				return { ...h, status, completedDate: status === 'completed' ? new Date().toISOString() : h.completedDate };
			})
		});
	}

	function copyHomework(hw: HomeworkItem) {
		if (!student) return;
		const course = student.courses.find((c) => c.id === hw.courseId);
		const lines = [
			hw.title || 'Untitled',
			course?.name,
			hw.dueDate ? `Due: ${new Date(hw.dueDate + 'T00:00:00').toLocaleDateString()}` : null,
			hw.notes || null
		].filter((l): l is string => !!l);
		copy(lines.join('\n'), `hw-${hw.id}`);
	}

	function addProjectInline() {
		if (!student) return;
		const id = crypto.randomUUID();
		store.update(student.id, {
			...student,
			projects: [...student.projects, { id, title: '', startDate: today, dueDate: today }]
		});
		inlineProjectId = id;
		inlineProjectTitle = '';
		inlineProjectStart = today;
		inlineProjectDue = today;
	}

	function startEditProject(project: BigProject) {
		inlineProjectId = project.id;
		inlineProjectTitle = project.title;
		inlineProjectStart = project.startDate;
		inlineProjectDue = project.dueDate;
	}

	function saveProjectInline() {
		if (!student || !inlineProjectId) return;
		const id = inlineProjectId;
		store.update(student.id, {
			...student,
			projects: student.projects.map((p) =>
				p.id !== id ? p : { ...p, title: inlineProjectTitle, startDate: inlineProjectStart, dueDate: inlineProjectDue }
			)
		});
		inlineProjectId = null;
	}

	function removeProjectInline(id: string) {
		if (!student) return;
		store.update(student.id, {
			...student,
			projects: student.projects.filter((p) => p.id !== id)
		});
		if (inlineProjectId === id) inlineProjectId = null;
	}

	function startEditNotes() {
		notesInput = student?.notes ?? '';
		editingNotes = true;
	}

	function saveNotes() {
		if (!student) return;
		store.update(student.id, { ...student, notes: notesInput });
		editingNotes = false;
	}

	let shareCopied = $state(false);
	let shareError = $state(false);

	async function copyShareLink() {
		if (!student) return;
		const url = await getOrCreateShareUrl(student.id);
		if (!url) {
			shareError = true;
			setTimeout(() => (shareError = false), 2500);
			return;
		}
		await navigator.clipboard.writeText(url);
		shareCopied = true;
		setTimeout(() => (shareCopied = false), 2000);
	}

	function getProgress(project: BigProject) {
		if (!project.startDate || !project.dueDate) return { pct: 0, daysLeft: null, overdue: false };
		const now = Date.now();
		const start = new Date(project.startDate).getTime();
		const due = new Date(project.dueDate).getTime();
		if (due <= start) return { pct: 0, daysLeft: null, overdue: false };
		const pct = Math.min(100, Math.max(0, ((now - start) / (due - start)) * 100));
		const daysLeft = Math.ceil((due - now) / (1000 * 60 * 60 * 24));
		return { pct, daysLeft, overdue: daysLeft < 0 };
	}

	function barColor(daysLeft: number | null, overdue: boolean): string {
		if (overdue) return 'bg-ctp-red';
		if (daysLeft === null) return 'bg-ctp-surface2';
		if (daysLeft <= 3) return 'bg-ctp-red';
		if (daysLeft <= 7) return 'bg-ctp-yellow';
		return 'bg-ctp-green';
	}

	const inputClass =
		'w-full rounded border border-ctp-surface2 bg-ctp-surface1 px-3 py-1.5 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-blue focus:outline-none focus:ring-1 focus:ring-ctp-blue/30';
	const miniInputClass =
		'rounded border border-ctp-surface2 bg-ctp-surface1 px-2 py-1 text-xs text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-blue focus:outline-none';
</script>

{#if !student}
	<div class="flex min-h-screen items-center justify-center bg-ctp-base">
		<div class="text-center">
			<p class="mb-4 text-ctp-subtext0">Student not found.</p>
			<a href="/" class="text-sm text-ctp-blue hover:underline">← Back to Students</a>
		</div>
	</div>
{:else}
	{@const s = student}

	<div class="min-h-screen bg-ctp-base">
		<!-- Header -->
		<header class="border-b border-ctp-surface0 bg-ctp-mantle px-6 py-4">
			<div class="mx-auto max-w-3xl">
				<div class="mb-3 flex items-center justify-between">
					<div class="flex items-center gap-3">
						<a href="/" class="text-sm text-ctp-subtext0 hover:text-ctp-text">← Students</a>
						<span class="h-4 w-px bg-ctp-surface2"></span>
						<a href="/skills" class="text-sm text-ctp-subtext0 hover:text-ctp-text">Skill Bank</a>
					</div>
					<div class="flex gap-2">
						<button
							onclick={() => store.toggleHiatus(student.id)}
							class="rounded border px-3 py-1.5 text-sm transition-colors {student.hiatus
								? 'border-ctp-yellow/40 bg-ctp-yellow/10 text-ctp-yellow hover:bg-ctp-yellow/20'
								: 'border-ctp-surface2 text-ctp-subtext1 hover:bg-ctp-surface0'}"
						>
							{student.hiatus ? '▶ Resume Student' : '⏸ Pause Student'}
						</button>
						<button
							onclick={copyShareLink}
							class="rounded border px-3 py-1.5 text-sm transition-colors {shareCopied ? 'border-ctp-green/40 text-ctp-green' : shareError ? 'border-ctp-red/40 text-ctp-red' : 'border-ctp-surface2 text-ctp-subtext1 hover:bg-ctp-surface0'}"
						>
							{shareCopied ? '✓ Copied!' : shareError ? 'Failed' : 'Share'}
						</button>
					</div>
				</div>

				<div class="flex flex-wrap items-baseline gap-3">
					{#if editingHeader}
						<input bind:value={headerName} class="{inputClass} text-2xl font-bold" placeholder="Name"
							onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveHeader(); } if (e.key === 'Escape') { e.preventDefault(); editingHeader = false; } }} />
					{:else}
						<div class="flex items-center gap-2.5">
							<span
								class="h-3.5 w-3.5 shrink-0 rounded-full"
								style="background: {student.color}"
							></span>
							<h1 class="text-2xl font-bold text-ctp-text">{student.name}</h1>
							<button onclick={startEditHeader} class="text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors" title="Edit">✎</button>
						</div>
					{/if}
					<div class="flex flex-wrap items-center gap-2">
						{#if editingHeader}
							<input
								type="number"
								bind:value={headerGrade}
								min="1"
								max="12"
								class="w-20 rounded px-2 py-0.5 text-sm"
								placeholder="Grade"
							/>
							<input
								bind:value={headerSchool}
								class="rounded px-2 py-0.5 text-sm"
								placeholder="School"
							/>
							<div class="flex flex-wrap gap-1">
								{#each WEEK_DAYS as day}
									<button
										type="button"
										onclick={() => toggleHeaderDay(day)}
										class="{headerDays.includes(day)
											? 'bg-ctp-blue text-ctp-crust'
											: 'bg-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface2'} rounded px-1.5 py-0.5 text-xs font-medium transition-colors"
									>
										{DAY_ABBR[day]}
									</button>
								{/each}
							</div>
							<button onclick={saveHeader} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
							<button onclick={() => (editingHeader = false)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
						{:else}
							{#if student.grade}
								<span class="rounded-full bg-ctp-surface1 px-2.5 py-0.5 text-xs font-medium text-ctp-subtext0">
									Grade {student.grade}
								</span>
							{/if}
							{#if student.school}
								<span class="rounded-full bg-ctp-blue/20 px-2.5 py-0.5 text-xs font-medium text-ctp-blue">
									{student.school}
								</span>
							{/if}
							{#each student.days as day}
								<span class="rounded-full bg-ctp-green/20 px-2.5 py-0.5 text-xs font-medium text-ctp-green">
									{day}
								</span>
							{/each}
							{#if student.hiatus}
								<span class="rounded-full bg-ctp-yellow/20 px-2.5 py-0.5 text-xs font-medium text-ctp-yellow">
									On Hiatus
								</span>
							{/if}
						{/if}
					</div>
				</div>
			</div>
		</header>

		<main class="mx-auto max-w-3xl space-y-4 p-6">
			<!-- Logins -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Logins</h2>
					{#if !editingSchoolLogin}
						<button onclick={startEditSchoolLogin} class="text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors" title="Edit school login">✎</button>
					{/if}
				</div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-ctp-overlay1">School</p>
				<div class="space-y-2">
					<div class="flex items-center gap-3">
						<span class="w-20 shrink-0 text-xs font-medium text-ctp-overlay1">URL</span>
						{#if editingSchoolLogin}
							<input bind:value={schoolLoginUrl} class={inputClass} placeholder="https://..." />
						{:else}
							<a
								href={student.schoolUrl}
								target="_blank"
								rel="noopener noreferrer"
								class="flex-1 truncate text-sm text-ctp-blue hover:underline"
							>
								{student.schoolUrl || '—'}
							</a>
							{#if student.schoolUrl}
								<button
									onclick={() => copy(student.schoolUrl, 'main-url')}
									class="{copied === 'main-url'
										? 'bg-ctp-green/20 text-ctp-green'
										: 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors"
								>
									{copied === 'main-url' ? '✓ Copied' : 'Copy'}
								</button>
							{/if}
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<span class="w-20 shrink-0 text-xs font-medium text-ctp-overlay1">Username</span>
						{#if editingSchoolLogin}
							<input bind:value={schoolLoginUsername} class={inputClass} />
						{:else}
							<span class="flex-1 text-sm text-ctp-text">{student.username || '—'}</span>
							{#if student.username}
								<button
									onclick={() => copy(student.username, 'main-user')}
									class="{copied === 'main-user'
										? 'bg-ctp-green/20 text-ctp-green'
										: 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors"
								>
									{copied === 'main-user' ? '✓ Copied' : 'Copy'}
								</button>
							{/if}
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<span class="w-20 shrink-0 text-xs font-medium text-ctp-overlay1">Password</span>
						{#if editingSchoolLogin}
							<input bind:value={schoolLoginPassword} class={inputClass} />
						{:else}
							<span class="flex-1 font-mono text-sm text-ctp-text">
								{revealed.has('main-pw') ? student.password : '••••••••'}
							</span>
							{#if student.password}
								<button
									onclick={() => toggleReveal('main-pw')}
									class="shrink-0 rounded px-2 py-1 text-xs text-ctp-overlay0 transition-colors hover:bg-ctp-surface1"
								>
									{revealed.has('main-pw') ? 'Hide' : 'Show'}
								</button>
								<button
									onclick={() => copy(student.password, 'main-pw')}
									class="{copied === 'main-pw'
										? 'bg-ctp-green/20 text-ctp-green'
										: 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} shrink-0 rounded px-2 py-1 text-xs font-medium transition-colors"
								>
									{copied === 'main-pw' ? '✓ Copied' : 'Copy'}
								</button>
							{/if}
						{/if}
					</div>
					{#if editingSchoolLogin}
						<div class="flex gap-2">
							<button onclick={saveSchoolLogin} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
							<button onclick={() => (editingSchoolLogin = false)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
						</div>
					{/if}
				</div>

				<div class="mt-4 flex items-center justify-between border-t border-ctp-surface1 pt-3">
					<p class="text-xs font-semibold uppercase tracking-wide text-ctp-overlay1">Extra logins</p>
					<button onclick={addExtraLoginInline} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">+ Add</button>
				</div>
				{#if s.extraLogins.length === 0}
					<p class="mt-1 text-sm text-ctp-overlay0">—</p>
				{:else}
					<div class="mt-2 space-y-3">
						{#each s.extraLogins as login (login.id)}
							<div class="rounded-lg border border-ctp-surface1 p-3">
								{#if inlineLoginId === login.id}
									<div class="grid grid-cols-2 gap-2">
										<input bind:value={inlineLoginSite} class={inputClass} placeholder="Site name" />
										<input bind:value={inlineLoginUrl} class={inputClass} placeholder="URL" />
										<input bind:value={inlineLoginUsername} class={inputClass} placeholder="Username" />
										<input bind:value={inlineLoginPassword} class={inputClass} placeholder="Password" />
									</div>
									<div class="mt-2 flex items-center gap-2">
										<button onclick={saveExtraLoginInline} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
										<button onclick={() => (inlineLoginId = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
										<button onclick={() => removeExtraLoginInline(login.id)} class="ml-auto text-xs text-ctp-red/60 hover:text-ctp-red transition-colors">Remove</button>
									</div>
								{:else}
									<div class="flex items-center justify-between">
										<div>
											<p class="font-medium text-ctp-text">{login.site || 'Unnamed'}</p>
											{#if login.url}
												<a
													href={login.url}
													target="_blank"
													rel="noopener noreferrer"
													class="text-xs text-ctp-blue hover:underline">{login.url}</a
												>
											{/if}
										</div>
										<div class="flex items-center gap-1.5">
											<button
												onclick={() => copy(login.url, login.id + '-url')}
												class="{copied === login.id + '-url'
													? 'bg-ctp-green/20 text-ctp-green'
													: 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} rounded px-2 py-1 text-xs font-medium transition-colors"
											>
												{copied === login.id + '-url' ? '✓' : 'URL'}
											</button>
											<button
												onclick={() => copy(login.username, login.id + '-user')}
												class="{copied === login.id + '-user'
													? 'bg-ctp-green/20 text-ctp-green'
													: 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} rounded px-2 py-1 text-xs font-medium transition-colors"
											>
												{copied === login.id + '-user' ? '✓' : 'User'}
											</button>
											<button
												onclick={() => copy(login.password, login.id + '-pw')}
												class="{copied === login.id + '-pw'
													? 'bg-ctp-green/20 text-ctp-green'
													: 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} rounded px-2 py-1 font-mono text-xs font-medium transition-colors"
											>
												{copied === login.id + '-pw' ? '✓' : '••••'}
											</button>
											<button onclick={() => startEditExtraLoginInline(login)} class="text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors" title="Edit">✎</button>
										</div>
									</div>
									<div class="mt-1 text-sm text-ctp-subtext0">
										{login.username || '—'} ·
										<span class="font-mono">
											{revealed.has(login.id)
												? login.password
												: login.password
													? '••••••••'
													: '—'}
										</span>
										{#if login.password}
											<button
												onclick={() => toggleReveal(login.id)}
												class="ml-1 text-xs text-ctp-overlay0 hover:text-ctp-subtext0"
											>
												{revealed.has(login.id) ? 'hide' : 'show'}
											</button>
										{/if}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Contacts -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Contacts</h2>
					{#if !editingStudentContact}
						<button onclick={startEditStudentContact} class="text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors" title="Edit student contact">✎</button>
					{/if}
				</div>
				<p class="mb-2 text-xs font-semibold uppercase tracking-wide text-ctp-overlay1">Student</p>
				<div class="space-y-2">
					<div class="flex items-center gap-3">
						<span class="w-20 shrink-0 text-xs font-medium text-ctp-overlay1">Phone</span>
						{#if editingStudentContact}
							<input bind:value={studentPhoneInput} type="tel" class={inputClass} />
						{:else}
							<span class="text-sm text-ctp-text">{s.phone || '—'}</span>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<span class="w-20 shrink-0 text-xs font-medium text-ctp-overlay1">Email</span>
						{#if editingStudentContact}
							<input bind:value={studentEmailInput} type="email" class={inputClass} />
						{:else if s.email}
							<button
								onclick={() => copy(s.email, 'student-email')}
								class="{copied === 'student-email'
									? 'text-ctp-green'
									: 'text-ctp-blue hover:text-ctp-lavender'} text-sm transition-colors"
							>
								{copied === 'student-email' ? '✓ Copied' : s.email}
							</button>
						{:else}
							<span class="text-sm text-ctp-text">—</span>
						{/if}
					</div>
					{#if editingStudentContact}
						<div class="flex gap-2">
							<button onclick={saveStudentContact} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
							<button onclick={() => (editingStudentContact = false)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
						</div>
					{/if}
				</div>

				<div class="mt-4 flex items-center justify-between border-t border-ctp-surface1 pt-3">
					<p class="text-xs font-semibold uppercase tracking-wide text-ctp-overlay1">Parent / guardian</p>
					<button onclick={addContactInline} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">+ Add</button>
				</div>
				{#if s.contacts.length === 0}
					<p class="mt-1 text-sm text-ctp-overlay0">—</p>
				{:else}
					<div class="mt-2 space-y-3">
						{#each s.contacts as contact, i}
							<div class="rounded-lg border border-ctp-surface1 p-3">
								{#if inlineContactId === 'idx-' + i}
									<div class="grid grid-cols-2 gap-2">
										<input bind:value={inlineContactName} class={inputClass} placeholder="Name" />
										<input bind:value={inlineContactRelationship} class={inputClass} placeholder="Relationship" />
										<input bind:value={inlineContactPhone} type="tel" class={inputClass} placeholder="Phone" />
										<input bind:value={inlineContactEmail} type="email" class={inputClass} placeholder="Email" />
									</div>
									<div class="mt-2 flex items-center gap-2">
										<button onclick={() => saveContactInline(i)} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
										<button onclick={() => (inlineContactId = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
										<button onclick={() => removeContactInline(i)} class="ml-auto text-xs text-ctp-red/60 hover:text-ctp-red transition-colors">Remove</button>
									</div>
								{:else}
									<div class="flex items-start justify-between gap-2">
										<p class="font-medium text-ctp-text">
											{contact.name}
											{#if contact.relationship}
												<span class="ml-1 text-xs font-normal text-ctp-overlay0">({contact.relationship})</span>
											{/if}
										</p>
										<button onclick={() => startEditContactInline(i)} class="shrink-0 text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors" title="Edit">✎</button>
									</div>
									{#if contact.phone}
										<p class="text-sm text-ctp-subtext0">{contact.phone}</p>
									{/if}
									{#if contact.email}
										<button
											onclick={() => copy(contact.email, `c${i}-email`)}
											class="{copied === `c${i}-email`
												? 'text-ctp-green'
												: 'text-ctp-subtext0 hover:text-ctp-blue'} text-sm transition-colors"
										>
											{copied === `c${i}-email` ? '✓ Copied' : contact.email}
										</button>
									{/if}
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- ── Grades ─────────────────────────────────────────────── -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Grades</h2>
					<div class="flex items-center gap-3">
						{#if s.courses.some((c) => c.entries.length > 0)}
							{#if showResetGradesConfirm}
								<span class="text-xs text-ctp-overlay0">Clear all grade history?</span>
								<button onclick={resetGrades} class="text-xs text-ctp-red hover:opacity-80">Yes, reset</button>
								<button onclick={() => (showResetGradesConfirm = false)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
							{:else}
								<button onclick={() => (showResetGradesConfirm = true)} class="text-xs text-ctp-overlay0 hover:text-ctp-red transition-colors">Reset grades</button>
							{/if}
						{/if}
						<button onclick={addCourseInline} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">
							+ Add Course
						</button>
					</div>
				</div>

				<!-- Chart (needs at least one entry) -->
				{#if s.courses.some((c) => c.entries.length > 0)}
					<div class="mb-5">
						<GradeChart courses={s.courses} />
					</div>
				{/if}

				{#if s.courses.length === 0}
					<p class="text-sm text-ctp-overlay0">No courses added yet.</p>
				{:else}
					<div class="space-y-2">
						{#each s.courses as course (course.id)}
							<div class="rounded-lg border border-ctp-surface1 p-3">
								{#if inlineCourseId === course.id}
									<!-- Inline rename -->
									<div class="flex items-center gap-2">
										<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{course.color}"></span>
										<input
											bind:value={inlineCourseName}
											class="{inputClass} flex-1"
											placeholder="Course name (e.g. English, Math)"
											onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveCourseInline(); } if (e.key === 'Escape') { e.preventDefault(); inlineCourseId = null; } }}
										/>
										<button onclick={saveCourseInline} class="shrink-0 rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
										<button onclick={() => (inlineCourseId = null)} class="shrink-0 text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
										<button onclick={() => removeCourse(course.id)} class="shrink-0 text-xs text-ctp-red/70 hover:text-ctp-red">Remove</button>
									</div>
								{:else}
									<!-- Course row -->
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{course.color}"></span>
											<span class="font-medium text-ctp-text">{course.name || 'Unnamed course'}</span>
											{#if course.entries.length > 0}
												{@const last = course.entries[course.entries.length - 1]}
												<span class="text-sm text-ctp-overlay0">
													{last.grade}% &middot; {new Date(last.date + 'T00:00:00').toLocaleDateString('en-US', {
														month: 'short',
														day: 'numeric'
													})}
												</span>
											{:else}
												<span class="text-xs text-ctp-surface2">no entries</span>
											{/if}
											<button onclick={() => startEditCourseInline(course)} class="text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors" title="Rename / remove">✎</button>
										</div>
										{#if activeCourseLog !== course.id}
											<button
												onclick={() => openLog(course.id)}
												class="rounded bg-ctp-surface1 px-2.5 py-1 text-xs font-medium text-ctp-subtext1 hover:bg-ctp-surface2"
											>
												Log
											</button>
										{/if}
									</div>
									<!-- Inline log form -->
									{#if activeCourseLog === course.id}
										<div class="mt-2 flex flex-wrap items-center gap-2 rounded bg-ctp-surface1 px-3 py-2">
											<input
												type="date"
												bind:value={logDate}
												class={miniInputClass}
												onkeydown={(e) => {
													if (e.key === 'Enter') { e.preventDefault(); submitLog(); }
													if (e.key === 'Escape') { e.preventDefault(); activeCourseLog = null; }
												}}
											/>
											<div class="flex items-center gap-1">
												<input
													type="number"
													bind:value={logGradeInput}
													min="0"
													max="100"
													step="1"
													class="{miniInputClass} w-16 text-right"
													use:autoselect
													onkeydown={(e) => {
														if (e.key === 'Enter') { e.preventDefault(); submitLog(); }
														if (e.key === 'Escape') { e.preventDefault(); activeCourseLog = null; }
													}}
												/>
												<span class="text-xs text-ctp-overlay0">%</span>
											</div>
											{#if course.entries.length > 0}
												{@const lastGrade = course.entries[course.entries.length - 1].grade}
												<button
													onclick={() => { logGradeInput = lastGrade; submitLog(); }}
													class="rounded border border-ctp-surface2 px-2.5 py-1 text-xs text-ctp-subtext0 hover:border-ctp-overlay0 hover:text-ctp-text transition-colors"
													title="Log same grade as last entry"
												>
													↩ {lastGrade}%
												</button>
											{/if}
											<button
												onclick={submitLog}
												class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90"
											>
												Save
											</button>
											<button
												onclick={() => (activeCourseLog = null)}
												class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0"
											>
												Cancel
											</button>
										</div>
									{/if}
									<!-- Entry history -->
									{#if course.entries.length > 0}
										<button onclick={() => toggleCourseHistory(course.id)} class="mt-2 text-xs text-ctp-overlay0 hover:text-ctp-subtext0 transition-colors">
											{expandedCourseHistory.has(course.id) ? '▾' : '▸'} History ({course.entries.length})
										</button>
										{#if expandedCourseHistory.has(course.id)}
											<div class="mt-1 space-y-0.5">
												{#each [...course.entries].reverse() as entry, ri}
													{@const j = course.entries.length - 1 - ri}
													<div class="flex items-center gap-2 text-xs text-ctp-subtext0">
														<span
															>{new Date(entry.date + 'T00:00:00').toLocaleDateString('en-US', {
																month: 'short',
																day: 'numeric',
																year: 'numeric'
															})}</span
														>
														<span class="font-medium text-ctp-text">{entry.grade}%</span>
														<button
															onclick={() => removeGradeEntry(course.id, j)}
															class="text-ctp-red/40 hover:text-ctp-red"
														>
															✕
														</button>
													</div>
												{/each}
											</div>
										{/if}
									{/if}
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Big Projects -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Big Projects</h2>
					<button onclick={addProjectInline} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">+ Add</button>
				</div>
				{#if s.projects.length === 0}
					<p class="text-sm text-ctp-overlay0">No projects yet.</p>
				{:else}
					<div class="space-y-4">
						{#each s.projects as project (project.id)}
							<div>
								{#if inlineProjectId === project.id}
									<div class="space-y-2">
										<input bind:value={inlineProjectTitle} class="{inputClass} w-full" placeholder="Project title"
											onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveProjectInline(); } if (e.key === 'Escape') { e.preventDefault(); inlineProjectId = null; } }} />
										<div class="grid grid-cols-2 gap-2">
											<div>
												<label for="inline-proj-start" class="mb-1 block text-xs text-ctp-overlay0">Start</label>
												<input id="inline-proj-start" type="date" bind:value={inlineProjectStart} class={inputClass} />
											</div>
											<div>
												<label for="inline-proj-due" class="mb-1 block text-xs text-ctp-overlay0">Due</label>
												<input id="inline-proj-due" type="date" bind:value={inlineProjectDue} class={inputClass} />
											</div>
										</div>
										<div class="flex items-center gap-2">
											<button onclick={saveProjectInline} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
											<button onclick={() => (inlineProjectId = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
											<button onclick={() => removeProjectInline(project.id)} class="ml-auto text-xs text-ctp-red/60 hover:text-ctp-red transition-colors">Remove</button>
										</div>
									</div>
								{:else}
									{@const prog = getProgress(project)}
									<div class="mb-1 flex items-start justify-between gap-2">
										<p class="font-medium text-ctp-text">{project.title || 'Untitled'}</p>
										<button onclick={() => startEditProject(project)} class="shrink-0 text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors">✎</button>
									</div>
									<div class="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-ctp-surface1">
										<div class="{barColor(prog.daysLeft, prog.overdue)} h-2.5 rounded-full transition-all" style="width: {prog.pct}%"></div>
									</div>
									<div class="flex justify-between text-xs text-ctp-overlay0">
										<span>{project.startDate ? new Date(project.startDate + 'T00:00:00').toLocaleDateString() : '—'}</span>
										<span>
											{#if prog.overdue}
												<span class="font-medium text-ctp-red">Overdue</span>
											{:else if prog.daysLeft !== null}
												{prog.daysLeft} day{prog.daysLeft !== 1 ? 's' : ''} left
											{/if}
										</span>
										<span>{project.dueDate ? new Date(project.dueDate + 'T00:00:00').toLocaleDateString() : '—'}</span>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Homework -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Homework</h2>
					<button onclick={addHomeworkInline} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">+ Add</button>
				</div>
				{#if s.homework.length === 0}
					<p class="text-sm text-ctp-overlay0">No homework yet.</p>
				{:else}
					<div class="space-y-3">
						{#each s.homework as hw (hw.id)}
							{@const overdue = hw.status !== 'completed' && !!hw.dueDate && hw.dueDate < today}
							<div class="rounded-lg border border-ctp-surface1 border-l-4 {homeworkUrgencyBorder(hw)} p-3 {overdue ? 'bg-ctp-red/5' : ''}">
								{#if inlineHomeworkId === hw.id}
									<div class="space-y-2">
										<input
											bind:value={inlineHomeworkTitle}
											class={inputClass}
											placeholder="Assignment title"
											onkeydown={(e) => {
												if (e.key === 'Escape') {
													e.preventDefault();
													inlineHomeworkId = null;
												}
											}}
										/>
										<div class="grid grid-cols-2 gap-2">
											<div>
												<label for="inline-hw-due" class="mb-1 block text-xs text-ctp-overlay0">Due</label>
												<input id="inline-hw-due" type="date" bind:value={inlineHomeworkDue} class={inputClass} />
											</div>
											<div>
												<label for="inline-hw-course" class="mb-1 block text-xs text-ctp-overlay0">Course</label>
												<select id="inline-hw-course" bind:value={inlineHomeworkCourseId} class={inputClass}>
													<option value="">—</option>
													{#each student.courses as c}
														<option value={c.id}>{c.name}</option>
													{/each}
												</select>
											</div>
										</div>
										<textarea bind:value={inlineHomeworkNotes} class="{inputClass} min-h-16" placeholder="Instructions / notes"></textarea>
										<div class="flex items-center gap-2">
											<button onclick={saveHomeworkInline} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
											<button onclick={() => (inlineHomeworkId = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
											<button onclick={() => removeHomeworkInline(hw.id)} class="ml-auto text-xs text-ctp-red/60 hover:text-ctp-red transition-colors">Remove</button>
										</div>
									</div>
								{:else}
									{@const course = student.courses.find((c) => c.id === hw.courseId)}
									<div class="mb-1.5 flex items-start justify-between gap-2">
										<div>
											<div class="flex items-center gap-2">
												{#if course}<span class="h-2 w-2 shrink-0 rounded-full" style="background:{course.color}"></span>{/if}
												<p class="font-medium text-ctp-text">{hw.title || 'Untitled'}</p>
											</div>
											{#if course}<p class="text-xs text-ctp-overlay0">{course.name}</p>{/if}
										</div>
										<div class="flex shrink-0 items-center gap-2">
											<button
												onclick={() => copyHomework(hw)}
												class="text-xs transition-colors {copied === `hw-${hw.id}` ? 'text-ctp-green' : 'text-ctp-overlay0/60 hover:text-ctp-subtext0'}"
											>
												{copied === `hw-${hw.id}` ? '✓' : 'Copy'}
											</button>
											<button onclick={() => startEditHomeworkInline(hw)} class="text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors">✎</button>
										</div>
									</div>
									{#if hw.dueDate}
										<p class="mb-2 text-xs {overdue ? 'font-medium text-ctp-red' : 'text-ctp-overlay0'}">
											Due {new Date(hw.dueDate + 'T00:00:00').toLocaleDateString()}{overdue ? ' — overdue' : ''}
										</p>
									{/if}
									{#if hw.notes}
										<p class="mb-2 whitespace-pre-wrap text-sm text-ctp-subtext1">{hw.notes}</p>
									{/if}
									<div class="flex gap-1.5">
										{#each HOMEWORK_STATUS_ORDER as st (st)}
											<button
												onclick={() => setHomeworkStatus(hw.id, st)}
												class="{hw.status === st ? HOMEWORK_STATUS_ACTIVE[st] : 'bg-ctp-surface1 text-ctp-overlay0 hover:bg-ctp-surface2'} rounded px-2.5 py-1 text-xs transition-colors"
											>{HOMEWORK_STATUS_LABEL[st]}</button>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Skills -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Skills</h2>
					<div class="flex items-center gap-3">
					{#if store.skillBank.length > 0}
						<div class="relative">
							{#if showAssignSkill}
								<div class="absolute right-0 top-6 z-10 flex w-80 flex-col rounded-lg border border-ctp-surface1 bg-ctp-mantle shadow-lg" style="max-height: 26rem">
									<div class="shrink-0 border-b border-ctp-surface1 p-2">
										<input
											bind:value={assignSkillSearch}
											class="w-full rounded border border-ctp-surface2 bg-ctp-surface1 px-2.5 py-1.5 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-blue focus:outline-none"
											placeholder="Search skills…"
											onkeydown={(e) => e.key === 'Escape' && closeAssignSkill()}
										/>
									</div>
									<div class="flex-1 overflow-y-auto py-1">
										{#if availableSkills.length === 0}
											<p class="px-3 py-2 text-xs text-ctp-overlay0">All skills assigned</p>
										{:else if filteredAvailableSkills.length === 0}
											<p class="px-3 py-2 text-xs text-ctp-overlay0">No skills match "{assignSkillSearch}"</p>
										{:else}
											{#each availableSkillCategories as cat}
												{@const idsInCat = availableSkillsInCategory(cat).map((s) => s.id)}
												{@const allSelected = idsInCat.every((id) => selectedToAssign.has(id))}
												<div class="flex items-center justify-between px-3 pt-1.5 pb-0.5">
													<p class="text-xs font-semibold uppercase tracking-wide text-ctp-overlay0">{cat}</p>
													<button onclick={() => toggleSelectAllInCategory(cat)} class="text-xs text-ctp-blue hover:text-ctp-lavender">
														{allSelected ? 'Clear' : 'Select all'}
													</button>
												</div>
												{#each availableSkillsInCategory(cat) as skill}
													<label class="flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-left text-sm text-ctp-text hover:bg-ctp-surface0">
														<input
															type="checkbox"
															checked={selectedToAssign.has(skill.id)}
															onchange={() => toggleSelectToAssign(skill.id)}
															class="rounded"
														/>
														<span>{skill.name}</span>
													</label>
												{/each}
											{/each}
										{/if}
									</div>
									<div class="flex shrink-0 items-center gap-2 border-t border-ctp-surface1 px-3 py-1.5">
										<button
											onclick={assignSelectedSkills}
											disabled={selectedToAssign.size === 0}
											class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust transition-opacity hover:opacity-90 disabled:opacity-40"
										>
											Assign {selectedToAssign.size || ''} skill{selectedToAssign.size === 1 ? '' : 's'}
										</button>
										<button onclick={closeAssignSkill} class="py-1 text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
									</div>
								</div>
							{/if}
							<button
								onclick={() => (showAssignSkill = !showAssignSkill)}
								class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender"
							>+ Assign skill</button>
						</div>
					{/if}
					</div>
				</div>

				{#if !student || s.skills.length === 0}
					<p class="text-sm text-ctp-overlay0">
						{store.skillBank.length === 0 ? 'Add skills to your Skill Bank first.' : 'No skills assigned yet.'}
					</p>
				{:else}
					<div class="space-y-5">
						{#each assignedCategories as cat}
							<div>
								<div class="mb-2 flex items-center justify-between">
									<p class="text-xs font-semibold uppercase tracking-wide text-ctp-overlay0">{cat}</p>
									<button
										onclick={() => copySkillsForAI(cat)}
										class="text-xs font-medium transition-colors {copied === `ai-skills-${cat}` ? 'text-ctp-green' : 'text-ctp-overlay0 hover:text-ctp-subtext0'}"
									>
										{copied === `ai-skills-${cat}` ? '✓ Copied' : 'Copy for AI'}
									</button>
								</div>
								<div class="space-y-2">
									{#each s.skills.filter((sk) => store.skillBank.find((b) => b.id === sk.skillId)?.category === cat) as sk}
										{@const skillDef = store.skillBank.find((b) => b.id === sk.skillId)}
										{#if skillDef}
											<div class="rounded-lg border border-ctp-surface1 p-3">
												<div class="flex items-start justify-between gap-3">
													<span class="text-sm font-medium text-ctp-text">{skillDef.name}</span>
													<button onclick={() => removeStudentSkill(sk.skillId)} class="shrink-0 text-xs text-ctp-red/50 hover:text-ctp-red transition-colors">✕</button>
												</div>

												{#if skillDef.type === 'status'}
													<!-- Status toggle -->
													<div class="mt-2 flex gap-1.5">
														{#each ['not_started', 'working', 'mastered'] as st (st)}
															<button
																onclick={() => setSkillStatus(sk.skillId, st as SkillStatus)}
																class="{sk.status === st ? STATUS_ACTIVE[st as SkillStatus] : 'bg-ctp-surface1 text-ctp-overlay0 hover:bg-ctp-surface2'} rounded px-2.5 py-1 text-xs transition-colors"
															>{STATUS_LABELS[st as SkillStatus]}</button>
														{/each}
													</div>

													<!-- Status change log (tutor-only) -->
													{#if (sk.statusHistory ?? []).length > 0}
														<button onclick={() => toggleStatusHistory(sk.skillId)} class="mt-2 text-xs text-ctp-overlay0 hover:text-ctp-subtext0 transition-colors">
															{expandedStatusHistory.has(sk.skillId) ? '▾' : '▸'} Status log ({(sk.statusHistory ?? []).length})
														</button>
														{#if expandedStatusHistory.has(sk.skillId)}
															<div class="mt-1 space-y-1">
																{#each [...(sk.statusHistory ?? [])].reverse() as change}
																	<div class="flex flex-wrap items-center gap-1.5 text-xs text-ctp-overlay0">
																		<span>{new Date(change.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })}</span>
																		<span>·</span>
																		<span class="text-ctp-subtext1">{STATUS_LABELS[change.from]} → {STATUS_LABELS[change.to]}</span>
																		<span class="rounded-full px-1.5 py-0.5 text-[10px] font-medium {change.by === 'family' ? 'bg-ctp-mauve/20 text-ctp-mauve' : 'bg-ctp-surface1 text-ctp-overlay1'}">
																			{change.by === 'family' ? 'Family' : 'You'}
																		</span>
																	</div>
																{/each}
															</div>
														{/if}
													{/if}

												{:else if skillDef.type === 'scored'}
													<!-- Scored: sparkline + log -->
													{@const lastEntry = sk.entries.at(-1)}
													{@const prevEntry = sk.entries.length >= 2 ? sk.entries.at(-2) : null}
													<div class="mt-2 flex flex-wrap items-center gap-2">
														{#if lastEntry}
															{@const delta = prevEntry ? lastEntry.value - prevEntry.value : null}
															{@const better = delta !== null && (skillDef.higherIsBetter ? delta > 0.5 : delta < -0.5)}
															{@const worse = delta !== null && (skillDef.higherIsBetter ? delta < -0.5 : delta > 0.5)}
															<span class="text-lg font-bold text-ctp-text">{lastEntry.value}{skillDef.unit ? ' ' + skillDef.unit : ''}</span>
															{#if delta !== null}
																<span class="text-sm {better ? 'text-ctp-green' : worse ? 'text-ctp-red' : 'text-ctp-overlay0'}">{better ? '↑' : worse ? '↓' : '–'}</span>
															{/if}
															{#if skillDef.goal !== undefined}
																<span class="text-xs text-ctp-overlay0">→ goal: <span class="font-medium text-ctp-subtext1">{skillDef.goal}{skillDef.unit ? ' ' + skillDef.unit : ''}</span></span>
															{/if}
														{:else}
															<span class="text-sm text-ctp-overlay0">No entries yet</span>
														{/if}
														{#if activeSkillLog !== sk.skillId}
															<button onclick={() => openSkillLog(sk.skillId, lastEntry?.value ?? 0)} class="ml-auto rounded bg-ctp-surface1 px-2 py-0.5 text-xs text-ctp-subtext1 hover:bg-ctp-surface2">Log</button>
														{/if}
													</div>

													<!-- Sparkline chart -->
													<SkillSparkline entries={sk.entries} goal={skillDef.goal} unit={skillDef.unit} higherIsBetter={skillDef.higherIsBetter} />

													<!-- Inline log form -->
													{#if activeSkillLog === sk.skillId}
														<div class="mt-2 flex flex-wrap items-center gap-2 rounded bg-ctp-surface1 px-3 py-2">
															<input type="date" bind:value={skillLogDate} class={miniInputClass}
																onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitSkillLog(sk.skillId); } if (e.key === 'Escape') { e.preventDefault(); activeSkillLog = null; } }} />
															<div class="flex items-center gap-1">
																<input type="number" bind:value={skillLogValue} class="{miniInputClass} w-20 text-right" use:autoselect
																	onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitSkillLog(sk.skillId); } if (e.key === 'Escape') { e.preventDefault(); activeSkillLog = null; } }} />
																{#if skillDef.unit}<span class="text-xs text-ctp-overlay0">{skillDef.unit}</span>{/if}
															</div>
															{#if sk.entries.length > 0}
																{@const lv = sk.entries.at(-1)!.value}
																<button onclick={() => { skillLogValue = lv; submitSkillLog(sk.skillId); }}
																	class="rounded border border-ctp-surface2 px-2 py-1 text-xs text-ctp-subtext0 hover:border-ctp-overlay0 hover:text-ctp-text transition-colors"
																>↩ {lv}{skillDef.unit ? ' ' + skillDef.unit : ''}</button>
															{/if}
															<button onclick={() => submitSkillLog(sk.skillId)} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
															<button onclick={() => (activeSkillLog = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
														</div>
													{/if}

													<!-- Collapsible history with edit/delete -->
													{#if sk.entries.length > 0}
														<button onclick={() => toggleHistory(sk.skillId)} class="mt-2 text-xs text-ctp-overlay0 hover:text-ctp-subtext0 transition-colors">
															{expandedHistory.has(sk.skillId) ? '▾' : '▸'} History ({sk.entries.length})
														</button>
														{#if expandedHistory.has(sk.skillId)}
															<div class="mt-1 space-y-0.5">
																{#each [...sk.entries].reverse() as e, ri}
																	{@const idx = sk.entries.length - 1 - ri}
																	{#if editingSkillEntry?.skillId === sk.skillId && editingSkillEntry.idx === idx}
																		<div class="flex flex-wrap items-center gap-2 rounded bg-ctp-surface1 px-2 py-1">
																			<input type="date" bind:value={editSkillEntryDate} class={miniInputClass}
																				onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveSkillEntry(); } if (e.key === 'Escape') { e.preventDefault(); editingSkillEntry = null; } }} />
																			<div class="flex items-center gap-1">
																				<input type="number" bind:value={editSkillEntryValue} class="{miniInputClass} w-20 text-right" use:autoselect
																					onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveSkillEntry(); } if (e.key === 'Escape') { e.preventDefault(); editingSkillEntry = null; } }} />
																				{#if skillDef.unit}<span class="text-xs text-ctp-overlay0">{skillDef.unit}</span>{/if}
																			</div>
																			<button onclick={saveSkillEntry} class="rounded bg-ctp-blue px-2 py-0.5 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
																			<button onclick={() => (editingSkillEntry = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
																		</div>
																	{:else}
																		<div class="flex items-center gap-2 text-xs">
																			<span class="font-medium text-ctp-subtext1">{e.value}{skillDef.unit ? ' ' + skillDef.unit : ''}</span>
																			<span class="text-ctp-overlay0">·</span>
																			<span class="text-ctp-overlay0">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
																			<button onclick={() => startEditSkillEntry(sk.skillId, idx, e.date, e.value)} class="text-ctp-overlay0/60 hover:text-ctp-blue transition-colors" title="Edit">✎</button>
																			<button onclick={() => deleteSkillEntry(sk.skillId, idx)} class="text-ctp-red/40 hover:text-ctp-red transition-colors" title="Delete">✕</button>
																		</div>
																	{/if}
																{/each}
															</div>
														{/if}
													{/if}
												{:else if skillDef.type === 'multi'}
													<!-- Multi: per-item chart + per-item logging -->
													<SkillMultiChart items={skillDef.items ?? []} itemEntries={sk.itemEntries ?? {}} goal={skillDef.goal} unit={skillDef.unit} higherIsBetter={skillDef.higherIsBetter} />
													{#each (skillDef.items ?? []) as item, itemIdx}
														{@const itemHistory = (sk.itemEntries ?? {})[item] ?? []}
														{@const lastItemEntry = itemHistory.at(-1)}
														{@const goalMet = skillDef.goal !== undefined && lastItemEntry !== undefined && (skillDef.higherIsBetter ? lastItemEntry.value >= skillDef.goal : lastItemEntry.value <= skillDef.goal)}
														<div class="mt-2 rounded border border-ctp-surface1 p-2">
															<div class="flex flex-wrap items-center gap-2">
																<span class="h-2 w-2 shrink-0 rounded-full" style="background:{COURSE_COLORS[itemIdx % COURSE_COLORS.length]}"></span>
																<span class="text-xs font-medium text-ctp-text">{item}</span>
																{#if lastItemEntry}
																	<span class="text-xs font-bold text-ctp-subtext1">{lastItemEntry.value}{skillDef.unit ? ' ' + skillDef.unit : ''}</span>
																	{#if goalMet}<span class="text-xs text-ctp-green">★</span>{/if}
																{:else}
																	<span class="text-xs text-ctp-overlay0">—</span>
																{/if}
																{#if !(activeSkillLogItem?.skillId === sk.skillId && activeSkillLogItem?.item === item)}
																	<button onclick={() => openMultiLog(sk.skillId, item, lastItemEntry?.value ?? 0)} class="ml-auto rounded bg-ctp-surface1 px-2 py-0.5 text-xs text-ctp-subtext1 hover:bg-ctp-surface2">Log</button>
																{/if}
															</div>
															{#if activeSkillLogItem?.skillId === sk.skillId && activeSkillLogItem?.item === item}
																<div class="mt-1.5 flex flex-wrap items-center gap-2 rounded bg-ctp-surface1 px-2 py-1.5">
																	<input type="date" bind:value={multiLogDate} class={miniInputClass}
																		onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitMultiLog(sk.skillId, item); } if (e.key === 'Escape') { e.preventDefault(); activeSkillLogItem = null; } }} />
																	<div class="flex items-center gap-1">
																		<input type="number" bind:value={multiLogValue} class="{miniInputClass} w-20 text-right" use:autoselect
																			onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); submitMultiLog(sk.skillId, item); } if (e.key === 'Escape') { e.preventDefault(); activeSkillLogItem = null; } }} />
																		{#if skillDef.unit}<span class="text-xs text-ctp-overlay0">{skillDef.unit}</span>{/if}
																	</div>
																	{#if itemHistory.length > 0}
																		{@const lv = itemHistory.at(-1)!.value}
																		<button onclick={() => { multiLogValue = lv; submitMultiLog(sk.skillId, item); }}
																			class="rounded border border-ctp-surface2 px-2 py-1 text-xs text-ctp-subtext0 hover:border-ctp-overlay0 hover:text-ctp-text transition-colors"
																		>↩ {lv}{skillDef.unit ? ' ' + skillDef.unit : ''}</button>
																	{/if}
																	<button onclick={() => submitMultiLog(sk.skillId, item)} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
																	<button onclick={() => (activeSkillLogItem = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
																</div>
															{/if}
															{#if itemHistory.length > 0}
																<button onclick={() => toggleMultiHistory(sk.skillId, item)} class="mt-1.5 text-xs text-ctp-overlay0 hover:text-ctp-subtext0 transition-colors">
																	{expandedMultiHistory.has(sk.skillId + '::'  + item) ? '▾' : '▸'} History ({itemHistory.length})
																</button>
																{#if expandedMultiHistory.has(sk.skillId + '::'  + item)}
																	<div class="mt-1 space-y-0.5">
																		{#each [...itemHistory].reverse() as e, ri}
																			{@const idx = itemHistory.length - 1 - ri}
																			{#if editingMultiEntry?.skillId === sk.skillId && editingMultiEntry?.item === item && editingMultiEntry?.idx === idx}
																				<div class="flex flex-wrap items-center gap-2 rounded bg-ctp-surface1 px-2 py-1">
																					<input type="date" bind:value={editMultiEntryDate} class={miniInputClass}
																						onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveMultiEntry(); } if (e.key === 'Escape') { e.preventDefault(); editingMultiEntry = null; } }} />
																					<div class="flex items-center gap-1">
																						<input type="number" bind:value={editMultiEntryValue} class="{miniInputClass} w-20 text-right" use:autoselect
																							onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveMultiEntry(); } if (e.key === 'Escape') { e.preventDefault(); editingMultiEntry = null; } }} />
																						{#if skillDef.unit}<span class="text-xs text-ctp-overlay0">{skillDef.unit}</span>{/if}
																					</div>
																					<button onclick={saveMultiEntry} class="rounded bg-ctp-blue px-2 py-0.5 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
																					<button onclick={() => (editingMultiEntry = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
																				</div>
																			{:else}
																				<div class="flex items-center gap-2 text-xs">
																					<span class="font-medium text-ctp-subtext1">{e.value}{skillDef.unit ? ' ' + skillDef.unit : ''}</span>
																					<span class="text-ctp-overlay0">·</span>
																					<span class="text-ctp-overlay0">{new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
																					<button onclick={() => startEditMultiEntry(sk.skillId, item, idx, e.date, e.value)} class="text-ctp-overlay0/60 hover:text-ctp-blue transition-colors" title="Edit">✎</button>
																					<button onclick={() => deleteMultiEntry(sk.skillId, item, idx)} class="text-ctp-red/40 hover:text-ctp-red transition-colors" title="Delete">✕</button>
																				</div>
																			{/if}
																		{/each}
																	</div>
																{/if}
															{/if}
														</div>
													{/each}
												{/if}

											{#if skillDef.description}
												<p class="mt-2 whitespace-pre-wrap text-xs text-ctp-subtext0">{skillDef.description}</p>
											{/if}
											{#if skillDef.example}
												<p class="mt-1 text-xs italic text-ctp-overlay0">Example: {skillDef.example}</p>
											{/if}

											<!-- Per-student notes -->
											{#if editingSkillNotes === sk.skillId}
												<div class="mt-2 rounded bg-ctp-surface1 p-2">
													<textarea
														bind:value={skillNotesInput}
														rows="2"
														class="w-full rounded border border-ctp-surface2 bg-ctp-mantle px-2 py-1 text-xs text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-blue focus:outline-none"
														placeholder="Notes for this student (e.g. gets confused with numbers like 97)"
													></textarea>
													<div class="mt-1.5 flex gap-2">
														<button onclick={() => saveSkillNotes(sk.skillId)} class="rounded bg-ctp-blue px-2 py-0.5 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
														<button onclick={() => (editingSkillNotes = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
													</div>
												</div>
											{:else if sk.notes}
												<div class="mt-2 flex items-start justify-between gap-2 rounded bg-ctp-yellow/10 px-2 py-1.5">
													<p class="whitespace-pre-wrap text-xs text-ctp-subtext1">{sk.notes}</p>
													<button onclick={() => startEditSkillNotes(sk.skillId, sk.notes ?? '')} class="shrink-0 text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors">✎</button>
												</div>
											{:else}
												<button onclick={() => startEditSkillNotes(sk.skillId, '')} class="mt-2 text-xs text-ctp-overlay0/60 hover:text-ctp-blue transition-colors">+ Add note</button>
											{/if}
										</div>
									{/if}
								{/each}
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Notes -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Notes</h2>
					{#if !editingNotes}
						<button onclick={startEditNotes} class="text-xs text-ctp-overlay0/60 hover:text-ctp-subtext0 transition-colors">✎</button>
					{/if}
				</div>
				{#if editingNotes}
					<textarea
						bind:value={notesInput}
						rows="4"
						class="w-full rounded px-3 py-2 text-sm"
						placeholder="Any additional notes..."
					></textarea>
					<div class="mt-2 flex gap-2">
						<button onclick={saveNotes} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
						<button onclick={() => (editingNotes = false)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
					</div>
				{:else}
					<p class="whitespace-pre-wrap text-sm text-ctp-text">{s.notes || '—'}</p>
				{/if}
			</section>

			<!-- Danger Zone -->
			<section class="rounded-xl border border-ctp-red/20 bg-ctp-surface0 p-5 shadow-sm">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-ctp-red/70">Danger Zone</h2>
				{#if showDeleteConfirm}
					<div class="rounded-lg border border-ctp-red/30 bg-ctp-red/10 px-4 py-3">
						<p class="mb-2 text-sm font-medium text-ctp-red">
							Delete {student.name}? This cannot be undone.
						</p>
						<div class="flex gap-2">
							<button
								onclick={deleteStudent}
								class="rounded bg-ctp-red px-3 py-1 text-xs font-medium text-ctp-crust hover:opacity-90"
							>
								Yes, delete
							</button>
							<button
								onclick={() => (showDeleteConfirm = false)}
								class="rounded px-3 py-1 text-xs text-ctp-subtext1 hover:bg-ctp-red/10"
							>
								Cancel
							</button>
						</div>
					</div>
				{:else}
					<button
						onclick={() => (showDeleteConfirm = true)}
						class="rounded border border-ctp-red/40 px-3 py-1.5 text-sm text-ctp-red transition-colors hover:bg-ctp-red/10"
					>
						Delete student
					</button>
				{/if}
			</section>
		</main>
	</div>
{/if}
