# pi-todo-rail

> **A live execution rail for Pi.**

Plans are cheap. Staying on the right step is the work.

`pi-todo-rail` keeps one verified next action in sight, lets Pi close the loop when the work is actually done, and restores the right plan when the session branches.

```text
*  Verify the fix                         Ctrl+R previous · Ctrl+N done · 2/4
```

When the current step passes verification, the rail hands off—quietly:

```text
x  Verify the fix
→  Run the regression suite
*  Run the regression suite
```

No dashboard. No project file. No second source of truth.

## Install

```bash
pi install npm:pi-todo-rail
```

Or pin the GitHub release:

```bash
pi install git:github.com/j-joker/pi-todo-rail@v0.1.0
```

Try it without installing:

```bash
pi -e npm:pi-todo-rail
```

## Why it feels different

### The current step never disappears

The first unfinished task stays above the editor. Long plans collapse into one quiet line; progress remains visible even in narrow terminals.

### “Done” means verified

Pi is instructed to advance a task only after it has been implemented **and** verified. The user can still reopen, reorder, or override anything from the panel.

### Branches keep their own truth

Todo snapshots live in the Pi session. Fork a conversation, navigate the tree, or resume later—the list returns to the state that belongs to that branch.

## The panel

Run `/todo`:

```text
  x  Ship the parser
> *  Verify the fix
     Write the changelog

↑/↓ select   Enter current   Space done/reopen   Esc close
```

The markers have one job each:

```text
>    selected
*    current
x    done
```

They compose without ambiguity:

```text
> *  selected + current
```

## Fast path

```text
Ctrl+N      Complete the current task
Ctrl+R      Return to the previous task
```

The shortcuts wrap Pi’s active editor component. If your terminal workflow already owns either key, use `/todo` instead.

## Commands

```text
/todo                         Open the panel
/todo add <text>              Add a task
/todo list                    Print the list
/todo done <ID>               Complete or reopen
/todo rm <ID>                 Remove
/todo clear-done              Clear completed tasks
/todo reset                   Reset after confirmation
```

## Built for the agent loop

The extension registers a branch-aware `todo` tool:

```text
list · add · update · start · done · block
remove · reorder · clear_done · replace
```

The important rule is simple:

> Implement. Verify. Then mark done.

The current task is always derived from the first unfinished item—there is no separate “active” flag to drift out of sync.

## Motion with a reason

The handoff animation exists to explain causality, not decorate the terminal:

```text
x old  →  → next  →  * next
```

It runs for about 200ms, never blocks input, and only plays when the previous current task has actually become done.

Disable it when needed:

```bash
TODO_MOTION=0 pi
```

Also respected: `REDUCE_MOTION=1`, `PI_REDUCED_MOTION=1`, `CI`, and `TERM=dumb`. Session restore and tree navigation never animate.

<details>
<summary><strong>How state works</strong></summary>

State is stored in structured tool-result details and manual `todo-state` session entries. No database or project file is created. On restore, the extension reads the latest valid snapshot on the active branch.

This makes the Todo list naturally follow Pi’s session semantics instead of inventing a parallel persistence model.

</details>

<details>
<summary><strong>Development</strong></summary>

Requires Node.js 22.19+ and Pi 0.80+.

```bash
git clone https://github.com/j-joker/pi-todo-rail.git
cd pi-todo-rail
npm install
npm test
pi -e .
```

Validate the release tarball:

```bash
npm run pack:check
```

</details>

## Security

Pi extensions run with the user’s full system permissions. Review extension source before installation. `pi-todo-rail` does not start network services, spawn subprocesses, or write external state.

## License

MIT — [j-joker/pi-todo-rail](https://github.com/j-joker/pi-todo-rail)
