#!/usr/bin/env python3
"""Writes content/sat/math.js: original SAT-style Math questions.

Every answer is computed from the numbers in the question, so a key cannot be
wrong. Each "family" below writes one kind of question at one of three levels
(1 easier, 2 medium, 3 harder) for one skill in src/sat/blueprint.js.

Run: python scripts/gen-sat-math.py
"""
import json, pathlib, random
from fractions import Fraction as F
from math import gcd

M = '−'  # a real minus sign
SUP = str.maketrans('0123456789-', '⁰¹²³⁴⁵⁶⁷⁸⁹⁻')
PI = 'π'
VARIANTS = 6  # questions per family per level


class Skip(Exception):
    """Raised when the random numbers do not make a clean question; the caller tries again."""


def need(ok):
    if not ok:
        raise Skip()


def norm(x):
    if isinstance(x, F):
        return x.numerator if x.denominator == 1 else x
    if isinstance(x, float):
        x = round(x, 4)
        return int(x) if x == int(x) else x
    return x


def n(x):
    """A number as the student sees it."""
    x = norm(x)
    if isinstance(x, F):
        return (M if x < 0 else '') + f'{abs(x.numerator)}/{x.denominator}'
    if isinstance(x, float):
        return ('%.4f' % x).rstrip('0').rstrip('.').replace('-', M)
    return str(x).replace('-', M)


def plain(x):
    """A number as the student types it."""
    return n(x).replace(M, '-')


def money(x):
    x = norm(x)
    return f'${x:,.2f}' if isinstance(x, float) else f'${x:,}'


def pm(b):
    return f'+ {n(b)}' if b >= 0 else f'{M} {n(-b)}'


def poly(cs, v='x'):
    """[1, -5, 6] -> x² − 5x + 6"""
    deg, out = len(cs) - 1, ''
    for i, c in enumerate(cs):
        p = deg - i
        if c == 0:
            continue
        mag = abs(c)
        body = (n(mag) if (mag != 1 or p == 0) else '') + (v if p >= 1 else '') + (str(p).translate(SUP) if p >= 2 else '')
        out = ((M if c < 0 else '') + body) if not out else out + (f' {M} ' if c < 0 else ' + ') + body
    return out or '0'


def lin(a, b, v='x'):
    return poly([a, b], v)


def undo(b):
    """How to remove a constant term b from one side."""
    return f'Take {n(b)} from both sides' if b > 0 else f'Add {n(-b)} to both sides'


def xp(a, v='x'):
    return f'({v} {pm(a)})'


def mc(r, skill, level, q, ans, wrong, explain, table=None):
    """Multiple choice with text options, shuffled."""
    texts = [str(ans)] + [str(w) for w in wrong]
    need(len(texts) == 4 and len(set(texts)) == 4)
    order = list(range(4))
    r.shuffle(order)
    item = dict(skill=skill, level=level, type='mc', question=q, options=[texts[i] for i in order], answer=order.index(0), explain=explain)
    if table:
        item['table'] = table
    return item


def num_mc(r, skill, level, q, ans, cands, explain, pre='', unit='', table=None, pos=None):
    """Multiple choice with number options, listed from smallest to largest as on the test."""
    ans = norm(ans)
    pos = (ans > 0) if pos is None else pos
    seen, wrong = {ans}, []
    for c in list(cands) + [ans + 1, ans - 1, ans + 2, ans * 2, ans - 2, ans + 10, ans + 5, ans * 3]:
        c = norm(c)
        if c in seen or (pos and c <= 0):
            continue
        seen.add(c)
        wrong.append(c)
        if len(wrong) == 3:
            break
    need(len(wrong) == 3)
    values = sorted([ans] + wrong)
    item = dict(skill=skill, level=level, type='mc', question=q, options=[f'{pre}{n(v)}{unit}' for v in values], answer=values.index(ans), explain=explain)
    if table:
        item['table'] = table
    return item


def spr(skill, level, q, value, explain, table=None):
    """The student types the answer."""
    value = norm(value)
    accept = [plain(value)]
    if isinstance(value, F):
        d = value.denominator
        while d % 2 == 0:
            d //= 2
        while d % 5 == 0:
            d //= 5
        if d == 1:
            accept.append(plain(float(value)))
    item = dict(skill=skill, level=level, type='spr', question=q, accept=accept, values=[float(value)], explain=explain)
    if table:
        item['table'] = table
    return item


NAMES = ['Rafi', 'Nadia', 'Arif', 'Maya', 'Tania', 'Omar', 'Lina', 'Sami', 'Ishaan', 'Farah']

# ---- Algebra ----------------------------------------------------------------

def lin1_solve(r, L):
    x = r.choice([k for k in range(-9, 13) if k != 0])
    if L == 1:
        a = r.choice([2, 3, 4, 5, 6, 7]); b = r.choice([k for k in range(-15, 16) if k != 0]); c = a * x + b
        return num_mc(r, 'lin1', L, f'If {lin(a, b)} = {n(c)}, what is the value of x?', x, [c - b, F(c + b, a), -x, x + b],
                      f'{undo(b)}: {a}x = {n(c - b)}. Divide by {a}: x = {n(x)}.', pos=False)
    if L == 2:
        a = r.choice([2, 3, 4, 5]); b = r.choice([k for k in range(-6, 7) if k != 0]); c = r.choice([k for k in range(-4, 8) if k not in (0, a)])
        d = a * (x + b) - c * x
        return num_mc(r, 'lin1', L, f'{a}{xp(b)} = {lin(c, d)}\n\nWhat value of x satisfies the equation above?', x,
                      [F(d + a * b, a - c), F(d - b, a - c), -x],
                      f'Expand the left side: {lin(a, a * b)} = {lin(c, d)}. Collect terms: {n(a - c)}x = {n(d - a * b)}, so x = {n(x)}.', pos=False)
    a, b = r.choice([(2, 3), (2, 5), (3, 4), (4, 6), (3, 5), (2, 7)])
    lcm = a * b // gcd(a, b); x = lcm * r.choice([1, 2, 3, 4]); c = x // a + x // b
    return spr('lin1', L, f'x/{a} + x/{b} = {c}\n\nWhat value of x satisfies the equation above?', x,
               f'Multiply every term by {lcm}: {lcm // a}x + {lcm // b}x = {c * lcm}, so {lcm // a + lcm // b}x = {c * lcm} and x = {x}.')


def lin1_word(r, L):
    if L == 1:
        fee = r.choice([3, 4, 5, 8, 10, 12]); rate = r.choice([2, 3, 4, 6]); units = r.randint(4, 18); total = fee + rate * units
        text = r.choice([
            f'A taxi ride costs a fixed fee of ${fee} plus ${rate} for each kilometre travelled. A ride cost ${total}. How many kilometres long was the ride?',
            f'A print shop charges a setup fee of ${fee} plus ${rate} for each poster. An order cost ${total}. How many posters were in the order?',
            f'A bike rental costs ${fee} plus ${rate} for each hour. {r.choice(NAMES)} paid ${total}. For how many hours was the bike rented?',
        ])
        return num_mc(r, 'lin1', L, text, units, [F(total, rate), total - fee, units + fee],
                      f'{fee} + {rate}n = {total}, so {rate}n = {total - fee} and n = {units}.')
    need(L == 2)
    q1 = r.choice([3, 4, 5, 6]); p1 = q1 + r.choice([2, 3, 4, 5]); months = r.randint(3, 12); a = r.choice([10, 20, 25, 40]); b = a + (p1 - q1) * months
    return spr('lin1', L, f'Gym A charges a joining fee of ${a} plus ${p1} per week. Gym B charges a joining fee of ${b} plus ${q1} per week. After how many weeks is the total cost of the two gyms the same?', months,
               f'Set the costs equal: {a} + {p1}w = {b} + {q1}w. Then {p1 - q1}w = {b - a}, so w = {months}.')


