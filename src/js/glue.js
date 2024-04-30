import { board } from "./state";

export { setScene } from "./scene";
export { joinResponse } from "../menus/online.js";

export const setPieces = (pieces) => board.setPieces(pieces);
export const movePieces = (pieces) => board.movePieces(pieces);
export const highlight = (hexes) => board.highlight(hexes);
