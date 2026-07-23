import type { PageLoad } from './$types';
import { supabase } from '$lib/supabase';
import type { Course, BigProject, SkillBankItem, StudentSkill } from '$lib/types';

export interface ShareData {
	name: string;
	color: string;
	courses: Course[];
	projects: BigProject[];
	skills?: StudentSkill[];
	skillDefs?: SkillBankItem[];
}

export const load: PageLoad = async ({ params }) => {
	const { data, error } = await supabase
		.from('public_shares')
		.select('data')
		.eq('id', params.id)
		.single();

	if (error || !data) return { shareData: null };
	return { shareData: data.data as ShareData };
};