def lin1_special(r, L):
    need(L == 3)
    a = r.choice([2, 3, 4, 5, 6]); b = r.choice([2, 3, 4, 5, 7])
    if r.random() < 0.5:
        c = a * b + r.choice([-5, -3, -2, 2, 3, 5])
        return num_mc(r, 'lin1', L, f'{a}{xp(b)} = kx + {c}\n\nIn the equation above, k is a constant. The equation has no solution. What is the value of k?', a, [a * b, c, a + b],
                      f'The left side is {lin(a, a * b)}. With k = {a} the x-terms match but the constants ({a * b} and {c}) do not, so no value of x works.')
    return num_mc(r, 'lin1', L, f'{a}{xp(b)} = {a}x + c\n\nIn the equation above, c is a constant. The equation has infinitely many solutions. What is the value of c?', a * b, [a, b, a + b],
                  f'The left side is {lin(a, a * b)}. Both sides are the same for every x only when c = {a * b}.')


def lin2_slope(r, L):
    need(L == 1)
    x1, y1 = r.randint(-5, 4), r.randint(-6, 6); dx = r.choice([1, 2, 3, 4, 5]); dy = r.choice([k for k in range(-8, 9) if k != 0 and abs(k) != dx])
    x2, y2 = x1 + dx, y1 + dy; s = F(dy, dx)
    return num_mc(r, 'lin2', L, f'In the xy-plane, a line passes through the points ({n(x1)}, {n(y1)}) and ({n(x2)}, {n(y2)}). What is the slope of the line?', s, [F(dx, dy), -s, F(-dx, dy)],
                  f'Slope = change in y over change in x = ({n(y2)} {M} {n(y1) if y1 >= 0 else "(" + n(y1) + ")"}) / ({n(x2)} {M} {n(x1) if x1 >= 0 else "(" + n(x1) + ")"}) = {n(dy)}/{n(dx)}' + (f' = {n(s)}.' if n(s) != f'{n(dy)}/{n(dx)}' else '.'), pos=False)


def lin2_equation(r, L):
    need(L == 2)
    m = r.choice([-4, -3, -2, 2, 3, 4, 5]); x1 = r.choice([-3, -2, -1, 1, 2, 3, 4]); y1 = r.randint(-6, 8); b = y1 - m * x1
    need(b != 0 and b != y1 and y1 + m * x1 != b and y1 != 0)
    eq = lambda mm, bb: f'y = {lin(mm, bb)}'
    return mc(r, 'lin2', L, f'A line in the xy-plane has a slope of {n(m)} and passes through the point ({n(x1)}, {n(y1)}). Which equation represents the line?', eq(m, b),
              [eq(m, y1), eq(m, y1 + m * x1), eq(b, m)],
              f'Use y = mx + b with m = {n(m)}: {n(y1)} = {n(m)}({n(x1)}) + b, so b = {n(b)}.')


def lin2_intercept(r, L):
    a = r.choice([2, 3, 4, 5, 6]); b = r.choice([2, 3, 4, 5, 7]); need(a != b)
    if L == 1:
        k = r.randint(2, 9); c = a * k
        return spr('lin2', L, f'The graph of {a}x + {b}y = {c} in the xy-plane crosses the x-axis at the point (k, 0). What is the value of k?', k,
                   f'On the x-axis y = 0, so {a}x = {c} and x = {k}.')
    need(L == 2)
    c = a * b * r.choice([1, 2, 3])
    return num_mc(r, 'lin2', L, f'In the xy-plane, the graph of {a}x {M} {b}y = {c} crosses the y-axis at (0, k). What is the value of k?', F(-c, b), [F(c, b), F(c, a), F(-c, a)],
                  f'On the y-axis x = 0, so {M}{b}y = {c} and y = {n(F(-c, b))}.', pos=False)


def lin2_perp(r, L):
    need(L == 3)
    a, b = r.choice([(2, 3), (3, 4), (2, 5), (4, 5), (3, 5), (5, 2), (4, 3), (3, 2)]); c = r.randint(2, 12)
    par = r.random() < 0.4
    ans = F(-a, b) if par else F(b, a)
    word = 'parallel' if par else 'perpendicular'
    why = 'Parallel lines have equal slopes.' if par else f'A perpendicular line has the negative reciprocal slope: {n(F(b, a))}.'
    return mc(r, 'lin2', L, f'Line k is defined by {a}x + {b}y = {c}. Line j is {word} to line k in the xy-plane. What is the slope of line j?', n(ans),
              [n(w) for w in [F(-a, b), F(b, a), F(a, b), F(-b, a)] if w != ans],
              f'Solve for y: y = ({n(F(-a, b))})x + {n(F(c, b))}, so line k has slope {n(F(-a, b))}. {why}')


def linf_eval(r, L):
    need(L == 1)
    m = r.choice([-5, -4, -3, -2, 2, 3, 4, 6, 7]); b = r.choice([k for k in range(-12, 13) if k != 0]); k = r.choice([-4, -3, -2, 2, 3, 4, 5, 6])
    return num_mc(r, 'linf', L, f'The function f is defined by f(x) = {lin(m, b)}. What is the value of f({n(k)})?', m * k + b, [m * k - b, m + k + b, m * k],
                  f'f({n(k)}) = {n(m)}({n(k)}) {pm(b)} = {n(m * k)} {pm(b)} = {n(m * k + b)}.', pos=False)


def linf_two(r, L):
    m = r.choice([-4, -3, -2, 2, 3, 4, 5]); b = r.randint(-10, 12); x1 = r.randint(0, 3); x2 = x1 + r.choice([2, 3, 4])
    f = lambda x: m * x + b
    if L == 2:
        x3 = x2 + r.choice([2, 3, 5])
        return num_mc(r, 'linf', L, f'For the linear function f, f({x1}) = {n(f(x1))} and f({x2}) = {n(f(x2))}. What is the value of f({x3})?', f(x3), [f(x3) + m, f(x2) + (x3 - x2), f(x1) + f(x2)],
                      f'The slope is ({n(f(x2))} {M} {n(f(x1)) if f(x1) >= 0 else "(" + n(f(x1)) + ")"}) / ({x2} {M} {x1}) = {n(m)}. From x = {x2} to x = {x3} the function changes by {n(m)} × {x3 - x2} = {n(m * (x3 - x2))}, giving {n(f(x3))}.', pos=False)
    need(L == 3 and x1 != 0 and b != 0)
    return spr('linf', L, f'For the linear function g, g({x1}) = {n(f(x1))} and g({x2}) = {n(f(x2))}. The graph of y = g(x) in the xy-plane crosses the y-axis at (0, b). What is the value of b?', b,
               f'The slope is {n(m)}. Using g({x1}) = {n(f(x1))}: {n(f(x1))} = {n(m)}({x1}) + b, so b = {n(b)}.')


def linf_interpret(r, L):
    rate = r.choice([6, 8, 12, 15, 18, 25]); fixed = r.choice([20, 30, 40, 50, 75])
    if L == 1:
        thing, unit = r.choice([('renting a boat', 'hours'), ('hiring a van', 'hours'), ('booking a hall', 'hours')])
        return mc(r, 'linf', L, f'The function C(t) = {rate}t + {fixed} gives the total cost, in dollars, of {thing} for t {unit}. What is the best interpretation of {fixed} in this context?',
                  'The fixed charge, before any hours are added', ['The charge for each additional hour', f'The total cost for {fixed} hours', 'The number of hours in the booking'],
                  f'When t = 0, C(0) = {fixed}. It is the part of the cost that does not depend on time.')
    need(L == 2)
    start = rate * r.choice([10, 12, 20])
    return mc(r, 'linf', L, f'A water tank is being emptied. The function W(m) = {start} {M} {rate}m gives the number of litres of water left in the tank m minutes after emptying begins. What is the best interpretation of {rate} in this context?',
              'The number of litres that leave the tank each minute', ['The number of litres in the tank when emptying begins', 'The number of minutes it takes to empty the tank', f'The number of litres left after {rate} minutes'],
              f'Each time m goes up by 1, W(m) goes down by {rate}. So {rate} is the rate, in litres per minute, at which water leaves.')


