#!/usr/bin/env python3
"""Writes src/mockBank/bracMath.js and src/mockBank/bracHmphys.js: original,
computer-checked questions in the style of BRAC University's admission test
(section C Mathematics, section D Higher Mathematics & Physics), four options
(A to D) like the real paper. Every answer is computed from the question's own
numbers, so the key cannot be wrong.
Run: python scripts/gen-brac.py"""
import json, math, random, pathlib
from fractions import Fraction

ROOT = pathlib.Path(__file__).resolve().parent.parent


def fmt(x, unit=''):
    if isinstance(x, Fraction):
        s = str(x.numerator) if x.denominator == 1 else f'{x.numerator}/{x.denominator}'
    elif isinstance(x, float):
        x = round(x, 2)
        s = str(int(x)) if x == int(x) else ('%.2f' % x).rstrip('0').rstrip('.')
    else:
        s = str(x)
    if unit in ('Tk ',):
        return f'{unit}{s}'
    return f'{s} {unit}'.strip() if unit and not unit.startswith('°') and unit != '%' else f'{s}{unit}'


def pack(rng, topic, q, answer_text, wrong_texts, explain):
    texts = [answer_text] + [w for w in dict.fromkeys(wrong_texts) if w != answer_text][:3]
    assert len(texts) == 4 and len(set(texts)) == 4, (q, texts)
    order = list(range(4))
    rng.shuffle(order)
    return dict(question=q, options=[texts[i] for i in order], answer=order.index(0), topic=topic, explain=explain)


