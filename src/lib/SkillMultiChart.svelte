<script lang="ts">
	import type { SkillEntry } from './types';
	import { COURSE_COLORS } from './types';

	let {
		items,
		itemEntries,
		goal,
		unit = '',
		higherIsBetter = true
	}: {
		items: string[];
		itemEntries: Record<string, SkillEntry[]>;
		goal?: number;
		unit?: string;
		higherIsBetter?: boolean;
	} = $props();

	const W = 580;
	const ML = 36,
		MR = 8,
		MT = 14,
		MB = 22;
	const LABEL_GAP = 10,
		LABEL_W = 110,
		LABEL_H = 18,
		LABEL_PAD = 3;
	const CW = W - ML - MR - LABEL_GAP - LABEL_W;
	const LABEL_X = ML + CW + LABEL_GAP;

	let hoveredItem = $state<string | null>(null);

	// Height grows to fit all label rows with comfortable spacing
	const H = $derived(Math.max(160, items.length * (LABEL_H + LABEL_PAD) + MT + MB + 16));
	const CH = $derived(H - MT - MB);

	const allEntries = $derived(Object.values(itemEntries).flat());

	const allTimes = $derived(
		allEntries.map((e) => new Date(e.date + 'T00:00:00').getTime())
	);
	const minT = $derived(allTimes.length ? Math.min(...allTimes) : 0);
	const maxT = $derived(allTimes.length ? Math.max(...allTimes) : 0);
	const spanT = $derived(maxT > minT ? maxT - minT : 86400000 * 14);
	const singleDate = $derived(maxT === minT && allTimes.length > 0);

	function tx(date: string): number {
		if (singleDate) return ML + CW / 2;
		return ML + ((new Date(date + 'T00:00:00').getTime() - minT) / spanT) * CW;
	}

	const allValues = $derived(allEntries.map((e) => e.value));
	const forRange = $derived(goal !== undefined ? [...allValues, goal] : allValues);
	const rawMin = $derived(forRange.length ? Math.min(...forRange) : 0);
	const rawMax = $derived(forRange.length ? Math.max(...forRange) : 100);
	const span = $derived(rawMax - rawMin || 10);
	const yPad = $derived(Math.max(span * 0.15, 2));
	const yMin = $derived(Math.max(0, rawMin - yPad));
	const yMax = $derived(rawMax + yPad);

	function ty(value: number): number {
		return MT + (1 - (value - yMin) / (yMax - yMin)) * CH;
	}

	const goalY = $derived(goal !== undefined ? ty(goal) : null);

	function linePath(pts: [number, number][]): string {
		if (pts.length < 2) return '';
		return pts
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
			.join(' ');
	}

	const lines = $derived(
		items
			.map((item, idx) => {
				const sorted = [...(itemEntries[item] ?? [])].sort((a, b) =>
					a.date.localeCompare(b.date)
				);
				const pts: [number, number][] = sorted.map((e) => [tx(e.date), ty(e.value)]);
				const color = COURSE_COLORS[idx % COURSE_COLORS.length];
				const lastEntry = sorted.at(-1);
				const goalMet =
					goal !== undefined &&
					lastEntry !== undefined &&
					(higherIsBetter ? lastEntry.value >= goal : lastEntry.value <= goal);
				return { item, color, pts, path: linePath(pts), lastEntry, goalMet };
			})
			.filter((l) => l.pts.length > 0)
	);

	// End-of-line labels with collision resolution
	const labels = $derived.by(() => {
		const lbls = lines.map((l) => ({
			item: l.item,
			color: l.color,
			lastEntry: l.lastEntry,
			goalMet: l.goalMet,
			lastX: l.pts[l.pts.length - 1][0],
			naturalY: l.pts[l.pts.length - 1][1],
			y: l.pts[l.pts.length - 1][1] - LABEL_H / 2
		}));

		lbls.sort((a, b) => a.naturalY - b.naturalY);

		for (let i = 1; i < lbls.length; i++) {
			const minY = lbls[i - 1].y + LABEL_H + LABEL_PAD;
			if (lbls[i].y < minY) lbls[i].y = minY;
		}

		const maxY = MT + CH - LABEL_H;
		for (let i = lbls.length - 1; i >= 0; i--) {
			if (lbls[i].y > maxY) lbls[i].y = maxY;
			if (i > 0) {
				const maxPrevY = lbls[i].y - LABEL_H - LABEL_PAD;
				if (lbls[i - 1].y > maxPrevY) lbls[i - 1].y = maxPrevY;
			}
		}

		return lbls;
	});

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
				: [
						{
							x: ML,
							label: new Date(minT).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})
						},
						{
							x: ML + CW,
							label: new Date(maxT).toLocaleDateString('en-US', {
								month: 'short',
								day: 'numeric'
							})
						}
					]
	);

	const yLines = $derived.by(() => {
		const step = yMax - yMin > 40 ? 10 : 5;
		const ticks: number[] = [];
		for (let v = Math.ceil(yMin / step) * step; v <= yMax; v += step) ticks.push(v);
		return ticks;
	});
