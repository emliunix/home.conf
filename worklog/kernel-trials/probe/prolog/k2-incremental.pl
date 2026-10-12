% K2 - incremental tabling: answers asserted between rounds update the tables without
% abolish_all_tables. Two copies of the same program side by side:
%   *_i  - answered_i/2 is dynamic AND incremental, every table is `as incremental`;
%   *_s  - the negative control: plain dynamic answered_s/2 and plain tables.
% A third copy (*_t) differs from *_i only in that the oracle wrapper is itself tabled; it is
% kept because it exposes a reporting anomaly of call_delays/2 (see the results file).

sect(a). sect(b).

% ---- incremental program ----
% Leaf encoding as in K1 (negative loop through tnot). u_i/1 has no dynamic dependency, but a
% table that depends on it must be incremental, so it is declared incremental too.
:- table u_i/1 as incremental.
u_i(A) :- tnot(u_i(A)).
% The incremental declaration on the dynamic predicate is what makes assertz/retract invalidate
% the dependent tables.
:- dynamic([answered_i/2], [incremental(true)]).
oracle_i(A) :- answered_i(A, holds).
oracle_i(A) :- \+ answered_i(A, holds), \+ answered_i(A, fails), u_i(A).
:- table ok_i/1 as incremental.
ok_i(S) :- sect(S), oracle_i(o(S)).
:- table violated_i/1 as incremental.
violated_i(c1) :- tnot(ok_i(a)).
violated_i(c2) :- tnot(ok_i(b)).

% ---- negative control: same program, nothing incremental ----
:- table u_s/1.
u_s(A) :- tnot(u_s(A)).
:- dynamic answered_s/2.
oracle_s(A) :- answered_s(A, holds).
oracle_s(A) :- \+ answered_s(A, holds), \+ answered_s(A, fails), u_s(A).
:- table ok_s/1.
ok_s(S) :- sect(S), oracle_s(o(S)).
:- table violated_s/1.
violated_s(c1) :- tnot(ok_s(a)).

% ---- variant: tabled oracle wrapper, otherwise as *_i ----
:- table u_t/1 as incremental.
u_t(A) :- tnot(u_t(A)).
:- dynamic([answered_t/2], [incremental(true)]).
:- table oracle_t/1 as incremental.
oracle_t(A) :- answered_t(A, holds).
oracle_t(A) :- \+ answered_t(A, holds), \+ answered_t(A, fails), u_t(A).
:- table ok_t/1 as incremental.
ok_t(S) :- sect(S), oracle_t(o(S)).
:- table violated_t/1 as incremental.
violated_t(c1) :- tnot(ok_t(a)).

% ---- helpers ----
% tv/2 reads the truth value from call_delays/2; rtv/2 reads it from the residual program
% (true when the residual program is empty or is just `G :- true`). They should always agree.
tv(G, T) :-
    (   call_delays(G, true) -> T = true
    ;   call_delays(G, _)    -> T = undefined
    ;   T = false ).
rtv(G, T) :-
    (   \+ G -> T = false
    ;   call_residual_program(G, P), ( P == [] -> true ; P = [(H :- true)], H =@= G ) -> T = true
    ;   T = undefined ).
