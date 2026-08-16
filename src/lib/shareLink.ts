import { supabase } from './supabase';

/**
 * Returns the stable public "Grades" share id for a student, creating one
 * on first use. Existing rows are reused so the URL never changes.
 */
export async function getOrCreateShareId(studentId: string): Promise<string | null> {
	const {
		data: { session }
	} = await supabase.auth.getSession();
	if (!session) return null;

	const { data: existing, error: lookupError } = await supabase
		.from('public_shares')
		.select('id')
		.eq('student_id', studentId)
		.eq('user_id', session.user.id)
		.limit(1);
	if (lookupError) return null;
	if (existing && existing.length > 0) return existing[0].id;

	const id = crypto.randomUUID();
	const { error: insertError } = await supabase.from('public_shares').insert({
		id,
		user_id: session.user.id,
		student_id: studentId
	});
	if (insertError) return null;
	return id;
}

export function shareUrl(shareId: string): string {
	return `${window.location.origin}/share/${shareId}`;
}
