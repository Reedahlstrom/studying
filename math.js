/* ══════════════════════════════════════════════════════════════
   Mental math — automaticity, not understanding.

   The point of this deck is to stop spending working memory on things
   that should be instant, so it is free for the actual reasoning.
   If you have to *compute* it, it belongs here. If you have to
   *understand* it, that is what Math Academy is for.

   Every arithmetic fact below is GENERATED, never typed. A wrong
   answer in a memorisation deck is worse than no card at all.
   ══════════════════════════════════════════════════════════════ */

const cards = [];
const add = (category, front, back) => cards.push({ category, front: String(front), back: String(back) });

/* ── how a fraction prints ─────────────────────────────────────
   Terminating only when the denominator reduces to 2s and 5s. */
function decimalOf(n, d) {
  let x = d;
  while (x % 2 === 0) x /= 2;
  while (x % 5 === 0) x /= 5;
  const exact = x === 1;
  const val = n / d;
  if (exact) return { text: String(+val.toFixed(10)), exact: true };
  return { text: '≈ ' + val.toFixed(4).replace(/0+$/, ''), exact: false };
}

/* ═════════ 1. Addition that has to be instant ═════════
   Skipping +0 and +1 — nobody stalls on those. What stalls people is
   crossing ten. */
for (let a = 2; a <= 9; a++) {
  for (let b = a; b <= 9; b++) {
    if (a + b < 10) continue;               // sub-ten sums are already automatic
    add('Addition facts', `${a} + ${b}`, a + b);
  }
}
[[6, 6], [7, 7], [8, 8], [9, 9], [11, 11], [12, 12], [15, 15], [25, 25], [50, 50]]
  .forEach(([a, b]) => add('Addition facts', `${a} + ${b}`, a + b));
[[7, 9], [8, 9], [9, 9], [6, 9], [9, 12], [9, 15]]
  .forEach(([a, b]) => add('Addition facts', `${a} + ${b}`, a + b));

/* ═════════ 2. Complements — the shape of subtraction ═════════ */
for (let a = 1; a <= 9; a++) add('Complements', `${a} + ? = 10`, 10 - a);
for (let a = 2; a <= 9; a++) add('Complements', `${a * 10} + ? = 100`, 100 - a * 10);
[3, 7, 12, 15, 18, 23, 34, 45, 56, 67, 78, 89].forEach((a) => add('Complements', `${a} + ? = 100`, 100 - a));
for (let a = 11; a <= 18; a++) {
  for (let b = 2; b <= 9; b++) {
    if (a - b < 2 || a - b > 9) continue;
    if (a - b >= b) continue;               // keep one direction, avoid duplicates
    add('Subtraction facts', `${a} − ${b}`, a - b);
  }
}

/* ═════════ 3. The tables ═════════
   Unique pairs only — 7×8 and 8×7 are one fact, not two. ×1 and ×10
   are omitted as already automatic. */
for (let a = 2; a <= 12; a++) {
  for (let b = a; b <= 12; b++) {
    if (a === 10 || b === 10) continue;
    add('Times tables', `${a} × ${b}`, a * b);
  }
}

/* ═════════ 4. Division, which is the table read backwards ═════════ */
for (let b = 3; b <= 12; b++) {
  for (let q = 3; q <= 12; q++) {
    if (b === 10 || q === 10 || q < b) continue;
    add('Division facts', `${b * q} ÷ ${b}`, q);
  }
}

/* ═════════ 5. Squares ═════════ */
for (let n = 2; n <= 30; n++) add('Squares', `${n}²`, n * n);
[40, 50, 60, 70, 80, 90, 100, 125].forEach((n) => add('Squares', `${n}²`, n * n));

/* ═════════ 6. Cubes and powers ═════════ */
for (let n = 2; n <= 12; n++) add('Cubes & powers', `${n}³`, n ** 3);
for (let n = 1; n <= 16; n++) add('Cubes & powers', `2^${n}`, 2 ** n);
[1, 2, 3, 4, 5, 6].forEach((n) => add('Cubes & powers', `3^${n}`, 3 ** n));
[2, 3, 4, 5].forEach((n) => add('Cubes & powers', `5^${n}`, 5 ** n));

/* ═════════ 7. Roots worth knowing cold ═════════ */
[4, 9, 16, 25, 36, 49, 64, 81, 100, 121, 144, 169, 196, 225, 256, 289, 324, 361, 400, 625]
  .forEach((n) => add('Roots', `√${n}`, Math.sqrt(n)));
