% K3 - proof trees and the missing literal, by a meta-interpreter over the (tabled) program.
% Answered oracle atoms are plain facts here (no undefined needed).

% corpus-shaped facts for three documents
:- discontiguous section/3, depth/3, heading/3.
section(d1, goal, root).      depth(d1, goal, 2).      heading(d1, goal, 'Goal').
section(d1, rationale, root). depth(d1, rationale, 2). heading(d1, rationale, 'Rationale').
section(d2, intro, root).     depth(d2, intro, 2).     heading(d2, intro, 'Introduction').
section(d3, goal, root).      depth(d3, goal, 2).      heading(d3, goal, 'Goal').
meta(d1, kind, design). meta(d2, kind, design). meta(d3, kind, design).

% d1's Goal section is answered 'goal'; d3's is answered 'other', so the oracle literal is missing.
answered(purpose(d1, goal), goal).
answered(purpose(d3, goal), other).

% rules (tabled, as in K4)
:- table top/2, goal_section/2, purposeful_goal/2.
top(D, S) :- section(D, S, _), depth(D, S, 2).
goal_section(D, S) :- top(D, S), heading(D, S, 'Goal').
purposeful_goal(D, S) :- goal_section(D, S), purpose(D, S, goal).

% a choose oracle, answered as a fact
purpose(D, S, L) :- answered(purpose(D, S), L).
oracle_pred(purpose(_, _, _)).
oracle_leaf(purpose(D, S, L), purpose(D, S), L).

% constraint(Name, ForallGoal, RequireGoal)
constraint('artifact-has-goal', meta(D, kind, _), goal_section(D, _S)).
constraint('goal-has-purpose', meta(D, kind, _), (top(D, S), heading(D, S, 'Goal'), purpose(D, S, goal))).

% prove(+Goal, -Tree): Tree is node(Goal, Children) for a rule step, fact(F) for a fact,
% oracle(Atom, Label) for an answered oracle atom, builtin(G) for a builtin.
% Tabled predicates are expanded too: the table is consulted first (call/1), and clause/2 then
% picks the clause that re-derives that answer, so the tree follows answers the engine accepts.
prove(true, []) :- !.
prove((A, B), Ts) :- !, prove(A, TA), prove(B, TB), append(TA, TB, Ts).
prove(G, [oracle(Atom, L)]) :- oracle_pred(G), !, call(G), oracle_leaf(G, Atom, L).
prove(G, [builtin(G)]) :- predicate_property(G, built_in), !, call(G).
prove(G, [T]) :-
    (   predicate_property(G, tabled) -> call(G) ; true ),
    clause(G, Body),
    (   Body == true -> T = fact(G)
    ;   prove(Body, Ts), T = node(G, Ts) ).

% missing(+Goal, -Literal): the first literal, left to right, at which the conjunction stops
% having a solution (bindings from the forall are already applied to Goal).
missing(Goal, Lit) :- conj(Goal, Ls), first_missing(Ls, true, Lit).
first_missing([L|Ls], Prefix, Lit) :-
    (   \+ (Prefix, L) -> bind_if_unique(Prefix), Lit = L
    ;   first_missing(Ls, (Prefix, L), Lit) ).
% L is reported with the prefix's bindings only when the prefix has exactly one solution;
% otherwise the variables stay unbound (no single binding is "the" missing one).
bind_if_unique(P) :- findall(P, P, Ps), sort(Ps, Us), ( Us = [P] -> true ; true ).
conj((A, B), L) :- !, conj(A, LA), conj(B, LB), append(LA, LB, L).
conj(A, [A]).

% check(Name, D, Result): the proof tree (node(Require, Children) for a conjunction) when the require holds, missing(Lit) when it is violated.
check(Name, D, Result) :-
    constraint(Name, Forall, Require),
    call(Forall), arg(1, Forall, D),
    (   prove(Require, Ts) -> ( Ts = [T], Require \= (_, _) -> Result = T ; Result = node(Require, Ts) )
    ;   missing(Require, Lit), Result = missing(Lit) ).
