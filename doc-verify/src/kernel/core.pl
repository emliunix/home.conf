% core.pl - the doc-verify kernel, round-2 core, for SWI-Prolog's well-founded semantics
% (swipl-wasm 8.2.2 / SWI-Prolog 10.1.15).
%
% The specification is docs/doc-verify-model.md ("the model"); every part below names the
% section it implements. The author's program is produced by translate.mjs and consulted after
% this file. Author rules are translated mechanically and never edited; everything the model
% needs beyond plain WFS lives here, under the reserved prefix `core_`.
%
% Naming (fixed by translate.mjs):
%   - base facts of the dump:        core_<name>/N       (core.section(D,S,P) -> core_section(D,S,P))
%   - module predicates and oracles: 'Module::name'/N    (w.ok(D,S) -> 'w::ok'(D,S)); the oracle
%                                     atom's identity is that ground term (model §1, invariant 6)
%   - declarations the core reads:   core_oracle_decl/5, core_constraint/8, core_forall/2,
%                                     core_goal/2, core_warning_threshold/1

:- use_module(library(lists)).
:- use_module(library(apply)).
:- use_module(library(pairs)).
:- use_module(library(pcre)).          % §3 matches/2: SWI's re_match/2 is available in this build

% ---------------------------------------------------------------------------------------------
% Base facts (model §1 document dump; §2 "a base fact is t if in F_D, else f").
% Declared dynamic so that a dump without a predicate makes it false instead of raising.
:- dynamic core_section/3, core_heading/3, core_depth/3, core_order/3, core_meta/3,
           core_selected/2, core_ref/4, core_resolves/2, core_child/3, core_descendant/3,
           core_table/3, core_header/3, core_row/3, core_cell/3,
           core_nests/3, core_dangling/4, core_spec_unresolved/4, core_section_ref/5.
core_base(core_section/3). core_base(core_heading/3). core_base(core_depth/3).
core_base(core_order/3).   core_base(core_meta/3).    core_base(core_selected/2).
core_base(core_ref/4).     core_base(core_resolves/2). core_base(core_child/3).
core_base(core_table/3).   core_base(core_header/3).   core_base(core_row/3).     core_base(core_cell/3).
core_base(core_descendant/3). core_base(core_nests/3). core_base(core_dangling/4).
core_base(core_spec_unresolved/4). core_base(core_section_ref/5).

% Declarations written by translate.mjs.
%   core_oracle_decl(Functor, Arity, Labels, InputPositions, Kind)  Kind = ask | choose
%   core_constraint(Id, Mode, Severity, Weight, Nonempty, ForallVarsNames, ForallGoal, Goal)
%     ForallVarsNames is ['D'=_V_D, ...]: the forall's named variables, which key a binding.
:- dynamic core_oracle_decl/5, core_constraint/8, core_warning_threshold/1.

% ---------------------------------------------------------------------------------------------
% §2 Leaves. The judge's answers are data: core_answered(OracleAtom, Label), Label one of the
% oracle's labels or `unknown` (a threshold demotion, model §1 Answer). Dynamic and incremental.
:- dynamic([core_answered/2], [incremental(true)]).

% An unanswered label atom is made undefined by a negative self-loop through tnot/1 (WFS has no
% "undefined fact"; round 1). u/1 is tabled and always called ground.
:- table core_u/1 as incremental.
core_u(X) :- tnot(core_u(X)).

% An atom has a usable answer when it is answered with a label (unknown is not a label).
core_has_label(A) :- core_answered(A, L), L \== unknown.

% core_label(+A, +L): the leaf valuation λ_ans of the label atom (A, L), model §2:
%   t if ans(A) = L; f if ans(A) = L' with L' ≠ L; u if A is unanswered or answered unknown.
% For a two-label oracle o(i) stands for o(i, holds). The wrapper is UNTABLED (round 1 K2,
% visflow design 20 F12). The groundness check is the boundary of model §8: an oracle atom is
% a ground term; a non-ground one would silently become existential under tnot (F13).
core_label(A, L) :-
    core_ground_or_throw(A, nonground_oracle),
    (   core_answered(A, L), L \== unknown
    ;   \+ core_has_label(A), core_u(lab(A, L))
    ).

% core_not_label(+A, +L): the negation of the label atom at the leaf: t if A is answered with
% another label, f if answered L, u if unanswered. The negation of an undefined leaf is the same
% undefined leaf, so no tnot over an untabled wrapper is needed.
core_not_label(A, L) :-
    core_ground_or_throw(A, nonground_negation),
    (   core_answered(A, L2), L2 \== unknown, L2 \== L
    ;   \+ core_has_label(A), core_u(lab(A, L))
    ).

% A choose oracle k(i, L) is one label atom per label (§1 Label atom). With an answer l the
% label atom (A, l) is t and every other label atom is f; unanswered, every label atom is u.
core_choose(A, Labels, L) :- member(L, Labels), core_label(A, L).

% ---------------------------------------------------------------------------------------------
% §8 (amended 2026-10-12) The static checks the kernel owes are two: every negated goal is ground
% when reached, and every `matches` operand is bound when reached (§3). They are checked when the
% literal is reached, and a violation is not a truth value: it throws core_rejected(Reason, Goal),
% and the host reports the module as rejected (no statuses).
core_ground_or_throw(G, What) :-
    (   ground(G) -> true
    ;   throw(core_rejected(What, G))
    ).