add('Roots', '√2 (to 3 places)', '1.414');
add('Roots', '√3 (to 3 places)', '1.732');
add('Roots', '√5 (to 3 places)', '2.236');
add('Roots', '√10 (to 3 places)', '3.162');

/* ═════════ 8. Fractions, decimals, percents — one object, three faces ═════════ */
const FRACTIONS = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [1, 5], [2, 5], [3, 5], [4, 5],
  [1, 6], [5, 6], [1, 7], [1, 8], [3, 8], [5, 8], [7, 8], [1, 9], [2, 9], [1, 11], [1, 12],
  [5, 12], [1, 16], [3, 16], [1, 20], [1, 25], [1, 32], [1, 50]];
FRACTIONS.forEach(([n, d]) => {
  const dec = decimalOf(n, d);
  const pct = (n / d) * 100;
  const pctText = Number.isInteger(pct) ? `${pct}%` : `≈ ${(+pct.toFixed(2))}%`;
  add('Fractions ↔ decimals', `${n}/${d} as a decimal`, dec.text);
  add('Fractions ↔ decimals', `${n}/${d} as a percent`, pctText);
});
[[0.25, '1/4'], [0.5, '1/2'], [0.75, '3/4'], [0.2, '1/5'], [0.125, '1/8'], [0.375, '3/8'],
 [0.625, '5/8'], [0.875, '7/8'], [0.4, '2/5'], [0.6, '3/5'], [0.8, '4/5']]
  .forEach(([d, f]) => add('Fractions ↔ decimals', `${d} as a fraction`, f));

/* ═════════ 9. Percent anchors ═════════ */
[[10, 250], [10, 68], [25, 80], [25, 240], [20, 45], [20, 350], [15, 60], [15, 200],
 [5, 140], [50, 86], [75, 48], [30, 90], [40, 65], [12.5, 64]]
  .forEach(([p, n]) => add('Percent work', `${p}% of ${n}`, +((p / 100) * n).toFixed(2)));

/* ══════════════════════════════════════════════════════════════
   Everything below is hand-written: the techniques and rules that
   turn facts into speed. These are the ones worth understanding,
   not just recalling.
   ══════════════════════════════════════════════════════════════ */

const TECHNIQUES = [
  ['Fast way to multiply by 5', 'Times 10, then halve. 5 × 46 = 460 ÷ 2 = 230.'],
  ['Fast way to multiply by 9', 'Times 10, minus the number. 9 × 37 = 370 − 37 = 333.'],
  ['Fast way to multiply by 11 (two digits)', 'Split the digits, put their sum in the middle. 11 × 36 → 3_6 with 9 between = 396.'],
  ['11 × 78 — what do you do about the carry?', 'The middle sum is 15, so carry: 7+1=8 → 858.'],
  ['Fast way to multiply by 25', 'Times 100, divide by 4. 25 × 36 = 3600 ÷ 4 = 900.'],
  ['Fast way to multiply by 50', 'Times 100, halve it. 50 × 46 = 4600 ÷ 2 = 2300.'],
  ['Fast way to multiply by 15', 'Times 10, plus half of that. 15 × 24 = 240 + 120 = 360.'],
  ['Square any number ending in 5', 'Front digits × (front + 1), then stick 25 on. 65² → 6×7 = 42 → 4225.'],
  ['85² in your head', '8 × 9 = 72, then 25 → 7225.'],
  ['Multiply two numbers either side of a round one', 'Difference of squares. 48 × 52 = 50² − 2² = 2500 − 4 = 2496.'],
  ['19 × 21 without working it out', '20² − 1 = 399.'],
  ['Doubling and halving', 'Halve one side, double the other. 14 × 35 = 7 × 70 = 490.'],
  ['Multiply by splitting', 'Break one number apart. 7 × 68 = 7×70 − 7×2 = 490 − 14 = 476.'],
  ['Divide by 5 quickly', 'Double it, then divide by 10. 340 ÷ 5 = 680 ÷ 10 = 68.'],
  ['Divide by 25', 'Times 4, divide by 100. 900 ÷ 25 = 3600 ÷ 100 = 36.'],
  ['Add by compensating', 'Round one number, then correct. 47 + 38 = 47 + 40 − 2 = 85.'],
  ['Subtract by compensating', 'Round the number you take away, then give it back. 83 − 29 = 83 − 30 + 1 = 54.'],
  ['Find 15% for a tip', '10% plus half of it. 15% of 60 = 6 + 3 = 9.'],
  ['Find 20% fast', 'Take 10% and double it.'],
  ['Percent trick worth knowing', 'x% of y equals y% of x. 8% of 50 is the same as 50% of 8 = 4.'],
  ['Multiply two numbers just under 100', 'Take each from 100. 96 × 97: 100−(4+3) = 93 for the front, 4×3 = 12 for the back → 9312.'],
  ['Estimate a division fast', 'Round both to one significant figure first, then adjust. 412 ÷ 19 ≈ 400 ÷ 20 = 20.'],
];
TECHNIQUES.forEach(([f, b]) => add('Mental math techniques', f, b));

