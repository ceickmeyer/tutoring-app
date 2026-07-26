<script lang="ts">
	import { store } from '$lib/store.svelte';
	import type { SkillBankItem, SkillType } from '$lib/types';

	const TYPE_LABELS: Record<SkillType, string> = {
		status: 'Status',
		scored: 'Scored',
		multi: 'Multi'
	};

	let search = $state('');

	const allCategories = $derived([...new Set(store.skillBank.map((s) => s.category))].sort());

	const filteredCategories = $derived.by(() => {
		const q = search.trim().toLowerCase();
		if (!q) return allCategories;
		return allCategories.filter((cat) =>
			store.skillBank.some(
				(s) => s.category === cat && (s.name.toLowerCase().includes(q) || cat.toLowerCase().includes(q))
			)
		);
	});

	function skillsInCategory(cat: string) {
		const q = search.trim().toLowerCase();
		return store.skillBank.filter(
			(s) => s.category === cat && (!q || s.name.toLowerCase().includes(q) || cat.toLowerCase().includes(q))
		);
	}

	function catAnchor(cat: string): string {
		return 'cat-' + cat.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
	}

	// ── Collapsible categories ─────────────────────────────────────
	let expandedCats = $state<Set<string>>(new Set());
	const isSearching = $derived(search.trim().length > 0);

	function isExpanded(cat: string): boolean {
		return isSearching || expandedCats.has(cat);
	}

	function toggleCat(cat: string) {
		const next = new Set(expandedCats);
		if (next.has(cat)) next.delete(cat);
		else next.add(cat);
		expandedCats = next;
	}

	function expandAll() {
		expandedCats = new Set(allCategories);
	}

	function collapseAll() {
		expandedCats = new Set();
	}

	function jumpTo(cat: string) {
		const next = new Set(expandedCats);
		next.add(cat);
		expandedCats = next;
		requestAnimationFrame(() => {
			document.getElementById(catAnchor(cat))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}

	// ── Bulk select / delete ────────────────────────────────────────
	let bulkSelectMode = $state(false);
	let selectedForDelete = $state<Set<string>>(new Set());
	let confirmBulkDelete = $state(false);

	function toggleBulkSelectMode() {
		bulkSelectMode = !bulkSelectMode;
		selectedForDelete = new Set();
		confirmBulkDelete = false;
		if (bulkSelectMode) expandAll();
	}

	function toggleSelectForDelete(id: string) {
		const next = new Set(selectedForDelete);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		selectedForDelete = next;
	}

	function toggleSelectAllForDeleteInCategory(cat: string) {
		const ids = skillsInCategory(cat).map((s) => s.id);
		const allSelected = ids.every((id) => selectedForDelete.has(id));
		const next = new Set(selectedForDelete);
		if (allSelected) ids.forEach((id) => next.delete(id));
		else ids.forEach((id) => next.add(id));
		selectedForDelete = next;
	}

	function confirmDeleteSelected() {
		for (const id of selectedForDelete) store.removeSkill(id);
		selectedForDelete = new Set();
		confirmBulkDelete = false;
		bulkSelectMode = false;
	}

	// ── Single skill add form ──────────────────────────────────────
	let newSkillName = $state('');
	let newSkillCategory = $state('');
	let newSkillDescription = $state('');
	let newSkillExample = $state('');
	let newSkillType = $state<SkillType>('status');
	let newSkillUnit = $state('');
	let newSkillHigher = $state(true);
	let newSkillGoal = $state<number | null>(null);
	let newSkillItems = $state('');

	function addSkill() {
		if (!newSkillName.trim()) return;
		const parsedItems = newSkillItems.split(',').map((s) => s.trim()).filter(Boolean);
		store.addSkill({
			id: crypto.randomUUID(),
			name: newSkillName.trim(),
			category: newSkillCategory.trim() || 'General',
			description: newSkillDescription.trim(),
			example: newSkillExample.trim(),
			type: newSkillType,
			unit: newSkillUnit.trim(),
			higherIsBetter: newSkillHigher,
			goal: newSkillGoal !== null && !isNaN(newSkillGoal) ? newSkillGoal : undefined,
			items: newSkillType === 'multi' && parsedItems.length ? parsedItems : undefined
		} satisfies SkillBankItem);
		newSkillName = '';
		newSkillDescription = '';
		newSkillExample = '';
		newSkillUnit = '';
		newSkillGoal = null;
		newSkillItems = '';
	}

	// ── Bulk add ──────────────────────────────────────────────────
	let showBulkAdd = $state(false);
	let bulkCategory = $state('');
	let bulkType = $state<SkillType>('status');
	let bulkUnit = $state('');
	let bulkHigher = $state(true);
	let bulkGoal = $state<number | null>(null);
	let bulkNames = $state('');
	let bulkAddedMsg = $state('');

	// One skill per line. "Name" · "Name | Example" · "Name | Description | Example"
	function parseBulkLine(line: string): { name: string; description: string; example: string } {
		const parts = line.split('|').map((p) => p.trim());
		const name = parts[0] ?? '';
		if (parts.length >= 3) return { name, description: parts[1], example: parts[2] };
		if (parts.length === 2) return { name, description: '', example: parts[1] };
		return { name, description: '', example: '' };
	}

	const bulkParsed = $derived(
		bulkNames
			.split('\n')
			.map(parseBulkLine)
			.filter((l) => l.name)
	);

	function addBulkSkills() {
		if (!bulkParsed.length) return;
		for (const { name, description, example } of bulkParsed) {
			store.addSkill({
				id: crypto.randomUUID(),
				name,
				category: bulkCategory.trim() || 'General',
				description,
				example,
				type: bulkType,
				unit: bulkUnit.trim(),
				higherIsBetter: bulkHigher,
				goal: bulkGoal !== null && !isNaN(bulkGoal) ? bulkGoal : undefined,
				items: undefined
			} satisfies SkillBankItem);
		}
		bulkAddedMsg = `Added ${bulkParsed.length} skill${bulkParsed.length === 1 ? '' : 's'} to ${bulkCategory.trim() || 'General'}.`;
		bulkNames = '';
		setTimeout(() => (bulkAddedMsg = ''), 3000);
	}

	// ── Inline edit ──────────────────────────────────────────────
	let editingSkillId = $state<string | null>(null);
	let editSkillName = $state('');
	let editSkillCategory = $state('');
	let editSkillDescription = $state('');
	let editSkillExample = $state('');
	let editSkillType = $state<SkillType>('status');
	let editSkillUnit = $state('');
	let editSkillHigher = $state(true);
	let editSkillGoal = $state<number | null>(null);
	let editSkillItems = $state('');
	let showDeleteConfirm = $state<string | null>(null);

	function startEditSkill(skill: SkillBankItem) {
		editingSkillId = skill.id;
		editSkillName = skill.name;
		editSkillCategory = skill.category;
		editSkillDescription = skill.description;
		editSkillExample = skill.example ?? '';
		editSkillType = skill.type;
		editSkillUnit = skill.unit;
		editSkillHigher = skill.higherIsBetter;
		editSkillGoal = skill.goal ?? null;
		editSkillItems = skill.items?.join(', ') ?? '';
	}

	function saveEditSkill() {
		if (!editingSkillId || !editSkillName.trim()) return;
		const parsedItems = editSkillItems.split(',').map((s) => s.trim()).filter(Boolean);
		store.updateSkill(editingSkillId, {
			name: editSkillName.trim(),
			category: editSkillCategory.trim() || 'General',
			description: editSkillDescription.trim(),
			example: editSkillExample.trim(),
			type: editSkillType,
			unit: editSkillUnit.trim(),
			higherIsBetter: editSkillHigher,
			goal: editSkillGoal !== null && !isNaN(editSkillGoal) ? editSkillGoal : undefined,
			items: editSkillType === 'multi' && parsedItems.length ? parsedItems : undefined
		});
		editingSkillId = null;
	}

	function confirmRemoveSkill(id: string) {
		store.removeSkill(id);
		showDeleteConfirm = null;
		editingSkillId = null;
	}

	const inputClass =
		'w-full rounded border border-ctp-surface2 bg-ctp-surface1 px-3 py-1.5 text-sm text-ctp-text placeholder:text-ctp-overlay0 focus:border-ctp-blue focus:outline-none focus:ring-1 focus:ring-ctp-blue/30';
</script>

<div class="min-h-screen bg-ctp-base">
	<header class="border-b border-ctp-surface0 bg-ctp-mantle px-6 py-4">
		<div class="mx-auto max-w-6xl">
			<a href="/" class="text-sm text-ctp-subtext0 hover:text-ctp-text">← Students</a>
			<div class="mt-2 flex items-center justify-between gap-4">
				<h1 class="text-2xl font-bold text-ctp-text">Skill Bank</h1>
				<p class="text-sm text-ctp-overlay0">{store.skillBank.length} skill{store.skillBank.length === 1 ? '' : 's'} in {allCategories.length} categor{allCategories.length === 1 ? 'y' : 'ies'}</p>
			</div>
		</div>
	</header>

	<main class="mx-auto max-w-6xl gap-4 p-6 lg:grid lg:grid-cols-[220px_1fr] lg:items-start">
		<!-- Category jump sidebar -->
		{#if allCategories.length > 1}
			<div class="mb-4 rounded-xl bg-ctp-surface0 p-3 shadow-sm lg:sticky lg:top-6 lg:mb-0 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto">
				<div class="mb-2 flex items-center justify-between px-1">
					<p class="text-xs font-semibold uppercase tracking-wide text-ctp-overlay0">Categories</p>
					<div class="flex gap-2 text-xs">
						<button onclick={expandAll} class="text-ctp-blue hover:text-ctp-lavender">Expand</button>
						<button onclick={collapseAll} class="text-ctp-overlay0 hover:text-ctp-subtext0">Collapse</button>
					</div>
				</div>
				<div class="space-y-0.5">
					{#each allCategories as cat}
						<button
							onclick={() => jumpTo(cat)}
							class="flex w-full items-center justify-between rounded px-2 py-1 text-left text-xs text-ctp-subtext1 transition-colors hover:bg-ctp-surface1 hover:text-ctp-text"
						>
							<span class="truncate">{cat}</span>
							<span class="ml-2 shrink-0 text-ctp-overlay0">{skillsInCategory(cat).length}</span>
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<div class="space-y-4">
			<!-- Search -->
			<div class="rounded-xl bg-ctp-surface0 p-4 shadow-sm">
				<input
					bind:value={search}
					class={inputClass}
					placeholder="Search skills or categories…"
				/>
			</div>

			<!-- Skill list -->
			<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
				{#if store.skillBank.length === 0}
					<p class="text-sm text-ctp-overlay0">No skills yet. Add some below — try pasting a whole list with Bulk Add.</p>
				{:else if filteredCategories.length === 0}
					<p class="text-sm text-ctp-overlay0">No skills match "{search}".</p>
				{:else}
					<div class="mb-3 flex items-center justify-end">
						<button onclick={toggleBulkSelectMode} class="text-xs font-medium {bulkSelectMode ? 'text-ctp-overlay0 hover:text-ctp-subtext0' : 'text-ctp-blue hover:text-ctp-lavender'}">
							{bulkSelectMode ? 'Cancel' : 'Select multiple'}
						</button>
					</div>
					<div class="space-y-3">
						{#each filteredCategories as cat}
							{@const idsInCat = skillsInCategory(cat).map((s) => s.id)}
							{@const allSelected = idsInCat.length > 0 && idsInCat.every((id) => selectedForDelete.has(id))}
							<div id={catAnchor(cat)} class="scroll-mt-6">
								<div class="flex items-center justify-between gap-2">
									<button
										onclick={() => toggleCat(cat)}
										class="flex flex-1 items-center gap-1.5 py-1 text-left text-xs font-semibold uppercase tracking-wide text-ctp-overlay0 hover:text-ctp-subtext0"
									>
										<span class="inline-block w-3 text-ctp-overlay0/70">{isExpanded(cat) ? '▾' : '▸'}</span>
										{cat} <span class="text-ctp-overlay0/60">({skillsInCategory(cat).length})</span>
									</button>
									{#if bulkSelectMode}
										<button onclick={() => toggleSelectAllForDeleteInCategory(cat)} class="shrink-0 text-xs text-ctp-blue hover:text-ctp-lavender">
											{allSelected ? 'Clear' : 'Select all'}
										</button>
									{/if}
								</div>
								{#if isExpanded(cat)}
									<div class="mt-1.5 space-y-1.5 pl-4">
										{#each skillsInCategory(cat) as skill}
									<div class="rounded-lg border border-ctp-surface1 bg-ctp-mantle px-3 py-2">
										{#if editingSkillId === skill.id}
											<div class="space-y-2">
												<div class="grid grid-cols-2 gap-2">
													<input bind:value={editSkillName} class={inputClass} placeholder="Skill name" />
													<input bind:value={editSkillCategory} class={inputClass} placeholder="Category" />
												</div>
												<textarea bind:value={editSkillDescription} rows="2" class="{inputClass} resize-none" placeholder="Description for parents"></textarea>
												<input bind:value={editSkillExample} class={inputClass} placeholder="Example (e.g. 518 = 500+10+8)" />
												<div class="flex flex-wrap items-center gap-3">
													<div class="flex items-center gap-2">
														<span class="text-xs text-ctp-subtext0">Type:</span>
														{#each [['status', 'Status'], ['scored', 'Scored'], ['multi', 'Multi']] as [val, lbl]}
															<button onclick={() => (editSkillType = val as SkillType)} class="{editSkillType === val ? 'bg-ctp-blue text-ctp-crust' : 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} rounded px-2 py-0.5 text-xs font-medium transition-colors">{lbl}</button>
														{/each}
													</div>
													{#if editSkillType === 'scored' || editSkillType === 'multi'}
														<input bind:value={editSkillUnit} class="w-24 rounded border border-ctp-surface2 bg-ctp-surface1 px-2 py-0.5 text-xs" placeholder="Unit" />
														<label class="flex items-center gap-1.5 text-xs text-ctp-subtext0 cursor-pointer">
															<input type="checkbox" bind:checked={editSkillHigher} class="rounded" />
															Higher is better
														</label>
														<div class="flex items-center gap-1.5">
															<span class="text-xs text-ctp-subtext0">Goal:</span>
															<input type="number" bind:value={editSkillGoal} class="w-24 rounded border border-ctp-surface2 bg-ctp-surface1 px-2 py-0.5 text-xs" placeholder="e.g. 30" />
															{#if editSkillUnit}<span class="text-xs text-ctp-overlay0">{editSkillUnit}</span>{/if}
														</div>
													{/if}
													{#if editSkillType === 'multi'}
														<div class="w-full">
															<input bind:value={editSkillItems} class="w-full rounded border border-ctp-surface2 bg-ctp-surface1 px-2 py-0.5 text-xs" placeholder="Items, comma-separated (e.g. 2s, 3s, 4s, 5s)" />
														</div>
													{/if}
												</div>
												<div class="flex items-center gap-2">
													<button onclick={saveEditSkill} class="rounded bg-ctp-blue px-2.5 py-1 text-xs font-medium text-ctp-crust hover:opacity-90">Save</button>
													<button onclick={() => (editingSkillId = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
													{#if showDeleteConfirm === skill.id}
														<span class="ml-auto text-xs text-ctp-red">Delete "{skill.name}"?</span>
														<button onclick={() => confirmRemoveSkill(skill.id)} class="text-xs font-medium text-ctp-red hover:opacity-80">Confirm</button>
														<button onclick={() => (showDeleteConfirm = null)} class="text-xs text-ctp-overlay0 hover:text-ctp-subtext0">No</button>
													{:else}
														<button onclick={() => (showDeleteConfirm = skill.id)} class="ml-auto text-xs text-ctp-red/60 hover:text-ctp-red transition-colors">Remove skill</button>
													{/if}
												</div>
											</div>
										{:else}
											<div class="flex items-start justify-between gap-3">
												<label class="flex flex-1 items-start gap-2 {bulkSelectMode ? 'cursor-pointer' : ''}">
													{#if bulkSelectMode}
														<input
															type="checkbox"
															checked={selectedForDelete.has(skill.id)}
															onchange={() => toggleSelectForDelete(skill.id)}
															class="mt-0.5 shrink-0 rounded"
														/>
													{/if}
													<div>
														<div class="flex items-center gap-2">
															<span class="text-sm text-ctp-text">{skill.name}</span>
															<span class="rounded-full bg-ctp-surface1 px-2 py-0.5 text-xs text-ctp-overlay0">
																{TYPE_LABELS[skill.type]}{skill.unit ? ` · ${skill.unit}${skill.higherIsBetter ? ' ↑' : ' ↓'}` : ''}
															</span>
														</div>
														{#if skill.description}
															<p class="mt-0.5 whitespace-pre-wrap text-xs text-ctp-subtext0">{skill.description}</p>
														{/if}
														{#if skill.example}
															<p class="mt-0.5 text-xs italic text-ctp-overlay0">Example: {skill.example}</p>
														{/if}
													</div>
												</label>
												{#if !bulkSelectMode}
													<button onclick={() => startEditSkill(skill)} class="shrink-0 text-xs text-ctp-overlay0 hover:text-ctp-subtext0 transition-colors">Edit</button>
												{/if}
											</div>
										{/if}
									</div>
								{/each}
							</div>
								{/if}
						</div>
					{/each}
				</div>
					{#if bulkSelectMode && selectedForDelete.size > 0}
						<div class="sticky bottom-4 z-10 mt-4 flex items-center gap-3 rounded-lg border border-ctp-red/30 bg-ctp-mantle px-4 py-3 shadow-lg">
							{#if confirmBulkDelete}
								<span class="text-sm text-ctp-red">Delete {selectedForDelete.size} skill{selectedForDelete.size === 1 ? '' : 's'}? This also removes them from any student they're assigned to.</span>
								<button onclick={confirmDeleteSelected} class="ml-auto shrink-0 rounded bg-ctp-red px-3 py-1.5 text-xs font-medium text-ctp-crust hover:opacity-90">Confirm delete</button>
								<button onclick={() => (confirmBulkDelete = false)} class="shrink-0 text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
							{:else}
								<span class="text-sm text-ctp-text">{selectedForDelete.size} skill{selectedForDelete.size === 1 ? '' : 's'} selected</span>
								<button onclick={() => (confirmBulkDelete = true)} class="ml-auto shrink-0 rounded bg-ctp-red/90 px-3 py-1.5 text-xs font-medium text-ctp-crust hover:opacity-90">Delete selected</button>
								<button onclick={toggleBulkSelectMode} class="shrink-0 text-xs text-ctp-overlay0 hover:text-ctp-subtext0">Cancel</button>
							{/if}
						</div>
					{/if}
			{/if}
		</section>

		<!-- Add single skill -->
		<section class="rounded-xl bg-ctp-surface0 p-5 shadow-sm">
			<div class="mb-3 flex items-center justify-between">
				<p class="text-xs font-semibold uppercase tracking-wide text-ctp-overlay0">Add Skill</p>
				<button onclick={() => (showBulkAdd = !showBulkAdd)} class="text-xs font-medium text-ctp-blue hover:text-ctp-lavender">
					{showBulkAdd ? '← Single add' : 'Bulk add many at once →'}
				</button>
			</div>

			{#if !showBulkAdd}
				<div class="space-y-2">
					<div class="grid grid-cols-2 gap-2">
						<input bind:value={newSkillName} class={inputClass} placeholder="Skill name" onkeydown={(e) => e.key === 'Enter' && addSkill()} />
						<input bind:value={newSkillCategory} class={inputClass} placeholder="Category (e.g. Math)" onkeydown={(e) => e.key === 'Enter' && addSkill()} />
					</div>
					<textarea
						bind:value={newSkillDescription}
						rows="2"
						class="{inputClass} resize-none"
						placeholder="Description for parents (e.g. Student can recall multiplication facts 0–12 within 3 seconds)"
					></textarea>
					<input bind:value={newSkillExample} class={inputClass} placeholder="Example (e.g. 518 = 500+10+8)" onkeydown={(e) => e.key === 'Enter' && addSkill()} />
					<div class="flex flex-wrap items-center gap-3">
						<div class="flex items-center gap-2">
							<span class="text-xs text-ctp-subtext0">Type:</span>
							{#each [['status', 'Status'], ['scored', 'Scored'], ['multi', 'Multi']] as [val, label]}
								<button
									onclick={() => (newSkillType = val as SkillType)}
									class="{newSkillType === val ? 'bg-ctp-blue text-ctp-crust' : 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} rounded px-2.5 py-1 text-xs font-medium transition-colors"
								>{label}</button>
							{/each}
						</div>
						{#if newSkillType === 'scored' || newSkillType === 'multi'}
							<input bind:value={newSkillUnit} class="w-28 rounded border border-ctp-surface2 bg-ctp-surface1 px-2.5 py-1 text-xs" placeholder="Unit (wpm, sec…)" />
							<label class="flex items-center gap-1.5 text-xs text-ctp-subtext0 cursor-pointer">
								<input type="checkbox" bind:checked={newSkillHigher} class="rounded" />
								Higher is better
							</label>
							<div class="flex items-center gap-1.5">
								<span class="text-xs text-ctp-subtext0">Goal:</span>
								<input type="number" bind:value={newSkillGoal} class="w-24 rounded border border-ctp-surface2 bg-ctp-surface1 px-2.5 py-1 text-xs" placeholder="e.g. 100" />
								{#if newSkillUnit}<span class="text-xs text-ctp-overlay0">{newSkillUnit}</span>{/if}
							</div>
						{/if}
						{#if newSkillType === 'multi'}
							<div class="flex items-center gap-1.5">
								<span class="text-xs text-ctp-subtext0">Items:</span>
								<input bind:value={newSkillItems} class="w-56 rounded border border-ctp-surface2 bg-ctp-surface1 px-2.5 py-1 text-xs" placeholder="2s, 3s, 5s, 9s, 10s" />
							</div>
						{/if}
					</div>
					<button onclick={addSkill} class="rounded bg-ctp-blue px-3 py-1.5 text-xs font-medium text-ctp-crust hover:opacity-90 transition-opacity">+ Add to Bank</button>
				</div>
			{:else}
				<div class="space-y-2">
					<p class="text-xs text-ctp-subtext0">
						Paste one skill per line — perfect for a whole curriculum list (e.g. all 2nd grade math skills) at once. They'll all share the same category and type below; fine-tune individual skills afterward.
					</p>
					<div class="rounded-lg border border-ctp-surface1 bg-ctp-mantle px-3 py-2 text-xs">
						<p class="mb-1.5 text-ctp-subtext0">Add more detail to a line by separating with "|":</p>
						<div class="space-y-1 text-ctp-overlay0">
							<p><span class="text-ctp-subtext1">Just a name:</span> Skip counting by 5s</p>
							<p><span class="text-ctp-subtext1">+ an example:</span> Skip counting by 5s | 5, 10, 15, 20…</p>
							<p><span class="text-ctp-subtext1">+ a description too:</span> Skip counting by 5s | Count up by 5s starting from any number | 5, 10, 15, 20…</p>
						</div>
					</div>
					<div class="grid grid-cols-2 gap-2">
						<input bind:value={bulkCategory} class={inputClass} placeholder="Category (e.g. Math — 2nd Grade)" />
						<div class="flex items-center gap-2">
							<span class="text-xs text-ctp-subtext0">Type:</span>
							{#each [['status', 'Status'], ['scored', 'Scored']] as [val, label]}
								<button
									onclick={() => (bulkType = val as SkillType)}
									class="{bulkType === val ? 'bg-ctp-blue text-ctp-crust' : 'bg-ctp-surface1 text-ctp-subtext1 hover:bg-ctp-surface2'} rounded px-2.5 py-1 text-xs font-medium transition-colors"
								>{label}</button>
							{/each}
							<span class="text-xs text-ctp-overlay0/70">(Multi-item skills need per-skill items — add those individually)</span>
						</div>
					</div>
					{#if bulkType === 'scored'}
						<div class="flex flex-wrap items-center gap-3">
							<input bind:value={bulkUnit} class="w-28 rounded border border-ctp-surface2 bg-ctp-surface1 px-2.5 py-1 text-xs" placeholder="Unit (wpm, sec…)" />
							<label class="flex items-center gap-1.5 text-xs text-ctp-subtext0 cursor-pointer">
								<input type="checkbox" bind:checked={bulkHigher} class="rounded" />
								Higher is better
							</label>
							<div class="flex items-center gap-1.5">
								<span class="text-xs text-ctp-subtext0">Goal:</span>
								<input type="number" bind:value={bulkGoal} class="w-24 rounded border border-ctp-surface2 bg-ctp-surface1 px-2.5 py-1 text-xs" placeholder="e.g. 100" />
							</div>
						</div>
					{/if}
					<textarea
						bind:value={bulkNames}
						rows="8"
						class="{inputClass} resize-y font-mono"
						placeholder={'Writing numbers in expanded form | Break a number into place values | 518 = 500+10+8\nRounding to nearest ten | 97 → 100\nRounding to nearest hundred\nAdding/subtracting mentally\nDivision facts'}
					></textarea>
					<div class="flex items-center gap-3">
						<button onclick={addBulkSkills} class="rounded bg-ctp-blue px-3 py-1.5 text-xs font-medium text-ctp-crust hover:opacity-90 transition-opacity">
							+ Add {bulkParsed.length} skill{bulkParsed.length === 1 ? '' : 's'}
						</button>
						{#if bulkAddedMsg}
							<span class="text-xs text-ctp-green">{bulkAddedMsg}</span>
						{/if}
					</div>
				</div>
			{/if}
		</section>
		</div>
	</main>
</div>