% `not G` over a derived (tabled) predicate: groundness check, then tnot/1 (translate.mjs).
core_tnot(G) :- core_ground_or_throw(G, nonground_negation), tnot(G).
% `not G` over a base fact of the dump (two-valued): groundness check, then \+.
core_naf(G) :- core_ground_or_throw(G, nonground_negation), \+ call(G).

% ---------------------------------------------------------------------------------------------
% WFS truth value of a ground goal: t (an unconditional answer), u (only conditional answers),
% f (no answer). Model §3.
core_tv(G, T) :-
    (   call_delays(G, true) -> T = t
    ;   call_delays(G, _)    -> T = u
    ;   T = f
    ).

% ---------------------------------------------------------------------------------------------
% §3 Aggregates. count(V, G, N) is the interval [c, p]: c = #distinct V with G = t,
% p = #distinct V with G ≠ f. WFS has no three-valued aggregate (aggregate_all ignores delays,
% round 1), so it is encoded as two queries over the delays of the (tabled) count goal:
%   certain:  V such that the instance has an unconditional answer (every leaf t);
%   possible: V such that the instance has any answer (no leaf f).
% N is an integer when c = p, else core_iv(C, P, UGoals) where UGoals are the undetermined
% instances; a comparison that comes out u depends on them, so the residual program (§6 demand)
% reaches their leaves.
%   core_count_mode(interval) is the encoding; core_count_mode(naive) is the un-encoded engine
%   (aggregate_all over the goal, delays ignored), kept to record the failing state of the
%   interval-count gate (round-2 preregistration).
:- dynamic core_count_mode/1.
core_count_mode(interval).

core_count(V, G, N) :-
    core_count_mode(naive), !,
    aggregate_all(count, V, distinct(V, G), N).
core_count(V, G, N) :-
    findall(V-D, call_delays(G, D), Pairs),
    findall(V, member(V-true, Pairs), C0), sort(C0, Cs),
    findall(V, member(V-_, Pairs), P0), sort(P0, Ps),
    length(Cs, C), length(Ps, P),
    (   C =:= P -> M = C
    ;   subtract(Ps, Cs, Us), findall(G, member(V, Us), UGoals), M = core_iv(C, P, UGoals)
    ),
    % A result already bound (a constant, or a variable an earlier count bound) is compared, not
    % unified: an interval would fail unification where the comparison is u (gate-ledger item 7).
    (   var(N) -> N = M
    ;   core_same_count(N, M) -> true
    ;   core_cmp(=:=, N, M)
    ).

% Two intervals over the same undetermined instances count the same goal (the instances carry
% the goal), so they are equal in every completion: t, where the interval comparison alone says u.
core_same_count(core_iv(L, H, U1), core_iv(L, H, U2)) :- U1 \== [], U1 =@= U2.

core_bounds(N, N, N, []) :- integer(N), !.
core_bounds(core_iv(L, H, Us), L, H, Us).

% A comparison on intervals (model §3): t if it holds for every value in the intervals, f if for
% none, u otherwise. With integers on both sides this is ordinary arithmetic comparison.
core_cmp(Op, A, B) :-
    core_bounds(A, AL, AH, AU), core_bounds(B, BL, BH, BU),
    (   core_cmp_all(Op, AL, AH, BL, BH) -> true
    ;   core_cmp_some(Op, AL, AH, BL, BH) -> append(AU, BU, Us), core_undef(Us)
    ;   fail
    ).

core_cmp_all(<,    _, AH, BL, _)  :- AH < BL.
core_cmp_all(>,    AL, _, _, BH)  :- AL > BH.
core_cmp_all(=<,   _, AH, BL, _)  :- AH =< BL.
core_cmp_all(>=,   AL, _, _, BH)  :- AL >= BH.
core_cmp_all(=:=,  AL, AH, BL, BH) :- AL =:= AH, BL =:= BH, AL =:= BL.
core_cmp_all(=\=,  AL, AH, BL, BH) :- ( AH < BL ; BH < AL ), !.
core_cmp_some(<,   AL, _, _, BH)  :- AL < BH.
core_cmp_some(>,   _, AH, BL, _)  :- AH > BL.
core_cmp_some(=<,  AL, _, _, BH)  :- AL =< BH.
core_cmp_some(>=,  _, AH, BL, _)  :- AH >= BL.
core_cmp_some(=:=, AL, AH, BL, BH) :- AL =< BH, BL =< AH.
core_cmp_some(=\=, AL, AH, BL, BH) :- \+ ( AL =:= AH, BL =:= BH, AL =:= BL ).

% core_undef(+Goals): u, and dependent on the undetermined instances in Goals: for each G (u),
% G ∧ ¬G is u, and its residual program contains G's leaves.
core_undef(Gs) :- member(G, Gs), call(G), core_tnot(G).

% ---------------------------------------------------------------------------------------------
% §3 Pattern builtins. matches(X, R): t/f on a bound atomic X (SWI re_match/2, PCRE, unanchored
% search like the TypeScript RegExp.test), u on an interval; an unbound X is a static error
% (amended §3/§8): rejected. A ground compound (a list) is decided and does not match.
core_matches(X, R) :- var(X), !, throw(core_rejected(unbound_matches, matches(X, R))).
core_matches(core_iv(_, _, Us), _) :- !, core_undef(Us).
core_matches(X, R) :- atomic(X), !, core_text(X, S), re_match(R, S).

