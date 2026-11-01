#!/usr/bin/env python3
"""Writes src/mockBank/nsuQuant.js: original, computer-checked quantitative questions.
Every answer is computed from the question's numbers, so the key cannot be wrong.
Run: python3 scripts/gen-quant.py"""
import json, math, random, pathlib

LETTERS = 'ABCDE'
def fmt(x, unit=''):
    if isinstance(x, float):
        x = round(x, 2)
        s = str(int(x)) if x == int(x) else ('%.2f' % x).rstrip('0').rstrip('.')
    else:
        s = str(x)
    return f'{unit}{s}' if unit in ('Tk ', '$') else (f'{s}{unit}' if unit else s)

def numopts(rng, ans, unit='', near=None):
    cands = near or []
    cands += [ans + 1, ans - 1, ans + 2, ans - 2, ans * 2, ans + 10, ans - 10, ans + 5, ans - 5, ans * 3, ans + 4, ans - 4]
    if isinstance(ans, int) and ans % 2 == 0: cands += [ans // 2]
    seen, out = {ans}, []
    for c in cands:
        if c in seen or c <= 0: continue
        if c == int(c) and isinstance(ans, int): c = int(c)
        seen.add(c); out.append(c)
    first = [c for c in dict.fromkeys(near or []) if c in seen and c != ans and c > 0][:2]
    rest = [c for c in out if c not in first]
    rng.shuffle(rest)
    chosen = (first + rest)[:4]
    return ans, chosen, unit

def pack(rng, topic, q, ans, wrong, explain, unit=''):
    texts = [fmt(ans, unit)] + [fmt(w, unit) for w in wrong]
    assert len(set(texts)) == 5, (q, texts)
    order = list(range(5)); rng.shuffle(order)
    options = [texts[i] for i in order]
    return dict(question=q, options=options, answer=order.index(0), topic=topic, explain=explain)

def num(rng, topic, q, ans, explain, unit='', near=None):
    a, w, u = numopts(rng, ans, unit, near)
    return pack(rng, topic, q, a, w, explain, u)

# ---- families: each returns one question ----------------------------------
def pct_of(r):
    p = r.choice([15, 20, 25, 30, 35, 40, 45, 60, 65, 75]); n = r.choice([120, 160, 180, 200, 240, 260, 280, 320, 360, 400, 480])
    a = p * n // 100
    if p * n % 100: return pct_of(r)
    return num(r, 'Percentages & ratio', f'What is {p}% of {n}?', a, f'{p}% of {n} = {p}/100 × {n} = {a}.', near=[n // p, a * 10 if a * 10 != a else a + 3])
def pct_change(r):
    a = r.choice([40, 50, 80, 120, 200, 250]); pc = r.choice([10, 20, 25, 30, 40, 50]); b = a * (100 + pc) // 100
    if a * (100 + pc) % 100: return pct_change(r)
    return num(r, 'Percentages & ratio', f'The price of a book rose from Tk {a} to Tk {b}. What is the percentage increase?', pc, f'Increase = {b-a}; {b-a}/{a} × 100 = {pc}%.', '%', near=[pc + 5, round((b - a) / b * 100) if (b - a) * 100 % b == 0 else pc + 10])
def ratio_share(r):
    a, b = r.choice([(2, 3), (3, 5), (4, 5), (1, 4), (3, 7), (5, 7)]); k = r.choice([20, 30, 40, 50, 60, 70]); n = (a + b) * k
    big = max(a, b) * k
    return num(r, 'Percentages & ratio', f'Tk {n} is shared between two people in the ratio {a}:{b}. How much does the larger share receive?', big, f'Total parts = {a+b}; one part = {k}; larger share = {max(a,b)} × {k} = {big}.', 'Tk ', near=[min(a, b) * k, n // 2 + k])
def ratio_class(r):
    a, b = r.choice([(3, 2), (4, 3), (5, 3), (7, 5), (2, 1)]); k = r.choice([4, 5, 6, 8, 9]); n = (a + b) * k; girls = b * k
    return num(r, 'Percentages & ratio', f'In a class of {n} students the ratio of boys to girls is {a}:{b}. How many girls are there?', girls, f'One part = {n}/{a+b} = {k}; girls = {b} × {k} = {girls}.', near=[a * k, n - k])
def sp_profit(r):
    cp = r.choice([200, 250, 400, 500, 600, 800]); p = r.choice([10, 20, 25, 40]); sp = cp * (100 + p) // 100
    if cp * (100 + p) % 100: return sp_profit(r)
    return num(r, 'Profit & loss', f'A shopkeeper buys a shirt for Tk {cp} and sells it at a {p}% profit. What is the selling price?', sp, f'Profit = {p}% of {cp} = {sp-cp}; SP = {cp} + {sp-cp} = {sp}.', 'Tk ', near=[sp - 2 * (sp - cp), cp - (sp - cp)])
def cp_loss(r):
    cp = r.choice([400, 500, 800, 1000, 1200]); l = r.choice([10, 20, 25]); sp = cp * (100 - l) // 100
    if cp * (100 - l) % 100: return cp_loss(r)
    return num(r, 'Profit & loss', f'A radio is sold for Tk {sp} at a loss of {l}%. What was its cost price?', cp, f'SP is {100-l}% of CP, so CP = {sp} × 100/{100-l} = {cp}.', 'Tk ', near=[sp + sp * l // 100, sp * (100 + l) // 100])
def discount(r):
    m = r.choice([500, 800, 1000, 1500, 2000]); d = r.choice([10, 15, 20, 25]); amt = m * d // 100
    if m * d % 100: return discount(r)
    return num(r, 'Profit & loss', f'A bag has a marked price of Tk {m}. After a {d}% discount, what is the price paid?', m - amt, f'Discount = {amt}; price paid = {m} − {amt} = {m-amt}.', 'Tk ', near=[m + amt, amt])
def work_together(r):
    a, b = r.choice([(10, 15), (12, 24), (20, 30), (6, 12), (15, 30), (12, 6), (9, 18)]); t = a * b // (a + b)
    if a * b % (a + b): return work_together(r)
    return num(r, 'Time, work & speed', f'A can finish a job in {a} days and B can finish it in {b} days. Working together, in how many days will they finish it?', t, f'Rate = 1/{a} + 1/{b} = {a+b}/{a*b} per day, so time = {a*b}/{a+b} = {t} days.', ' days', near=[(a + b) // 2, a + b - t])
def avg_speed(r):
    u, v = r.choice([(40, 60), (30, 60), (20, 30), (60, 90), (30, 45), (50, 75)]); s = 2 * u * v // (u + v)
    if 2 * u * v % (u + v): return avg_speed(r)
    return num(r, 'Time, work & speed', f'A bus goes to a town at {u} km/h and returns at {v} km/h along the same road. What is its average speed for the whole trip?', s, f'Average speed = 2uv/(u+v) = 2 × {u} × {v}/{u+v} = {s} km/h (not the simple mean).', ' km/h', near=[(u + v) // 2])
def distance(r):
    s = r.choice([30, 36, 40, 48, 54, 60, 72]); t = r.choice([20, 30, 40, 45, 50, 90]); d = s * t / 60
    return num(r, 'Time, work & speed', f'A cyclist travels at {s} km/h for {t} minutes. How far does the cyclist go?', int(d) if d == int(d) else d, f'{t} minutes = {t}/60 hour; distance = {s} × {t}/60 = {fmt(d)} km.', ' km', near=[s * t // 60 + s // 2, float(s * t)] if d != int(d) else [s * t // 10])
def train_pole(r):
    v, L = r.choice([(36, 100), (54, 150), (72, 200), (90, 250), (36, 180), (54, 300)]); t = L * 18 / (v * 5)
    if t != int(t): return train_pole(r)
    t = int(t)
    return num(r, 'Time, work & speed', f'A train {L} m long runs at {v} km/h. How many seconds does it take to pass a pole?', t, f'{v} km/h = {v} × 5/18 = {v*5//18 if (v*5)%18==0 else v*5/18} m/s; time = {L} ÷ that = {t} s.', ' s', near=[L // 10, t * 2])
def linear(r):
    a = r.choice([2, 3, 4, 5, 6]); x = r.choice([3, 4, 5, 6, 7, 8, 9]); b = r.choice([1, 2, 3, 5, 7, 9]); c = a * x + b
    return num(r, 'Algebra', f'If {a}x + {b} = {c}, what is the value of x?', x, f'{a}x = {c} − {b} = {c-b}, so x = {x}.', near=[(c + b) // a if (c + b) % a == 0 else x + 3, c - b])
def sum_diff(r):
    x, y = r.choice([(9, 4), (10, 6), (8, 3), (12, 5), (7, 2), (11, 4), (13, 5)]); s, d = x + y, x - y
    return num(r, 'Algebra', f'If x + y = {s} and x − y = {d}, what is the value of xy?', x * y, f'x = ({s}+{d})/2 = {x}, y = ({s}−{d})/2 = {y}; xy = {x*y}.', near=[s * d, x + y])
def quad_roots(r):
    p, q = r.choice([(2, 5), (3, 4), (1, 6), (2, 7), (3, 8), (4, 5), (1, 9)]); b, c = p + q, p * q
    return num(r, 'Algebra', f'The roots of x² − {b}x + {c} = 0 are both positive. What is the larger root?', max(p, q), f'x² − {b}x + {c} = (x − {p})(x − {q}), so the roots are {p} and {q}.', near=[b, c])
def func_eval(r):
    a, b = r.choice([(2, 1), (3, 2), (2, 3), (4, 1), (3, 5), (5, 2)]); f1, f2, f3 = a + b, 4 * a + b, 9 * a + b
    return num(r, 'Algebra', f'If f(x) = ax² + b with f(1) = {f1} and f(2) = {f2}, what is f(3)?', f3, f'f(2) − f(1) = 3a = {f2-f1}, so a = {a}; b = {b}; f(3) = 9 × {a} + {b} = {f3}.', near=[f2 + f1, 3 * a + b])
def lcm_q(r):
    a, b = r.choice([(12, 18), (8, 12), (15, 20), (14, 21), (9, 12), (16, 24), (10, 25)]); l = a * b // math.gcd(a, b)
    return num(r, 'Number properties', f'What is the least common multiple (LCM) of {a} and {b}?', l, f'LCM = {a} × {b} / HCF = {a*b}/{math.gcd(a,b)} = {l}.', near=[a * b, math.gcd(a, b)])
def hcf_q(r):
    a, b = r.choice([(36, 48), (24, 60), (45, 75), (28, 42), (54, 72), (40, 100)]); g = math.gcd(a, b)
    return num(r, 'Number properties', f'What is the highest common factor (HCF) of {a} and {b}?', g, f'The largest number that divides both {a} and {b} is {g}.', near=[a - b if a > b else b - a, g * 2])
def divisors(r):
    n, d = r.choice([(12, 6), (18, 6), (20, 6), (24, 8), (30, 8), (36, 9), (48, 10), (60, 12), (72, 12)])
    return num(r, 'Number properties', f'How many positive divisors does {n} have?', d, f'Counting the numbers that divide {n} evenly gives {d}.', near=[n // 2, d + 2])
def remainder(r):
    d = r.choice([5, 6, 7, 8, 9]); q = r.choice([13, 17, 21, 25, 31]); rem = r.randint(1, d - 1); n = d * q + rem
    return num(r, 'Number properties', f'What is the remainder when {n} is divided by {d}?', rem, f'{n} = {d} × {q} + {rem}.', near=[d - rem if d - rem != rem else rem + 1, q % d + 6])
def sum_n(r):
    n = r.choice([10, 12, 15, 20, 25, 30]); s = n * (n + 1) // 2
    return num(r, 'Number properties', f'What is the sum of the integers from 1 to {n}?', s, f'n(n+1)/2 = {n} × {n+1}/2 = {s}.', near=[n * n, s + n])
def diagonal(r):
    k = r.choice([2, 3, 4, 5, 6]); w, l = 3 * k, 4 * k
    return num(r, 'Geometry & mensuration', f'A rectangle is {l} cm long and {w} cm wide. What is the length of its diagonal?', 5 * k, f'Diagonal = √({l}² + {w}²) = √{l*l+w*w} = {5*k} cm.', ' cm', near=[l + w, l * w // 2 if (l * w) % 2 == 0 else l + w + 1])
def circle_area(r):
    rad = r.choice([3, 4, 5, 6, 7, 8, 9, 10, 12])
    ans = f'{rad*rad}π'
    wrong = [f'{2*rad}π', f'{rad*rad*2}π', f'{rad*rad//2 if rad*rad%2==0 else rad*rad+1}π', f'{rad}π']
    return pack(r, 'Geometry & mensuration', f'What is the area of a circle of radius {rad} cm (in terms of π)?', ans, wrong, f'Area = πr² = π × {rad}² = {rad*rad}π cm².', '')
def tri_angle(r):
    a, b = r.choice([(40, 65), (50, 70), (35, 85), (60, 55), (45, 75), (30, 80)])
    return num(r, 'Geometry & mensuration', f'Two angles of a triangle are {a}° and {b}°. What is the third angle?', 180 - a - b, f'Angles sum to 180°: 180 − {a} − {b} = {180-a-b}°.', '°', near=[180 - a, a + b])
def cuboid(r):
    l, w, h = r.choice([(10, 5, 4), (20, 10, 6), (12, 5, 5), (15, 10, 4), (8, 5, 5), (25, 10, 4)])
    return num(r, 'Geometry & mensuration', f'A tank is {l} cm long, {w} cm wide and {h} cm high. What is its volume in cm³?', l * w * h, f'Volume = {l} × {w} × {h} = {l*w*h} cm³.', ' cm³', near=[2 * (l * w + w * h + h * l), l + w + h])
def square_perim(r):
    s = r.choice([6, 7, 8, 9, 12, 15]); p = 4 * s
    return num(r, 'Geometry & mensuration', f'The perimeter of a square is {p} cm. What is its area?', s * s, f'Side = {p}/4 = {s}; area = {s}² = {s*s} cm².', ' cm²', near=[p, 2 * s])
def arrange(r):
    n = r.choice([4, 5, 6]); ans = math.factorial(n)
    return num(r, 'Counting & probability', f'In how many different ways can {n} different books be arranged on a shelf?', ans, f'{n}! = {ans}.', near=[n * n, ans // n])
def committee(r):
    n, k = r.choice([(5, 2), (6, 2), (6, 3), (7, 2), (8, 2), (5, 3), (7, 3)]); ans = math.comb(n, k)
    return num(r, 'Counting & probability', f'A committee of {k} is chosen from {n} students. How many different committees are possible?', ans, f'C({n},{k}) = {ans}.', near=[math.perm(n, k), n * k])
def prob_ball(r):
    red, blue = r.choice([(3, 5), (4, 6), (2, 8), (5, 5), (6, 4), (3, 9)]); t = red + blue; g = math.gcd(red, t)
    ans = f'{red//g}/{t//g}'
    cands = [f'{blue//math.gcd(blue,t)}/{t//math.gcd(blue,t)}', f'{red}/{blue}' if red != blue else f'{red}/{t+1}', f'1/{t}', f'{red+1}/{t}']
    cands = [c for c in dict.fromkeys(cands) if c != ans]
    cands += [f'{red}/{t+2}', f'{t}/{red}']
    return pack(r, 'Counting & probability', f'A bag has {red} red and {blue} blue balls. One ball is drawn at random. What is the probability it is red?', ans, cands[:4], f'P(red) = {red}/{t} = {ans}.')
def prob_dice(r):
    tgt = r.choice([7, 8, 9, 10]); ways = {7: 6, 8: 5, 9: 4, 10: 3}[tgt]; g = math.gcd(ways, 36); ans = f'{ways//g}/{36//g}'
    pool = ['1/6', '1/12', '5/36', '1/9', '1/4', '7/36', '5/18', '1/3']
    wrong = [p for p in pool if p != ans][:4]
    return pack(r, 'Counting & probability', f'Two fair dice are rolled. What is the probability that the sum is {tgt}?', ans, wrong, f'There are {ways} ways to get {tgt} out of 36, so {ways}/36 = {ans}.')
def di_average(r):
    base = r.choice([30, 40, 50, 60]); d = r.choice([10, 15, 20]); v = [base, base + d, base + 2 * d, base + 3 * d]; avg = sum(v) // 4
    if sum(v) % 4: return di_average(r)
    return num(r, 'Data interpretation', f'A shop sold {v[0]}, {v[1]}, {v[2]} and {v[3]} phones in four consecutive months. What was the average number sold per month?', avg, f'Total = {sum(v)}; average = {sum(v)}/4 = {avg}.', near=[v[3], v[0] + d])
def di_change(r):
    a = r.choice([40, 50, 80, 100, 200]); pc = r.choice([10, 20, 25, 50]); b = a * (100 + pc) // 100
    if a * (100 + pc) % 100: return di_change(r)
    return num(r, 'Data interpretation', f'A school had {a} students in 2023 and {b} students in 2024. By what percentage did enrolment grow?', pc, f'Growth = {b-a}; {b-a}/{a} × 100 = {pc}%.', '%', near=[pc * 2, b - a])
def di_share(r):
    tot = r.choice([200, 400, 500, 800]); p = r.choice([10, 20, 25, 30]); sub = tot * p // 100
    if tot * p % 100: return di_share(r)
    return num(r, 'Data interpretation', f'In a survey of {tot} people, {sub} said they prefer tea. What percentage prefer tea?', p, f'{sub}/{tot} × 100 = {p}%.', '%', near=[sub // 10 or 5])

FAMILIES = {
    'Percentages & ratio': [pct_of, pct_change, ratio_share, ratio_class],
    'Profit & loss': [sp_profit, cp_loss, discount],
    'Time, work & speed': [work_together, avg_speed, distance, train_pole],
    'Algebra': [linear, sum_diff, quad_roots, func_eval],
    'Number properties': [lcm_q, hcf_q, divisors, remainder, sum_n],
    'Geometry & mensuration': [diagonal, circle_area, tri_angle, cuboid, square_perim],
    'Counting & probability': [arrange, committee, prob_ball, prob_dice],
    'Data interpretation': [di_average, di_change, di_share],
}
PLAN = [7, 5, 7, 7, 7, 7, 6, 4]   # per topic, 50 questions per mock

def build(mock):
    rng = random.Random(9000 + mock)
    seen, qs = set(), []
    for (topic, fams), count in zip(FAMILIES.items(), PLAN):
        order = fams[:]; rng.shuffle(order)
        for i in range(count):
            for _ in range(200):
                q = order[(i + _) % len(order)](rng)
                if q['question'] not in seen and q['question'] not in GLOBAL: break
            else:
                raise SystemExit('could not make a unique question for ' + topic)
            seen.add(q['question']); GLOBAL.add(q['question']); qs.append(q)
    rng.shuffle(qs)
    return qs

GLOBAL = set()
mocks = []
for n in (1, 2, 3):
    qs = build(n)
    assert len(qs) == 50 and len({q['question'] for q in qs}) == 50, 'duplicate questions'
    for i, q in enumerate(qs, 1): q['id'] = f'quant-{n}-{i}'
    mocks.append(dict(n=n, questions=qs))
out = pathlib.Path(__file__).resolve().parent.parent / 'src' / 'mockBank' / 'nsuQuant.js'
out.write_text('// Generated by scripts/gen-quant.py. Original questions; every answer is computed. Do not edit by hand.\nexport const NSU_QUANT = ' + json.dumps(mocks, ensure_ascii=False, indent=1) + ';\n')
print('wrote', out, [len(m['questions']) for m in mocks])
