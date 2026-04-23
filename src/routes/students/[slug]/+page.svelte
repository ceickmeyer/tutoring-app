<script lang="ts">
	import { goto } from '$app/navigation';
	import GradeChart from '$lib/GradeChart.svelte';
	import { store } from '$lib/store.svelte';
	import { COURSE_COLORS } from '$lib/types';
	import type { BigProject, Day, Student } from '$lib/types';

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

	function toggleDay(day: Day) {
		if (!draft) return;
		draft.days = draft.days.includes(day)
			? draft.days.filter((d) => d !== day)
			: [...draft.days, day];
	}

	const today = new Date().toISOString().slice(0, 10);

	let { data } = $props();

	const student = $derived(store.find(data.slug));

	// ── Edit mode ────────────────────────────────────────────────
	let editMode = $state(false);
	let draft = $state<Student | null>(null);
	let showDeleteConfirm = $state(false);

	function startEdit() {
		if (!student) return;
		draft = JSON.parse(JSON.stringify(student));
		editMode = true;
	}

	function cancelEdit() {
		draft = null;
		editMode = false;
		showDeleteConfirm = false;
		editEntryOpen = null;
	}

	function saveEdit() {
		if (!draft) return;
		store.update(draft.id, draft);
		editMode = false;
		draft = null;
		editEntryOpen = null;
	}

	function deleteStudent() {
		if (!student) return;
		store.remove(student.id);
		goto('/');
	}

	// ── Clipboard ────────────────────────────────────────────────
	let copied = $state<string | null>(null);

	async function copy(text: string, key: string) {
		await navigator.clipboard.writeText(text);
		copied = key;
		setTimeout(() => {
			if (copied === key) copied = null;
		}, 1500);
	}

	// ── Password reveal ──────────────────────────────────────────
	let revealed = $state<Set<string>>(new Set());

	function toggleReveal(key: string) {
		const next = new Set(revealed);
		if (next.has(key)) next.delete(key);
		else next.add(key);
		revealed = next;
	}

	// ── Contacts ─────────────────────────────────────────────────
	function addContact() {
		if (!draft) return;
		draft.contacts = [...draft.contacts, { name: '', relationship: '', phone: '', email: '' }];
	}

	function removeContact(i: number) {
		if (!draft) return;
		draft.contacts = draft.contacts.filter((_, idx) => idx !== i);
	}

	// ── Extra logins ─────────────────────────────────────────────
	function addExtraLogin() {
		if (!draft) return;
		draft.extraLogins = [
			...draft.extraLogins,
			{ id: crypto.randomUUID(), site: '', url: '', username: '', password: '' }
		];
	}

	function removeExtraLogin(id: string) {
		if (!draft) return;
		draft.extraLogins = draft.extraLogins.filter((l) => l.id !== id);
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

	// ── Grades: edit-mode course management ──────────────────────
	function addCourse() {
		if (!draft) return;
		draft.courses = [
			...draft.courses,
			{
				id: crypto.randomUUID(),
				name: '',
				color: COURSE_COLORS[draft.courses.length % COURSE_COLORS.length],
				entries: []
			}
		];
	}

	function removeCourse(id: string) {
		if (!draft) return;
		draft.courses = draft.courses.filter((c) => c.id !== id);
	}

	function removeGradeEntry(courseId: string, entryIdx: number) {
		if (!draft) return;
		draft.courses = draft.courses.map((c) =>
			c.id === courseId ? { ...c, entries: c.entries.filter((_, i) => i !== entryIdx) } : c
		);
	}

	// ── Grades: edit-mode per-course entry form ───────────────────
	let editEntryOpen = $state<string | null>(null);
	let editEntryDate = $state(today);
	let editEntryGrade = $state<number>(0);

	function openEditEntry(courseId: string) {
		editEntryOpen = courseId;
		editEntryDate = today;
		editEntryGrade = 0;
	}

	function submitEditEntry() {
		if (!draft || !editEntryOpen || isNaN(editEntryGrade)) return;
		draft.courses = draft.courses.map((c) =>
			c.id === editEntryOpen
				? {
						...c,
						entries: [...c.entries, { date: editEntryDate, grade: editEntryGrade }].sort((a, b) =>
							a.date.localeCompare(b.date)
						)
					}
				: c
		);
		editEntryOpen = null;
	}

	// ── Big projects ─────────────────────────────────────────────
	function addProject() {
		if (!draft) return;
		draft.projects = [
			...draft.projects,
			{ id: crypto.randomUUID(), title: '', startDate: today, dueDate: today }
		];
	}

	function removeProject(id: string) {
		if (!draft) return;
		draft.projects = draft.projects.filter((p) => p.id !== id);
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
	{@const s = editMode && draft ? draft : student}

	<div class="min-h-screen bg-ctp-base">
		<!-- Header -->
		<header class="border-b border-ctp-surface0 bg-ctp-mantle px-6 py-4">
			<div class="mx-auto max-w-3xl">
				<div class="mb-3 flex items-center justify-between">
					<a href="/" class="text-sm text-ctp-subtext0 hover:text-ctp-text">← Students</a>
					<div class="flex gap-2">
						{#if editMode}
							<button
								onclick={() => (showDeleteConfirm = !showDeleteConfirm)}
								class="rounded px-3 py-1.5 text-sm text-ctp-red transition-colors hover:bg-ctp-red/10"
							>
								Delete
							</button>
							<button
								onclick={cancelEdit}
								class="rounded px-3 py-1.5 text-sm text-ctp-subtext1 transition-colors hover:bg-ctp-surface0"
							>
								Cancel
							</button>
							<button
								onclick={saveEdit}
								class="rounded bg-ctp-blue px-3 py-1.5 text-sm font-medium text-ctp-crust transition-colors hover:opacity-90"
							>
								Save
							</button>
						{:else}
							<button
								onclick={() => store.toggleHiatus(student.id)}
								class="rounded border px-3 py-1.5 text-sm transition-colors {student.hiatus
									? 'border-ctp-yellow/40 bg-ctp-yellow/10 text-ctp-yellow hover:bg-ctp-yellow/20'
									: 'border-ctp-surface2 text-ctp-subtext1 hover:bg-ctp-surface0'}"
							>
								{student.hiatus ? '▶ Resume Student' : '⏸ Pause Student'}
							</button>
							<button
								onclick={startEdit}
								class="rounded border border-ctp-surface2 px-3 py-1.5 text-sm text-ctp-subtext1 transition-colors hover:bg-ctp-surface0"
							>
								Edit
							</button>
						{/if}
					</div>
				</div>

				{#if showDeleteConfirm}
					<div class="mb-3 rounded-lg border border-ctp-red/30 bg-ctp-red/10 px-4 py-3">
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
				{/if}

				<div class="flex flex-wrap items-baseline gap-3">
					{#if editMode}
						<input bind:value={draft!.name} class="{inputClass} text-2xl font-bold" />
					{:else}
						<div class="flex items-center gap-2.5">
							<span
								class="h-3.5 w-3.5 shrink-0 rounded-full"
								style="background: {student.color}"
							></span>
							<h1 class="text-2xl font-bold text-ctp-text">{student.name}</h1>
						</div>
					{/if}
					<div class="flex flex-wrap gap-2">
						{#if editMode}
							<input
								type="number"
								bind:value={draft!.grade}
								min="1"
								max="12"
								class="w-20 rounded px-2 py-0.5 text-sm"
								placeholder="Grade"
							/>
							<input
								bind:value={draft!.school}
								class="rounded px-2 py-0.5 text-sm"
								placeholder="School"
							/>
							<div class="flex flex-wrap gap-1">
								{#each WEEK_DAYS as day}
									<button
										type="button"
										onclick={() => toggleDay(day)}
										class="{draft!.days.includes(day)
											? 'bg-ctp-blue text-ctp-crust'
											: 'bg-ctp-surface1 text-ctp-subtext0 hover:bg-ctp-surface2'} rounded px-1.5 py-0.5 text-xs font-medium transition-colors"
									>
										{DAY_ABBR[day]}
									</button>
								{/each}
							</div>
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
			<!-- School Login -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">
					School Login
				</h2>
				<div class="space-y-2">
					<div class="flex items-center gap-3">
						<span class="w-20 shrink-0 text-xs font-medium text-ctp-overlay1">URL</span>
						{#if editMode}
							<input bind:value={draft!.schoolUrl} class={inputClass} placeholder="https://..." />
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
						{#if editMode}
							<input bind:value={draft!.username} class={inputClass} />
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
						{#if editMode}
							<input bind:value={draft!.password} class={inputClass} />
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
				</div>
			</section>

			<!-- Contact Info -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">
					Student Contact
				</h2>
				<div class="space-y-2">
					<div class="flex items-center gap-3">
						<span class="w-20 shrink-0 text-xs font-medium text-ctp-overlay1">Phone</span>
						{#if editMode}
							<input bind:value={draft!.phone} type="tel" class={inputClass} />
						{:else}
							<span class="text-sm text-ctp-text">{s.phone || '—'}</span>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<span class="w-20 shrink-0 text-xs font-medium text-ctp-overlay1">Email</span>
						{#if editMode}
							<input bind:value={draft!.email} type="email" class={inputClass} />
						{:else}
							<span class="text-sm text-ctp-text">{s.email || '—'}</span>
						{/if}
					</div>
				</div>
			</section>

			<!-- Parent/Guardian Contacts -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">
						Parent / Guardian Contacts
					</h2>
					{#if editMode}
						<button onclick={addContact} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">
							+ Add
						</button>
					{/if}
				</div>
				{#if s.contacts.length === 0}
					<p class="text-sm text-ctp-overlay0">{editMode ? 'No contacts yet.' : '—'}</p>
				{:else}
					<div class="space-y-3">
						{#each s.contacts as contact, i}
							<div class="rounded-lg border border-ctp-surface1 p-3">
								{#if editMode}
									<div class="grid grid-cols-2 gap-2">
										<input bind:value={draft!.contacts[i].name} class={inputClass} placeholder="Name" />
										<input
											bind:value={draft!.contacts[i].relationship}
											class={inputClass}
											placeholder="Relationship"
										/>
										<input
											bind:value={draft!.contacts[i].phone}
											type="tel"
											class={inputClass}
											placeholder="Phone"
										/>
										<input
											bind:value={draft!.contacts[i].email}
											type="email"
											class={inputClass}
											placeholder="Email"
										/>
									</div>
									<button onclick={() => removeContact(i)} class="mt-2 text-xs text-ctp-red/70 hover:text-ctp-red">
										Remove
									</button>
								{:else}
									<p class="font-medium text-ctp-text">
										{contact.name}
										{#if contact.relationship}
											<span class="ml-1 text-xs font-normal text-ctp-overlay0">({contact.relationship})</span>
										{/if}
									</p>
									{#if contact.phone}
										<p class="text-sm text-ctp-subtext0">{contact.phone}</p>
									{/if}
									{#if contact.email}
										<p class="text-sm text-ctp-subtext0">{contact.email}</p>
									{/if}
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Extra Logins -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-3 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Extra Logins</h2>
					{#if editMode}
						<button onclick={addExtraLogin} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">
							+ Add
						</button>
					{/if}
				</div>
				{#if s.extraLogins.length === 0}
					<p class="text-sm text-ctp-overlay0">{editMode ? 'No extra logins yet.' : '—'}</p>
				{:else}
					<div class="space-y-3">
						{#each s.extraLogins as login, i}
							<div class="rounded-lg border border-ctp-surface1 p-3">
								{#if editMode}
									<div class="grid grid-cols-2 gap-2">
										<input bind:value={draft!.extraLogins[i].site} class={inputClass} placeholder="Site name" />
										<input bind:value={draft!.extraLogins[i].url} class={inputClass} placeholder="URL" />
										<input
											bind:value={draft!.extraLogins[i].username}
											class={inputClass}
											placeholder="Username"
										/>
										<input
											bind:value={draft!.extraLogins[i].password}
											class={inputClass}
											placeholder="Password"
										/>
									</div>
									<button
										onclick={() => removeExtraLogin(login.id)}
										class="mt-2 text-xs text-ctp-red/70 hover:text-ctp-red"
									>
										Remove
									</button>
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
										<div class="flex gap-1.5">
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

			<!-- ── Grades ─────────────────────────────────────────────── -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<div class="mb-4 flex items-center justify-between">
					<h2 class="text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Grades</h2>
					{#if editMode}
						<button onclick={addCourse} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">
							+ Add Course
						</button>
					{/if}
				</div>

				<!-- Chart (view mode only, needs at least one entry) -->
				{#if !editMode && s.courses.some((c) => c.entries.length > 0)}
					<div class="mb-5">
						<GradeChart courses={s.courses} />
					</div>
				{/if}

				{#if s.courses.length === 0}
					<p class="text-sm text-ctp-overlay0">
						{editMode ? 'No courses yet. Click + Add Course to start.' : 'No courses added yet.'}
					</p>
				{:else}
					<div class="space-y-2">
						{#each s.courses as course, i}
							<div class="rounded-lg border border-ctp-surface1 p-3">
								{#if editMode}
									<!-- Course header row -->
									<div class="mb-2 flex items-center gap-2">
										<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{course.color}"></span>
										<input
											bind:value={draft!.courses[i].name}
											class="{inputClass} flex-1"
											placeholder="Course name (e.g. English, Math)"
										/>
										<button
											onclick={() => removeCourse(course.id)}
											class="shrink-0 text-xs text-ctp-red/70 hover:text-ctp-red"
										>
											Remove
										</button>
									</div>
									<!-- Entry list -->
									{#if draft!.courses[i].entries.length > 0}
										<div class="mb-2 space-y-0.5 pl-4">
											{#each draft!.courses[i].entries as entry, j}
												<div class="flex items-center gap-2 text-xs text-ctp-subtext0">
													<span
														>{new Date(entry.date).toLocaleDateString('en-US', {
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
									<!-- Add entry form -->
									{#if editEntryOpen === course.id}
										<div class="flex flex-wrap items-center gap-2 rounded bg-ctp-surface1 px-3 py-2 pl-4">
											<input type="date" bind:value={editEntryDate} class={miniInputClass} />
											<div class="flex items-center gap-1">
												<input
													type="number"
													bind:value={editEntryGrade}
													min="0"
													max="100"
													step="1"
													class="{miniInputClass} w-16 text-right"
												/>
												<span class="text-xs text-ctp-overlay0">%</span>
											</div>
											<button
												onclick={submitEditEntry}
												class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90"
											>
												Add
											</button>
											<button
												onclick={() => (editEntryOpen = null)}
												class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0"
											>
												Cancel
											</button>
										</div>
									{:else}
										<button
											onclick={() => openEditEntry(course.id)}
											class="pl-4 text-xs text-ctp-blue hover:text-ctp-lavender"
										>
											+ Add entry
										</button>
									{/if}
								{:else}
									<!-- View mode course row -->
									<div class="flex items-center justify-between">
										<div class="flex items-center gap-2">
											<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{course.color}"></span>
											<span class="font-medium text-ctp-text">{course.name || 'Unnamed course'}</span>
											{#if course.entries.length > 0}
												{@const last = course.entries[course.entries.length - 1]}
												<span class="text-sm text-ctp-overlay0">
													{last.grade}% &middot; {new Date(last.date).toLocaleDateString('en-US', {
														month: 'short',
														day: 'numeric'
													})}
												</span>
											{:else}
												<span class="text-xs text-ctp-surface2">no entries</span>
											{/if}
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
											<input type="date" bind:value={logDate} class={miniInputClass} />
											<div class="flex items-center gap-1">
												<input
													type="number"
													bind:value={logGradeInput}
													min="0"
													max="100"
													step="1"
													class="{miniInputClass} w-16 text-right"
												/>
												<span class="text-xs text-ctp-overlay0">%</span>
											</div>
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
					{#if editMode}
						<button onclick={addProject} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">
							+ Add
						</button>
					{/if}
				</div>
				{#if s.projects.length === 0}
					<p class="text-sm text-ctp-overlay0">{editMode ? 'No projects yet.' : '—'}</p>
				{:else}
					<div class="space-y-4">
						{#each s.projects as project, i}
							<div>
								{#if editMode}
									<div class="grid grid-cols-2 gap-2">
										<input
											bind:value={draft!.projects[i].title}
											class="{inputClass} col-span-2"
											placeholder="Project title"
										/>
										<div>
											<label for={'proj-start-' + project.id} class="mb-1 block text-xs text-ctp-overlay0">
												Start
											</label>
											<input
												id={'proj-start-' + project.id}
												type="date"
												bind:value={draft!.projects[i].startDate}
												class={inputClass}
											/>
										</div>
										<div>
											<label for={'proj-due-' + project.id} class="mb-1 block text-xs text-ctp-overlay0">
												Due
											</label>
											<input
												id={'proj-due-' + project.id}
												type="date"
												bind:value={draft!.projects[i].dueDate}
												class={inputClass}
											/>
										</div>
									</div>
									<button
										onclick={() => removeProject(project.id)}
										class="mt-2 text-xs text-ctp-red/70 hover:text-ctp-red"
									>
										Remove
									</button>
								{:else}
									{@const prog = getProgress(project)}
									<p class="mb-1 font-medium text-ctp-text">{project.title || 'Untitled'}</p>
									<div class="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-ctp-surface1">
										<div
											class="{barColor(prog.daysLeft, prog.overdue)} h-2.5 rounded-full transition-all"
											style="width: {prog.pct}%"
										></div>
									</div>
									<div class="flex justify-between text-xs text-ctp-overlay0">
										<span>
											{project.startDate ? new Date(project.startDate).toLocaleDateString() : '—'}
										</span>
										<span>
											{#if prog.overdue}
												<span class="font-medium text-ctp-red">Overdue</span>
											{:else if prog.daysLeft !== null}
												{prog.daysLeft} day{prog.daysLeft !== 1 ? 's' : ''} left
											{/if}
										</span>
										<span>
											{project.dueDate ? new Date(project.dueDate).toLocaleDateString() : '—'}
										</span>
									</div>
								{/if}
							</div>
						{/each}
					</div>
				{/if}
			</section>

			<!-- Notes -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Notes</h2>
				{#if editMode}
					<textarea
						bind:value={draft!.notes}
						rows="4"
						class="w-full rounded px-3 py-2 text-sm"
						placeholder="Any additional notes..."
					></textarea>
				{:else}
					<p class="whitespace-pre-wrap text-sm text-ctp-text">{s.notes || '—'}</p>
				{/if}
			</section>
		</main>
	</div>
{/if}
