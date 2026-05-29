<script lang="ts">
	import GradeChart from '$lib/GradeChart.svelte';
	import type { ShareData } from './+page';

	let { data } = $props();
	const s = $derived(data.shareData as ShareData | null);
	const activeCourses = $derived(s?.courses.filter((c) => c.entries.length > 0) ?? []);

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
		if (overdue) return 'bg-ctp-red';
		if (daysLeft === null) return 'bg-ctp-surface2';
		if (daysLeft <= 3) return 'bg-ctp-red';
		if (daysLeft <= 7) return 'bg-ctp-yellow';
		return 'bg-ctp-green';
	}
</script>

<svelte:head>
	<title>{s ? s.name + ' — Progress' : 'Student Progress'}</title>
</svelte:head>

<div class="min-h-screen bg-ctp-base px-4 py-10">
	{#if !s}
		<div class="flex min-h-[60vh] items-center justify-center">
			<p class="text-ctp-subtext0">Share link not found or has expired.</p>
		</div>
	{:else}
		<div class="mx-auto max-w-3xl space-y-8">
			<div class="flex items-center gap-3">
				<span class="h-4 w-4 shrink-0 rounded-full" style="background:{s.color}"></span>
				<h1 class="text-2xl font-bold text-ctp-text">{s.name}</h1>
			</div>

			{#if activeCourses.length > 0}
				<section>
					<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Grades</h2>
					<GradeChart courses={activeCourses} />
				</section>
			{/if}

			{#if s.projects.length > 0}
				<section>
					<h2 class="mb-3 text-sm font-semibold uppercase tracking-wide text-ctp-overlay0">Big Projects</h2>
					<div class="space-y-4 rounded-xl bg-ctp-surface0 p-5 shadow-sm">
						{#each s.projects as project}
							{@const prog = getProgress(project)}
							<div>
								<p class="mb-1 font-medium text-ctp-text">{project.title || 'Untitled'}</p>
								<div class="mb-1 h-2.5 w-full overflow-hidden rounded-full bg-ctp-surface1">
									<div
										class="{barColor(prog.daysLeft, prog.overdue)} h-2.5 rounded-full transition-all"
										style="width: {prog.pct}%"
									></div>
								</div>
								<div class="flex justify-between text-xs text-ctp-overlay0">
									<span>
										{project.startDate
											? new Date(project.startDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
											: '—'}
									</span>
									<span>
										{#if prog.overdue}
											<span class="font-medium text-ctp-red">Overdue</span>
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
	{/if}
</div>
