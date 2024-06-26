import { Color, EffectsAsset, Layer, Piece, PieceKind, Shape } from "./layer";
import { assets, colors } from "./loader";
import { ctx } from "./state";
import { Timers } from "./timer";

export class Board {
  constructor() {
    this.timers = new Timers();
    this.main = new Layer({
      shape: Shape.HEX,
      colors: colors.main.length,
      size: 11,
      assets,
      borderSize: 5,
      assetPrefix: null,
    });
    this.promotion = new Layer({
      shape: Shape.SQUARE,
      colors: colors.promotion.length,
      size: 2,
      assets,
      borderSize: 5,
      assetPrefix: "prom_",
    });
    this.promotion.pieces = [
      new Piece(PieceKind.QUEEN, Color.LIGHT, 0, 0),
      new Piece(PieceKind.BISHOP, Color.LIGHT, 0, 1),
      new Piece(PieceKind.ROOK, Color.LIGHT, 1, 0),
      new Piece(PieceKind.KNIGHT, Color.LIGHT, 1, 1),
    ];

    /**
     * @type {{color: number, q: number, r: number}?}
     */
    this.promoting = null;

    this.resize();

    this.timers.onExpired = () => ctx.timerExpired();
    this.main.onClick = (q, r) => ctx.hexClicked(q, r);
    this.promotion.onClick = (q, r) => {
      this.main.nextFullUpdate = true;
      this.promoting = null;
      for (const piece of this.promotion.pieceIterator()) {
        if (piece.q === q && piece.r === r) {
          ctx.promotionResponse(piece.kind);
          return;
        }
      }
    };
  }

  reloadPromotionPrompt() {
    if (!this.promoting) return;
    this.showPromotionPrompt(
      this.promoting.color,
      this.promoting.q,
      this.promoting.r,
    );
  }

  resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;

    const radius = this.main.getAppropriateRadius(0.95 * w, 0.8 * h);
    this.main.resize(radius);
    this.main.move((w - this.main.width) / 2, (h - this.main.height) / 2);
    this.promotion.resize(radius);
    this.reloadPromotionPrompt();
  }

  hideTimers() {
    this.timers.hidden = true;
  }

  setTimers(light, dark, active) {
    this.timers.hidden = false;
    this.timers.setState(light, dark, active);
  }

  flip(state) {
    this.main.flipped = state;
    this.timers.flipped = state;
    this.reloadPromotionPrompt();
  }

  /**
   * @param {Color} color
   * @param {number} q
   * @param {number} r
   */
  showPromotionPrompt(color, q, r) {
    this.promoting = { color, q, r };
    this.promotion.fullUpdate = true;
    for (const piece of this.promotion.pieceIterator()) {
      piece.color = color;
    }

    const [x, y] = this.main.getPixel(q, r);
    this.promotion.move(
      x - this.promotion.width / 2,
      y - this.promotion.height / 2,
    );
  }

  /**
   * Highlights a subset of hexes.
   * @param {Uint16Array} hexes
   */
  highlight(hexes) {
    for (let i = 0; i < this.main.highlight.length; i++) {
      const { q, r } = this.main.highlight[i];
      this.main.markUpdate(q, r);
    }

    this.main.highlight = [];
    for (let i = 0; i < hexes.length; i++) {
      const flags = hexes[i] >> 8;
      if (flags === 0) continue;

      const q = (hexes[i] & 0xf0) >> 4;
      const r = hexes[i] & 0xf;
      if (!this.main.isInBounds(q, r)) continue;

      const effects = [];
      for (let j = 0; j < EffectsAsset.length; j++) {
        if ((flags & (1 << j)) > 0) {
          effects.push(EffectsAsset[j]);
        }
      }

      this.main.highlight.push({ q, r, effects });
      this.main.markUpdate(q, r);
    }
  }

  /**
   * Sets the pieces in the board.
   * @param {Uint16Array} pieces
   */
  setPieces(pieces) {
    this.main.fullUpdate = true;
    this.main.nextFullUpdate = true;

    this.main.pieces = [];
    for (let i = 0; i < pieces.length; i++) {
      const color = (pieces[i] & 0x800) >> 11;
      const kind = (pieces[i] & 0x700) >> 8;
      const q = (pieces[i] & 0xf0) >> 4;
      const r = pieces[i] & 0xf;

      this.main.pieces.push(new Piece(kind, color, q, r));
    }
  }

  /**
   * Moves pieces in the board.
   * @param {Uint16Array} pieces
   */
  movePieces(pieces) {
    for (let i = 0; i < pieces.length; i++) {
      const idx = pieces[i] >> 8;
      const piece = this.main.pieces[idx];
      if (!piece) continue;

      this.main.markUpdate(piece.q, piece.r);
      piece.q = (pieces[i] & 0xf0) >> 4;
      piece.r = pieces[i] & 0xf;
      this.main.markUpdate(piece.q, piece.r);
    }
  }

  /**
   * Promotes a piece
   * @param {Uint16Array} pieces
   */
  promotePieces(pieces) {
    for (let i = 0; i < pieces.length; i++) {
      const idx = pieces[i] & 0xff;
      const piece = this.main.pieces[idx];
      if (!piece) continue;

      piece.kind = pieces[i] >> 8;
      this.main.markUpdate(piece.q, piece.r);
    }
  }

  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  render(ctx) {
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (this.main.fullUpdate) ctx.clearRect(0, 0, w, h);
    this.timers.render(ctx, 0, 0, w, h, this.main.fullUpdate);
    this.main.render(ctx);

    if (!this.promoting) {
      this.main.handleMouse(ctx);
    } else {
      this.promotion.render(ctx);
      this.promotion.handleMouse(ctx);
      this.promotion.finishUpdate();
    }

    this.main.finishUpdate();
  }
}
