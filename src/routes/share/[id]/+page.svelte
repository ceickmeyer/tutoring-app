<script lang="ts">
	import GradeChart from '$lib/GradeChart.svelte';
	import SkillSparkline from '$lib/SkillSparkline.svelte';
	import SkillMultiChart from '$lib/SkillMultiChart.svelte';
	import { supabase } from '$lib/supabase';
	import { computeSkillStatus, SKILL_STATUS_LABEL, type SkillStatusKind } from '$lib/skillStatus';
	import { HOMEWORK_STATUS_LABEL, HOMEWORK_STATUS_ORDER } from '$lib/homeworkStatus';
	import type { HomeworkStatus, SkillStatus } from '$lib/types';
	import type { ShareData } from './+page';

	let { data } = $props();

	let s = $state<ShareData | null>(null);
	$effect(() => {
		s = data.shareData as ShareData | null;
	});

	const activeCourses = $derived(s?.courses.filter((c) => c.entries.length > 0) ?? []);

	const today = new Date().toLocaleDateString('en-US', {
		month: 'long',
		day: 'numeric',
		year: 'numeric'
	});

	const STATUS_SYMBOL: Record<SkillStatusKind, string> = {
		mastered: '✓',
		working: '◐',
		not_started: '○'
	};

	const STATUS_OPTIONS: SkillStatus[] = ['not_started', 'working', 'mastered'];

	const HOMEWORK_STATUS_SYMBOL: Record<HomeworkStatus, string> = {
		completed: '✓',
		working: '◐',
		not_started: '○'
	};

	// ── Family-editable status ──────────────────────────────────────
	let openSkillId = $state<string | null>(null);
	let savingChange = $state<{ skillId: string; status: SkillStatus } | null>(null);
	let saveError = $state<string | null>(null);

	function startEditStatus(skillId: string) {
		openSkillId = skillId;
		saveError = null;
	}

	function cancelEditStatus() {
		openSkillId = null;
		saveError = null;
	}

	async function pickStatus(skillId: string, status: SkillStatus) {
		if (!s) return;
		savingChange = { skillId, status };
		saveError = null;
		const { error } = await supabase.rpc('update_shared_skill_status', {
			p_share_id: data.shareId,
			p_skill_id: skillId,
			p_new_status: status
		});
		savingChange = null;
		if (error) {
			saveError = "Couldn't save that — please try again.";
			return;
		}
		s = {
			...s,
			skills: (s.skills ?? []).map((sk) => (sk.skillId === skillId ? { ...sk, status } : sk))
		};
		openSkillId = null;
	}

	const skillCategories = $derived.by(() => {
		const skills = s?.skills;
		const skillDefs = s?.skillDefs;
		if (!skills || !skillDefs) return [];
		const cats = skills
			.map((sk) => skillDefs.find((b) => b.id === sk.skillId)?.category)
			.filter((c): c is string => !!c);
		return [...new Set(cats)].sort();
	});

	function skillsInCategory(cat: string) {
		const skills = s?.skills;
		const skillDefs = s?.skillDefs;
		if (!skills || !skillDefs) return [];
		return skills
			.map((sk) => ({ sk, def: skillDefs.find((b) => b.id === sk.skillId) }))
			.filter((x) => x.def?.category === cat);
	}

	// ── Family-editable homework status ─────────────────────────────
	let openHomeworkId = $state<string | null>(null);
	let savingHomeworkChange = $state<{ id: string; status: HomeworkStatus } | null>(null);
	let saveHomeworkError = $state<string | null>(null);

	function startEditHomeworkStatus(id: string) {
		openHomeworkId = id;
		saveHomeworkError = null;
	}

	function cancelEditHomeworkStatus() {
		openHomeworkId = null;
		saveHomeworkError = null;
	}

	async function pickHomeworkStatus(id: string, status: HomeworkStatus) {
		if (!s) return;
		savingHomeworkChange = { id, status };
		saveHomeworkError = null;
		const { error } = await supabase.rpc('update_shared_homework_status', {
			p_share_id: data.shareId,
			p_homework_id: id,
			p_new_status: status
		});
		savingHomeworkChange = null;
		if (error) {
			saveHomeworkError = "Couldn't save that — please try again.";
			return;
		}
		s = {
			...s,
			homework: (s.homework ?? []).map((hw) => (hw.id === id ? { ...hw, status } : hw))
		};
		openHomeworkId = null;
	}

	function isHomeworkOverdue(hw: { status: HomeworkStatus; dueDate: string }): boolean {
		return hw.status !== 'completed' && !!hw.dueDate && hw.dueDate < new Date().toISOString().slice(0, 10);
	}

	function getProgress(project: { startDate: string; dueDate: string }) {
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
		if (overdue) return 'var(--rc-red)';
		if (daysLeft === null) return 'var(--rc-border)';
		if (daysLeft <= 3) return 'var(--rc-red)';
		if (daysLeft <= 7) return 'var(--rc-orange)';
		return 'var(--rc-green)';
	}
