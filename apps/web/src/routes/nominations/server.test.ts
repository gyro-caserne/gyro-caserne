import { describe, expect, it } from 'vitest';
import { GET } from './+server';

describe('/nominations', () => {
	it('renvoie vers Qui fait quoi, pour de bon', () => {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		expect(() => (GET as any)({})).toThrow(expect.objectContaining({ status: 301, location: '/comites' }));
	});
});
