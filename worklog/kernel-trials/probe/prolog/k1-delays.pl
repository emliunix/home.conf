% K1 - undefined answers and delay lists under SWI-Prolog's well-founded semantics.
%
% Leaf encoding (the only transformation; author rules are untouched):
%   SWI has no "undefined fact". An oracle atom with no usable answer is made undefined by a
%   negative self-loop through tnot/1:  u(A) :- tnot(u(A)).  Under the WFS u(A) is neither true
%   nor false. tnot/1 needs a tabled, ground argument, so u/1 is tabled and A is always ground.

:- table u/1.
u(A) :- tnot(u(A)).

% answered(Atom, Label): the judge's answers. Labels: holds | fails | unknown (a threshold
% demotion). Anything but holds/fails leaves the atom undefined.
:- dynamic answered/2.

oracle(A) :- answered(A, holds).
oracle(A) :- \+ answered(A, holds), \+ answered(A, fails), u(A).

% A choose oracle: one undefined atom per label (label(A, L)). With an answer L the atom
% label(A, L) is true and the other labels are false; with no answer every label is undefined.
labels(k(_), [x, y, z]).
choose(A, L) :- labels(A, Ls), answered(A, L), memberchk(L, Ls).
choose(A, L) :- labels(A, Ls), \+ ( answered(A, L0), memberchk(L0, Ls) ),
                member(L, Ls), u(label(A, L)).

% ---- the user program under test ----
sect(a). sect(b).
fact(a).

% (a) prefix test: o1(a) unanswered; o2(a) must not be demanded while o1(a) is open.
ok(S) :- sect(S), oracle(o1(S)), oracle(o2(S)).
% (a') a disjunct already true: nothing is demanded for a.
ok2(S) :- fact(S).
ok2(S) :- oracle(o3(S)).
% the constraint in negated form (tnot needs a tabled argument)
:- table ok_t/1, pick/2.
ok_t(S) :- ok(S).
violated(c1) :- sect(a), tnot(ok_t(a)).
% (d) an existential target for tnot over a non-ground goal
:- table has_fact/1.
has_fact(S) :- fact(S).
% (c) choose oracle in positive and negated position
is_x(S) :- sect(S), choose(k(S), x).
pick(S, L) :- choose(k(S), L).
not_y(S) :- sect(S), tnot(pick(S, y)).

% ---- probe helpers ----
% Truth value of a goal under the WFS: true (unconditional answer), undefined (only conditional
% answers), false (no answer).
tv(G, T) :-
    (   call_delays(G, true) -> T = true
    ;   call_delays(G, _)    -> T = undefined
    ;   T = false ).

% Demand set: walk the residual program of every conditional answer transitively down to the
% u/1 leaves. full = every leaf; prefix = only the first delayed literal of each residual clause
% body (the current evaluator's prefix rule).
%   A goal that already has an unconditional answer demands nothing (checked first: enumerating
%   call_delays/2 alone also yields the conditional answers of a goal that is already true).
demand(G, _, []) :- call_delays(G, true), !.
demand(G, Mode, Set) :-
    findall(A, ( call_delays(G, D), D \== true,
                 delays_residual_program(D, P),
                 conj_list(D, Ls), pick_lits(Mode, Ls, Ls1),
                 member(L, Ls1), leaf(L, P, Mode, [], A) ), As),
    sort(As, Set).

leaf(L0, P, Mode, Seen, A) :-
    strip(L0, L),
    (   L = u(A0) -> A = A0
    ;   memberchk(L, Seen) -> fail
    ;   member((H :- B), P), H =@= L,
        conj_list(B, Bs), pick_lits(Mode, Bs, Bs1),
        member(L1, Bs1), leaf(L1, P, Mode, [L|Seen], A) ).

strip(tnot(G), G) :- !.
strip(\+ G, G) :- !.
strip(G, G).
pick_lits(full, Ls, Ls).
% Observed: SWI lists delayed literals most-recent-first (ok(a)'s delays print as
% u(o2(a)),u(o1(a))), so the first literal in source order is the LAST element.
pick_lits(prefix, Ls, [L]) :- last(Ls, L).
pick_lits(prefix, [], []).
conj_list(true, []) :- !.
conj_list((A, B), L) :- !, conj_list(A, LA), conj_list(B, LB), append(LA, LB, L).
conj_list(A, [A]).

% Every u/1 subgoal ever tabled (to show no unrelated oracle was even explored).
% Observed: current_table(u(A), T) with a partially bound pattern returns nothing in this build;
% enumerating current_table(V, T) and unifying afterwards works.
tabled_leaves(As) :- findall(A, (current_table(V, _), V = u(A)), As0), sort(As0, As).

% (d) tnot over a non-ground goal: report the outcome or the error term.
nonground(Goal, R) :-
    catch(( call_delays(tnot(Goal), D) -> R = succeeded(D) ; R = failed ), E, R = error(E)).
