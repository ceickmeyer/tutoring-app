<script lang="ts">
	import type { Course } from './types';

	let { courses, light = false }: { courses: Course[]; light?: boolean } = $props();

	const gridColor = $derived(light ? '#e6ddc9' : '#363a4f');
	const axisTextColor = $derived(light ? '#8a8175' : '#6e738d');
	const axisLineColor = $derived(light ? '#d8cfba' : '#494d64');
	const dotStroke = $derived(light ? '#ffffff' : '#24273a');
	const labelBoxFill = $derived(light ? '#ffffff' : '#24273a');

	// SVG canvas layout
	const W = 820,
		H = 300;
	const ML = 40,
		MR = 8,
		MT = 14,
		MB = 30;
	const LABEL_GAP = 12;
	const LABEL_W = 180;
	const LABEL_H = 24;
	const LABEL_PAD = 4;
	const CW = W - ML - MR - LABEL_GAP - LABEL_W; // 580
	const CH = H - MT - MB; // 256
	const LABEL_X = ML + CW + LABEL_GAP; // 632

	// Collect every timestamp across all courses
	const allTimes = $derived(
		courses.flatMap((c) => c.entries.map((e) => new Date(e.date + 'T00:00:00').getTime()))
	);

	const minT = $derived(allTimes.length ? allTimes.reduce((a, b) => Math.min(a, b)) : 0);
	const maxT = $derived(allTimes.length ? allTimes.reduce((a, b) => Math.max(a, b)) : 0);
	// If all entries share one date, spread the axis over 2 weeks so the dot is centered
	const spanT = $derived(maxT > minT ? maxT - minT : 86400000 * 14);
	const singleDate = $derived(maxT === minT && allTimes.length > 0);

	function tx(date: string): number {
		if (singleDate) return ML + CW / 2;
		return ML + ((new Date(date + 'T00:00:00').getTime() - minT) / spanT) * CW;
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
				return {
					id: c.id,
					name: c.name,
					color: c.color,
					pts,
					path: curvePath(pts),
					lastGrade: sorted[sorted.length - 1].grade,
					prevGrade: sorted.length >= 2 ? sorted[sorted.length - 2].grade : null
				};
			})
	);

	// End-of-line labels with collision resolution and trend indicators
	const labels = $derived.by(() => {
		const items = lines.map((l) => {
			const delta = l.prevGrade !== null ? l.lastGrade - l.prevGrade : null;
			const trend = delta === null ? '' : delta > 1 ? 'up' : delta < -1 ? 'down' : 'flat';
			return {
				name: l.name,
				color: l.color,
				grade: l.lastGrade,
				trend,
				lastX: l.pts[l.pts.length - 1][0],
				naturalY: l.pts[l.pts.length - 1][1],
				y: l.pts[l.pts.length - 1][1] - LABEL_H / 2
			};
		});

		items.sort((a, b) => a.naturalY - b.naturalY);

		// Forward pass: push labels down to avoid overlap
		for (let i = 1; i < items.length; i++) {
			const minY = items[i - 1].y + LABEL_H + LABEL_PAD;
			if (items[i].y < minY) items[i].y = minY;
		}

		// Backward pass: clamp to chart bottom, then pull overlapping labels up
		const maxY = MT + CH - LABEL_H;
		for (let i = items.length - 1; i >= 0; i--) {
			if (items[i].y > maxY) items[i].y = maxY;
			if (i > 0) {
				const maxPrevY = items[i].y - LABEL_H - LABEL_PAD;
				if (items[i - 1].y > maxPrevY) items[i - 1].y = maxPrevY;
			}
		}

		return items;
	});

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

	let hoveredItem = $state<string | null>(null);

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
	<div class="overflow-hidden rounded-lg border {light ? 'border-[#e6ddc9] bg-white' : 'border-ctp-surface1 bg-ctp-surface0'}">
		<svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Grade history chart">
			<!-- Horizontal grid lines + Y labels -->
			{#each yLines as y}
				<line x1={ML} y1={ty(y)} x2={ML + CW} y2={ty(y)} stroke={gridColor} stroke-width="1" />
				<text x={ML - 6} y={ty(y) + 4} text-anchor="end" fill={axisTextColor} font-size="10">{y}</text>
			{/each}

			<!-- X axis date labels -->
			{#each xTicks as tick}
				<text x={tick.x} y={H - 6} text-anchor="middle" fill={axisTextColor} font-size="10"
					>{tick.label}</text
				>
			{/each}

			<!-- Axis borders -->
			<line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke={axisLineColor} stroke-width="1" />
			<line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke={axisLineColor} stroke-width="1" />

			<!-- Course lines -->
			{#each lines as line}
				{@const dim = hoveredItem !== null && hoveredItem !== line.name}
				{#if line.path}
					<path
						d={line.path}
						fill="none"
						stroke={line.color}
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						opacity={dim ? 0.12 : 1}
						style="transition: opacity 0.15s"
					/>
				{/if}
				<!-- Data point dots -->
				{#each line.pts as [x, y]}
					<circle
						cx={x}
						cy={y}
						r={line.pts.length === 1 ? 5 : 3.5}
						fill={line.color}
						stroke={dotStroke}
						stroke-width="2"
						opacity={dim ? 0.12 : 1}
						style="transition: opacity 0.15s"
					/>
				{/each}
			{/each}

			<!-- End-of-line labels -->
			{#each labels as lbl}
				{@const dim = hoveredItem !== null && hoveredItem !== lbl.name}
				<g
					role="button"
					tabindex="-1"
					opacity={dim ? 0.12 : 1}
					style="transition: opacity 0.15s; cursor: pointer"
					onmouseenter={() => (hoveredItem = lbl.name)}
					onmouseleave={() => (hoveredItem = null)}
				>
					<line
						x1={lbl.lastX}
						y1={lbl.naturalY}
						x2={LABEL_X}
						y2={lbl.y + LABEL_H / 2}
						stroke={lbl.color}
						stroke-width="1"
						stroke-dasharray="3 2"
						opacity="0.5"
					/>
					<rect
						x={LABEL_X}
						y={lbl.y}
						width={LABEL_W}
						height={LABEL_H}
						rx="3"
						fill={labelBoxFill}
						stroke={lbl.color}
						stroke-width="1.5"
					/>
					<!-- Trend icon: 10×10, centered vertically in label -->
					{#if lbl.trend}
						<g transform="translate({LABEL_X + 5}, {lbl.y + LABEL_H / 2 - 5}) scale({10 / 24})">
							{#if lbl.trend === 'up'}
								<path
									fill-rule="evenodd"
									clip-rule="evenodd"
									d="M12 7C12.2652 7 12.5196 7.10536 12.7071 7.29289L19.7071 14.2929C20.0976 14.6834 20.0976 15.3166 19.7071 15.7071C19.3166 16.0976 18.6834 16.0976 18.2929 15.7071L12 9.41421L5.70711 15.7071C5.31658 16.0976 4.68342 16.0976 4.29289 15.7071C3.90237 15.3166 3.90237 14.6834 4.29289 14.2929L11.2929 7.29289C11.4804 7.10536 11.7348 7 12 7Z"
									fill={lbl.color}
								/>
							{:else if lbl.trend === 'down'}
								<g transform="rotate(180, 12, 12)">
									<path
										fill-rule="evenodd"
										clip-rule="evenodd"
										d="M12 7C12.2652 7 12.5196 7.10536 12.7071 7.29289L19.7071 14.2929C20.0976 14.6834 20.0976 15.3166 19.7071 15.7071C19.3166 16.0976 18.6834 16.0976 18.2929 15.7071L12 9.41421L5.70711 15.7071C5.31658 16.0976 4.68342 16.0976 4.29289 15.7071C3.90237 15.3166 3.90237 14.6834 4.29289 14.2929L11.2929 7.29289C11.4804 7.10536 11.7348 7 12 7Z"
										fill={lbl.color}
									/>
								</g>
							{:else}
								<path
									d="M3 12L21 12"
									stroke={lbl.color}
									stroke-width="2"
									stroke-linecap="round"
									stroke-linejoin="round"
								/>
							{/if}
						</g>
						<text x={LABEL_X + 19} y={lbl.y + LABEL_H - 7} font-size="12" font-weight="500" fill={lbl.color}
							>{lbl.name} – {lbl.grade}%</text
						>
					{:else}
						<text x={LABEL_X + 6} y={lbl.y + LABEL_H - 7} font-size="12" font-weight="500" fill={lbl.color}
							>{lbl.name} – {lbl.grade}%</text
						>
					{/if}
				</g>
			{/each}
		</svg>

		<!-- Legend -->
		{#if lines.length > 1}
			<div class="flex flex-wrap gap-x-5 gap-y-1 border-t {light ? 'border-[#e6ddc9] text-[#6b6259]' : 'border-ctp-surface1 text-ctp-subtext1'} px-4 py-2.5 text-xs">
				{#each lines as line}
					<span class="flex items-center gap-1.5">
						<span class="h-2.5 w-2.5 shrink-0 rounded-full" style="background:{line.color}"></span>
						{line.name}
					</span>
				{/each}
			</div>
		{/if}
	</div>
{/if}