core_not_matches(X, R) :- var(X), !, throw(core_rejected(unbound_matches, matches(X, R))).
core_not_matches(core_iv(_, _, Us), _) :- !, core_undef(Us).
core_not_matches(X, R) :- atomic(X), !, core_text(X, S), \+ re_match(R, S).
core_not_matches(X, _) :- compound(X).

core_text(X, S) :- ( string(X) -> S = X ; atom_string(X, S) ).

% present(D, Cs, Ps): a derived predicate over node facts (model §3): Ps is the candidates that
% are sections of D, in document order (core_order/3); no member present has no derivation.
core_present(D, Cs, Ps) :-
    findall(O-S, ( member(S, Cs), core_section(D, S, _), core_order(D, S, O) ), L0),
    sort(L0, L), L \== [], pairs_values(L, Ps).

% ---------------------------------------------------------------------------------------------
% §4 Constraints and status. core_forall(Id, Vals) and core_goal(Id, Vals) are tabled per
% constraint by translate.mjs (Vals = the forall's named variables, in order); the goal's other
% variables are existential. A binding is θ with Bθ ≠ f.
core_binding(Id, Vals) :-
    findall(Vals, call_delays(core_forall(Id, Vals), _), L0), sort(L0, L),
    member(Vals, L).

core_binding_status(Id, Vals, TB, TG, Status) :-
    core_constraint(Id, Mode, _, _, _, _, _, _),
    core_binding(Id, Vals),
    core_tv(core_forall(Id, Vals), TB),
    core_tv(core_goal(Id, Vals), TG),
    core_status(Mode, TB, TG, Status0),
    Status = Status0.                    % compute first: core_status/4 uses cuts

% The status table of §4 (amended 2026-10-12; B = forall, G = goal under θ): satisfied when the
% goal is decided the right way whatever B; violated only when B = t and the goal is decided the
% wrong way; otherwise undetermined.
core_status(require, _, t, satisfied) :- !.
core_status(require, t, f, violated)  :- !.
core_status(forbid,  _, f, satisfied) :- !.
core_status(forbid,  t, t, violated)  :- !.
core_status(_, _, _, undetermined).

% Rows of one constraint: b(Vals, Status), plus, for a `nonempty` constraint, a population row
% b(population, S) (§4 amended): violated when no binding has B ≠ f, undetermined when every
% binding has B = u (the population may still turn out empty), absent otherwise.
core_constraint_rows(Id, Rows) :-
    core_constraint(Id, _, _, _, Nonempty, _, _, _),
    findall(b(Vals, St)-TB, core_binding_status(Id, Vals, TB, _, St), Pairs),
    pairs_keys_values(Pairs, Rows0, TBs),
    (   Nonempty == true, Rows0 == [] -> append(Rows0, [b(population, violated)], Rows)
    ;   Nonempty == true, \+ memberchk(t, TBs) -> append(Rows0, [b(population, undetermined)], Rows)
    ;   Rows = Rows0
    ).

% Constraint-level status, used only by the verdict's warning ratio.
core_constraint_status(Rows, violated)     :- memberchk(b(_, violated), Rows), !.
core_constraint_status(Rows, undetermined) :- memberchk(b(_, undetermined), Rows), !.
core_constraint_status(_, satisfied).

% ---------------------------------------------------------------------------------------------
% §5 Verdict (without BLOCKED: this kernel always finishes on the witnesses; rounds, the cap R
% and the budget B are the host's and are not exercised in round 2).
core_verdict(V) :-
    findall(Sev-W-Rows, ( core_constraint(Id, _, Sev, W, _, _, _, _), core_constraint_rows(Id, Rows) ), Cs),
    (   member(error-_-Rows, Cs), memberchk(b(_, violated), Rows) -> V = 'NO-GO'
    ;   member(error-_-Rows, Cs), memberchk(b(_, undetermined), Rows) -> V = 'NEEDS-REVIEW'
    ;   core_warning_ratio_low(Cs) -> V = 'NEEDS-REVIEW'
    ;   V = 'PASS'
    ).
core_warning_ratio_low(Cs) :-
    ( core_warning_threshold(Th) -> true ; Th = 0 ),
    findall(W, member(warning-W-_, Cs), Ws), sum_list(Ws, Total), Total > 0,
    findall(W, ( member(warning-W-Rows, Cs), core_constraint_status(Rows, satisfied) ), Ss),
    sum_list(Ss, Sat), Sat / Total < Th.

% ---------------------------------------------------------------------------------------------
% §6 Demand. The support of an undetermined binding is the set of unanswered atoms at the
% leaves of every residual derivation of its forall and goal. The residual program comes from
% delays_residual_program/2 and is walked transitively to the core_u(lab(A, L)) leaves (round 1:
% the delay list itself is not the demand, F8). A goal with an unconditional answer contributes
% nothing (F10). The definition is syntactic (amended §6): it over-approximates the semantic
% relevance of an atom, which the host measures as D3. Asked atoms are removed in core_demand/2.
%   full:   every leaf of every residual derivation;
%   prefix: per residual derivation, only the first literal in source order that still leads to
%           an unanswered leaf (design 04's order); for a binding, the forall's derivation comes
%           before the goal's, so the goal is walked only once the forall is t.
% Source order: SWI lists delayed literals most-recent-first (F9, pinned by core_selftest_order),
% so a delay conjunction is reversed before it is read.
% (Re-amended §1/§6, second review) Dem(ans) = residual leaves minus asked(ans), where asked(ans)
% is every atom with any answer, `unknown` included. Valuation is unchanged: an `unknown` atom is
% still a u leaf, so it is found by the walk and then removed here.
%   (Re-amended after the kernel author's counterexample) An asked atom is, for scheduling, as good
%   as decided: every policy skips it, and `prefix` takes the first DEMANDABLE leaf of each
%   residual derivation, falling through past asked-unknown leaves (core_leaf/5 drops asked atoms
%   for full and prefix, so core_first_leaves/4 moves on), hence prefix is empty exactly when full
%   is. Policy `raw` keeps asked leaves: it is used only to tell a negative loop (no leaf at all,
%   `unfounded`) from an `unresolvable` binding (leaves, all asked).
core_demand(Policy, Atoms) :-
    core_demand_leaves(Policy, Leaves),
    exclude(core_asked, Leaves, Atoms).
core_asked(A) :- core_answered(A, _).

core_demand_leaves(Policy, Atoms) :-
    findall(A, ( core_constraint(Id, _, _, _, _, _, _, _),
                 core_binding_status(Id, Vals, TB, _, undetermined),
                 core_binding_leaf(Policy, Id, Vals, TB, A) ), As0),
    % a nonempty constraint whose population is undetermined (every binding has B = u) also
    % depends on its bindings' forall instances
    findall(A, ( core_constraint(Id, _, _, _, true, _, _, _),
                 core_constraint_rows(Id, Rows), memberchk(b(population, undetermined), Rows),
                 core_binding_status(Id, Vals, u, _, _),
                 core_goal_leaf(core_forall(Id, Vals), Policy, A) ), As1),
    append(As0, As1, As), sort(As, Atoms).

% §3 M2 (amended): an undetermined binding whose full support is empty rests on a negative loop
% (or on nothing an answer can decide): reported as an `unfounded` finding. The walk's Seen list
% keeps the loop p :- tnot(q), q :- tnot(p) finite and leaf-free.
core_unfounded(Id, Vals) :-
    core_constraint(Id, _, _, _, _, _, _, _),
    core_binding_status(Id, Vals, TB, _, undetermined),
    \+ core_binding_leaf(raw, Id, Vals, TB, _).

% §6 (re-amended): an undetermined binding whose support is empty after subtracting asked atoms,
% but which has residual leaves (all asked, i.e. answered unknown): unresolvable. It stays
% undetermined, demands nothing, and the verdict is NEEDS-REVIEW.
core_unresolvable(Id, Vals) :-
    core_constraint(Id, _, _, _, _, _, _, _),
    core_binding_status(Id, Vals, TB, _, undetermined),
    core_binding_leaf(raw, Id, Vals, TB, _),
    \+ core_binding_leaf(full, Id, Vals, TB, _).

% The atom an unfounded binding rests on: the first literal (source order) of the residual body of
% its goal instance (or of its forall instance when the goal is decided), with tnot stripped.
core_unfounded_atom(Id, Vals, A) :-
    (   G = core_goal(Id, Vals) ; G = core_forall(Id, Vals) ),
    call_delays(G, D), D \== true,
    delays_residual_program(D, P),
    member((H :- B0), P), H =@= G,
    core_disj(B0, [B|_]), core_delay_list(B, [L|_]),
    core_strip(L, A), !.

core_binding_leaf(raw, Id, Vals, _, A) :-
    (   core_goal_leaf(core_forall(Id, Vals), raw, A)
    ;   core_goal_leaf(core_goal(Id, Vals), raw, A)
    ).
core_binding_leaf(full, Id, Vals, _, A) :-
    (   core_goal_leaf(core_forall(Id, Vals), full, A)
    ;   core_goal_leaf(core_goal(Id, Vals), full, A)
    ).
% prefix over a binding: the forall's derivation precedes the goal's; falling through (§6
% re-amended) when the forall has no demandable leaf (it is t, or its leaves are all asked).
core_binding_leaf(prefix, Id, Vals, _, A) :-
    findall(A0, core_goal_leaf(core_forall(Id, Vals), prefix, A0), F0), sort(F0, F),
    (   F \== [] -> member(A, F)
    ;   core_goal_leaf(core_goal(Id, Vals), prefix, A)
    ).

core_goal_leaf(G, _, _) :- call_delays(G, true), !, fail.
core_goal_leaf(G, Policy, A) :-
    findall(D, ( call_delays(G, D), D \== true ), Ds0), sort(Ds0, Ds),
    member(D, Ds),
    delays_residual_program(D, P),
    core_disj(D, Alts), member(D1, Alts),
    core_delay_list(D1, Ls),
    core_lits_leaf(Policy, Ls, P, [], A).

core_disj((A ; B), L) :- !, core_disj(A, LA), core_disj(B, LB), append(LA, LB, L).
core_disj(A, [A]).

core_lits_leaf(full, Ls, P, Seen, A) :- member(L, Ls), core_leaf(L, P, full, Seen, A).
core_lits_leaf(raw, Ls, P, Seen, A) :- member(L, Ls), core_leaf(L, P, raw, Seen, A).
core_lits_leaf(prefix, Ls, P, Seen, A) :- core_first_leaves(Ls, P, Seen, As), member(A, As).

core_first_leaves([L|Ls], P, Seen, As) :-
    findall(A, core_leaf(L, P, prefix, Seen, A), As0), sort(As0, As1),
    (   As1 \== [] -> As = As1
    ;   core_first_leaves(Ls, P, Seen, As)
    ).

core_leaf(L0, P, Policy, Seen, A) :-
    core_strip(L0, L),
    (   L = core_u(lab(A0, _)) -> ( Policy == raw -> true ; \+ core_asked(A0) ), A = A0
    ;   L = core_u(_) -> fail
    ;   member(S, Seen), S =@= L -> fail
    ;   member((H :- B0), P), H =@= L,
        core_disj(B0, Alts), member(B, Alts),          % one residual clause may hold several
        core_delay_list(B, Bs),                         % derivations as a disjunction (F16)
        core_lits_leaf(Policy, Bs, P, [L|Seen], A)
    ).

core_strip(tnot(G), G) :- !.
core_strip(\+ G, G) :- !.
core_strip(G, G).

% A delay conjunction as a list in source order (reversed: F9).
core_delay_list(true, []) :- !.
core_delay_list(D, Ls) :- core_conj(D, Rev), reverse(Rev, Ls).

core_conj((A, B), L) :- !, core_conj(A, LA), core_conj(B, LB), append(LA, LB, L).
core_conj(true, []) :- !.
core_conj(A, [A]).

% F9 pinned: a two-literal conditional body must list its delays most-recent-first. The runner
% prints this; if a build changes the order, the prefix policy is wrong and this says so.
:- table core_selftest_p/0.
core_selftest_p :- core_u(selftest_first), core_u(selftest_second).
core_selftest_order(R) :-
    (   call_delays(core_selftest_p, D0), D0 \== true,
        delays_residual_program(D0, P), member((core_selftest_p :- D), P) -> true
    ;   D = none
    ),
    (   D = (core_u(selftest_second), core_u(selftest_first)) -> R = most_recent_first(D)
    ;   R = unexpected(D)
    ).

% ---------------------------------------------------------------------------------------------
% §7 Missing literal (amended 2026-10-12: descent). For a violated require binding θ: walk Gθ left
% to right; a literal valued t binds its variables (its first t solution) and is passed; a
% literal valued u is noted and passed as if it held (its first u solution); the first literal
% valued f is the answer if it is a base fact, a label atom, a builtin or a negation; if it is a
% derived atom, descend into that predicate's FIRST clause in source order with the head bound
% and repeat. Reported: the literal and the clause path (the derived atoms descended through).
% translate.mjs declares core_rule_pred(Functor, Arity) for every module predicate with rules.
:- dynamic core_rule_pred/2.

core_missing(Id, Vals, Text, PathTexts, UTexts) :-
    core_constraint(Id, require, _, _, _, NV, _, Goal0),
    copy_term(NV-Goal0, NV1-Goal),
    pairs_values_eq(NV1, Vals),
    core_conj(Goal, Ls),
    core_descend(Ls, [], [], Lit, Path, Us),
    core_lit_text(Lit, Text),
    maplist(core_path_text, Path, PathTexts),
    maplist(core_lit_text, Us, UTexts).

% A clause-path entry: the derived atom descended through and the clause index (always the first
% clause, §7), e.g. w::ok(d,a)#1.
core_path_text(G, T) :- core_lit_text(G, T0), atom_concat(T0, '#1', T).

pairs_values_eq([], []).
pairs_values_eq([_=V|T], [V|Vs]) :- pairs_values_eq(T, Vs).

% core_descend(+Literals, +Path, +PassedU, -Lit, -PathOut, -PassedUOut)
core_descend([L|Ls], Path, Us, Lit, PathOut, UsOut) :-
    (   call_delays(L, true) -> core_descend(Ls, Path, Us, Lit, PathOut, UsOut)        % t: bind, pass
    ;   call_delays(L, _)    -> append(Us, [L], Us1),                                % u: note, pass
                                core_descend(Ls, Path, Us1, Lit, PathOut, UsOut)
    ;   core_derived_lit(L)
    ->  once(clause(L, Body)),                                                       % first clause
        core_conj(Body, Bs),
        append(Path, [L], Path1),
        core_descend(Bs, Path1, Us, Lit, PathOut, UsOut)
    ;   Lit = L, PathOut = Path, UsOut = Us
    ).

core_derived_lit(L) :- callable(L), functor(L, F, N), core_rule_pred(F, N).

% The model's text of a translated literal: `module::pred(args)`, `not ...`, `X in L`, ...
core_lit_text(L, T) :- copy_term(L, L1), core_lit_text_(L1, T).
core_lit_text_(core_tnot(G), T) :- !, core_lit_text_(G, T0), atom_concat('not ', T0, T).
core_lit_text_(\+ G, T) :- !, core_lit_text_(G, T0), atom_concat('not ', T0, T).
core_lit_text_(core_not_label(A, L), T) :- !, core_label_atom(A, L, LA), core_lit_text_(LA, T0), atom_concat('not ', T0, T).
core_lit_text_(memberchk(X, Ls), T) :- !, core_arg_text(X, TX), core_arg_text(Ls, TL), format(atom(T), '~s in ~s', [TX, TL]).
core_lit_text_(core_matches(X, R), T) :- !, core_arg_text(X, TX), core_arg_text(R, TR), format(atom(T), 'matches(~s,~s)', [TX, TR]).
core_lit_text_(core_not_matches(X, R), T) :- !, core_arg_text(X, TX), core_arg_text(R, TR), format(atom(T), 'not matches(~s,~s)', [TX, TR]).
core_lit_text_(core_cmp(Op, A, B), T) :- !, core_arg_text(A, TA), core_arg_text(B, TB), format(atom(T), '~s~w~s', [TA, Op, TB]).
core_lit_text_(core_count(V, G, N), T) :- !, core_arg_text(V, TV), core_lit_text_(G, TG), core_arg_text(N, TN), format(atom(T), 'count(~s,~s,~s)', [TV, TG, TN]).
core_lit_text_(core_present(D, Cs, Ps), T) :- !, core_arg_text(D, TD), core_arg_text(Cs, TC), core_arg_text(Ps, TP), format(atom(T), 'present(~s,~s,~s)', [TD, TC, TP]).
core_lit_text_(G, T) :-
    G =.. [F|Args],
    (   atom_concat(core_, Name, F), functor(G, F, N), core_base(F/N)
    ->  atom_concat('core::', Name, QF)
    ;   QF = F
    ),
    maplist(core_arg_text, Args, Ts), atomic_list_concat(Ts, ',', Inner),
    atom_string(QF, QFS),
    format(atom(T), '~s(~s)', [QFS, Inner]).

% A choose oracle's negated label literal is reported as the label atom k(i, l); a two-label
% oracle's as o(i).
core_label_atom(A, L, LA) :-
    functor(A, F, _),
    (   core_oracle_decl(F, _, _, _, choose) -> A =.. [F|Is], append(Is, [L], As), LA =.. [F|As]
    ;   LA = A
    ).

core_arg_text(X, T) :- var(X), !, T = '_'.
core_arg_text(core_iv(L, H, _), T) :- !, format(atom(T), '~w..~w', [L, H]).   % an interval [L, H]
% Lists: tight commas (write_term's spacing(next_argument) still spaces list elements).
core_arg_text(X, T) :-
    is_list(X), !,
    maplist(core_arg_text, X, Ts), atomic_list_concat(Ts, ',', Inner),
    format(atom(T), '[~s]', [Inner]).
core_arg_text(X, T) :-
    compound(X), \+ is_list(X), !,
    X =.. [F|Args], maplist(core_arg_text, Args, Ts), atomic_list_concat(Ts, ',', Inner),
    with_output_to(atom(FS), write_term(F, [quoted(true)])),
    format(atom(T), '~s(~s)', [FS, Inner]).
core_arg_text(X, T) :-
    copy_term(X, Y), term_variables(Y, Vs), maplist(=('$VAR'('_')), Vs),
    with_output_to(atom(T), write_term(Y, [quoted(true), numbervars(true)])).

% ---------------------------------------------------------------------------------------------
% Atom keys (FORMAT.md / host oracleAtomKey): module::pred(args), functor unquoted,
% ground args as write_term(quoted), no spaces between args. The host key is a JS string
% `mod::pred(...)`, not a Prolog source token — so the functor must not be '~w'-quoted.
core_atom_key(A, K) :-
    A =.. [F|Args],
    maplist(core_arg_text, Args, Ts), atomic_list_concat(Ts, ',', Inner),
    atom_string(F, FS),
    format(atom(K), '~s(~s)', [FS, Inner]).

% Answer state (the host writes it; model §8: the kernel's only input besides P and F).
core_set_answers(Pairs) :-
    retractall(core_answered(_, _)),
    forall(member(A-L, Pairs), assertz(core_answered(A, L))).

% ---------------------------------------------------------------------------------------------
% One evaluation, as lines for the host (fields separated by \x1f):
%   status <Id> <Status> <V1> ... (values written with ~w, keyed by the forall's variable order)
%   certain <Id> <V1> ...          (forall TB = t for this binding)
%   population <Id> <Possible> <Certain>
%   proof <Id> <V1> ... <Tree>     (Tree = write_canonical of the proof term)
%   demand <full|prefix> <Key>
%   missing <Id> <Literal> <ClausePath> <PassedU> <V1> ...  (lists joined by \x1e)
%   unfounded <Id> <V1> ...           (§3 M2: an undetermined binding with empty support)
%   a population row of a nonempty constraint has the single value \x1d population
%   verdict <V>
core_report(Out) :-
    findall(Line, core_report_line(Line), Lines),
    atomic_list_concat(Lines, '\n', Out).

core_report_line(Line) :-
    core_constraint(Id, _, _, _, _, _, _, _),
    core_constraint_rows(Id, Rows),
    member(b(Vals0, St), Rows),
    ( Vals0 == population -> Ts = ['\x1d\population'] ; maplist(core_val_text, Vals0, Ts) ),
    atomic_list_concat([status, Id, St|Ts], '\x1f\', Line).
core_report_line(Line) :-
    core_binding_status(Id, Vals, t, _, _),
    maplist(core_val_text, Vals, Ts),
    atomic_list_concat([certain, Id|Ts], '\x1f\', Line).
core_report_line(Line) :-
    core_constraint(Id, _, _, _, _, _, _, _),
    findall(TB, core_binding_status(Id, _, TB, _, _), TBs),
    length(TBs, Possible),
    include(=(t), TBs, Certs), length(Certs, Certain),
    atomic_list_concat([population, Id, Possible, Certain], '\x1f\', Line).
core_report_line(Line) :-
    core_binding_status(Id, Vals, TB, TG, Status),
    core_proof_term(Id, Vals, TB, TG, Status, Tree),
    with_output_to(atom(Canon), write_canonical(Tree)),
    maplist(core_val_text, Vals, Ts),
    atomic_list_concat([proof, Id|Ts], '\x1f\', Pref),
    atomic_list_concat([Pref, Canon], '\x1f\', Line).
core_report_line(Line) :-
    member(Policy, [full, prefix]),
    core_demand(Policy, As), member(A, As), core_atom_key(A, K),
    atomic_list_concat([demand, Policy, K], '\x1f\', Line).
core_report_line(Line) :-
    core_constraint(Id, require, _, _, _, _, _, _),
    core_binding_status(Id, Vals, _, _, violated),
    once(core_missing(Id, Vals, Text, PathTexts, UTexts)),
    atomic_list_concat(PathTexts, '\x1e\', PathText),
    atomic_list_concat(UTexts, '\x1e\', UText),
    maplist(core_val_text, Vals, Ts),
    atomic_list_concat([missing, Id, Text, PathText, UText|Ts], '\x1f\', Line).
core_report_line(Line) :-
    core_unresolvable(Id, Vals),
    maplist(core_val_text, Vals, Ts),
    atomic_list_concat([unresolvable, Id|Ts], '\x1f\', Line).
core_report_line(Line) :-
    core_unfounded(Id, Vals),
    (   core_unfounded_atom(Id, Vals, A) -> core_lit_text(A, AT) ; AT = '' ),
    maplist(core_val_text, Vals, Ts),
    atomic_list_concat([unfounded, Id, AT|Ts], '\x1f\', Line).
core_report_line(Line) :-
    core_verdict(V),
    atomic_list_concat([verdict, V], '\x1f\', Line).

core_val_text(V, T) :- format(atom(T), '~w', [V]).

% Labels of a demanded atom (for the host's D3 measurement, model §6).
core_atom_labels(A, Ls) :- functor(A, F, _), core_oracle_decl(F, _, Ls, _, _).

% ---------------------------------------------------------------------------------------------
% Proof trees (design 06; prototype worklog/kernel-trials/probe/prolog/k3-proof.pl).
% Tree = tree(forall(Mode, Kids), goal(Mode, Kids), MissingList)
%   Mode = certain | possible
%   Kid  = rule(Atom, RuleText, Kids) | fact(Atom) | oracle(Key) | unasked(Key)
%        | not(Kid) | builtin(Text) | missing(LitText)
% A node is certain when its goal is t, possible when u; cycles are cut by Seen.

core_proof_term(Id, Vals, TB, TG, Status, tree(forall(FM, FK), goal(GM, GK), Miss)) :-
    core_mode(TB, FM), core_mode(TG, GM),
    core_prove_goal(core_forall(Id, Vals), TB, [], FK),
    (   Status == violated, core_constraint(Id, require, _, _, _, _, _, _)
    ->  GK = [],
        (   once(core_missing_proof(Id, Vals, Lit, After))
        ->  Miss = [missing(Lit, After)]
        ;   Miss = []
        )
    ;   core_prove_goal(core_goal(Id, Vals), TG, [], GK), Miss = []
    ).

core_mode(t, certain) :- !.
core_mode(_, possible).

% Prefix proof up to the first f literal (design 04 missing.after), then that literal.
core_missing_proof(Id, Vals, Lit, After) :-
    core_constraint(Id, require, _, _, _, NV, _, Goal0),
    copy_term(NV-Goal0, NV1-Goal),
    pairs_values_eq(NV1, Vals),
    core_conj(Goal, Ls),
    core_descend_prove(Ls, [], Lit, After).

core_descend_prove([L|Ls], Acc, Lit, Kids) :-
    (   call_delays(L, true)
    ->  core_prove(L, t, [], PK), append(Acc, PK, Acc1),
        core_descend_prove(Ls, Acc1, Lit, Kids)
    ;   call_delays(L, _)
    ->  core_prove(L, u, [], PK), append(Acc, PK, Acc1),
        core_descend_prove(Ls, Acc1, Lit, Kids)
    ;   core_derived_lit(L)
    ->  once(clause(L, Body)), core_conj(Body, Bs),
        core_descend_prove(Bs, Acc, Lit, Kids)
    ;   core_lit_text(L, Lit), Kids = Acc
    ).

core_prove_goal(_G, f, _, []) :- !.
% Expand core_forall / core_goal to their bodies so the host's goal/forall nodes
% hold the premises (facts, oracles), not a wrapper rule(core_goal(...), ...).
% Do not call_delays the whole body again: status already decided the binding, and
% re-running would re-execute injected side effects (boundary E14's open/3).
core_prove_goal(core_forall(Id, Vals), Mode, Seen, Kids) :- !,
    (   once((clause(core_forall(Id, Vals), Body), core_prove(Body, Mode, Seen, Kids)))
    ->  true
    ;   Kids = [builtin('proof could not be built')]
    ).
core_prove_goal(core_goal(Id, Vals), Mode, Seen, Kids) :- !,
    (   once((clause(core_goal(Id, Vals), Body), core_prove(Body, Mode, Seen, Kids)))
    ->  true
    ;   Kids = [builtin('proof could not be built')]
    ).
core_prove_goal(G, Mode, Seen, Kids) :-
    (   Mode == t -> call_delays(G, true) ; call_delays(G, _) ),
    (   once(core_prove(G, Mode, Seen, Kids0))
    ->  Kids = Kids0
    ;   Kids = [builtin('proof could not be built')]
    ).

% core_prove(+Goal, +Mode, +Seen, -Kids): Kids is a list of proof nodes for Goal's body.
core_prove(true, _, _, []) :- !.
core_prove((A, B), Mode, Seen, Kids) :- !,
    core_prove(A, Mode, Seen, KA), core_prove(B, Mode, Seen, KB), append(KA, KB, Kids).
core_prove(core_label(A, _), _Mode, _, [N]) :- !,
    core_atom_key(A, K),
    % Any answer (including `unknown` from a threshold demotion) is an oracle leaf; only
    % never-asked atoms are unasked.
    (   core_answered(A, _) -> N = oracle(K) ; N = unasked(K) ).
core_prove(core_not_label(A, _), _Mode, _, [not(N)]) :- !,
    core_atom_key(A, K),
    (   core_answered(A, _) -> N = oracle(K) ; N = unasked(K) ).
core_prove(core_choose(A, _, _), Mode, Seen, Kids) :- !,
    core_prove(core_label(A, _), Mode, Seen, Kids).
core_prove(core_tnot(G), Mode, Seen, [not(Child)]) :- !,
    core_prove_negated(G, Mode, Seen, Child).
core_prove(core_naf(G), Mode, Seen, [not(Child)]) :- !,
    core_prove_negated(G, Mode, Seen, Child).
core_prove(\+ G, Mode, Seen, [not(Child)]) :- !,
    core_prove_negated(G, Mode, Seen, Child).
core_prove(memberchk(X, L), _, _, [builtin(T)]) :- !,
    core_lit_text(memberchk(X, L), T).
core_prove(core_matches(X, R), _, _, [builtin(T)]) :- !, core_lit_text(core_matches(X, R), T).
core_prove(core_not_matches(X, R), _, _, [builtin(T)]) :- !, core_lit_text(core_not_matches(X, R), T).
core_prove(core_cmp(Op, A, B), _, _, [builtin(T)]) :- !, core_lit_text(core_cmp(Op, A, B), T).
core_prove(core_count(V, G, N), _, _, [builtin(T)]) :- !, core_lit_text(core_count(V, G, N), T).
core_prove(core_present(D, C, P), _, _, [builtin(T)]) :- !, core_lit_text(core_present(D, C, P), T).
% Builtins / foreign goals: name them only — never re-execute (E14 injects open/3 into a body).
core_prove(G, _, _, [builtin(T)]) :-
    callable(G), predicate_property(G, built_in), !,
    core_lit_text(G, T).
core_prove(G, _, _, [builtin(T)]) :-
    callable(G), predicate_property(G, foreign), !,
    core_lit_text(G, T).
core_prove(G, Mode, Seen, [Node]) :-
    callable(G), functor(G, F, N),
    (   core_base(F/N) -> core_lit_text(G, T), Node = fact(T)
    ;   core_oracle_decl(F, _, _, _, _) ->
            G =.. [F|Args],
            (   core_oracle_decl(F, _, _, Inputs, choose)
            ->  length(Inputs, K), length(In, K), append(In, [_], Args), Atom =.. [F|In]
            ;   Atom = G
            ),
            core_atom_key(Atom, Key),
            (   core_answered(Atom, _) -> Node = oracle(Key) ; Node = unasked(Key) )
    ;   core_prove_derived(G, Mode, Seen, Node)
    ).

core_prove_one(G, Mode, Seen, Node) :-
    core_prove(G, Mode, Seen, Kids),
    ( Kids = [Node] -> true ; Node = rule(G, '', Kids) ).

% A `not G` node follows G's status: f → certain not (name G only); u → possible, with G's
% subtree when it builds; never call_delays(G, true) which would fail and drop the proof.
core_prove_negated(G, _Mode, Seen, Node) :-
    core_lit_text(G, Text),
    (   \+ call_delays(G, _)
    ->  Node = builtin(Text)
    ;   call_delays(G, true)
    ->  Node = builtin(Text)
    ;   catch(
            ( core_prove(G, u, Seen, Kids),
              ( Kids = [One] -> Node = One ; Node = rule(Text, '', Kids) )
            ),
            _,
            fail
        )
    ->  true
    ;   Node = builtin(Text)
    ).

core_prove_derived(G, Mode, Seen, Node) :-
    % Bind through call_delays before naming the atom (possible mode must not use \+ \+,
    % or oracle keys stay non-ground and miss core_answered/2).
    (   Mode == t -> call_delays(G, true) ; call_delays(G, _) ),
    core_lit_text(G, AtomText),
    (   member(S, Seen), S =@= G -> Node = rule(AtomText, '', [])
    ;   (   clause(G, Body),
            (   Mode == t -> call_delays(Body, true) ; call_delays(Body, _) )
        ->  (   Body == true -> Node = fact(AtomText)
            ;   core_rule_text(G, Body, RuleText),
                core_prove(Body, Mode, [G|Seen], Kids),
                Node = rule(AtomText, RuleText, Kids)
            )
        ;   Node = fact(AtomText)
        )
    ).

core_rule_text(G, _Body, Text) :-
    (   clause(G, B), core_lit_text(G, H), core_lit_text(B, BT),
        format(atom(Text), '~w :- ~w', [H, BT])
    ->  true
    ;   core_lit_text(G, Text)
    ).
