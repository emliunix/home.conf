% K4 - doc-verify:references + doc-verify:artifact + home.design translated by hand over the
% exported core facts (corpus-facts.pl, consulted first). `core.p(...)` becomes `p(...)`,
% `X in List` becomes memberchk/2, `$statuses` is home.design's param.

% spec_unresolved/4 has no facts at HEAD; declare it so calling it fails instead of raising.
:- ( current_predicate(spec_unresolved/4) -> true ; dynamic(spec_unresolved/4) ).
:- ( current_predicate(dangling/4) -> true ; dynamic(dangling/4) ).

statuses([draft, reviewed, 'pending-retro', landed]).

% ---- oracles: no answers this round, every atom undefined (negative loop, as K1) ----
:- table u/1.
u(A) :- tnot(u(A)).
:- dynamic answered/2.
oracle(A) :- answered(A, holds).
oracle(A) :- \+ answered(A, holds), \+ answered(A, fails), u(A).
problem_resolved(D, L)      :- oracle(problem_resolved(D, L)).
verification_falsifies(D, S) :- oracle(verification_falsifies(D, S)).
% purpose/3 (artifact's choose oracle) is declared but no constraint in these three modules uses it.

% ---- rules (doc-verify:artifact) ----
:- table top/2, goal_section/2, has_status_word/1.
top(D, S)           :- section(D, S, _), depth(D, S, 2).
goal_section(D, S)  :- top(D, S), heading(D, S, 'Goal').
has_status_word(D)  :- meta(D, status, _).

% ---- rules (home.design) ----
:- table problem_section/2, rationale_section/2, review_section/2, status_section/2,
         verification_design_section/2, one_word_status/1.
problem_section(D, S)             :- top(D, S), heading(D, S, 'Problem statement').
rationale_section(D, S)           :- top(D, S), heading(D, S, 'Rationale').
review_section(D, S)              :- top(D, S), heading(D, S, 'Review').
status_section(D, S)              :- top(D, S), heading(D, S, 'Status').
verification_design_section(D, S) :- top(D, S), heading(D, S, 'Verification design').
one_word_status(D)                :- has_status_word(D), meta(D, status_words, '1').

% ---- constraints: constraint(Name, Profiles, D, Forall, require|forbid, Goal) ----
% D is the document variable, so a binding can be scoped to the documents a module governs.
constraint('references-resolve', all, D, ref(D, S, T, link), forbid, dangling(D, S, T, link)).
constraint('paths-resolve', all, D, ref(D, S, T, path), forbid, dangling(D, S, T, path)).
constraint('specs-resolve', all, D, ref(D, S, T, spec), forbid, spec_unresolved(D, S, T, revision)).
constraint('spec-paths-resolve', all, D, ref(D, S, T, spec), forbid, spec_unresolved(D, S, T, path)).
constraint('artifact-has-status', all, D, meta(D, kind, _), require, has_status_word(D)).
constraint('artifact-status-in-vocabulary', all, D, meta(D, status, W), require, (statuses(L), memberchk(W, L))).
constraint('artifact-has-goal', all, D, meta(D, kind, _), require, goal_section(D, _)).
constraint('design-has-problem-statement', all, D, meta(D, kind, design), require, problem_section(D, _)).
constraint('design-has-rationale', all, D, meta(D, kind, design), require, rationale_section(D, _)).
constraint('design-has-review', all, D, meta(D, kind, design), require, review_section(D, _)).
constraint('design-has-status-section', all, D, meta(D, kind, design), require, status_section(D, _)).
constraint('design-status-is-one-word', all, D, status_section(D, _), require, one_word_status(D)).
constraint('design-problem-resolved', promotion, D, (problem_section(D, P), rationale_section(D, R)), require, problem_resolved(D, [P, R])).
constraint('design-verification-falsifies', promotion, D, verification_design_section(D, S), require, verification_falsifies(D, S)).

% Truth value under the WFS (as K1).
tv(G, T) :-
    (   call_delays(G, true) -> T = true
    ;   call_delays(G, _)    -> T = undefined
    ;   T = false ).

% status(Kind, GoalTruth, BindingStatus)
status(require, true, satisfied).
status(require, false, violated).
status(require, undefined, undefined).
status(forbid, true, violated).
status(forbid, false, satisfied).
status(forbid, undefined, undefined).

% Scope: `all` applies every constraint to every exported document; `design` only to the
% documents .doc-verify.yaml binds to these modules (artifact_kind design).
in_scope(all, _).
in_scope(design, D) :- meta(D, kind, design).

% One row per constraint: Name-Profile-counts(Satisfied, Violated, Undefined), over the distinct
% forall bindings.
evaluate(Scope, Name, Prof, counts(NS, NV, NU)) :-
    constraint(Name, Prof, D, Forall, Kind, Goal),
    findall(St, ( distinct(Forall, Forall), in_scope(Scope, D), tv(Goal, T), status(Kind, T, St) ), Sts),
    count(satisfied, Sts, NS), count(violated, Sts, NV), count(undefined, Sts, NU).
count(X, L, N) :- include(==(X), L, L1), length(L1, N).

% The violated bindings, for comparison with the TypeScript checker.
violation(Scope, Name, Forall) :-
    constraint(Name, _, D, Forall, Kind, Goal),
    distinct(Forall, Forall), in_scope(Scope, D), tv(Goal, T), status(Kind, T, violated).

evaluate_all(Scope, Rows) :- findall(N-P-C, evaluate(Scope, N, P, C), Rows).
