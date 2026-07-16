# pi-todo-rail

> **Turn model output into a plan you and Pi can execute.**

Model proposes. You decompose. Both move the work forward.

A code review produces findings. A deep explanation produces concepts and open questions. A planning session produces risks, experiments, and decisions. You decide what deserves a Todo, how small it should be, and what comes first.

`pi-todo-rail` keeps that human-shaped plan visible to both sides. Pi can record context and advance verified work; you can inspect, steer, complete, reopen, or take over at any moment.

<p align="center">
  <img src="https://raw.githubusercontent.com/j-joker/pi-todo-rail/main/assets/decompose.gif" width="900" alt="Real Pi terminal capture showing model review output, a human asking Pi to turn it into a Todo plan, and Pi materializing three shared tasks">
</p>

<p align="center"><sub>Real Pi TUI · model output → human direction → shared execution plan</sub></p>

No hidden agent checklist. No project file. No second source of truth.

## The missing step between output and action

Most Todo tools begin after decomposition—when someone already knows exactly what the tasks are. `pi-todo-rail` begins one step earlier, inside the conversation.

```text
CODE REVIEW   findings      → choose → split → fix → verify
LEARNING      big concept   → map → question → practice → teach back
PLANNING      model output  → judge → sequence → execute → revise
```

The model supplies breadth. The human supplies judgment and granularity. The rail turns the result into shared execution state.

You can add the chosen steps directly with `/todo add`, shape them in the panel, or ask Pi to materialize your decomposition. The important part is that the plan remains visible and editable after the conversation moves on.

## Install

```bash
pi install npm:pi-todo-rail
```

Or pin the GitHub release:

```bash
pi install git:github.com/j-joker/pi-todo-rail@v0.1.2
```

Try it without installing:

```bash
pi -e npm:pi-todo-rail
```

## Why it feels different

### Human judgment shapes the plan

Model output is input, not authority. You choose which review findings matter, where a concept needs another learning step, and whether a task should be split, reordered, or discarded.

### The shaped plan is visible to both sides

The first unfinished task stays above the editor. Pi sees the same human-curated current step in its runtime context that you see in the rail. There is no hidden plan drifting away from the conversation.

### Pi advances; you steer

Pi is instructed to mark a task done only after it has been implemented **and** verified. You can set a different current task, complete or reopen an item, reorder the plan, or remove work that no longer matters.

### Human control is always one key away

The rail is ambient; `/todo` is the cockpit. Long plans collapse into one quiet line until you choose to inspect or intervene.

### Branches keep their own truth

Todo snapshots live in the Pi session. Fork a conversation, navigate the tree, or resume later—the shared list returns to the state that belongs to that branch.

## The panel

Run `/todo`:

<p align="center">
  <img src="https://raw.githubusercontent.com/j-joker/pi-todo-rail/main/assets/panel.png" width="900" alt="Real Pi terminal capture of the Todo panel with the human selection on a different task from the shared current task">
</p>

The screenshot is deliberate: `*` stays on the shared current task while `>` follows the human selection.

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

## One plan. Three roles.

```text
MODEL  expands · reviews · explains · proposes
YOU    judge · decompose · prioritize · redirect
PI     record · execute · verify · advance

SHARED current task · progress · context · branch history
```

Pi gets a branch-aware `todo` tool:

```text
list · add · update · start · done · block
remove · reorder · clear_done · replace
```

The collaboration contract is simple:

> The model generates possibilities. You shape the plan. Pi helps execute it.

The current task is always derived from the first unfinished item—there is no separate “active” flag to drift out of sync between human and agent.

## Motion with a reason

The handoff animation exists to explain causality, not decorate the terminal:

```text
x old  →  → next  →  * next
```

It runs for about 200ms, never blocks input, and only plays when the previous current task has actually become done.

<p align="center">
  <img src="https://raw.githubusercontent.com/j-joker/pi-todo-rail/main/assets/handoff.gif" width="900" alt="Real Pi terminal capture of the Todo rail handing off from a verified task to the next current task">
</p>

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