def num(rng, topic, q, ans, explain, unit='', near=()):
    cands = list(near) + [ans + 1, ans - 1, ans + 2, ans * 2, ans - 2, ans + 3, ans + 5, ans - 5]
    if isinstance(ans, int) and ans % 2 == 0:
        cands.append(ans // 2)
    wrong = []
    for c in cands:
        if c == ans or (isinstance(c, (int, float, Fraction)) and c < 0 and ans >= 0):
            continue
        t = fmt(c, unit)
        if t != fmt(ans, unit) and t not in wrong:
            wrong.append(t)
    near_t = list(dict.fromkeys(fmt(c, unit) for c in near if fmt(c, unit) in wrong))[:2]
    rest = [w for w in wrong if w not in near_t]
    rng.shuffle(rest)
    return pack(rng, topic, q, fmt(ans, unit), (near_t + rest)[:3], explain)


# ---- Section C: Mathematics -------------------------------------------------

def pct(r):
    p, n = r.choice([12, 15, 20, 25, 35, 40, 60]), r.choice([80, 120, 150, 200, 240, 300, 360])
    if p * n % 100:
        return pct(r)
    a = p * n // 100
    return num(r, 'Arithmetic & percentages', f'What is {p}% of {n}?', a, f'{p}/100 × {n} = {a}.', near=[a + 10, n - a])


def pct_change(r):
    a, b = r.choice([(80, 100), (50, 60), (200, 250), (120, 150), (40, 30), (250, 200)])
    ch = Fraction(b - a, a) * 100
    if ch.denominator != 1:
        return pct_change(r)
    word = 'increase' if b > a else 'decrease'
    return num(r, 'Arithmetic & percentages', f'A price changes from Tk {a} to Tk {b}. What is the percentage {word}?', abs(int(ch)), f'Change = {abs(b-a)}; {abs(b-a)}/{a} × 100 = {abs(int(ch))}%.', '%', near=[abs(round((b - a) / b * 100))])


def simple_interest(r):
    p, rate, t = r.choice([1000, 2000, 5000, 8000]), r.choice([5, 6, 8, 10, 12]), r.choice([2, 3, 4, 5])
    i = p * rate * t // 100
    return num(r, 'Arithmetic & percentages', f'What is the simple interest on Tk {p} at {rate}% per year for {t} years?', i, f'I = P × r × t / 100 = {p} × {rate} × {t} / 100 = {i}.', 'Tk ', near=[i + p, p * rate // 100])


def ratio(r):
    a, b, k = r.choice([2, 3, 4, 5]), r.choice([3, 5, 7]), r.choice([6, 8, 9, 12])
    if a == b:
        return ratio(r)
    total = (a + b) * k
    return num(r, 'Ratio & proportion', f'{total} marbles are shared in the ratio {a} : {b}. How many are in the smaller share?', min(a, b) * k, f'One part = {total}/{a+b} = {k}; smaller share = {min(a,b)} × {k} = {min(a,b)*k}.', near=[max(a, b) * k, total // 2])


def linear(r):
    a, x, b = r.choice([2, 3, 4, 5, 7]), r.choice([2, 3, 4, 5, 6, 8]), r.choice([1, 3, 5, 7, 9])
    c = a * x + b
    return num(r, 'Algebra & equations', f'If {a}x + {b} = {c}, what is the value of x?', x, f'{a}x = {c} − {b} = {c-b}, so x = {x}.', near=[(c + b) // a if (c + b) % a == 0 else x + 3])


def quad_roots(r):
    p, q = r.sample([1, 2, 3, 4, 5, 6], 2)
    s, prod = p + q, p * q
    return pack(r, 'Algebra & equations', f'What are the roots of x² − {s}x + {prod} = 0?', f'{min(p,q)} and {max(p,q)}', [f'{-max(p,q)} and {-min(p,q)}', f'{min(p,q)} and {-max(p,q)}', f'1 and {prod}' if prod != max(p, q) else f'{s} and {prod}'], f'(x − {p})(x − {q}) = 0, so x = {min(p,q)} or {max(p,q)}.')


def sum_product(r):
    a, b, c = r.choice([1, 2, 3]), r.choice([-7, -5, 4, 6, 9]), r.choice([-6, 2, 3, 5])
    s = Fraction(-b, a)
    return num(r, 'Algebra & equations', f'For {a if a > 1 else ""}x² {"+" if b > 0 else "−"} {abs(b)}x {"+" if c > 0 else "−"} {abs(c)} = 0, what is the sum of the roots?', s, f'Sum of roots = −b/a = {fmt(s)}.', near=[-s, Fraction(c, a)])


def indices(r):
    base, m, n = r.choice([2, 3, 5]), r.choice([2, 3, 4]), r.choice([1, 2, 3])
    val = base ** (m + n) // base ** n
    return num(r, 'Indices & logarithms', f'Simplify {base}^{m + n} ÷ {base}^{n}.', val, f'aᵐ ÷ aⁿ = aᵐ⁻ⁿ: {base}^{m} = {val}.', near=[base ** (m + 2 * n), base ** m * n])


def logs(r):
    base, k = r.choice([(2, 3), (2, 5), (3, 2), (3, 4), (5, 3), (10, 3), (4, 3)])
    n = base ** k
    return num(r, 'Indices & logarithms', f'What is log base {base} of {n}?', k, f'{base}^{k} = {n}, so log_{base} {n} = {k}.', near=[n // base, k + 1])


def circle(r):
    rad = r.choice([3, 4, 5, 6, 7, 10])
    return pack(r, 'Geometry & mensuration', f'What is the area of a circle of radius {rad} cm?', f'{rad*rad}π cm²', [f'{2*rad}π cm²', f'{rad}π cm²', f'{rad*rad*2}π cm²'], f'Area = πr² = π × {rad}² = {rad*rad}π cm².')


def triangle_angle(r):
    a, b = r.choice([35, 40, 45, 50, 55, 65, 70]), r.choice([45, 55, 60, 75, 80])
    c = 180 - a - b
    if c <= 0:
        return triangle_angle(r)
    return num(r, 'Geometry & mensuration', f'Two angles of a triangle are {a}° and {b}°. What is the third angle?', c, f'Angles add to 180°: 180 − {a} − {b} = {c}°.', '°', near=[c + 10, 90 - c if 90 - c > 0 else c + 20])


def pythag(r):
    a, b, c = r.choice([(3, 4, 5), (5, 12, 13), (6, 8, 10), (8, 15, 17), (9, 12, 15)])
    return num(r, 'Geometry & mensuration', f'A right triangle has legs {a} cm and {b} cm. How long is the hypotenuse?', c, f'√({a}² + {b}²) = √{a*a+b*b} = {c} cm.', 'cm', near=[a + b, c + 2])


def rect_box(r):
    l, w, h = r.choice([4, 5, 6, 8]), r.choice([2, 3, 4]), r.choice([2, 3, 5])
    v = l * w * h
    return num(r, 'Geometry & mensuration', f'What is the volume of a box {l} cm long, {w} cm wide and {h} cm high?', v, f'V = l × w × h = {l} × {w} × {h} = {v} cm³.', 'cm³', near=[2 * (l * w + w * h + l * h), l + w + h])


def trig(r):
    items = [('sin 30°', '1/2'), ('cos 60°', '1/2'), ('tan 45°', '1'), ('sin 90°', '1'), ('cos 0°', '1'), ('cos 90°', '0'), ('sin 60°', '√3/2'), ('cos 30°', '√3/2'), ('tan 60°', '√3')]
    q, a = r.choice(items)
    pool = ['1/2', '1', '0', '√3/2', '√3', '1/√2', '1/√3', '2']
    wrong = [p for p in pool if p != a]
    r.shuffle(wrong)
    return pack(r, 'Trigonometry basics', f'What is the value of {q}?', a, wrong[:3], f'{q} = {a} (standard angle).')


def sets(r):
    a, b, both = r.choice([20, 25, 30, 35]), r.choice([15, 18, 22, 28]), r.choice([5, 8, 10, 12])
    u = a + b - both
    return num(r, 'Sets & functions', f'In a class, {a} students play cricket, {b} play football and {both} play both. How many play at least one?', u, f'n(A ∪ B) = n(A) + n(B) − n(A ∩ B) = {a} + {b} − {both} = {u}.', near=[a + b, a + b - 2 * both])


def function_value(r):
    a, b, x = r.choice([2, 3, 4]), r.choice([-3, -1, 1, 5]), r.choice([2, 3, -1])
    v = a * x * x + b
    sign = '+' if b > 0 else '−'
    return num(r, 'Sets & functions', f'If f(x) = {a}x² {sign} {abs(b)}, what is f({x})?', v, f'f({x}) = {a} × {x*x} {sign} {abs(b)} = {v}.', near=[a * x + b, a * x * x - b])


def mean(r):
    vals = r.sample(range(2, 30), 5)
    if sum(vals) % 5:
        return mean(r)
    m = sum(vals) // 5
    return num(r, 'Statistics & probability', f'What is the mean of {", ".join(map(str, vals))}?', m, f'Sum = {sum(vals)}; mean = {sum(vals)}/5 = {m}.', near=[sorted(vals)[2]])


def median(r):
    vals = r.sample(range(1, 40), 7)
    med = sorted(vals)[3]
    return num(r, 'Statistics & probability', f'What is the median of {", ".join(map(str, vals))}?', med, f'In order: {", ".join(map(str, sorted(vals)))}; the middle (4th) value is {med}.', near=[vals[3], round(sum(vals) / 7)])


def probability(r):
    red, blue = r.choice([2, 3, 4, 5]), r.choice([3, 5, 6, 7])
    p = Fraction(red, red + blue)
    return num(r, 'Statistics & probability', f'A bag has {red} red and {blue} blue balls. One ball is picked at random. What is the probability it is red?', p, f'P = {red}/{red+blue}' + (f' = {fmt(p)}.' if p.denominator != red + blue else '.'), near=[Fraction(blue, red + blue), Fraction(red, blue)])


MATH = [pct, pct_change, simple_interest, ratio, linear, quad_roots, sum_product, indices, logs, circle, triangle_angle, pythag, rect_box, trig, sets, function_value, mean, median, probability]


# ---- Section D: Higher Mathematics & Physics --------------------------------

def derivative(r):
    a, n, x = r.choice([2, 3, 4, 5]), r.choice([2, 3]), r.choice([1, 2, 3])
    v = a * n * x ** (n - 1)
    return num(r, 'Differentiation', f'If y = {a}x^{n}, what is dy/dx at x = {x}?', v, f'dy/dx = {a*n}x^{n-1}; at x = {x} it is {v}.', near=[a * x ** n, a * n * x ** n])


def integral(r):
    a, b = r.choice([1, 2, 3]), r.choice([2, 3, 4])
    # ∫0^b a x^2 dx = a b^3 / 3
    v = Fraction(a * b ** 3, 3)
    return num(r, 'Integration', f'Evaluate the integral of {a if a > 1 else ""}x² from 0 to {b}.', v, f'∫{a if a>1 else ""}x² dx = {fmt(Fraction(a,3))}x³; from 0 to {b}: {fmt(v)}.', near=[a * b ** 2, Fraction(a * b ** 3, 2)])


def dot(r):
    a = [r.randint(-3, 4) for _ in range(3)]
    b = [r.randint(-3, 4) for _ in range(3)]
    d = sum(x * y for x, y in zip(a, b))
    vec = lambda v: f'{v[0]}i {"+" if v[1] >= 0 else "−"} {abs(v[1])}j {"+" if v[2] >= 0 else "−"} {abs(v[2])}k'
    return num(r, 'Vectors & coordinate geometry', f'If A = {vec(a)} and B = {vec(b)}, what is A · B?', d, f'A · B = {"+".join(f"({x})({y})" for x, y in zip(a, b))} = {d}.', near=[-d if d else 3, d + 4])


def slope(r):
    x1, y1, x2, y2 = r.choice([(1, 2, 3, 6), (0, 1, 2, 7), (2, 5, 4, 1), (-1, 3, 1, 7), (1, 1, 4, 10)])
    m = Fraction(y2 - y1, x2 - x1)
    return num(r, 'Vectors & coordinate geometry', f'What is the slope of the line through ({x1}, {y1}) and ({x2}, {y2})?', m, f'm = ({y2} − {y1})/({x2} − {x1}) = {fmt(m)}.', near=[Fraction(x2 - x1, y2 - y1) if y2 != y1 else m + 2, -m])


def distance(r):
    x1, y1, dx, dy = r.choice([0, 1, 2]), r.choice([0, 1, 3]), *r.choice([(3, 4), (6, 8), (5, 12)])
    d = int(math.hypot(dx, dy))
    return num(r, 'Vectors & coordinate geometry', f'What is the distance between ({x1}, {y1}) and ({x1+dx}, {y1+dy})?', d, f'√({dx}² + {dy}²) = {d}.', near=[dx + dy, d + 1])


def modulus(r):
    a, b = r.choice([(3, 4), (6, 8), (5, 12), (8, 6)])
    return num(r, 'Complex numbers & polynomials', f'What is the modulus of {a} + {b}i?', int(math.hypot(a, b)), f'|z| = √({a}² + {b}²) = {int(math.hypot(a, b))}.', near=[a + b, a * b])


def remainder(r):
    a, c, k = r.choice([1, 2]), r.choice([-5, -3, 2, 4]), r.choice([1, 2, -1])
    # f(x) = x^3 + a x + c, remainder on division by (x - k) is f(k)
    v = k ** 3 + a * k + c
    sign = lambda n: f'+ {n}' if n >= 0 else f'− {abs(n)}'
    return num(r, 'Complex numbers & polynomials', f'What is the remainder when x³ {"+ x" if a == 1 else sign(a) + "x"} {sign(c)} is divided by (x {sign(-k)})?', v, f'Remainder theorem: f({k}) = {k**3} {sign(a*k)} {sign(c)} = {v}.', near=[-v if v else 2, v + k])


def kinematics(r):
    u, a, t = r.choice([0, 2, 5, 10]), r.choice([2, 3, 4]), r.choice([2, 3, 4, 5])
    v = u + a * t
    return num(r, "Kinematics & Newton's laws", f'A car starts at {u} m/s and accelerates at {a} m/s² for {t} s. What is its final speed?', v, f'v = u + at = {u} + {a} × {t} = {v} m/s.', 'm/s', near=[a * t, u * t + a * t])


def displacement(r):
    a, t = r.choice([2, 4, 6]), r.choice([2, 3, 4, 5])
    s = a * t * t // 2
    return num(r, "Kinematics & Newton's laws", f'A body starts from rest with acceleration {a} m/s². How far does it go in {t} s?', s, f's = ½at² = ½ × {a} × {t}² = {s} m.', 'm', near=[a * t, a * t * t])


def newton(r):
    m, a = r.choice([2, 4, 5, 10, 20]), r.choice([2, 3, 5])
    return num(r, "Kinematics & Newton's laws", f'What force gives a {m} kg mass an acceleration of {a} m/s²?', m * a, f'F = ma = {m} × {a} = {m*a} N.', 'N', near=[m + a, Fraction(m, a)])


def kinetic(r):
    m, v = r.choice([2, 4, 5, 10]), r.choice([2, 3, 4, 6])
    ke = m * v * v // 2
    return num(r, 'Work, energy & momentum', f'What is the kinetic energy of a {m} kg body moving at {v} m/s?', ke, f'KE = ½mv² = ½ × {m} × {v}² = {ke} J.', 'J', near=[m * v, m * v * v])


def momentum(r):
    m, v = r.choice([0.5, 2, 3, 5]), r.choice([4, 6, 10, 12])
    p = m * v
    return num(r, 'Work, energy & momentum', f'What is the momentum of a {fmt(m)} kg ball moving at {v} m/s?', p, f'p = mv = {fmt(m)} × {v} = {fmt(p)} kg·m/s.', 'kg·m/s', near=[m * v * v / 2, m + v])


def ohm(r):
    v, rr = r.choice([6, 12, 24, 220]), r.choice([2, 3, 4, 6, 10])
    if v % rr:
        return ohm(r)
    return num(r, 'Electricity & circuits', f'A {v} V supply is connected across a {rr} Ω resistor. What current flows?', v // rr, f'I = V/R = {v}/{rr} = {v//rr} A.', 'A', near=[v * rr, rr])


def resistors(r):
    a, b = r.choice([(3, 6), (4, 4), (6, 12), (2, 2), (10, 15)])
    par = Fraction(a * b, a + b)
    return num(r, 'Electricity & circuits', f'Resistors of {a} Ω and {b} Ω are joined in parallel. What is the total resistance?', par, f'1/R = 1/{a} + 1/{b}, so R = {a*b}/{a+b} = {fmt(par)} Ω.', 'Ω', near=[a + b, Fraction(a + b, 2)])


def wave(r):
    f, lam = r.choice([50, 100, 200, 250, 500]), r.choice([0.5, 1.5, 2, 4])
    return num(r, 'Waves, optics & modern physics', f'A wave has frequency {f} Hz and wavelength {fmt(lam)} m. What is its speed?', f * lam, f'v = fλ = {f} × {fmt(lam)} = {fmt(f*lam)} m/s.', 'm/s', near=[f / lam, f + lam])


def power(r):
    v, i = r.choice([12, 220, 240]), r.choice([2, 3, 5])
    return num(r, 'Electricity & circuits', f'A device draws {i} A from a {v} V supply. What power does it use?', v * i, f'P = VI = {v} × {i} = {v*i} W.', 'W', near=[Fraction(v, i), v + i])


HMPHYS = [derivative, integral, dot, slope, distance, modulus, remainder, kinematics, displacement, newton, kinetic, momentum, ohm, resistors, wave, power]


def build(families, per_set, sets, seed, prefix):
    out = []
    for n in range(1, sets + 1):
        r = random.Random(seed * 1000 + n)
        order = families[:]
        r.shuffle(order)
        chosen = (order * 3)[:per_set]
        qs, seen = [], set()
        for i, fam in enumerate(chosen):
            for _ in range(20):
                q = fam(r)
                if q['question'] not in seen:
                    break
            seen.add(q['question'])
            q['id'] = f'{prefix}-{n}-{i+1}'
            qs.append(q)
        out.append({'n': n, 'questions': qs})
    return out


def write(name, const, data, note):
    text = f'// Generated by scripts/gen-brac.py. {note} Do not edit by hand.\nexport const {const} = ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n'
    (ROOT / 'src' / 'mockBank' / name).write_text(text, encoding='utf8')


if __name__ == '__main__':
    write('bracMath.js', 'BRAC_MATH', build(MATH, 15, 4, 7, 'bmath'), 'Original BRAC-style Mathematics questions (section C); every answer is computed.')
    write('bracHmphys.js', 'BRAC_HMPHYS', build(HMPHYS, 10, 4, 11, 'hmphys'), 'Original Higher Mathematics & Physics questions (section D); every answer is computed.')
    print('ok')
