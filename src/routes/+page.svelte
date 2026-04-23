<script lang="ts">
	import { store, uniqueSlug } from '$lib/store.svelte';
	import { STUDENT_COLORS } from '$lib/types';
	import type { Day } from '$lib/types';

	const WEEK_DAYS: Day[] = [
		'Monday',
		'Tuesday',
		'Wednesday',
		'Thursday',
		'Friday',
		'Saturday',
		'Sunday'
	];
	const DAY_ORDER: Record<string, number> = {
		Monday: 1,
		Tuesday: 2,
		Wednesday: 3,
		Thursday: 4,
		Friday: 5,
		Saturday: 6,
		Sunday: 7,
		'': 8
	};
	const DAY_ABBR: Record<string, string> = {
		Monday: 'Mon',
		Tuesday: 'Tue',
		Wednesday: 'Wed',
		Thursday: 'Thu',
		Friday: 'Fri',
		Saturday: 'Sat',
		Sunday: 'Sun'
	};

	const TODAY = new Date().toLocaleDateString('en-US', { weekday: 'long' }) as Day;

	type SortKey = 'name' | 'grade' | 'school' | 'day';

	const SORT_STORAGE_KEY = 'tutoring-sort-prefs';

	function loadSortPrefs(): { key: SortKey; dir: 1 | -1; todayFirst: boolean } {
		try {
			const raw = localStorage.getItem(SORT_STORAGE_KEY);
			if (raw) return { todayFirst: true, ...JSON.parse(raw) };
		} catch {}
		return { key: 'name', dir: 1, todayFirst: true };
	}

	const prefs = loadSortPrefs();
	let sortKey = $state<SortKey>(prefs.key);
	let sortDir = $state<1 | -1>(prefs.dir);
	let todayFirst = $state<boolean>(prefs.todayFirst);

	$effect(() => {
		try {
			localStorage.setItem(
				SORT_STORAGE_KEY,
				JSON.stringify({ key: sortKey, dir: sortDir, todayFirst })
			);
		} catch {}
	});

	let toast = $state<string | null>(null);
	let toastTimer: ReturnType<typeof setTimeout>;

	let showAdd = $state(false);
	let showImport = $state(false);
	let importText = $state('');

	let newName = $state('');
	let newGrade = $state(9);
	let newSchool = $state('');
	let newUrl = $state('');
	let newUsername = $state('');
	let newPassword = $state('');
	let newDays = $state<Day[]>([]);

	function dayTier(s: { days: Day[] }): number {
		if (s.days.includes(TODAY)) return 0;
		if (s.days.length > 0) return 1;
		return 2;
	}

	function minDayOrder(days: Day[]): number {
		if (!days.length) return 99;
		return Math.min(...days.map((d) => DAY_ORDER[d] ?? 99));
	}

	const sorted = $derived(
		[...store.list].sort((a, b) => {
			// Hiatus always sinks to the bottom regardless of any sort
			const aH = a.hiatus ? 1 : 0,
				bH = b.hiatus ? 1 : 0;
			if (aH !== bH) return aH - bH;
			// Today-first pin overrides the chosen sort column
			if (todayFirst) {
				const ta = dayTier(a),
					tb = dayTier(b);
				if (ta !== tb) return ta - tb;
			}
			switch (sortKey) {
				case 'name':
					return a.name.localeCompare(b.name) * sortDir;
				case 'grade':
					return (a.grade - b.grade) * sortDir;
				case 'school':
					return a.school.localeCompare(b.school) * sortDir;
				case 'day':
					return (minDayOrder(a.days) - minDayOrder(b.days)) * sortDir;
			}
		})
	);

	function toggleSort(key: SortKey) {
		if (sortKey === key) sortDir = sortDir === 1 ? -1 : 1;
		else {
			sortKey = key;
			sortDir = 1;
		}
	}

	function sortIndicator(key: SortKey) {
		if (sortKey !== key) return '↕';
		return sortDir === 1 ? '↑' : '↓';
	}

	function formatDays(days: Day[]): string {
		if (!days.length) return '—';
		return days.map((d) => DAY_ABBR[d] ?? d).join(' · ');
	}

	async function copy(text: string, label: string) {
		if (!text) return;
		await navigator.clipboard.writeText(text);
		clearTimeout(toastTimer);
		toast = label;
		toastTimer = setTimeout(() => (toast = null), 1500);
	}

	function toggleNewDay(day: Day) {
		newDays = newDays.includes(day) ? newDays.filter((d) => d !== day) : [...newDays, day];
	}

	function addStudent() {
		if (!newName.trim()) return;
		store.add({
			id: uniqueSlug(newName),
			name: newName.trim(),
			grade: newGrade,
			school: newSchool.trim(),
			schoolUrl: newUrl.trim(),
			username: newUsername.trim(),
			password: newPassword.trim(),
			days: newDays,
			phone: '',
			email: '',
			notes: '',
			contacts: [],
			projects: [],
			extraLogins: [],
			courses: [],
			hiatus: false,
			color: STUDENT_COLORS[store.list.length % STUDENT_COLORS.length]
		});
		newName = '';
		newGrade = 9;
		newSchool = '';
		newUrl = '';
		newUsername = '';
		newPassword = '';
		newDays = [];
		showAdd = false;
	}

	function parseImport() {
		const lines = importText
			.trim()
			.split('\n')
			.filter((l) => l.trim());
		for (const line of lines) {
			const parts = line.split('\t');
			if (parts.length < 2) continue;
			const [name, grade, school, url, username, password, daysRaw] = parts;
			const days = (daysRaw ?? '')
				.split(',')
				.map((d) => d.trim())
				.filter((d) => WEEK_DAYS.includes(d as Day)) as Day[];
			store.add({
				id: uniqueSlug(name.trim()),
				name: name.trim(),
				grade: parseInt(grade?.trim()) || 0,
				school: (school ?? '').trim(),
				schoolUrl: (url ?? '').trim(),
				username: (username ?? '').trim(),
				password: (password ?? '').trim(),
				days,
				phone: '',
				email: '',
				notes: '',
				contacts: [],
				projects: [],
				extraLogins: [],
				courses: [],
				hiatus: false,
				color: STUDENT_COLORS[store.list.length % STUDENT_COLORS.length]
			});
		}
		importText = '';
		showImport = false;
	}
