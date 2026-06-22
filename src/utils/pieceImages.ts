export function getCburnettPieceImage(val: string): string {
	const normalized = val.trim();
	if (!normalized) return '';

	if (normalized.length === 2) {
		const color = normalized[0].toLowerCase() === 'w' ? 'w' : 'b';
		const piece = normalized[1].toUpperCase();
		return `/pieces/cburnett/${color}${piece}.svg`;
	}

	const isWhitePiece = normalized === normalized.toUpperCase();
	const color = isWhitePiece ? 'w' : 'b';
	return `/pieces/cburnett/${color}${normalized.toUpperCase()}.svg`;
}
