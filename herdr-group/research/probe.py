#!/usr/bin/env python3
"""Probe: can a plain process become a herdr agent seat and receive `agent prompt`?"""
import json, os, socket, sys, time

SOCK = os.environ["HERDR_SOCKET_PATH"]
PANE = os.environ["HERDR_PANE_ID"]
SOURCE = "herdr-group:probe"

def call(method, params):
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.connect(SOCK)
    s.sendall((json.dumps({"id": f"probe:{time.time_ns()}", "method": method, "params": params}) + "\n").encode())
    buf = b""
    while not buf.endswith(b"\n"):
        chunk = s.recv(65536)
        if not chunk:
            break
        buf += chunk
    s.close()
    return json.loads(buf or b"{}")

def report(state):
    return call("pane.report_agent", {"pane_id": PANE, "source": SOURCE, "agent": os.environ.get("HERDR_AGENT", "groupchat"),
                                     "state": state, "seq": time.time_ns()})

print("report idle ->", report("idle"), flush=True)
for line in sys.stdin:
    print(f"GOT: {line.rstrip()!r}", flush=True)
    report("working"); time.sleep(0.3); report("idle")
