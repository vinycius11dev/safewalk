/**
 * Pictogramas coloridos dos tipos de solicitação do SP156 mostrados no mapa:
 * buraco, árvore, bueiro, calçada danificada e obstáculo.
 *
 * Cada um é desenhado em 1024 px e reduzido para 64 px (suavização por média), com base branca e
 * detalhes coloridos para ficar legível sobre a bolha colorida do marcador. Uso:
 *   node scripts/generate-sp156-map-icons.mjs
 * Requer `pngjs` (já instalado na árvore de dependências do projeto).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { PNG } = require('pngjs');

const target = join(dirname(fileURLToPath(import.meta.url)), '..', 'apps/mobile/public/map-icons');
mkdirSync(target, { recursive: true });

const BIG = 1024;
const OUT = 64;
const K = BIG / 256; // desenho em unidades de 0..256

const hex = (value, alpha = 255) => [
  parseInt(value.slice(1, 3), 16),
  parseInt(value.slice(3, 5), 16),
  parseInt(value.slice(5, 7), 16),
  alpha,
];
const WHITE = hex('#FFFFFF');

function canvas() {
  const pixels = new Uint8ClampedArray(BIG * BIG * 4);
  const paint = (inside, bounds, color) => {
    const x0 = Math.max(0, Math.floor(bounds[0] * K));
    const y0 = Math.max(0, Math.floor(bounds[1] * K));
    const x1 = Math.min(BIG - 1, Math.ceil(bounds[2] * K));
    const y1 = Math.min(BIG - 1, Math.ceil(bounds[3] * K));
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!inside((x + 0.5) / K, (y + 0.5) / K)) continue;
        const i = (y * BIG + x) * 4;
        pixels[i] = color[0];
        pixels[i + 1] = color[1];
        pixels[i + 2] = color[2];
        pixels[i + 3] = color[3];
      }
    }
  };
  const api = {
    circle(cx, cy, r, color) {
      paint(
        (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r,
        [cx - r, cy - r, cx + r, cy + r],
        color,
      );
    },
    ellipse(cx, cy, rx, ry, color) {
      paint(
        (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1,
        [cx - rx, cy - ry, cx + rx, cy + ry],
        color,
      );
    },
    rrect(x0, y0, x1, y1, r, color) {
      paint(
        (x, y) => {
          const dx = Math.max(x0 + r - x, 0, x - (x1 - r));
          const dy = Math.max(y0 + r - y, 0, y - (y1 - r));
          return dx * dx + dy * dy <= r * r;
        },
        [x0, y0, x1, y1],
        color,
      );
    },
    poly(points, color) {
      const xs = points.map((p) => p[0]);
      const ys = points.map((p) => p[1]);
      paint(
        (x, y) => {
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i];
            const [xj, yj] = points[j];
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
          }
          return inside;
        },
        [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)],
        color,
      );
    },
    line(a, b, width, color) {
      const [ax, ay] = a;
      const [bx, by] = b;
      const half = width / 2;
      const length2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      paint(
        (x, y) => {
          const t = Math.max(
            0,
            Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / length2),
          );
          return (x - (ax + t * (bx - ax))) ** 2 + (y - (ay + t * (by - ay))) ** 2 <= half * half;
        },
        [
          Math.min(ax, bx) - half,
          Math.min(ay, by) - half,
          Math.max(ax, bx) + half,
          Math.max(ay, by) + half,
        ],
        color,
      );
    },
    path(points, width, color) {
      for (let i = 0; i < points.length - 1; i++) api.line(points[i], points[i + 1], width, color);
    },
    save(name) {
      const png = new PNG({ width: OUT, height: OUT });
      // O desenho ocupa 52 dos 64 px (margem de 6), como os demais ícones do mapa.
      const margin = 6;
      const inner = OUT - margin * 2;
      const SAMPLES = 8;
      const cell = BIG / inner / SAMPLES;
      for (let oy = margin; oy < OUT - margin; oy++) {
        for (let ox = margin; ox < OUT - margin; ox++) {
          let r = 0,
            g = 0,
            b = 0,
            a = 0;
          for (let sy = 0; sy < SAMPLES; sy++) {
            for (let sx = 0; sx < SAMPLES; sx++) {
              const x = Math.min(BIG - 1, Math.floor(((ox - margin) * SAMPLES + sx + 0.5) * cell));
              const y = Math.min(BIG - 1, Math.floor(((oy - margin) * SAMPLES + sy + 0.5) * cell));
              const i = (y * BIG + x) * 4;
              const alpha = pixels[i + 3];
              r += pixels[i] * alpha;
              g += pixels[i + 1] * alpha;
              b += pixels[i + 2] * alpha;
              a += alpha;
            }
          }
          const o = (oy * OUT + ox) * 4;
          if (a > 0) {
            png.data[o] = Math.round(r / a);
            png.data[o + 1] = Math.round(g / a);
            png.data[o + 2] = Math.round(b / a);
            png.data[o + 3] = Math.round(a / (SAMPLES * SAMPLES));
          }
        }
      }
      writeFileSync(join(target, `${name}.png`), PNG.sync.write(png));
    },
  };
  return api;
}

/** Buraco: pista branca com cavidade escura, rachaduras e cone de sinalização amarelo. */
function pothole() {
  const c = canvas();
  c.rrect(18, 150, 238, 230, 22, WHITE);
  c.ellipse(116, 192, 74, 28, hex('#7C2D12'));
  c.ellipse(116, 196, 56, 18, hex('#1C1917'));
  c.ellipse(100, 190, 20, 6, hex('#44403C'));
  c.path(
    [
      [40, 168],
      [58, 180],
      [50, 190],
    ],
    7,
    hex('#A8A29E'),
  );
  c.path(
    [
      [196, 164],
      [178, 176],
      [186, 190],
    ],
    7,
    hex('#A8A29E'),
  );
  // Cone: borda branca, corpo amarelo, faixas escuras e base laranja.
  const cx = 176;
  c.poly(
    [
      [cx - 14, 8],
      [cx + 14, 8],
      [cx + 58, 150],
      [cx - 58, 150],
    ],
    WHITE,
  );
  c.rrect(cx - 72, 138, cx + 72, 172, 12, WHITE);
  c.poly(
    [
      [cx - 8, 24],
      [cx + 8, 24],
      [cx + 48, 142],
      [cx - 48, 142],
    ],
    hex('#FACC15'),
  );
  const half = (y) => 8 + (48 - 8) * ((y - 24) / 118);
  const band = (y0, y1) =>
    c.poly(
      [
        [cx - half(y0), y0],
        [cx + half(y0), y0],
        [cx + half(y1), y1],
        [cx - half(y1), y1],
      ],
      hex('#1F2937'),
    );
  band(58, 76);
  band(100, 118);
  c.rrect(cx - 62, 146, cx + 62, 164, 8, hex('#F97316'));
  return c;
}