const DIVISIBILITY = [
  ['Divisible by 2?', 'The last digit is even.'],
  ['Divisible by 3?', 'The digits add up to a multiple of 3.'],
  ['Divisible by 4?', 'The last two digits form a multiple of 4.'],
  ['Divisible by 5?', 'It ends in 0 or 5.'],
  ['Divisible by 6?', 'It passes both the 2 test and the 3 test.'],
  ['Divisible by 8?', 'The last three digits form a multiple of 8.'],
  ['Divisible by 9?', 'The digits add up to a multiple of 9.'],
  ['Divisible by 10?', 'It ends in 0.'],
  ['Divisible by 11?', 'Alternately add and subtract the digits; the result is 0 or a multiple of 11.'],
  ['Divisible by 12?', 'It passes both the 3 test and the 4 test.'],
  ['Is 4,728 divisible by 3?', 'Yes — 4+7+2+8 = 21, a multiple of 3.'],
  ['Is 3,141 divisible by 9?', 'Yes — 3+1+4+1 = 9.'],
  ['Is 2,458 divisible by 4?', 'No — the last two digits, 58, are not a multiple of 4.'],
];
DIVISIBILITY.forEach(([f, b]) => add('Divisibility', f, b));

const RULES = [
  ['Order of operations', 'Brackets, exponents, multiply and divide left to right, then add and subtract left to right.'],
  ['Negative times negative', 'Positive.'],
  ['Negative times positive', 'Negative.'],
  ['Subtracting a negative', 'It becomes addition. 5 − (−3) = 8.'],
  ['Dividing by a fraction', 'Multiply by its reciprocal. 6 ÷ ⅔ = 6 × 3/2 = 9.'],
  ['Anything to the power 0', '1 (except 0⁰, which is undefined).'],
  ['A negative exponent', 'One over the positive version. 2⁻³ = 1/8.'],
  ['x^a × x^b', 'x^(a+b) — add the exponents.'],
  ['x^a ÷ x^b', 'x^(a−b) — subtract the exponents.'],
  ['(x^a)^b', 'x^(ab) — multiply the exponents.'],
  ['x^(1/2)', 'The square root of x.'],
  ['x^(m/n)', 'The nth root of x, raised to m.'],
  ['Adding fractions', 'Common denominator first, then add the numerators only.'],
  ['Multiplying fractions', 'Straight across — numerators together, denominators together.'],
  ['Why you can cancel before multiplying fractions', 'A factor on top and bottom divides out, so the value is unchanged and the numbers stay small.'],
  ['Dividing by zero', 'Undefined — there is no number that works.'],
  ['Zero divided by a number', '0.'],
  ['Percent increase then the same percent decrease', 'You do not return to the start. +10% then −10% of 100 leaves 99.'],
];
RULES.forEach(([f, b]) => add('Rules & signs', f, b));

const ALGEBRA = [
  ['(a + b)²', 'a² + 2ab + b²'],
  ['(a − b)²', 'a² − 2ab + b²'],
  ['a² − b²', '(a + b)(a − b)'],
  ['(a + b)³', 'a³ + 3a²b + 3ab² + b³'],
  ['a³ − b³', '(a − b)(a² + ab + b²)'],
  ['a³ + b³', '(a + b)(a² − ab + b²)'],
  ['FOIL — what does it stand for', 'First, Outer, Inner, Last — the four products when multiplying two binomials.'],
  ['The quadratic formula', 'x = [−b ± √(b² − 4ac)] / 2a'],
  ['The discriminant, and what it tells you', 'b² − 4ac. Positive: two real roots. Zero: one. Negative: none real.'],
  ['Slope between two points', '(y₂ − y₁) / (x₂ − x₁) — rise over run.'],
  ['Slope-intercept form', 'y = mx + b, where m is slope and b is where it crosses the y-axis.'],
  ['Point-slope form', 'y − y₁ = m(x − x₁)'],
  ['Midpoint of two points', '((x₁ + x₂)/2, (y₁ + y₂)/2) — average each coordinate.'],
  ['Distance between two points', '√[(x₂ − x₁)² + (y₂ − y₁)²]'],
  ['Slope of parallel lines', 'Identical.'],
  ['Slope of perpendicular lines', 'Negative reciprocal — m and −1/m.'],
  ['Sum of the roots of ax² + bx + c', '−b/a'],
  ['Product of the roots of ax² + bx + c', 'c/a'],
  ['Vertex of a parabola y = ax² + bx + c', 'x = −b/2a, then substitute back for y.'],
  ['What does factoring actually do', 'Rewrites a sum as a product, so the zero-product rule turns it into solvable pieces.'],
  ['Zero-product rule', 'If a product is zero, at least one factor is zero.'],
];
ALGEBRA.forEach(([f, b]) => add('Algebra patterns', f, b));

