<script lang="ts">
	import GradeChart from '$lib/GradeChart.svelte';
	import SkillSparkline from '$lib/SkillSparkline.svelte';
	import SkillMultiChart from '$lib/SkillMultiChart.svelte';
	import { computeSkillStatus, SKILL_STATUS_LABEL, type SkillStatusKind } from '$lib/skillStatus';
	import type { ShareData } from './+page';

	let { data } = $props();
	const s = $derived(data.shareData as ShareData | null);
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

	const skillCategories = $derived.by(() => {
		if (!s?.skills || !s.skillDefs) return [];
		const cats = s.skills
			.map((sk) => s.skillDefs!.find((b) => b.id === sk.skillId)?.category)
			.filter((c): c is string => !!c);
		return [...new Set(cats)].sort();
	});

	function skillsInCategory(cat: string) {
		if (!s?.skills || !s.skillDefs) return [];
		return s.skills
			.map((sk) => ({ sk, def: s.skillDefs!.find((b) => b.id === sk.skillId) }))
			.filter((x) => x.def?.category === cat);
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
														<span class="status-pill status-{status}">
															<span aria-hidden="true">{STATUS_SYMBOL[status]}</span>
															{SKILL_STATUS_LABEL[status]}
														</span>
													</div>

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
</style>
