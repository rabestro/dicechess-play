import { describe, it, expect } from 'vitest';
import { buildJoinUrl, parseSeat } from './seatLink';

describe('seatLink', () => {
	it('builds a join URL with token and colour', () => {
		expect(buildJoinUrl('https://play.example', 'g1', 'tok-123', 'Black')).toBe(
			'https://play.example/live/g1?seat=tok-123&as=black',
		);
	});

	it('parses token and colour from a URL', () => {
		expect(parseSeat(new URL('https://x/live/g1?seat=tok&as=white'))).toEqual({
			token: 'tok',
			as: 'white',
		});
	});

	it('treats a tokenless URL as a spectator', () => {
		expect(parseSeat(new URL('https://x/live/g1'))).toEqual({ token: null, as: null });
	});

	it('ignores an invalid colour', () => {
		expect(parseSeat(new URL('https://x/live/g1?seat=t&as=purple'))).toEqual({
			token: 't',
			as: null,
		});
	});
});