def sys_solve(r, L):
    x, y = r.randint(-4, 9), r.randint(-5, 8); need(x != y and x != 0 and y != 0)
    if L == 1:
        return num_mc(r, 'sys', L, f'x + y = {n(x + y)}\nx {M} y = {n(x - y)}\n\nThe solution to the system above is (x, y). What is the value of x?', x, [y, x + y, x - y],
                      f'Add the equations: 2x = {n(2 * x)}, so x = {n(x)}.', pos=False)
    need(L == 2)
    a, b, c, d = r.choice([(2, 1, 1, -1), (3, 2, 1, 1), (2, 3, 1, -2), (3, -1, 2, 1), (4, 1, 3, -1)])
    return num_mc(r, 'sys', L, f'{poly([a, 0], "x")} {pm(b).replace(n(abs(b)), (n(abs(b)) if abs(b) != 1 else "") + "y")} = {n(a * x + b * y)}\n{poly([c, 0], "x")} {pm(d).replace(n(abs(d)), (n(abs(d)) if abs(d) != 1 else "") + "y")} = {n(c * x + d * y)}\n\nIf (x, y) is the solution to the system above, what is the value of x + y?', x + y, [x - y, x, y],
                  f'Solving the system gives x = {n(x)} and y = {n(y)}, so x + y = {n(x + y)}.', pos=False)


def sys_word(r, L):
    need(L == 2)
    adult = r.choice([8, 10, 12, 15]); child = r.choice([3, 4, 5, 6]); na = r.randint(20, 80); nc = r.randint(20, 90)
    total, revenue = na + nc, adult * na + child * nc
    return spr('sys', L, f'A school play sold {total} tickets. Adult tickets cost ${adult} each and student tickets cost ${child} each. Ticket sales came to ${revenue:,}. How many adult tickets were sold?', na,
               f'Let a and s be the numbers of adult and student tickets: a + s = {total} and {adult}a + {child}s = {revenue}. Substitute s = {total} {M} a: {adult - child}a = {revenue - child * total}, so a = {na}.')


def sys_nosol(r, L):
    need(L == 3)
    a = r.choice([2, 3, 4, 5]); b = r.choice([2, 3, 5, 7]); m = r.choice([2, 3, 4]); c = r.randint(3, 12); d = m * c + r.choice([-4, -2, 3, 5])
    need(a != b and m * a != m * b and a * m != b)
    return num_mc(r, 'sys', L, f'{a}x + {b}y = {c}\nkx + {m * b}y = {d}\n\nIn the system above, k is a constant. The system has no solution. What is the value of k?', m * a, [a, m * b, F(a, m)],
                  f'No solution means the lines are parallel: the left sides are multiples of each other but the right sides are not. {m * b}y is {m} times {b}y, so k = {m} × {a} = {m * a} (and {d} is not {m} × {c}).')


def ineq_solve(r, L):
    a = r.choice([2, 3, 4, 5, 6]); v = r.choice([k for k in range(-7, 9) if k != 0]); b = r.choice([k for k in range(-9, 10) if k != 0])
    if L == 1:
        c = a * v + b
        return mc(r, 'ineq', L, f'Which of the following describes all solutions to {lin(a, b)} > {n(c)}?', f'x > {n(v)}', [f'x < {n(v)}', f'x > {n(-v)}', f'x < {n(-v)}'],
                  f'{undo(b)}: {a}x > {n(c - b)}. Divide by {a}: x > {n(v)}.')
    need(L == 2)
    c = -a * v + b
    return mc(r, 'ineq', L, f'Which of the following describes all solutions to {lin(-a, b)} > {n(c)}?', f'x < {n(v)}', [f'x > {n(v)}', f'x < {n(-v)}', f'x > {n(-v)}'],
              f'{undo(b)}: {M}{a}x > {n(c - b)}. Dividing by a negative number reverses the sign: x < {n(v)}.')


def ineq_budget(r, L):
    need(L == 2)
    price = r.choice([7, 8, 9, 12, 14]); fee = r.choice([5, 6, 10, 15]); budget = r.choice([60, 75, 90, 100, 120, 150])
    need((budget - fee) % price != 0)
    most = (budget - fee) // price
    who = r.choice(NAMES)
    return spr('ineq', L, f'{who} has ${budget} to spend on concert tickets. Each ticket costs ${price}, and there is a single booking fee of ${fee} for the whole order. What is the greatest number of tickets {who} can buy?', most,
               f'{price}t + {fee} ≤ {budget}, so {price}t ≤ {budget - fee} and t ≤ {n(round((budget - fee) / price, 2))}. The number of tickets must be whole, so the most is {most}.')


def ineq_point(r, L):
    need(L == 3)
    m1 = r.choice([1, 2, 3]); b1 = r.randint(-4, 2); m2 = r.choice([-2, -1]); b2 = r.randint(5, 9)
    ok = lambda x, y: y > m1 * x + b1 and y <= m2 * x + b2
    grid = [(x, y) for x in range(-3, 5) for y in range(-3, 9)]
    good = [p for p in grid if ok(*p)]; bad = [p for p in grid if not ok(*p)]
    need(len(good) >= 1 and len(bad) >= 3)
    g = r.choice(good); wrong = r.sample(bad, 3)
    pt = lambda p: f'({n(p[0])}, {n(p[1])})'
    return mc(r, 'ineq', L, f'y > {lin(m1, b1)}\ny ≤ {lin(m2, b2)}\n\nWhich point (x, y) is a solution to the system of inequalities above?', pt(g), [pt(p) for p in wrong],
              f'Test each point in both inequalities. For {pt(g)}: {n(g[1])} > {n(m1 * g[0] + b1)} and {n(g[1])} ≤ {n(m2 * g[0] + b2)}, so both hold. Each other point fails at least one.')

# ---- Advanced Math ----------------------------------------------------------

def eqx_expand(r, L):
    need(L == 1)
    a = r.choice([k for k in range(-7, 8) if abs(k) > 1]); b = r.choice([k for k in range(-7, 8) if abs(k) > 1]); need(a + b != 0 and a != b and a * b != a + b)
    return mc(r, 'eqx', L, f'Which expression is equivalent to {xp(a)}{xp(b)}?', poly([1, a + b, a * b]), [poly([1, 0, a * b]), poly([1, a + b, a + b]), poly([1, a * b, a + b])],
              f'Multiply each term: x² {pm(b)}x {pm(a)}x {pm(a * b)} = {poly([1, a + b, a * b])}.')


def eqx_factor(r, L):
    need(L == 2)
    p = r.choice([k for k in range(-8, 9) if abs(k) > 1]); q = r.choice([k for k in range(-8, 9) if abs(k) > 1]); need(p != q and p + q != 0 and p * q != -1)
    f = lambda u, v: f'{xp(u)}{xp(v)}'
    return mc(r, 'eqx', L, f'Which expression is equivalent to {poly([1, p + q, p * q])}?', f(p, q), [f(-p, -q), f(p, -q), f(p * q, 1)],
              f'Find two numbers that multiply to {n(p * q)} and add to {n(p + q)}: {n(p)} and {n(q)}. So the expression is {f(p, q)}.')


def eqx_exponent(r, L):
    a, b = r.choice([2, 3, 4, 5]), r.choice([2, 3, 6]); m, k = r.choice([2, 3, 4, 5]), r.choice([2, 3, 4, 6]); need(m != k)
    e = lambda c, p: f'{c if c != 1 else ""}x{str(p).translate(SUP)}'
    if L == 1:
        need(a * b != a + b and m * k != m + k)
        return mc(r, 'eqx', L, f'Which expression is equivalent to ({e(a, m)})({e(b, k)})?', e(a * b, m + k), [e(a * b, m * k), e(a + b, m + k), e(a + b, m * k)],
                  f'Multiply the numbers ({a} × {b} = {a * b}) and add the exponents ({m} + {k} = {m + k}).')
    need(L == 2)
    j = r.choice([1, 2, 3]); need(m * k - j not in (m + k - j, m * k + j, m * k) and m * k - j > 1 and m + k - j > 1)
    return mc(r, 'eqx', L, f'For x ≠ 0, which expression is equivalent to (x{str(m).translate(SUP)}){str(k).translate(SUP)} / x{str(j).translate(SUP) if j > 1 else ""}?', e(1, m * k - j), [e(1, m + k - j), e(1, m * k + j), e(1, m * k)],
              f'A power of a power multiplies the exponents: x{str(m * k).translate(SUP)}. Dividing subtracts: {m * k} {M} {j} = {m * k - j}.')


