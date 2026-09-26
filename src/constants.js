// Shared canvas configuration. Mirrored in netlify/functions/place-pixel.js
// so the server can validate without importing frontend code.
export const GRID_COLS = 48;
export const GRID_ROWS = 32;
export const COOLDOWN_SECONDS = 6;

export const PALETTE = [
  "#0b0d12", // 0 blank/ink
  "#ffffff", // 1 white
  "#d4d7dd", // 2 light grey
  "#898d96", // 3 grey
  "#ff4d4d", // 4 red
  "#ff9c38", // 5 orange
  "#ffd83d", // 6 yellow
  "#7ee36b", // 7 green
  "#0fb894", // 8 teal
  "#4fd3ff", // 9 cyan
  "#3d7bff", // 10 blue
  "#8c5bff", // 11 violet
  "#e35bff", // 12 magenta
  "#ff6fae", // 13 pink
  "#a5622f", // 14 brown
  "#c8ff5e", // 15 lime
];
