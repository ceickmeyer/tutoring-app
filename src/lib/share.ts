import { supabase } from './supabase';

// Each student has exactly one, permanent share link — reuse the existing
// public_shares row instead of minting a new id (and new URL) every time.
export async function getOrCreateShareUrl(studentId: string): Promise<string | null> {
	const {
		data: { session }
	} = await supabase.auth.getSession();
	if (!session) return null;

	// .limit(1) instead of .maybeSingle(): earlier versions of this app minted
	// a new row on every click, so a student may already have several —
	// take the first (oldest) rather than erroring on more than one match.
	const { data: existing } = await supabase
		.from('public_shares')
		.select('id')
		.eq('user_id', session.user.id)
		.eq('student_id', studentId)
		.limit(1);

	let shareId = existing?.[0]?.id as string | undefined;

	if (!shareId) {
		shareId = crypto.randomUUID();
		const { error } = await supabase.from('public_shares').insert({
			id: shareId,
			user_id: session.user.id,
			student_id: studentId
		});
		if (error) return null;
	}

	return `${window.location.origin}/share/${shareId}`;
}
