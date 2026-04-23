<script lang="ts">
	import type { Course } from './types';

	let { courses }: { courses: Course[] } = $props();

	// SVG canvas layout
	const W = 680,
		H = 240;
	const ML = 40,
		MR = 16,
		MT = 14,
		MB = 30;
	const CW = W - ML - MR;
	const CH = H - MT - MB;

	// Collect every timestamp across all courses
	const allTimes = $derived(
		courses.flatMap((c) => c.entries.map((e) => new Date(e.date).getTime()))
	);

	const minT = $derived(allTimes.length ? allTimes.reduce((a, b) => Math.min(a, b)) : 0);
	const maxT = $derived(allTimes.length ? allTimes.reduce((a, b) => Math.max(a, b)) : 0);
	// If all entries share one date, spread the axis over 2 weeks so the dot is centered
	const spanT = $derived(maxT > minT ? maxT - minT : 86400000 * 14);
	const singleDate = $derived(maxT === minT && allTimes.length > 0);

	function tx(date: string): number {
		if (singleDate) return ML + CW / 2;
		return ML + ((new Date(date).getTime() - minT) / spanT) * CW;
	}

	// Y axis: top is always 100, bottom is 5 below the lowest grade, rounded to nearest 5
	const allGrades = $derived(courses.flatMap((c) => c.entries.map((e) => e.grade)));
	const yMin = $derived(
		allGrades.length ? Math.max(0, Math.floor((Math.min(...allGrades) - 5) / 5) * 5) : 0
	);

	function ty(grade: number): number {
		const range = 100 - yMin;
		return MT + (1 - (grade - yMin) / range) * CH;
	}

	// Catmull-Rom → cubic Bézier
	function curvePath(pts: [number, number][]): string {
		if (pts.length < 2) return '';
		let d = `M ${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
		for (let i = 0; i < pts.length - 1; i++) {
			const p0 = pts[Math.max(0, i - 1)];
			const p1 = pts[i];
			const p2 = pts[i + 1];
			const p3 = pts[Math.min(pts.length - 1, i + 2)];
			const c1x = p1[0] + (p2[0] - p0[0]) / 6;
			const c1y = p1[1] + (p2[1] - p0[1]) / 6;
			const c2x = p2[0] - (p3[0] - p1[0]) / 6;
			const c2y = p2[1] - (p3[1] - p1[1]) / 6;
			d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
		}
		return d;
	}

	const lines = $derived(
		courses
			.filter((c) => c.entries.length > 0)
			.map((c) => {
				const sorted = [...c.entries].sort((a, b) => a.date.localeCompare(b.date));
				const pts: [number, number][] = sorted.map((e) => [tx(e.date), ty(e.grade)]);
				return { id: c.id, name: c.name, color: c.color, pts, path: curvePath(pts) };
			})
	);

	// 5 evenly-spaced X axis labels
	const xTicks = $derived(
		allTimes.length === 0
			? []
			: singleDate
				? [
						{
							x: ML + CW / 2,
							label: new Date(minT).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})
						}
					]
				: Array.from({ length: 5 }, (_, i) => ({
						x: ML + (i / 4) * CW,
						label: new Date(minT + (i / 4) * spanT).toLocaleDateString('en-US', {
							month: 'short',
							day: 'numeric'
						})
					}))
	);

	// Smart Y ticks: multiples of 5 (or 10 for wide spans) from yMin to 100
	const yLines = $derived.by(() => {
		const span = 100 - yMin;
		const step = span > 40 ? 10 : 5;
		const ticks: number[] = [];
		for (let y = yMin; y <= 100; y += step) ticks.push(y);
		return ticks;
	});
</script>

{#if lines.length > 0}
	<div class="overflow-hidden rounded-lg border border-ctp-surface1 bg-ctp-surface0">
		<svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Grade history chart">
			<!-- Horizontal grid lines + Y labels -->
			{#each yLines as y}
				<line x1={ML} y1={ty(y)} x2={W - MR} y2={ty(y)} stroke="#363a4f" stroke-width="1" />
				<text x={ML - 6} y={ty(y) + 4} text-anchor="end" fill="#6e738d" font-size="10">{y}</text>
			{/each}

			<!-- X axis date labels -->
			{#each xTicks as tick}
				<text x={tick.x} y={H - 6} text-anchor="middle" fill="#6e738d" font-size="10"
					>{tick.label}</text
				>
			{/each}

			<!-- Axis borders -->
			<line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#494d64" stroke-width="1" />
			<line x1={ML} y1={MT + CH} x2={W - MR} y2={MT + CH} stroke="#494d64" stroke-width="1" />

			<!-- Course lines -->
			{#each lines as line}
				{#if line.path}
					<path
						d={line.path}
						fill="none"
						stroke={line.color}
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				{/if}
				<!-- Data point dots -->
				{#each line.pts as [x, y]}
					<circle
						cx={x}
						cy={y}
						r={line.pts.length === 1 ? 5 : 3.5}
						fill={line.color}
						stroke="#24273a"
						stroke-width="2"
					/>
				{/each}
			{/each}
		</svg>

		<!-- Legend -->
		{#if lines.length > 1}
			<div class="flex flex-wrap gap-x-5 gap-y-1 border-t border-ctp-surface1 px-4 py-2.5">
				{#each lines as line}
					<span class="flex items-center gap-1.5 text-xs text-ctp-subtext1">
						<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{line.color}"></span>
						{line.name}
					</span>
				{/each}
			</div>
		{/if}
	</div>
{/if}