/** Árvore: copa branca com realces verdes e tronco. */
function tree() {
  const c = canvas();
  c.rrect(112, 150, 144, 236, 10, WHITE);
  c.circle(128, 84, 72, WHITE);
  c.circle(78, 118, 52, WHITE);
  c.circle(178, 118, 52, WHITE);
  c.circle(104, 70, 20, hex('#A3E635'));
  c.circle(150, 98, 24, hex('#84CC16'));
  c.circle(82, 120, 15, hex('#BEF264'));
  c.circle(176, 130, 14, hex('#A3E635'));
  c.circle(128, 120, 12, hex('#65A30D'));
  c.line([128, 170], [128, 214], 8, hex('#92400E'));
  return c;
}

/** Bueiro: tampa redonda branca com grade roxa e gota azul. */
function drain() {
  const c = canvas();
  c.circle(118, 138, 98, WHITE);
  c.circle(118, 138, 80, hex('#4C1D95'));
  for (const y of [100, 124, 148, 172]) {
    const half = Math.sqrt(Math.max(0, 74 ** 2 - (y - 138) ** 2));
    c.rrect(118 - half + 4, y - 7, 118 + half - 4, y + 7, 7, hex('#DDD6FE'));
  }
  // Gota de água.
  c.poly(
    [
      [206, 18],
      [236, 64],
      [206, 80],
      [176, 64],
    ],
    WHITE,
  );
  c.circle(206, 66, 34, WHITE);
  c.poly(
    [
      [206, 28],
      [228, 62],
      [184, 62],
    ],
    hex('#38BDF8'),
  );
  c.circle(206, 66, 24, hex('#38BDF8'));
  c.circle(197, 60, 7, hex('#E0F2FE'));
  return c;
}

/** Calçada danificada: duas lajes brancas, rachadura rosa e lascas amarelas. */
function brokenSidewalk() {
  const c = canvas();
  c.poly(
    [
      [20, 70],
      [128, 52],
      [120, 204],
      [14, 228],
    ],
    WHITE,
  );
  c.poly(
    [
      [142, 50],
      [238, 34],
      [244, 190],
      [134, 208],
    ],
    WHITE,
  );
  c.path(
    [
      [128, 46],
      [112, 96],
      [138, 124],
      [108, 164],
      [126, 214],
    ],
    14,
    hex('#9D174D'),
  );
  c.path(
    [
      [128, 46],
      [112, 96],
      [138, 124],
      [108, 164],
      [126, 214],
    ],
    6,
    hex('#1F0A15'),
  );
  c.poly(
    [
      [52, 112],
      [84, 106],
      [74, 134],
    ],
    hex('#FACC15'),
  );
  c.poly(
    [
      [176, 120],
      [214, 112],
      [196, 146],
    ],
    hex('#FACC15'),
  );
  c.poly(
    [
      [160, 170],
      [188, 164],
      [178, 188],
    ],
    hex('#FDE68A'),
  );
  c.path(
    [
      [30, 150],
      [62, 146],
    ],
    6,
    hex('#F9A8D4'),
  );
  return c;
}

/** Obstáculo: barreira listrada amarela e preta, com refletores vermelhos. */
function obstacle() {
  const c = canvas();
  c.rrect(34, 100, 62, 236, 8, WHITE);
  c.rrect(194, 100, 222, 236, 8, WHITE);
  c.rrect(12, 30, 244, 116, 20, WHITE);
  c.rrect(26, 44, 230, 102, 12, hex('#FACC15'));
  const stripe = (x) =>
    c.poly(
      [
        [x, 44],
        [x + 26, 44],
        [x + 6, 102],
        [x - 20, 102],
      ],
      hex('#111827'),
    );
  for (const x of [56, 108, 160, 204]) stripe(x);
  c.circle(128, 168, 22, hex('#EF4444'));
  c.circle(128, 168, 11, hex('#FECACA'));
  return c;
}

for (const [name, draw] of [
  ['potholes', pothole],
  ['trees', tree],
  ['drains', drain],
  ['brokenSidewalk', brokenSidewalk],
  ['obstacles', obstacle],
]) {
  draw().save(name);
  console.log('gerado', `${name}.png`);
}