def eqx_rational(r, L):
    need(L == 2)
    a = r.choice([2, 3, 4, 5, 6, 7, 8, 9])
    return mc(r, 'eqx', L, f'For x ≠ {a}, which expression is equivalent to (x² {M} {a * a}) / (x {M} {a})?', f'x + {a}', [f'x {M} {a}', f'x + {a * a}', f'x² {M} {a}'],
              f'x² {M} {a * a} is a difference of squares: (x {M} {a})(x + {a}). The factor (x {M} {a}) cancels, leaving x + {a}.')


def eqx_hard(r, L):
    need(L == 3)
    if r.random() < 0.5:
        a = r.choice([1, 2, 3, 4]); b = r.choice([2, 3, 5, 7])
        t = lambda s: f'({poly([a, s * b])})²'
        return mc(r, 'eqx', L, f'Which expression is equivalent to {t(1)} {M} {t(-1)}?', f'{4 * a * b}x', [f'{2 * b * b}', '0', f'{poly([2 * a * a, 0, 2 * b * b])}'],
                  f'Expand both squares: ({poly([a * a, 2 * a * b, b * b])}) {M} ({poly([a * a, -2 * a * b, b * b])}). The x² terms and the constants cancel, leaving {4 * a * b}x.')
    p, q = r.choice([(2, 3), (3, 2), (5, 2), (4, 3), (5, 3), (3, 4)])
    root = {2: 'square root', 3: 'cube root', 4: 'fourth root', 5: 'fifth root'}
    ex = lambda k: f'x{str(k).translate(SUP)}'
    return mc(r, 'eqx', L, f'For x > 0, which of the following is equivalent to x^({p}/{q})?', f'The {root[q]} of {ex(p)}', [f'The {root[p]} of {ex(q)}', f'{ex(p)} divided by {q}', f'{ex(p)} minus {ex(q)}'],
              f'In a fractional exponent the top number is the power and the bottom number is the root: x^({p}/{q}) is the {root[q]} of {ex(p)}.')


def nleq_roots(r, L):
    p = r.randint(2, 9); q = -r.randint(1, 9); need(p + q != 0)
    if L == 1:
        return spr('nleq', L, f'{poly([1, -(p + q), p * q])} = 0\n\nWhat is the positive solution to the equation above?', p,
                   f'Factor: {xp(-p)}{xp(-q)} = 0, so x = {p} or x = {n(q)}. The positive solution is {p}.')
    need(L == 2)
    a = r.choice([2, 3, 4]); b = r.choice([k for k in range(-11, 12) if k != 0 and k % a != 0]); c = r.randint(-6, -1)
    return mc(r, 'nleq', L, f'What is the sum of the solutions to {poly([a, b, c])} = 0?', n(F(-b, a)), [n(F(b, a)), n(F(c, a)), n(F(-c, a))],
              f'For ax² + bx + c = 0 the solutions add up to {M}b/a = {n(F(-b, a))}. (Here b² {M} 4ac is positive, so there are two real solutions.)')


def nleq_disc(r, L):
    if L == 2:
        a = r.choice([1, 2, 3]); b = r.randint(-7, 7); c = r.randint(1, 9); disc = b * b - 4 * a * c
        ans = 'Exactly two' if disc > 0 else 'Exactly one' if disc == 0 else 'Zero'
        return mc(r, 'nleq', L, f'How many distinct real solutions does the equation {poly([a, b, c])} = 0 have?', ans, [w for w in ['Zero', 'Exactly one', 'Exactly two', 'Infinitely many'] if w != ans],
                  f'The discriminant is b² {M} 4ac = {b * b} {M} {4 * a * c} = {n(disc)}. ' + ('It is positive, so there are two real solutions.' if disc > 0 else 'It is zero, so there is one real solution.' if disc == 0 else 'It is negative, so there are no real solutions.'))
    need(L == 3)
    m = r.randint(2, 9)
    return spr('nleq', L, f'x² {M} {2 * m}x + c = 0\n\nIn the equation above, c is a constant. The equation has exactly one real solution. What is the value of c?', m * m,
               f'One real solution means the discriminant is zero: ({2 * m})² {M} 4c = 0, so 4c = {4 * m * m} and c = {m * m}.')


def nleq_abs(r, L):
    need(L == 2)
    a = r.choice([k for k in range(-6, 9) if k != 0]); b = r.randint(2, 9)
    if r.random() < 0.5:
        return num_mc(r, 'nleq', L, f'What is the sum of the solutions to |x {pm(-a)}| = {b}?', 2 * a, [2 * b, a + b, a - b],
                      f'x {pm(-a)} = {b} gives x = {n(a + b)}; x {pm(-a)} = {M}{b} gives x = {n(a - b)}. Their sum is {n(2 * a)}.', pos=False)
    return num_mc(r, 'nleq', L, f'What is the smaller of the two solutions to |x {pm(-a)}| = {b}?', a - b, [a + b, -a - b, b - a],
                  f'x {pm(-a)} = {b} gives x = {n(a + b)}; x {pm(-a)} = {M}{b} gives x = {n(a - b)}. The smaller one is {n(a - b)}.', pos=False)


def nleq_sqrt(r, L):
    need(L == 1)
    b = r.randint(3, 9); a = r.choice([k for k in range(-8, 12) if k != 0])
    return spr('nleq', L, f'√(x {pm(a)}) = {b}\n\nWhat value of x satisfies the equation above?', b * b - a,
               f'Square both sides: x {pm(a)} = {b * b}, so x = {n(b * b - a)}.')


def nleq_system(r, L):
    need(L == 3)
    p = r.randint(2, 7); q = -r.randint(1, 6); need(p + q != 0)
    s, k = p + q, -p * q
    return spr('nleq', L, f'y = x²\ny = {lin(s, k)}\n\nThe graphs of the two equations above cross at two points in the xy-plane. What is the x-coordinate of the point of intersection for which x > 0?', p,
               f'Set them equal: x² = {lin(s, k)}, so {poly([1, -s, -k])} = 0, which factors as {xp(-p)}{xp(-q)} = 0. The positive solution is x = {p}.')


def nlf_eval(r, L):
    need(L == 1)
    a = r.choice([1, 2, 3, -1, -2]); b = r.randint(-6, 6); c = r.randint(-9, 9); k = r.choice([-3, -2, 2, 3, 4]); need(b != 0)
    val = a * k * k + b * k + c
    return num_mc(r, 'nlf', L, f'The function f is defined by f(x) = {poly([a, b, c])}. What is the value of f({n(k)})?', val, [a * k * 2 + b * k + c, -a * k * k + b * k + c, a * k * k - b * k + c],
                  f'f({n(k)}) = {n(a)}({n(k * k)}) {pm(b * k)} {pm(c)} = {n(val)}. Remember that ({n(k)})² = {k * k}.', pos=False)


def nlf_vertex(r, L):
    h = r.choice([k for k in range(-6, 8) if k != 0]); k = r.choice([j for j in range(-9, 10) if j != 0]); need(h != k and h != -k)
    if L == 2:
        a = r.choice([1, 2, 3])
        if r.random() < 0.5:
            return num_mc(r, 'nlf', L, f'The function f is defined by f(x) = {a if a != 1 else ""}{xp(-h)}² {pm(k)}. What is the minimum value of f?', k, [h, -h, -k],
                          f'A square is never negative, so {xp(-h)}² is smallest (zero) when x = {n(h)}. The minimum value is then {n(k)}.', pos=False)
        return num_mc(r, 'nlf', L, f'The function g is defined by g(x) = {M}{a if a != 1 else ""}{xp(-h)}² {pm(k)}. For what value of x does g(x) reach its maximum?', h, [-h, k, -k],
                      f'The squared term is zero when x = {n(h)}, and for every other x it makes g smaller. So the maximum is at x = {n(h)}.', pos=False)
    need(L == 3)
    c = r.randint(-5, 12); low = c - h * h
    return num_mc(r, 'nlf', L, f'The function f is defined by f(x) = {poly([1, -2 * h, c])}. What is the minimum value of f?', low, [c, c + h * h, h],
                  f'Complete the square: f(x) = {xp(-h)}² {pm(low)}. The minimum is {n(low)}, at x = {n(h)}.', pos=False)


