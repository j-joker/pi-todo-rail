# pi-todo-rail

> **A shared execution rail for you and Pi.**

One plan. Two operators.

Pi can plan the work, record context, and advance a step after verification. You can see every move, choose what is current, complete or reopen anything, and take over at any moment.

`pi-todo-rail` is not an agent’s private checklist. It is the visible control surface between human judgment and agent execution.

```text
*  Verify the fix                         Ctrl+R previous · Ctrl+N done · 2/4
```

When the current step passes verification, the rail hands off—quietly:

```text
x  Verify the fix
→  Run the regression suite
*  Run the regression suite
```

No hidden agent checklist. No project file. No second source of truth.

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

### The work is visible to both sides

The first unfinished task stays above the editor. Pi sees the same current step in its runtime context that you see in the rail. There is no hidden plan drifting away from the conversation.

### Pi advances; you steer

Pi is instructed to mark a task done only after it has been implemented **and** verified. You can set a different current task, complete or reopen an item, reorder the plan, or remove work that no longer matters.

### Human control is always one key away

The rail is ambient; `/todo` is the cockpit. Long plans collapse into one quiet line until you choose to inspect or intervene.

### Branches keep their own truth

Todo snapshots live in the Pi session. Fork a conversation, navigate the tree, or resume later—the shared list returns to the state that belongs to that branch.

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

## One list. Two operators.

```text
YOU   inspect · choose · complete · reopen · override
PI    plan · update · note · verify · advance
BOTH  share the same current task, progress, and branch history
```

Pi gets a branch-aware `todo` tool:

```text
list · add · update · start · done · block
remove · reorder · clear_done · replace
```

The collaboration contract is simple:

> Pi moves verified work forward. You can redirect it at any moment.

The current task is always derived from the first unfinished item—there is no separate “active” flag to drift out of sync between human and agent.

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

This makes the shared Todo list naturally follow Pi’s session semantics instead of inventing a parallel persistence model for either side.

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
