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
	const { data, error } = await supabase.rpc('get_shared_student', { p_share_id: params.id });

	if (error) {
		console.error('get_shared_student failed:', error.message, error.details, error.hint);
		return { shareData: null, shareId: params.id };
	}
	if (!data) return { shareData: null, shareId: params.id };
	return { shareData: data as ShareData, shareId: params.id };
};
