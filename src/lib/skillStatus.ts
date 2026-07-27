import type { SkillBankItem, StudentSkill } from './types';

export type SkillStatusKind = 'mastered' | 'working' | 'not_started';

export const SKILL_STATUS_LABEL: Record<SkillStatusKind, string> = {
	mastered: 'Mastered',
	working: 'Working on it',
	not_started: 'Not started'
};

export function computeSkillStatus(def: SkillBankItem, sk: StudentSkill): SkillStatusKind {
	if (def.type === 'status') return sk.status;

	if (def.type === 'scored') {
		const last = sk.entries.at(-1);
		if (!last) return 'not_started';
		if (def.goal !== undefined) {
			const met = def.higherIsBetter ? last.value >= def.goal : last.value <= def.goal;
			return met ? 'mastered' : 'working';
		}
		return 'working';
	}

	// multi
	const anyEntries = Object.values(sk.itemEntries ?? {}).some((e) => e.length > 0);
	if (!anyEntries) return 'not_started';
	const items = def.items ?? [];
	if (def.goal !== undefined && items.length > 0) {
		const allMet = items.every((item) => {
			const last = (sk.itemEntries?.[item] ?? []).at(-1);
			return last !== undefined && (def.higherIsBetter ? last.value >= def.goal! : last.value <= def.goal!);
		});
		if (allMet) return 'mastered';
	}
	return 'working';
}
