<script lang="ts">
	import type { SkillEntry } from './types';

	let {
		entries,
		goal,
		unit = '',
		higherIsBetter = true,
		light = false
	}: {
		entries: SkillEntry[];
		goal?: number;
		unit?: string;
		higherIsBetter?: boolean;
		light?: boolean;
	} = $props();

	const axisTextColor = $derived(light ? '#8a8175' : '#6e738d');
	const dotStroke = $derived(light ? '#ffffff' : '#1e2030');
	const lineColorMet = $derived(light ? '#3f8f5f' : '#a6da95');
	const lineColorNotMet = $derived(light ? '#4472a8' : '#8aadf4');
	const goalLineColor = $derived(light ? '#3f8f5f' : '#a6da95');

	const W = 420,
		H = 88;
	const ML = 38,
		MR = 62,
		MT = 10,
		MB = 18;
	const CW = W - ML - MR;
	const CH = H - MT - MB;

	const sorted = $derived([...entries].sort((a, b) => a.date.localeCompare(b.date)));
	const allValues = $derived(sorted.map((e) => e.value));
	const lastValue = $derived(allValues.length ? allValues[allValues.length - 1] : null);

	const goalMet = $derived(
		goal !== undefined &&
			lastValue !== null &&
			(higherIsBetter ? lastValue >= goal : lastValue <= goal)
	);

	const allForRange = $derived(goal !== undefined ? [...allValues, goal] : allValues);
	const rawMin = $derived(allForRange.length ? Math.min(...allForRange) : 0);
	const rawMax = $derived(allForRange.length ? Math.max(...allForRange) : 10);
	const span = $derived(rawMax - rawMin || 10);
	const yPad = $derived(Math.max(span * 0.22, 1));
	const yMin = $derived(Math.max(0, rawMin - yPad));
	const yMax = $derived(rawMax + yPad);

	const times = $derived(
		sorted.map((e) => new Date(e.date + 'T00:00:00').getTime())
	);
	const minT = $derived(times.length ? Math.min(...times) : 0);
	const maxT = $derived(times.length ? Math.max(...times) : 0);
	const spanT = $derived(maxT > minT ? maxT - minT : 86400000 * 7);

	function tx(date: string): number {
		if (times.length <= 1) return ML + CW / 2;
		return ML + ((new Date(date + 'T00:00:00').getTime() - minT) / spanT) * CW;
	}

	function ty(value: number): number {
		return MT + (1 - (value - yMin) / (yMax - yMin)) * CH;
	}

	const pts = $derived(sorted.map((e) => [tx(e.date), ty(e.value)] as [number, number]));
	const goalY = $derived(goal !== undefined ? ty(goal) : null);

	function linePath(points: [number, number][]): string {
		if (points.length < 2) return '';
		return points
			.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`)
			.join(' ');
	}

	const lineColor = $derived(goalMet ? lineColorMet : lineColorNotMet);

	const xLabels = $derived.by(() => {
		if (sorted.length === 0) return [];
		if (sorted.length === 1)
			return [
				{
					x: ML + CW / 2,
					label: new Date(sorted[0].date + 'T00:00:00').toLocaleDateString('en-US', {
						month: 'short',
						day: 'numeric'
					})
				}
			];
		return [
			{
				x: ML,
				label: new Date(minT).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
			},
			{
				x: ML + CW,
				label: new Date(maxT).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
			}
		];
	});

	function fmt(v: number): string {
		return unit ? `${v} ${unit}` : `${v}`;
	}

	// Clamp goal label Y so it doesn't clip at chart edges
	const goalLabelY = $derived(goalY !== null ? Math.min(Math.max(goalY, MT + 10), MT + CH - 2) : null);
</script>

{#if sorted.length > 0}
	<div class="mt-3 overflow-hidden rounded-lg border {light ? 'border-[#e6ddc9] bg-white' : 'border-ctp-surface1 bg-ctp-mantle'}">
		<svg viewBox="0 0 {W} {H}" class="w-full" role="img" aria-label="Skill progress chart">
			<!-- Current value label (left axis, at last dot) -->
			{#if pts.length > 0}
				{@const cy = pts[pts.length - 1][1]}
				<text
					x={ML - 5}
					y={Math.min(Math.max(cy + 4, MT + 10), MT + CH)}
					text-anchor="end"
					font-size="10"
					font-weight="600"
					fill={lineColor}
				>{sorted[sorted.length - 1].value}</text>
			{/if}

			<!-- Goal line -->
			{#if goalY !== null && goal !== undefined && goalLabelY !== null}
				<line
					x1={ML}
					y1={goalY}
					x2={ML + CW}
					y2={goalY}
					stroke={goalLineColor}
					stroke-width="1.5"
					stroke-dasharray="5 3"
					opacity="0.75"
				/>
				<text x={ML + CW + 5} y={goalLabelY - 1} font-size="9" fill={goalLineColor} font-weight="600"
					>goal</text
				>
				<text x={ML + CW + 5} y={goalLabelY + 9} font-size="9" fill={goalLineColor}>{fmt(goal)}</text>
			{/if}

			<!-- Trend line -->
			{#if pts.length >= 2}
				<path
					d={linePath(pts)}
					fill="none"
					stroke={lineColor}
					stroke-width="2.5"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
			{/if}

			<!-- Dots -->
			{#each pts as [x, y]}
				<circle
					cx={x}
					cy={y}
					r={pts.length === 1 ? 5 : 3.5}
					fill={lineColor}
					stroke={dotStroke}
					stroke-width="2"
				/>
			{/each}

			<!-- X axis date labels -->
			{#each xLabels as tick}
				<text x={tick.x} y={H - 3} text-anchor="middle" font-size="9" fill={axisTextColor}
					>{tick.label}</text
				>
			{/each}

			<!-- Goal met banner -->
			{#if goalMet}
				<text
					x={ML + CW / 2}
					y={MT + 11}
					text-anchor="middle"
					font-size="10"
					fill={goalLineColor}
					font-weight="700"
				>★ Goal reached!</text>
			{/if}
		</svg>
	</div>
{/if}
