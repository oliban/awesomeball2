// Utility functions

/**
 * Linear interpolation between two numbers.
 * @param start The starting value.
 * @param end The ending value.
 * @param t The interpolation factor (0 to 1).
 * @returns The interpolated value.
 */
export function lerp(start: number, end: number, t: number): number {
    return start * (1 - t) + end * t;
}

/**
 * Quadratic easing function (ease in).
 * @param t The interpolation factor (0 to 1).
 * @returns The eased value.
 */
export function easeInQuad(t: number): number { return t * t; }

/**
 * Quadratic easing function (ease out).
 * @param t The interpolation factor (0 to 1).
 * @returns The eased value.
 */
export function easeOutQuad(t: number): number { return t * (2 - t); }

/**
 * Quadratic easing function (ease in and out).
 * @param t The interpolation factor (0 to 1).
 * @returns The eased value.
 */
export function easeInOutQuad(t: number): number {
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
} 