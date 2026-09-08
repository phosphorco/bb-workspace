# Host daemon interruption and automatic recovery

Restart Resume is enabled in the isolated preview with automatic recovery on. This supersedes its initial held status in the community activation inventory. No core or plugin source repair was required by the completed live trials; the existing implementation resumed every tested interruption.

## Verified behavior

| Trial | Interruption | Outcome |
| --- | --- | --- |
| One coding task | Graceful daemon SIGTERM after saved implementation/tests | One automatic continuation in 2.303 seconds; resumed turn in 5.434 seconds; task finished, 9 agent tests and 7 independent checks passed |
| Two concurrent batch tasks | Daemon SIGKILL while both tool commands were running | Both resumed automatically; continuation requests in 5.400–5.415 seconds |
| The same two tasks during recovery | Second daemon SIGKILL after both replacement workers started and progressed | Both resumed again; continuation requests in 8.350–8.360 seconds; both finished with 180 independently verified results |

All four hard-crash recovery claims were sent once with no retry error. Old tool processes were absent at the two-second observation after each crash. Each task had three workers total, one final completion, and no remaining worker. Saved records, source inputs and the supplied processor were preserved. The agents independently verified their reports and wrote verification notes. Background-job failure/completion notices also occurred; these were not duplicate restart-resume prompts. There were no operator follow-up, retry, or resume messages.

Core persisted `host-daemon-restarted` interruptions; Restart Resume detected them and submitted continuation messages to the same conversations. The preview server and normal BB process remained running throughout. The existing plugin unit suite passed 13/13.

## Evidence and inspection

[closeout.json](closeout.json) records the exact child commits, source hashes, per-subject checks, timing definitions and local evidence hashes. Detailed logs, fixture outputs, event records and one-off intervention scripts remain in ignored `runs/`. Those scripts embed historical process/thread IDs and are evidence, not reusable operational commands.

The first disposable project/thread was deleted. These completed preview threads and their local fixture directories remain for Cole to inspect:

- [Alpha](https://rosetta.banjo-tint.ts.net:40888/projects/proj_gsrqzwxaki/threads/thr_gk6ackcjc7)
- [Beta](https://rosetta.banjo-tint.ts.net:40888/projects/proj_gsrqzwxaki/threads/thr_3enappe4kn)

There are no active test workers or observers. Runtime configuration and plugin databases remain operator-owned and are not committed. A fresh installation still needs the explicit plugin activation; a Git checkout alone does not enable it.

## Limits

The batch fixture deliberately uses SQLite checkpoints and a single-instance lock. This verifies automatic continuation, worker cleanup and preserved local progress; it does not prove exactly-once arbitrary external actions. Machine reboot, complete server restart and UI recovery usability remain untested. These were controlled mechanism trials, not naive usability sessions or broad recovery certification. No normal-host promotion is included.