</script>

<svelte:head>
	<title>{s ? s.name + ' — Progress' : 'Student Progress'}</title>
</svelte:head>

<div class="report min-h-screen px-4 py-10 sm:py-14">
	{#if !s}
		<div class="flex min-h-[60vh] items-center justify-center">
			<p style="color: var(--rc-muted)">Share link not found or has expired.</p>
		</div>
	{:else}
		<div class="mx-auto max-w-3xl">
			<!-- Letterhead -->
			<header class="mb-9 border-b-2 pb-6 text-center" style="border-color: var(--rc-border)">
				<p class="mb-2 text-xs font-semibold uppercase" style="color: var(--rc-muted); letter-spacing: 0.2em">
					Progress Report
				</p>
				<div class="flex items-center justify-center gap-3">
					<span class="h-3 w-3 shrink-0 rounded-full" style="background:{s.color}"></span>
					<h1 class="text-3xl font-bold" style="color: var(--rc-heading)">{s.name}</h1>
				</div>
				<p class="mt-1.5 text-sm" style="color: var(--rc-muted)">{today}</p>
			</header>

			<div class="space-y-9">
				{#if activeCourses.length > 0}
					<section>
						<h2 class="report-heading">Grades</h2>
						<GradeChart courses={activeCourses} light />
					</section>
				{/if}

				{#if s.projects.length > 0}
					<section>
						<h2 class="report-heading">Big Projects</h2>
						<div class="report-card space-y-5">
							{#each s.projects as project}
								{@const prog = getProgress(project)}
								<div>
									<p class="mb-1.5 font-semibold" style="color: var(--rc-heading)">{project.title || 'Untitled'}</p>
									<div class="mb-1.5 h-2.5 w-full overflow-hidden rounded-full" style="background: var(--rc-track)">
										<div
											class="h-2.5 rounded-full transition-all"
											style="width: {prog.pct}%; background: {barColor(prog.daysLeft, prog.overdue)}"
										></div>
									</div>
									<div class="flex justify-between text-xs" style="color: var(--rc-muted)">
										<span>
											{project.startDate
												? new Date(project.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
												: '—'}
										</span>
										<span>
											{#if prog.overdue}
												<span class="font-semibold" style="color: var(--rc-red-text)">Overdue</span>
											{:else if prog.daysLeft !== null}
												{prog.daysLeft} day{prog.daysLeft !== 1 ? 's' : ''} left
											{/if}
										</span>
										<span>
											{project.dueDate
												? new Date(project.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
												: '—'}
										</span>
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if (s.homework ?? []).length > 0}
					<section>
						<h2 class="report-heading">Homework</h2>
						<div class="space-y-3">
							{#each s.homework ?? [] as hw (hw.id)}
								{@const course = s.courses.find((c) => c.id === hw.courseId)}
								{@const overdue = isHomeworkOverdue(hw)}
								<div class="report-card status-{hw.status === 'completed' ? 'mastered' : hw.status}">
									<div class="flex items-start justify-between gap-3">
										<div class="flex items-center gap-2">
											{#if course}<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{course.color}"></span>{/if}
											<span class="text-base font-semibold" style="color: var(--rc-heading)">{hw.title || 'Untitled'}</span>
										</div>
										<button
											class="status-pill status-pill-button status-{hw.status === 'completed' ? 'mastered' : hw.status}"
											onclick={() => startEditHomeworkStatus(hw.id)}
											disabled={openHomeworkId === hw.id}
										>
											<span aria-hidden="true">{HOMEWORK_STATUS_SYMBOL[hw.status]}</span>
											{HOMEWORK_STATUS_LABEL[hw.status]}
										</button>
									</div>

									{#if hw.dueDate}
										<p class="mt-1 text-xs" style="color: {overdue ? 'var(--rc-red-text)' : 'var(--rc-muted)'}; font-weight: {overdue ? 600 : 400}">
											Due {new Date(hw.dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{overdue ? ' — overdue' : ''}
										</p>
									{/if}

									{#if openHomeworkId === hw.id}
										<div class="status-editor">
											<p class="status-editor-text">Update status:</p>
											{#if saveHomeworkError}<p class="status-editor-error">{saveHomeworkError}</p>{/if}
											<div class="status-editor-actions">
												{#each HOMEWORK_STATUS_ORDER as opt (opt)}
													<button
														class="status-option status-{opt === 'completed' ? 'mastered' : opt}"
														onclick={() => pickHomeworkStatus(hw.id, opt)}
														disabled={savingHomeworkChange?.id === hw.id}
													>
														<span aria-hidden="true">{HOMEWORK_STATUS_SYMBOL[opt]}</span>
														{savingHomeworkChange?.id === hw.id && savingHomeworkChange.status === opt ? 'Saving…' : HOMEWORK_STATUS_LABEL[opt]}
													</button>
												{/each}
												<button class="status-btn-text" onclick={cancelEditHomeworkStatus} disabled={savingHomeworkChange?.id === hw.id}>Cancel</button>
											</div>
										</div>
									{/if}

									{#if hw.notes}
										<p class="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed" style="color: var(--rc-text)">{hw.notes}</p>
									{/if}
								</div>
							{/each}
						</div>
					</section>
				{/if}

				{#if skillCategories.length > 0}
					<section>
						<h2 class="report-heading">Skills</h2>
						<div class="space-y-6">
							{#each skillCategories as cat}
								<div>
									<p class="report-subheading">{cat}</p>
									<div class="space-y-3">
										{#each skillsInCategory(cat) as { sk, def } (sk.skillId)}
											{#if def}
												{@const status = computeSkillStatus(def, sk)}
												<div class="report-card status-{status}">
													<div class="flex items-start justify-between gap-3">
														<span class="text-base font-semibold" style="color: var(--rc-heading)">{def.name}</span>
														{#if def.type === 'status'}
															<button
																class="status-pill status-pill-button status-{status}"
																onclick={() => startEditStatus(sk.skillId)}
																disabled={openSkillId === sk.skillId}
															>
																<span aria-hidden="true">{STATUS_SYMBOL[status]}</span>
																{SKILL_STATUS_LABEL[status]}
															</button>
														{:else}
															<span class="status-pill status-{status}">
																<span aria-hidden="true">{STATUS_SYMBOL[status]}</span>
																{SKILL_STATUS_LABEL[status]}
															</span>
														{/if}
													</div>

													{#if def.type === 'status' && openSkillId === sk.skillId}
														<div class="status-editor">
															<p class="status-editor-text">Update status:</p>
															{#if saveError}<p class="status-editor-error">{saveError}</p>{/if}
															<div class="status-editor-actions">
																{#each STATUS_OPTIONS as opt (opt)}
																	<button
																		class="status-option status-{opt}"
																		onclick={() => pickStatus(sk.skillId, opt)}
																		disabled={savingChange?.skillId === sk.skillId}
																	>
																		<span aria-hidden="true">{STATUS_SYMBOL[opt]}</span>
																		{savingChange?.skillId === sk.skillId && savingChange.status === opt ? 'Saving…' : SKILL_STATUS_LABEL[opt]}
																	</button>
																{/each}
																<button class="status-btn-text" onclick={cancelEditStatus} disabled={savingChange?.skillId === sk.skillId}>Cancel</button>
															</div>
														</div>
													{/if}

													{#if def.type === 'scored'}
														{@const lastEntry = sk.entries.at(-1)}
														<div class="mt-2 flex flex-wrap items-center gap-2">
															{#if lastEntry}
																<span class="text-lg font-bold" style="color: var(--rc-heading)">{lastEntry.value}{def.unit ? ' ' + def.unit : ''}</span>
																{#if def.goal !== undefined}
																	<span class="text-xs" style="color: var(--rc-muted)">
																		→ goal: <span class="font-medium" style="color: var(--rc-text)">{def.goal}{def.unit ? ' ' + def.unit : ''}</span>
																	</span>
																{/if}
															{:else}
																<span class="text-sm" style="color: var(--rc-muted)">No entries yet</span>
															{/if}
														</div>
														<SkillSparkline entries={sk.entries} goal={def.goal} unit={def.unit} higherIsBetter={def.higherIsBetter} light />
													{:else if def.type === 'multi'}
														<SkillMultiChart items={def.items ?? []} itemEntries={sk.itemEntries ?? {}} goal={def.goal} unit={def.unit} higherIsBetter={def.higherIsBetter} light />
													{/if}

													{#if def.description}
														<p class="mt-2.5 whitespace-pre-wrap text-sm leading-relaxed" style="color: var(--rc-text)">{def.description}</p>
													{/if}
													{#if def.example}
														<p class="mt-1.5 text-sm" style="color: var(--rc-muted)">
															<span class="font-semibold" style="color: var(--rc-text)">Example:</span> {def.example}
														</p>
													{/if}
													{#if sk.notes}
														<div class="note-callout mt-2.5">
															<p class="whitespace-pre-wrap text-sm leading-relaxed">{sk.notes}</p>
														</div>
													{/if}
												</div>
											{/if}
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.report {
		--rc-bg: #f7f3ea;
		--rc-card: #fffdf8;
		--rc-border: #e6ddc9;
		--rc-track: #ece4d2;
		--rc-heading: #2e2a24;
		--rc-text: #4a443c;
		--rc-muted: #8a8175;

		--rc-green: #4c9a6a;
		--rc-green-bg: #e6f3ea;
		--rc-green-text: #2f6b45;
		--rc-green-border: #bfe0cb;

		--rc-orange: #d98a2b;
		--rc-orange-bg: #fbeedd;
		--rc-orange-text: #9c5f18;
		--rc-orange-border: #f0d3ac;

		--rc-red: #c48179;
		--rc-red-bg: #f7ebe8;
		--rc-red-text: #a3584c;
		--rc-red-border: #e8cac4;

		background: var(--rc-bg);
		color: var(--rc-text);
		font-family:
			'Iowan Old Style',
			'Palatino Linotype',
			Palatino,
			Georgia,
			Cambria,
			'Times New Roman',
			Times,
			serif;
	}

	.report-heading {
		margin-bottom: 0.75rem;
		font-size: 0.7rem;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.14em;
		color: var(--rc-muted);
	}

	.report-subheading {
		margin-bottom: 0.5rem;
		font-size: 0.95rem;
		font-weight: 700;
		color: var(--rc-heading);
	}

	.report-card {
		border-radius: 0.75rem;
		border: 1px solid var(--rc-border);
		background: var(--rc-card);
		padding: 1.1rem 1.25rem;
		box-shadow: 0 1px 2px rgba(46, 42, 36, 0.04);
	}

	.report-card.status-mastered {
		border-left: 4px solid var(--rc-green-border);
	}
	.report-card.status-working {
		border-left: 4px solid var(--rc-orange-border);
	}
	.report-card.status-not_started {
		border-left: 4px solid var(--rc-red-border);
	}

	.status-pill {
		display: inline-flex;
		flex-shrink: 0;
		align-items: center;
		gap: 0.3rem;
		border-radius: 999px;
		padding: 0.2rem 0.65rem;
		font-size: 0.75rem;
		font-weight: 600;
		white-space: nowrap;
		border: 1px solid transparent;
	}
	.status-pill.status-mastered {
		background: var(--rc-green-bg);
		color: var(--rc-green-text);
		border-color: var(--rc-green-border);
	}
	.status-pill.status-working {
		background: var(--rc-orange-bg);
		color: var(--rc-orange-text);
		border-color: var(--rc-orange-border);
	}
	.status-pill.status-not_started {
		background: var(--rc-red-bg);
		color: var(--rc-red-text);
		border-color: var(--rc-red-border);
	}

	.note-callout {
		border-radius: 0.5rem;
		border: 1px solid #ecdfa8;
		background: #fdf6dc;
		color: #6b5a1e;
		padding: 0.6rem 0.8rem;
	}

	.status-pill-button {
		font-family: inherit;
		line-height: inherit;
		cursor: pointer;
		transition: filter 0.15s;
	}
	.status-pill-button:hover:not(:disabled) {
		filter: brightness(0.97) saturate(1.1);
	}
	.status-pill-button:disabled {
		cursor: default;
		opacity: 0.6;
	}

	.status-editor {
		margin-top: 0.75rem;
		border-radius: 0.5rem;
		border: 1px dashed var(--rc-border);
		background: rgba(46, 42, 36, 0.02);
		padding: 0.75rem 0.85rem;
	}

	.status-editor-text {
		margin: 0 0 0.5rem;
		font-size: 0.85rem;
		color: var(--rc-text);
	}

	.status-editor-error {
		margin: -0.25rem 0 0.5rem;
		font-size: 0.8rem;
		color: var(--rc-red-text);
	}

	.status-editor-actions {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.status-option {
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
		border-radius: 999px;
		padding: 0.3rem 0.75rem;
		font-size: 0.8rem;
		font-weight: 600;
		font-family: inherit;
		cursor: pointer;
		border: 1px solid transparent;
		background: #efe9db;
		color: var(--rc-text);
		transition: filter 0.15s;
	}
	.status-option:hover {
		filter: brightness(0.96);
	}
	.status-option.status-mastered {
		background: var(--rc-green-bg);
		color: var(--rc-green-text);
		border-color: var(--rc-green-border);
	}
	.status-option.status-working {
		background: var(--rc-orange-bg);
		color: var(--rc-orange-text);
		border-color: var(--rc-orange-border);
	}
	.status-option.status-not_started {
		background: var(--rc-red-bg);
		color: var(--rc-red-text);
		border-color: var(--rc-red-border);
	}

	.status-btn-text {
		background: none;
		border: none;
		font-family: inherit;
		font-size: 0.8rem;
		color: var(--rc-muted);
		cursor: pointer;
		padding: 0.35rem 0.4rem;
	}
	.status-btn-text:hover:not(:disabled) {
		color: var(--rc-text);
	}
</style>