def nlf_expo(r, L):
    if L == 1:
        a = r.choice([3, 5, 10, 20, 50]); b = r.choice([2, 3]); t = r.choice([2, 3, 4])
        return num_mc(r, 'nlf', L, f'The function P is defined by P(t) = {a}({b}){"ᵗ"}. What is the value of P({t})?', a * b ** t, [a * b * t, (a * b) ** 2 if t != 2 else a * b + t, a + b ** t],
                      f'P({t}) = {a} × {b}{str(t).translate(SUP)} = {a} × {b ** t} = {a * b ** t}.')
    if L == 2:
        p = r.choice([2, 3, 4, 5, 6, 8]); start = r.choice([500, 800, 1200, 2000])
        if r.random() < 0.5:
            return mc(r, 'nlf', L, f'The function V(t) = {start:,}(1.0{p}){"ᵗ"} gives the value, in dollars, of an investment t years after it was made. Which statement is the best interpretation of 1.0{p}?',
                      f'The value grows by {p}% each year.', [f'The value grows by 1.0{p}% each year.', f'The value grows by ${p} each year.', f'The value grows by 10{p}% each year.'],
                      f'Multiplying by 1.0{p} each year means keeping 100% and adding {p}%.')
        return mc(r, 'nlf', L, f'The function M(t) = {start:,}(0.{100 - p}){"ᵗ"} gives the mass, in grams, of a substance t days after an experiment begins. Which statement is the best interpretation of 0.{100 - p}?',
                  f'The mass falls by {p}% each day.', [f'The mass falls by {100 - p}% each day.', f'The mass falls by 0.{100 - p} grams each day.', f'The mass falls by {p} grams each day.'],
                  f'Multiplying by 0.{100 - p} each day keeps {100 - p}% of the mass, so {p}% is lost.')
    start = r.choice([200, 300, 500, 1500]); k = r.choice([3, 4, 5, 6, 8]); word, b = r.choice([('doubles', 2), ('triples', 3)])
    return mc(r, 'nlf', L, f'A colony of {start:,} bacteria {word} every {k} hours. Which function gives the number of bacteria, N(t), in the colony t hours after it is first counted?',
              f'N(t) = {start:,}({b})^(t/{k})', [f'N(t) = {start:,}({b})^({k}t)', f'N(t) = {start:,}({k})^({b}t)', f'N(t) = {start:,} + {b * k}t'],
              f'The colony is multiplied by {b} once for every {k} hours, which is t/{k} times in t hours.')

# ---- Problem-Solving and Data Analysis --------------------------------------

def rate_basic(r, L):
    need(L == 1)
    if r.random() < 0.5:
        speed = r.choice([40, 45, 50, 60, 72, 80]); h1 = r.choice([2, 3, 4]); h2 = r.choice([5, 6, 7, 9])
        return num_mc(r, 'rate', L, f'A train travels {speed * h1} kilometres in {h1} hours at a constant speed. At this speed, how many kilometres does it travel in {h2} hours?', speed * h2, [speed * h1 + h2, speed * (h2 - h1), speed * h1 * h2],
                      f'Speed = {speed * h1} / {h1} = {speed} km per hour. In {h2} hours: {speed} × {h2} = {speed * h2} km.')
    cups = r.choice([2, 3, 4]); serves = r.choice([4, 6, 8]); k = r.choice([3, 4, 5, 7])
    return num_mc(r, 'rate', L, f'A recipe uses {cups} cups of rice to serve {serves} people. At this rate, how many cups of rice are needed to serve {serves * k} people?', cups * k, [cups + k, serves * k - cups, cups * serves],
                  f'{serves * k} people is {k} times {serves} people, so use {k} × {cups} = {cups * k} cups.')