</script>

<div class="min-h-screen bg-ctp-base">
	<header class="flex items-center justify-between border-b border-ctp-surface0 bg-ctp-mantle px-6 py-4">
		<div>
			<h1 class="text-xl font-semibold text-ctp-text">My Students</h1>
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={() => (todayFirst = !todayFirst)}
				class="rounded px-3 py-1.5 text-sm transition-colors {todayFirst
					? 'bg-ctp-surface0 font-medium text-ctp-text'
					: 'text-ctp-overlay0 hover:bg-ctp-surface0 hover:text-ctp-subtext0'}"
				title="Pin today's students to the top"
			>
				{DAY_ABBR[TODAY]} first
			</button>
			<button
				onclick={() => (showImport = true)}
				class="rounded px-3 py-1.5 text-sm text-ctp-subtext0 transition-colors hover:bg-ctp-surface0 hover:text-ctp-text"
			>
				Import
			</button>
			<button
				onclick={() => (showAdd = true)}
				class="rounded bg-ctp-blue px-3 py-1.5 text-sm font-medium text-ctp-crust transition-colors hover:opacity-90"
			>
				+ Add Student
			</button>
		</div>
	</header>

	<main class="p-6">
		<div class="overflow-hidden rounded-xl bg-ctp-surface0 shadow-sm">
			<table class="w-full text-sm">
				<thead>
					<tr class="bg-ctp-mantle text-ctp-text">
						<th class="px-4 py-3 text-left font-medium">
							<button
								onclick={() => toggleSort('name')}
								class="flex items-center gap-1 hover:text-ctp-subtext0"
							>
								Name <span class="text-xs">{sortIndicator('name')}</span>
							</button>
						</th>
						<th class="px-4 py-3 text-left font-medium">
							<button
								onclick={() => toggleSort('grade')}
								class="flex items-center gap-1 hover:text-ctp-subtext0"
							>
								Grade <span class="text-xs">{sortIndicator('grade')}</span>
							</button>
						</th>
						<th class="px-4 py-3 text-left font-medium">
							<button
								onclick={() => toggleSort('school')}
								class="flex items-center gap-1 hover:text-ctp-subtext0"
							>
								School <span class="text-xs">{sortIndicator('school')}</span>
							</button>
						</th>
						<th class="px-4 py-3 text-left font-medium">
							<button
								onclick={() => toggleSort('day')}
								class="flex items-center gap-1 hover:text-ctp-subtext0"
							>
								Day <span class="text-xs">{sortIndicator('day')}</span>
							</button>
						</th>
						<th class="px-4 py-3 text-left font-medium">Quick Copy</th>
					</tr>
				</thead>
				<tbody>
					{#each sorted as student (student.id)}
						{@const isToday = !student.hiatus && student.days.includes(TODAY)}
						<tr
							class="border-l-2 border-t border-ctp-surface1 transition-colors {student.hiatus
								? 'opacity-40 hover:opacity-60'
								: isToday
									? 'bg-ctp-surface1/30 hover:bg-ctp-surface1/50'
									: 'hover:bg-ctp-surface1/30'}"
							style="border-left-color: {isToday ? student.color : 'transparent'}"
						>
							<td class="px-4 py-3">
								<div class="flex items-center gap-2">
									<span
										class="h-2 w-2 shrink-0 rounded-full"
										style="background: {student.color}"
									></span>
									<a
										href="/students/{student.id}"
										class="font-medium text-ctp-blue hover:underline"
									>
										{student.name}
									</a>
								</div>
							</td>
							<td class="px-4 py-3 text-ctp-subtext1">{student.grade || '—'}</td>
							<td class="px-4 py-3 text-ctp-subtext1">{student.school || '—'}</td>
							<td class="px-4 py-3 text-xs text-ctp-overlay0">{formatDays(student.days)}</td>
							<td class="px-4 py-3">
								<div class="flex gap-1.5">
									<button
										onclick={() => copy(student.schoolUrl, student.name + ' portal')}
										class="rounded bg-ctp-surface1 px-2 py-1 text-xs font-medium text-ctp-subtext1 transition-colors hover:bg-ctp-surface2"
									>
										Portal
									</button>
									<button
										onclick={() => copy(student.username, student.name + ' login')}
										class="rounded bg-ctp-surface1 px-2 py-1 text-xs font-medium text-ctp-subtext1 transition-colors hover:bg-ctp-surface2"
									>
										Login
									</button>
									<button
										onclick={() => copy(student.password, student.name + ' password')}
										class="flex items-center rounded bg-ctp-surface1 px-2 py-1 text-ctp-subtext1 transition-colors hover:bg-ctp-surface2"
										aria-label="Copy password"
									>
										<svg
											viewBox="0 0 24 24"
											class="h-3.5 w-3.5 fill-current"
											xmlns="http://www.w3.org/2000/svg"
										>
											<path
												d="M17,9V7A5,5,0,0,0,7,7V9a3,3,0,0,0-3,3v7a3,3,0,0,0,3,3H17a3,3,0,0,0,3-3V12A3,3,0,0,0,17,9ZM9,7a3,3,0,0,1,6,0V9H9Zm9,12a1,1,0,0,1-1,1H7a1,1,0,0,1-1-1V12a1,1,0,0,1,1-1H17a1,1,0,0,1,1,1Z"
											/>
										</svg>
									</button>
								</div>
							</td>
						</tr>
					{/each}
					{#if sorted.length === 0}
						<tr>
							<td colspan="5" class="px-4 py-10 text-center text-ctp-overlay0">
								No students yet. Add one to get started.
							</td>
						</tr>
					{/if}
				</tbody>
			</table>
		</div>
	</main>
</div>

<!-- Toast -->
{#if toast}
	<div
		class="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ctp-mantle px-4 py-2 text-sm font-medium text-ctp-text shadow-lg"
	>
		Copied — {toast}
	</div>
{/if}

<!-- Add Student Modal -->
{#if showAdd}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		role="dialog"
		aria-modal="true"
	>
		<div class="mx-4 w-full max-w-md rounded-xl bg-ctp-mantle p-6 shadow-xl">
			<h2 class="mb-4 text-lg font-semibold text-ctp-text">Add Student</h2>
			<div class="space-y-3">
				<div>
					<label for="new-name" class="mb-1 block text-xs font-medium text-ctp-subtext0">Name</label>
					<input
						id="new-name"
						bind:value={newName}
						class="w-full rounded px-3 py-2 text-sm"
						placeholder="Full name"
					/>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="new-grade" class="mb-1 block text-xs font-medium text-ctp-subtext0">Grade</label>
						<input
							id="new-grade"
							type="number"
							bind:value={newGrade}
							min="1"
							max="12"
							class="w-full rounded px-3 py-2 text-sm"
						/>
					</div>
					<div>
						<p class="mb-1 text-xs font-medium text-ctp-subtext0">Day(s)</p>
						<div class="flex flex-wrap gap-1">
							{#each WEEK_DAYS as day}
								<button
									type="button"
									onclick={() => toggleNewDay(day)}
									class="{newDays.includes(day)
										? 'bg-ctp-blue text-ctp-crust'
										: 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} rounded px-1.5 py-0.5 text-xs font-medium transition-colors"
								>
									{DAY_ABBR[day]}
								</button>
							{/each}
						</div>
					</div>
				</div>
				<div>
					<label for="new-school" class="mb-1 block text-xs font-medium text-ctp-subtext0">School</label>
					<input
						id="new-school"
						bind:value={newSchool}
						class="w-full rounded px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="new-url" class="mb-1 block text-xs font-medium text-ctp-subtext0">School URL</label>
					<input
						id="new-url"
						bind:value={newUrl}
						class="w-full rounded px-3 py-2 text-sm"
						placeholder="https://..."
					/>
				</div>
				<div>
					<label for="new-username" class="mb-1 block text-xs font-medium text-ctp-subtext0">Username</label>
					<input
						id="new-username"
						bind:value={newUsername}
						class="w-full rounded px-3 py-2 text-sm"
					/>
				</div>
				<div>
					<label for="new-password" class="mb-1 block text-xs font-medium text-ctp-subtext0">Password</label>
					<input
						id="new-password"
						bind:value={newPassword}
						class="w-full rounded px-3 py-2 text-sm"
					/>
				</div>
			</div>
			<div class="mt-5 flex justify-end gap-2">
				<button
					onclick={() => (showAdd = false)}
					class="rounded px-4 py-2 text-sm text-ctp-subtext1 transition-colors hover:bg-ctp-surface0"
				>
					Cancel
				</button>
				<button
					onclick={addStudent}
					class="rounded bg-ctp-blue px-4 py-2 text-sm font-medium text-ctp-crust transition-colors hover:opacity-90"
				>
					Add Student
				</button>
			</div>
		</div>
	</div>
{/if}

<!-- Import Modal -->
{#if showImport}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
		role="dialog"
		aria-modal="true"
	>
		<div class="mx-4 w-full max-w-lg rounded-xl bg-ctp-mantle p-6 shadow-xl">
			<h2 class="mb-1 text-lg font-semibold text-ctp-text">Import Students</h2>
			<p class="mb-4 text-sm text-ctp-subtext0">
				Tab-separated: Name · Grade · School · URL · Username · Password · Day(s)
				<br /><span class="text-ctp-overlay0">Days can be comma-separated, e.g. "Tuesday, Thursday"</span>
			</p>
			<textarea
				bind:value={importText}
				rows="8"
				class="w-full rounded px-3 py-2 font-mono text-sm"
				placeholder="Maddie Henderson	11	Bullis	https://...	user@school.org	password	Sunday"
			></textarea>
			<div class="mt-4 flex justify-end gap-2">
				<button
					onclick={() => {
						showImport = false;
						importText = '';
					}}
					class="rounded px-4 py-2 text-sm text-ctp-subtext1 transition-colors hover:bg-ctp-surface0"
				>
					Cancel
				</button>
				<button
					onclick={parseImport}
					class="rounded bg-ctp-blue px-4 py-2 text-sm font-medium text-ctp-crust transition-colors hover:opacity-90"
				>
					Import
				</button>
			</div>
		</div>
	</div>
{/if}
