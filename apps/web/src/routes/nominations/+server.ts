import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// L'ancienne page Nominations : nommer se fait désormais dans Qui fait quoi (décision 0045).
export const GET: RequestHandler = () => redirect(301, '/comites');