const GEOMETRY = [
  ['Area of a rectangle', 'length × width'],
  ['Area of a triangle', '½ × base × height'],
  ['Area of a circle', 'πr²'],
  ['Circumference of a circle', '2πr, or πd'],
  ['Area of a trapezoid', '½ × (a + b) × height — average the parallel sides, times the height.'],
  ['Area of a parallelogram', 'base × height'],
  ['Volume of a box', 'length × width × height'],
  ['Volume of a cylinder', 'πr²h — the circle area times the height.'],
  ['Volume of a sphere', '(4/3)πr³'],
  ['Volume of a cone', '(1/3)πr²h — a third of the cylinder around it.'],
  ['Pythagoras', 'a² + b² = c², with c the side opposite the right angle.'],
  ['The 3-4-5 triangle', 'A right triangle — worth spotting instantly, along with 6-8-10 and 5-12-13.'],
  ['Angles in a triangle', '180°'],
  ['Angles in a quadrilateral', '360°'],
  ['Interior angles of an n-sided polygon', '(n − 2) × 180°'],
  ['π to 4 decimal places', '3.1416'],
  ['A 45-45-90 triangle', 'Sides in ratio 1 : 1 : √2'],
  ['A 30-60-90 triangle', 'Sides in ratio 1 : √3 : 2'],
];
GEOMETRY.forEach(([f, b]) => add('Geometry formulas', f, b));

const NUMBER_SENSE = [
  ['Primes below 30', '2, 3, 5, 7, 11, 13, 17, 19, 23, 29'],
  ['Is 1 prime?', 'No. A prime has exactly two distinct factors; 1 has one.'],
  ['What is a prime factorisation', 'Writing a number as a product of primes — 60 = 2² × 3 × 5.'],
  ['Greatest common factor of 12 and 18', '6'],
  ['Lowest common multiple of 4 and 6', '12'],
  ['Quick estimate of 19.8 × 4.9', 'About 20 × 5 = 100, so just under.'],
  ['Rounding rule that matters most', 'Round at the end, not partway through — early rounding compounds.'],
  ['Scientific notation for 45,000', '4.5 × 10⁴'],
  ['Scientific notation for 0.00032', '3.2 × 10⁻⁴'],
  ['Multiplying in scientific notation', 'Multiply the fronts, add the exponents.'],
  ['log₁₀(1000)', '3'],
  ['What a logarithm asks', '"What power do I raise the base to, to get this number?"'],
  ['log(ab)', 'log a + log b'],
  ['log(a/b)', 'log a − log b'],
  ['log(aⁿ)', 'n · log a'],
  ['Doubling time rule of 72', 'Divide 72 by the growth rate. At 6%, about 12 years.'],
  ['Seconds in an hour', '3,600'],
  ['Seconds in a day', '86,400'],
  ['Minutes in a week', '10,080'],
  ['Days in a year (non-leap)', '365'],
];
NUMBER_SENSE.forEach(([f, b]) => add('Number sense', f, b));

/* topics in the order they should be met */
export const MATH_TOPICS = [
  'Addition facts', 'Complements', 'Subtraction facts', 'Times tables', 'Division facts',
  'Squares', 'Cubes & powers', 'Roots', 'Fractions ↔ decimals', 'Percent work',
  'Mental math techniques', 'Divisibility', 'Rules & signs', 'Algebra patterns',
  'Geometry formulas', 'Number sense',
];

/* ordered so the deck is met foundation-first */
const seen = new Set();
export const MATH_CARDS = MATH_TOPICS.flatMap((t) => cards.filter((c) => c.category === t))
  .filter((c) => {
    const k = c.front.toLowerCase();
    if (seen.has(k)) return false;      // the doubles get generated twice
    seen.add(k);
    return true;
  });
