"""lanepool's runner: one control loop, many effects in flight."""

import asyncio


async def start_effects(state, ready, outstanding, effects):
    """Start every ready task's effect before waiting on any landing (T1)."""
    while ready:
        task = ready.pop()
        outstanding[task] = asyncio.create_task(effects[task](state.inputs(task)))


def barrier_check(state, waiting):
    """At a landing, admit each waiting task whose inputs are now all in the store (T2)."""
    admitted = [task for task in waiting if all(dep in state.store for dep in state.deps[task])]
    for task in admitted:
        waiting.remove(task)
    return admitted


async def run_one_control(state, effects):
    """The single control loop: the only code that writes the configuration (P3, T3)."""
    ready = set(state.initial_ready())
    waiting = set(state.tasks) - ready
    outstanding = {}
    while ready or outstanding:
        await start_effects(state, ready, outstanding, effects)
        done, _ = await asyncio.wait(outstanding.values(), return_when=asyncio.FIRST_COMPLETED)
        for task, future in list(outstanding.items()):
            if future in done:
                state.store[task] = future.result()
                del outstanding[task]
        ready.update(barrier_check(state, waiting))
    return state.store