def rate_convert(r, L):
    need(L == 2)
    if r.random() < 0.5:
        v = r.choice([18, 36, 54, 72, 90, 108]); ms = v * 1000 // 3600
        return num_mc(r, 'rate', L, f'A car travels at a constant speed of {v} kilometres per hour. What is its speed in metres per second? (1 kilometre = 1,000 metres)', ms, [v * 1000 // 60, F(v * 3600, 1000), F(v, 60)],
                      f'{v} km per hour = {v * 1000:,} metres per 3,600 seconds = {ms} metres per second.')
    rate = r.choice([12, 15, 18, 24]); pages = rate * r.choice([25, 35, 45]); mins = pages // rate
    return num_mc(r, 'rate', L, f'A printer prints {rate} pages per minute. How many hours does it take to print {pages:,} pages?', F(mins, 60), [mins, F(pages, 60), F(rate, 60)],
                  f'{pages:,} / {rate} = {mins} minutes, and {mins} minutes is {n(F(mins, 60))} hours.')


def rate_multi(r, L):
    need(L == 3)
    per100 = r.choice([5, 6, 8]); price = r.choice([F(3, 2), F(5, 4), 2, F(7, 4)]); dist = r.choice([250, 350, 450, 600])
    litres = F(per100 * dist, 100); cost = litres * price
    return num_mc(r, 'rate', L, f'A car uses {per100} litres of fuel for every 100 kilometres. Fuel costs ${float(price):.2f} per litre. What is the cost of the fuel for a {dist}-kilometre trip?', float(cost), [float(litres), float(cost * 2), float(F(dist, 100) * price), float(cost) + per100],
                  f'Fuel used: {dist} / 100 × {per100} = {n(float(litres))} litres. Cost: {n(float(litres))} × ${float(price):.2f} = ${float(cost):.2f}.', pre='$')


def pct_basic(r, L):
    if L == 1:
        p = r.choice([15, 20, 25, 30, 35, 40, 60, 75]); base = r.choice([80, 120, 160, 200, 240, 360, 480]); need(p * base % 100 == 0)
        return num_mc(r, 'pct', L, f'What is {p}% of {base}?', p * base // 100, [F(base * 100, p) if base * 100 % p == 0 else base - p, base - p * base // 100, p * base // 10],
                      f'{p}% of {base} = {p / 100:g} × {base} = {p * base // 100}.')
    need(L == 2)
    a = r.choice([40, 50, 80, 120, 150, 200, 250]); pc = r.choice([10, 15, 20, 30, 40, 60]); need(a * pc % 100 == 0); up = r.random() < 0.5
    b = a + a * pc // 100 if up else a - a * pc // 100
    other = round(abs(b - a) / b * 100, 1)
    return num_mc(r, 'pct', L, f'The price of a jacket changed from ${a} to ${b}. By what percent did the price {"increase" if up else "decrease"}?', pc, [other, abs(b - a), pc + 5],
                  f'Change = {abs(b - a)}. Compare it with the original price: {abs(b - a)} / {a} = {pc / 100:g} = {pc}%.', unit='%')


def pct_hard(r, L):
    need(L == 3)
    if r.random() < 0.5:
        d = r.choice([10, 20, 25, 30, 40]); orig = r.choice([40, 60, 80, 120, 150, 200]); need(orig * (100 - d) % 100 == 0); sale = orig * (100 - d) // 100
        return num_mc(r, 'pct', L, f'After a {d}% discount, a pair of shoes costs ${sale}. What was the price before the discount?', orig, [round(sale * (100 + d) / 100), sale + d, round(sale * 100 / d)],
                      f'The sale price is {100 - d}% of the original: {(100 - d) / 100:g} × p = {sale}, so p = {sale} / {(100 - d) / 100:g} = {orig}.', pre='$')
    up, down = r.choice([(20, 25), (25, 20), (50, 20), (10, 10), (20, 20), (40, 25), (25, 40), (60, 50)])
    net = F((100 + up) * (100 - down), 100) - 100
    word = 'no change' if net == 0 else f'{"an increase" if net > 0 else "a decrease"} of {n(abs(net))}%'
    opts = [f'{"An increase" if v > 0 else "A decrease"} of {n(abs(v))}%' if v != 0 else 'No change' for v in [net, F(up - down), -net if net != 0 else F(5), F(up + down)]]
    need(len(set(opts)) == 4)
    return mc(r, 'pct', L, f'A shop raises the price of a lamp by {up}% and later lowers the new price by {down}%. Compared with the original price, what is the overall change?', opts[0], opts[1:],
              f'Multiply the changes: {(100 + up) / 100:g} × {(100 - down) / 100:g} = {float((100 + up) * (100 - down)) / 10000:g}. That is {word} from the original price.')


def stat_center(r, L):
    if L == 1:
        k = r.choice([5, 6]); data = sorted(r.sample(range(3, 30), k)); need(sum(data) % k == 0)
        shown = data[:]; r.shuffle(shown)
        if r.random() < 0.5:
            return num_mc(r, 'stat', L, f'What is the mean of the data set {", ".join(map(str, shown))}?', sum(data) // k, [data[k // 2], sum(data), max(data) - min(data)],
                          f'Add the values: {sum(data)}. Divide by {k}: {sum(data) // k}.')
        data = sorted(r.sample(range(3, 30), 7)); shown = data[:]; r.shuffle(shown)
        return num_mc(r, 'stat', L, f'What is the median of the data set {", ".join(map(str, shown))}?', data[3], [shown[3] if shown[3] != data[3] else data[2], data[2], data[4]],
                      f'In order: {", ".join(map(str, data))}. The middle (4th) value is {data[3]}.')
    need(L == 2)
    k = 5; mean = r.randint(8, 20); four = r.sample(range(4, 28), 4); last = mean * k - sum(four); need(1 <= last <= 40 and last not in four)
    return spr('stat', L, f'The mean of five numbers is {mean}. Four of the numbers are {", ".join(map(str, four))}. What is the fifth number?', last,
               f'The five numbers add up to 5 × {mean} = {mean * k}. The four given numbers add up to {sum(four)}, so the fifth is {mean * k} {M} {sum(four)} = {last}.')


def stat_change(r, L):
    need(L == 3)
    k = r.choice([4, 5, 9]); mean = r.randint(10, 30); new = mean + r.choice([-3, -2, 2, 3, 4]); v = new * (k + 1) - mean * k; need(v > 0)
    return num_mc(r, 'stat', L, f'The mean of {k} test scores is {mean}. When one more score is included, the mean of the {k + 1} scores is {new}. What is the score that was added?', v, [new, new + (new - mean), mean * k - new * (k - 1)],
                  f'The first {k} scores total {k} × {mean} = {mean * k}. All {k + 1} total {k + 1} × {new} = {new * (k + 1)}. The added score is {new * (k + 1)} {M} {mean * k} = {v}.')


def stat_outlier(r, L):
    need(L == 2)
    data = sorted(r.sample(range(10, 30), 6)); big = r.choice([80, 95, 120]); full = data + [big]
    med_before = full[3]; med_after = (data[2] + data[3]) / 2
    ans = 'The mean decreases and the median stays the same.' if med_after == med_before else 'Both the mean and the median decrease.'
    need(med_after <= med_before)
    wrong = [w for w in ['The mean decreases and the median stays the same.', 'Both the mean and the median decrease.', 'The mean stays the same and the median decreases.', 'Both the mean and the median increase.', 'The mean increases and the median decreases.'] if w != ans][:3]
    return mc(r, 'stat', L, f'A data set consists of the values {", ".join(map(str, full))}. The value {big} is removed. Which statement describes the effect on the mean and the median?', ans, wrong,
              f'Removing the largest value lowers the mean a lot (from about {sum(full) / 7:.1f} to {sum(data) / 6:.1f}). The median moves from {med_before} to {med_after:g}.')


def prob_simple(r, L):
    need(L == 1)
    a, b, c = r.sample(range(2, 12), 3); total = a + b + c
    return mc(r, 'prob', L, f'A bag holds {a} red, {b} blue and {c} green marbles. One marble is chosen at random. What is the probability that it is blue?', n(F(b, total)),
              [n(w) for w in dict.fromkeys([F(b, a + c), F(a, total), F(c, total), F(1, 3), F(b + 1, total)]) if w != F(b, total)][:3],
              f'There are {total} marbles and {b} are blue: {b}/{total}' + (f' = {n(F(b, total))}.' if gcd(b, total) > 1 else '.'))


def prob_table(r, L):
    a, b, c, d = [r.randint(12, 60) for _ in range(4)]; total = a + b + c + d
    table = dict(head=['', 'Bus', 'Walk', 'Total'], rows=[['Grade 11', str(a), str(b), str(a + b)], ['Grade 12', str(c), str(d), str(c + d)], ['Total', str(a + c), str(b + d), str(total)]])
    intro = 'The table shows how the students in two grades at a school travel to school.'
    if L == 2:
        ans = F(b + d, total); wrong = [w for w in dict.fromkeys([F(b, total), F(b + d, 2 * total), F(d, total), F(a + b, total)]) if w != ans][:3]
        return mc(r, 'prob', L, f'{intro} If one of these students is chosen at random, what is the probability that the student walks to school?', n(ans), [n(w) for w in wrong],
                  f'{b + d} of the {total} students walk: {b + d}/{total}' + (f' = {n(ans)}.' if gcd(b + d, total) > 1 else '.'), table=table)
    need(L == 3)
    ans = F(d, c + d); wrong = [w for w in dict.fromkeys([F(d, total), F(d, b + d), F(c, c + d), F(b + d, total)]) if w != ans][:3]
    return mc(r, 'prob', L, f'{intro} If a Grade 12 student is chosen at random, what is the probability that the student walks to school?', n(ans), [n(w) for w in wrong],
              f'Look only at the Grade 12 row: {d} of the {c + d} Grade 12 students walk, so the probability is {d}/{c + d}' + (f' = {n(ans)}.' if gcd(d, c + d) > 1 else '.'), table=table)


def infr_estimate(r, L):
    need(L == 1)
    sample = r.choice([40, 50, 80, 100]); k = r.choice([k for k in range(8, sample - 5) if k * 20 % sample == 0]); pop = sample * r.choice([12, 15, 20, 30])
    return num_mc(r, 'infr', L, f'In a random sample of {sample} students at a school, {k} said they cycle to school. The school has {pop:,} students. Based on the sample, what is the best estimate of the number of students at the school who cycle to school?', k * pop // sample, [k, pop - k * pop // sample, k * pop // sample + k],
                  f'{k}/{sample} of the sample cycle. Apply the same share to everyone: {k}/{sample} × {pop:,} = {k * pop // sample:,}.')


def infr_concept(r, L):
    if L == 2:
        p = r.choice([38, 42, 46, 54, 58, 62]); m = r.choice([3, 4, 5]); thing, group = r.choice([('support building a new library', 'residents of the town'), ('prefer online classes', 'students at the university'), ('plan to vote in the election', 'adults in the city')])
        return mc(r, 'infr', L, f'A survey of a random sample of {group} estimated that {p}% {thing}, with a margin of error of {m}%. Which conclusion is best supported?',
                  f'It is plausible that between {p - m}% and {p + m}% of all {group} {thing}.',
                  [f'Exactly {p}% of all {group} {thing}.', f'Between {p - m}% and {p + m}% of the people in the sample {thing}.', f'At most {m}% of all {group} gave an incorrect answer.'],
                  f'A margin of error describes how far the true share for the whole population may be from the sample result: about {p - m}% to {p + m}%.')
    need(L == 3)
    k = r.choice([60, 80, 120, 200])
    if r.random() < 0.5:
        grade = r.choice([9, 10, 11])
        return mc(r, 'infr', L, f'A researcher chose {k} students at random from all the Grade {grade} students at one school and asked how long they sleep each night. To which group can the results best be generalised?',
                  f'All Grade {grade} students at that school', ['All students at that school', f'All Grade {grade} students in the country', f'Only the {k} students who were asked'],
                  f'A random sample speaks for the population it was drawn from: here, the Grade {grade} students at that one school.')
    return mc(r, 'infr', L, f'In a study, {k} volunteers were randomly assigned to two groups. One group drank green tea every day for a month and the other did not. At the end, the tea group had lower average blood pressure. Which conclusion is best supported?',
              'Drinking green tea caused lower blood pressure for the volunteers in the study.',
              ['Drinking green tea lowers blood pressure for all people.', 'People with low blood pressure tend to choose green tea.', 'No conclusion about cause can be drawn, because the groups were assigned at random.'],
              'Random assignment allows a cause-and-effect conclusion, but only about the people in the study. Volunteers are not a random sample of everyone.')

# ---- Geometry and Trigonometry ----------------------------------------------

def area_basic(r, L):
    if L == 1:
        b = r.choice([6, 8, 10, 12, 14, 16]); h = r.choice([5, 7, 9, 11])
        return num_mc(r, 'area', L, f'A triangle has a base of {b} centimetres and a height of {h} centimetres. What is its area, in square centimetres?', b * h // 2, [b * h, b + h, 2 * (b + h)],
                      f'Area = ½ × base × height = ½ × {b} × {h} = {b * h // 2}.')
    need(L == 2)
    if r.random() < 0.5:
        rad = r.choice([2, 3, 4, 5, 6]); h = r.choice([4, 5, 7, 10]); need(rad * rad * h not in (2 * rad * h, rad * h, rad * rad * h * 2) and 2 * rad * h != rad * h)
        return mc(r, 'area', L, f'A right circular cylinder has a radius of {rad} metres and a height of {h} metres. What is its volume, in cubic metres?', f'{rad * rad * h}{PI}', [f'{2 * rad * h}{PI}', f'{rad * h}{PI}', f'{rad * rad * h * 2}{PI}'],
                  f'Volume = {PI}r²h = {PI} × {rad * rad} × {h} = {rad * rad * h}{PI}.')
    length = r.randint(7, 15); width = r.randint(3, length - 2); per = 2 * (length + width)
    return num_mc(r, 'area', L, f'A rectangle has a perimeter of {per} metres and a length of {length} metres. What is its area, in square metres?', length * width, [per * length, width, (per - length) * length],
                  f'Perimeter = 2(length + width), so {length} + width = {per // 2} and width = {width}. Area = {length} × {width} = {length * width}.')


def area_scale(r, L):
    need(L == 3)
    k = r.choice([2, 3, 4, 5]); area = r.choice([6, 8, 10, 12, 15, 20])
    if r.random() < 0.5:
        return num_mc(r, 'area', L, f'Rectangle A has an area of {area} square centimetres. Every side of rectangle B is {k} times as long as the matching side of rectangle A. What is the area of rectangle B, in square centimetres?', area * k * k, [area * k, area * 2 * k, area + k * k],
                      f'When lengths are multiplied by {k}, areas are multiplied by {k}² = {k * k}: {area} × {k * k} = {area * k * k}.')
    return num_mc(r, 'area', L, f'A cube has a volume of {area} cubic centimetres. A second cube has edges {k} times as long. What is the volume of the second cube, in cubic centimetres?', area * k ** 3, [area * k, area * k * k, area * 3 * k],
                  f'When lengths are multiplied by {k}, volumes are multiplied by {k}³ = {k ** 3}: {area} × {k ** 3} = {area * k ** 3}.')


def ang_basic(r, L):
    if L == 1:
        a = r.randint(25, 80); b = r.randint(30, 85); need(a + b < 160 and a != b)
        return num_mc(r, 'ang', L, f'Two angles of a triangle measure {a}° and {b}°. What is the measure of the third angle?', 180 - a - b, [a + b, 360 - a - b, 90 - min(a, b)],
                      f'The angles of a triangle add up to 180°: 180 {M} {a} {M} {b} = {180 - a - b}.', unit='°')
    need(L == 2)
    if r.random() < 0.5:
        v = r.choice([20, 34, 40, 52, 68, 76, 100, 110])
        return num_mc(r, 'ang', L, f'In an isosceles triangle, the angle between the two equal sides measures {v}°. What is the measure of each of the other two angles?', (180 - v) // 2, [180 - v, v, 90 - v if v < 90 else 180 - v // 2],
                      f'The other two angles are equal and together make 180 {M} {v} = {180 - v}°, so each is {(180 - v) // 2}°.', unit='°')
    a = r.choice([38, 47, 55, 62, 71, 104, 118, 126])
    return num_mc(r, 'ang', L, f'Two parallel lines are crossed by a third line. Two of the angles formed lie between the parallel lines, on the same side of the third line. One of them measures {a}°. What is the measure of the other?', 180 - a, [a, 90 - a if a < 90 else a - 90, 360 - a],
                  f'Interior angles on the same side of a line crossing two parallel lines add up to 180°: 180 {M} {a} = {180 - a}.', unit='°')


def ang_similar(r, L):
    need(L == 3)
    a, b, c = r.choice([(3, 4, 5), (5, 6, 7), (4, 6, 8), (6, 7, 9), (5, 8, 10)]); k = r.choice([1.5, 2, 2.5, 3])
    if r.random() < 0.5:
        return spr('ang', L, f'Triangle ABC is similar to triangle DEF, with A matching D, B matching E and C matching F. AB = {a}, BC = {b} and DE = {n(a * k)}. What is the length of EF?', b * k,
                   f'The scale factor is DE / AB = {n(a * k)} / {a} = {n(k)}. So EF = {n(k)} × BC = {n(k)} × {b} = {n(b * k)}.')
    return spr('ang', L, f'Triangle ABC is similar to triangle DEF, with A matching D. The sides of triangle ABC are {a}, {b} and {c}. The shortest side of triangle DEF is {n(a * k)}. What is the perimeter of triangle DEF?', (a + b + c) * k,
               f'The scale factor is {n(a * k)} / {a} = {n(k)}. Perimeters scale the same way: {n(k)} × ({a} + {b} + {c}) = {n((a + b + c) * k)}.')


TRIPLES = [(3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25), (6, 8, 10), (9, 12, 15), (20, 21, 29)]


def trig_basic(r, L):
    a, b, c = r.choice(TRIPLES)
    if L == 1:
        if r.random() < 0.5:
            return num_mc(r, 'trig', L, f'A right triangle has legs of length {a} and {b}. What is the length of its hypotenuse?', c, [a + b, b - a + c, a * b // 2],
                          f'c² = {a}² + {b}² = {a * a} + {b * b} = {c * c}, so c = {c}.')
        return num_mc(r, 'trig', L, f'A right triangle has a hypotenuse of length {c} and one leg of length {a}. What is the length of the other leg?', b, [c - a, c + a, a],
                      f'b² = {c}² {M} {a}² = {c * c} {M} {a * a} = {b * b}, so b = {b}.')
    need(L == 2 and gcd(a, c) == 1 and gcd(b, c) == 1)
    fn, top, bottom = r.choice([('sin', a, c), ('cos', b, c), ('tan', a, b)])
    ans = F(top, bottom)
    return mc(r, 'trig', L, f'In right triangle PQR, the right angle is at Q. PQ = {b}, QR = {a} and PR = {c}. What is the value of {fn} P?', n(ans),
              [n(w) for w in dict.fromkeys([F(a, c), F(b, c), F(a, b), F(b, a), F(c, a)]) if w != ans][:3],
              f'For angle P the opposite side is QR = {a}, the adjacent side is PQ = {b} and the hypotenuse is PR = {c}. {fn} P = {top}/{bottom}.')


def trig_hard(r, L):
    if L == 2:
        k = r.choice([3, 4, 5, 6, 7, 8, 9])
        if r.random() < 0.5:
            return mc(r, 'trig', L, f'In a right triangle with angles of 30°, 60° and 90°, the hypotenuse has length {2 * k}. What is the length of the side opposite the 60° angle?', f'{k}√3', [f'{k}', f'{2 * k}√3', f'{k}√2'],
                      f'In a 30-60-90 triangle the sides are in the ratio 1 : √3 : 2. The hypotenuse is {2 * k}, so the short leg is {k} and the side opposite 60° is {k}√3.')
        return mc(r, 'trig', L, f'A right triangle has two legs of length {k}. What is the length of its hypotenuse?', f'{k}√2', [f'{2 * k}', f'{k}√3', f'{k * k}'],
                  f'c² = {k}² + {k}² = {2 * k * k}, so c = √{2 * k * k} = {k}√2.')
    need(L == 3)
    if r.random() < 0.5:
        k = r.choice([14, 23, 28, 37, 41, 56, 62, 71])
        return spr('trig', L, f'For an angle of x degrees, where 0 < x < 90, sin(x°) = cos({k}°). What is the value of x?', 90 - k,
                   f'The sine of an angle equals the cosine of its complement, so x + {k} = 90 and x = {90 - k}.')
    a, b, c = r.choice([(3, 4, 5), (5, 12, 13), (8, 15, 17), (7, 24, 25)])
    return mc(r, 'trig', L, f'In right triangle ABC, the right angle is at C. If sin A = {a}/{c}, what is the value of cos B?', f'{a}/{c}', [f'{b}/{c}', f'{a}/{b}', f'{c}/{a}'],
              f'A and B are the two acute angles, so they add up to 90°. The cosine of B equals the sine of A: {a}/{c}.')


def circ_basic(r, L):
    rad = r.choice([3, 4, 5, 6, 7, 8, 9])
    if L == 1:
        need(rad * rad != 2 * rad and rad != 4)
        if r.random() < 0.5:
            return mc(r, 'circ', L, f'A circle has a radius of {rad} centimetres. What is its area, in square centimetres?', f'{rad * rad}{PI}', [f'{2 * rad}{PI}', f'{rad}{PI}', f'{4 * rad * rad}{PI}'],
                      f'Area = {PI}r² = {PI} × {rad}² = {rad * rad}{PI}.')
        return mc(r, 'circ', L, f'A circle has a diameter of {2 * rad} centimetres. What is its circumference, in centimetres?', f'{2 * rad}{PI}', [f'{rad}{PI}', f'{rad * rad}{PI}', f'{4 * rad}{PI}'],
                  f'Circumference = {PI} × diameter = {2 * rad}{PI}.')
    need(L == 2)
    if r.random() < 0.5:
        deg = r.choice([30, 45, 60, 90, 120]); rad = r.choice([6, 8, 12, 18, 24]); arc = F(deg, 360) * 2 * rad
        return mc(r, 'circ', L, f'In a circle with a radius of {rad}, a central angle of {deg}° cuts off an arc. What is the length of the arc?', f'{n(arc)}{PI}', [f'{n(w)}{PI}' for w in dict.fromkeys([arc * 2, arc / 2, F(deg, 360) * rad * rad, F(2 * rad)]) if w != arc][:3],
                  f'The arc is {deg}/360 = {n(F(deg, 360))} of the circumference, {2 * rad}{PI}: {n(F(deg, 360))} × {2 * rad}{PI} = {n(arc)}{PI}.')
    h = r.choice([k for k in range(-6, 7) if k != 0]); k = r.choice([j for j in range(-6, 7) if j != 0]); need(abs(h) != abs(k))
    pt = lambda x, y: f'({n(x)}, {n(y)})'
    return mc(r, 'circ', L, f'In the xy-plane, a circle has the equation {xp(-h)}² + {xp(-k, "y")}² = {rad * rad}. What is the centre of the circle?', pt(h, k), [pt(-h, -k), pt(k, h), pt(-h, k)],
              f'In (x {M} h)² + (y {M} k)² = r² the centre is (h, k). Here that is {pt(h, k)}, and the radius is {rad}.')


def circ_hard(r, L):
    need(L == 3)
    if r.random() < 0.5:
        h = r.choice([k for k in range(-5, 6) if k != 0]); k = r.choice([j for j in range(-5, 6) if j != 0]); rad = r.choice([2, 3, 4, 5, 6, 7])
        D, E, Fc = -2 * h, -2 * k, h * h + k * k - rad * rad
        need(Fc != 0)
        return spr('circ', L, f'x² + y² {pm(D)}x {pm(E)}y {pm(Fc)} = 0\n\nThe equation above represents a circle in the xy-plane. What is the radius of the circle?', rad,
                   f'Complete the square for x and for y: {xp(-h)}² + {xp(-k, "y")}² = {n(-Fc)} + {h * h} + {k * k} = {rad * rad}. The radius is √{rad * rad} = {rad}.')
    deg = r.choice([30, 45, 60, 120, 135, 150, 210, 225, 240, 300, 315, 330]); frac = F(deg, 180)
    f = lambda v: (f'{v.numerator if v.numerator != 1 else ""}{PI}/{v.denominator}' if v.denominator != 1 else f'{v.numerator if v.numerator != 1 else ""}{PI}')
    wrong = [w for w in dict.fromkeys([F(deg, 360), F(deg, 90), F(180, deg), F(deg, 120)]) if w != frac][:3]
    return mc(r, 'circ', L, f'An angle measures {deg}°. What is its measure in radians?', f(frac), [f(w) for w in wrong],
              f'Multiply by {PI}/180: {deg} × {PI}/180 = {f(frac)}.')


FAMILIES = [
    lin1_solve, lin1_word, lin1_special, lin2_slope, lin2_equation, lin2_intercept, lin2_perp, linf_eval, linf_two, linf_interpret,
    sys_solve, sys_word, sys_nosol, ineq_solve, ineq_budget, ineq_point,
    eqx_expand, eqx_factor, eqx_exponent, eqx_rational, eqx_hard, nleq_roots, nleq_disc, nleq_abs, nleq_sqrt, nleq_system,
    nlf_eval, nlf_vertex, nlf_expo,
    rate_basic, rate_convert, rate_multi, pct_basic, pct_hard, stat_center, stat_change, stat_outlier, prob_simple, prob_table,
    infr_estimate, infr_concept,
    area_basic, area_scale, ang_basic, ang_similar, trig_basic, trig_hard, circ_basic, circ_hard,
]

DOMAIN = dict(lin1='alg', lin2='alg', linf='alg', sys='alg', ineq='alg', eqx='adv', nleq='adv', nlf='adv',
              rate='psda', pct='psda', stat='psda', prob='psda', infr='psda', area='geo', ang='geo', trig='geo', circ='geo')


def build():
    rng = random.Random(20261115)
    items, seen, counts = [], set(), {}
    for family in FAMILIES:
        for level in (1, 2, 3):
            made = 0
            for _ in range(400):
                if made == VARIANTS:
                    break
                try:
                    item = family(rng, level)
                except (Skip, ZeroDivisionError, ValueError):
                    continue
                sig = item['question'] + json.dumps(item.get('table'))
                if sig in seen:
                    continue
                seen.add(sig)
                key = (item['skill'], level)
                counts[key] = counts.get(key, 0) + 1
                item = dict(id=f"m-{item['skill']}-{level}-{counts[key]}", section='math', domain=DOMAIN[item['skill']], **item)
                items.append(item)
                made += 1
    return items


def main():
    items = build()
    out = pathlib.Path(__file__).resolve().parent.parent / 'content' / 'sat' / 'math.js'
    out.parent.mkdir(parents=True, exist_ok=True)
    head = '// Generated by scripts/gen-sat-math.py. Original questions; every answer is computed. Do not edit by hand.\n'
    out.write_text(head + 'export const SAT_MATH = ' + json.dumps(items, ensure_ascii=False, indent=1) + ';\n', encoding='utf-8')
    by_skill = {}
    for it in items:
        by_skill.setdefault(it['skill'], [0, 0, 0])[it['level'] - 1] += 1
    print(len(items), 'questions;', sum(1 for i in items if i['type'] == 'spr'), 'typed-answer')
    for skill, c in sorted(by_skill.items()):
        print(f'  {skill:5} {c}')


if __name__ == '__main__':
    main()
