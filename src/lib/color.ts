function hexToRgb(hex: string): [number, number, number] {
	const clean = hex.replace('#', '');
	const bigint = parseInt(clean, 16);
	return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
	return (
		'#' +
		[r, g, b]
			.map((v) =>
				Math.round(Math.max(0, Math.min(255, v)))
					.toString(16)
					.padStart(2, '0')
			)
			.join('')
	);
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h = 0,
		s = 0;
	const l = (max + min) / 2;
	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return [h * 360, s * 100, l * 100];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
	h /= 360;
	s /= 100;
	l /= 100;
	if (s === 0) {
		const v = l * 255;
		return [v, v, v];
	}
	const hue2rgb = (p: number, q: number, t: number) => {
		if (t < 0) t += 1;
		if (t > 1) t -= 1;
		if (t < 1 / 6) return p + (q - p) * 6 * t;
		if (t < 1 / 2) return q;
		if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
		return p;
	};
	const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
	const p = 2 * l - q;
	const r = hue2rgb(p, q, h + 1 / 3);
	const g = hue2rgb(p, q, h);
	const b = hue2rgb(p, q, h - 1 / 3);
	return [r * 255, g * 255, b * 255];
}

/**
 * The app's course/pastel palette is tuned to pop against a dark background.
 * Used as text on a light page those same hex values wash out, so this
 * pulls lightness down (and saturation up slightly) while keeping the hue —
 * same color identity, readable on white/cream.
 */
export function darkenForLight(hex: string, maxLightness = 30): string {
	const [r, g, b] = hexToRgb(hex);
	const [h, s, l] = rgbToHsl(r, g, b);
	const newL = Math.min(l, maxLightness);
	const newS = Math.min(100, s + 10);
	const [nr, ng, nb] = hslToRgb(h, newS, newL);
	return rgbToHex(nr, ng, nb);
}
