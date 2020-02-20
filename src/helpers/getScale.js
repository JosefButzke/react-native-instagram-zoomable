// @flow

const SCALE_MULTIPLIER = 0.6;

export default function getScale(
    currentDistance: number,
    initialDistance: number
) {
    return currentDistance / initialDistance * SCALE_MULTIPLIER;
}