</script>

{#if lines.length > 0}
	<div class="mt-3 overflow-hidden rounded-lg border border-ctp-surface1 bg-ctp-surface0">
		<svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Skill items progress chart">
			<!-- Grid lines + Y labels -->
			{#each yLines as v}
				<line
					x1={ML}
					y1={ty(v)}
					x2={ML + CW}
					y2={ty(v)}
					stroke="#363a4f"
					stroke-width="1"
				/>
				<text x={ML - 5} y={ty(v) + 4} text-anchor="end" font-size="9" fill="#6e738d">{v}</text>
			{/each}

			<!-- Goal line -->
			{#if goalY !== null && goal !== undefined}
				<line
					x1={ML}
					y1={goalY}
					x2={ML + CW}
					y2={goalY}
					stroke="#a6da95"
					stroke-width="1.5"
					stroke-dasharray="5 3"
					opacity="0.8"
				/>
				<text
					x={ML - 5}
					y={goalY + 4}
					text-anchor="end"
					font-size="9"
					fill="#a6da95"
					font-weight="600">{goal}</text
				>
			{/if}

			<!-- Axes -->
			<line x1={ML} y1={MT} x2={ML} y2={MT + CH} stroke="#494d64" stroke-width="1" />
			<line x1={ML} y1={MT + CH} x2={ML + CW} y2={MT + CH} stroke="#494d64" stroke-width="1" />

			<!-- Item lines and dots -->
			{#each lines as l}
				{@const dim = hoveredItem !== null && hoveredItem !== l.item}
				{#if l.path}
					<path
						d={l.path}
						fill="none"
						stroke={l.color}
						stroke-width="2.5"
						stroke-linecap="round"
						stroke-linejoin="round"
						opacity={dim ? 0.12 : 1}
						style="transition: opacity 0.15s"
					/>
				{/if}
				{#each l.pts as [x, y]}
					<circle
						cx={x}
						cy={y}
						r={l.pts.length === 1 ? 5 : 3.5}
						fill={l.color}
						stroke="#24273a"
						stroke-width="2"
						opacity={dim ? 0.12 : 1}
						style="transition: opacity 0.15s"
					/>
				{/each}
			{/each}

			<!-- End-of-line labels -->
			{#each labels as lbl}
				{@const dim = hoveredItem !== null && hoveredItem !== lbl.item}
				<g
					role="button"
					tabindex="-1"
					opacity={dim ? 0.12 : 1}
					style="transition: opacity 0.15s; cursor: pointer"
					onmouseenter={() => (hoveredItem = lbl.item)}
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
						fill="#24273a"
						stroke={lbl.color}
						stroke-width="1.5"
					/>
					<text
						x={LABEL_X + 5}
						y={lbl.y + LABEL_H - 5}
						font-size="11"
						font-weight="500"
						fill={lbl.color}
					>
						{lbl.item}{lbl.lastEntry ? ': ' + lbl.lastEntry.value + (unit ? ' ' + unit : '') : ''}
						{lbl.goalMet ? ' ★' : ''}
					</text>
				</g>
			{/each}

			<!-- X axis labels -->
			{#each xTicks as tick}
				<text x={tick.x} y={H - 5} text-anchor="middle" font-size="9" fill="#6e738d"
					>{tick.label}</text
				>
			{/each}
		</svg>

		<!-- Legend for items with no data yet -->
		{#if items.some((item) => !(itemEntries[item]?.length))}
			<div
				class="flex flex-wrap gap-x-4 gap-y-0.5 border-t border-ctp-surface1 px-3 py-1.5 text-xs text-ctp-overlay0"
			>
				{#each items as item, idx}
					{#if !(itemEntries[item]?.length)}
						<span class="flex items-center gap-1">
							<span
								class="h-2 w-2 shrink-0 rounded-full"
								style="background:{COURSE_COLORS[idx % COURSE_COLORS.length]}"
							></span>
							{item} — no data
						</span>
					{/if}
				{/each}
			</div>
		{/if}
	</div>
{/if}
