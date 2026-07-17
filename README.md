# pi-todo-rail

## The output scrolls away. The plan stays.

A model gives you a code review. Three findings. Clear priorities.

Then the conversation moves on.

One command. One patch. One more answer. The findings are still there—but now you have to go looking for them.

`pi-todo-rail` keeps the plan where the work happens: above the editor, visible to you and Pi.

You stop scrolling back to remember what comes next.

No scrollback archaeology. No hidden agent checklist. No second source of truth.

<p align="center">
  <img src="https://raw.githubusercontent.com/j-joker/pi-todo-rail/main/assets/decompose.gif" width="900" alt="Real Pi TUI capture showing review findings, a request to turn them into one Todo plan, and the background-free tree renderer creating a persistent execution rail">
</p>

<p align="center"><sub>Real Pi TUI · one sentence → a plan that stays</sub></p>

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

## Say it once

```text
Break these findings down into Todo tasks.
```

That is enough.

Pi turns the output into a shared plan. The first unfinished task appears above the editor. Progress stays beside it. When the conversation grows, the plan does not move.

```text
MODEL OUTPUT
P0  Reset tokens are logged
P1  Redirect URLs are unvalidated
P2  Reset tokens never expire

                         ↓

TODO RAIL
● Todo  Remove reset-token logging                    0/3
```

The answer remains evidence. The rail becomes execution.

When granularity matters, add the steps yourself. When the output is already clear, ask Pi to materialize it. Either way, you keep final control.

## One plan. Shared.

```text
MODEL  proposes · reviews · explains
YOU    choose · split · prioritize · redirect
PI     record · execute · verify · advance

SHARED current task · progress · context · branch history
```

Pi sees the same current task you see.

It is instructed to complete work only after implementation **and** verification. You can complete, reopen, reorder, remove, or replace any task at any time.

The first unfinished task is always current. There is no separate active flag to drift out of sync.

## Quiet by default

Most of the time, Todo Rail is one line:

```text
● Todo  Remove reset-token logging                    0/3
```

No dashboard. No permanent panel. Just the next thing that matters.

When you want control, run `/todo`:

<p align="center">
  <img src="https://raw.githubusercontent.com/j-joker/pi-todo-rail/main/assets/panel.png" width="900" alt="Real Ghostty capture of the Todo panel with the human selection on a different task from the shared current task">
</p>

The symbols do the work:

```text
›    selected
●    current
○    pending
✓    done

› ├─ ●  selected + current
  └─ ○  pending
```

The selection belongs to you. The current task belongs to the plan.

## Fast path

```text
Ctrl+N      Complete the current task
Ctrl+R      Return to the previous task
```

The shortcuts wrap Pi’s active editor component. If your terminal already owns either key, use `/todo` instead.

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

Pi gets the same plan through a branch-aware `todo` tool:

```text
list · add · update · start · done · block
remove · reorder · clear_done · replace
```

You steer. Pi advances verified work. Both operate on one list.

## The plan follows the conversation

Todo state lives in the Pi session—not in a project file or external database.

Fork a conversation and each branch keeps its own plan. Navigate the tree or resume later and the right Todo list returns with it.

The rail remembers the decision without pretending the conversation never branched.

## A handoff you can see

When the current task becomes done, the rail shows exactly what changed:

```text
x old  →  → next  →  * next
```

<p align="center">
  <img src="https://raw.githubusercontent.com/j-joker/pi-todo-rail/main/assets/handoff.gif" width="900" alt="Real Ghostty capture of Todo Rail completing one task and handing focus to the next">
</p>

The animation lasts about 200ms. It never blocks input. It only plays when completed work causes a real handoff.

Disable it when needed:

```bash
TODO_MOTION=0 pi
```

Also respected: `REDUCE_MOTION=1`, `PI_REDUCED_MOTION=1`, `CI`, and `TERM=dumb`. Session restore and tree navigation never animate.

<details>
<summary><strong>How state works</strong></summary>

State is stored in structured tool-result details and manual `todo-state` session entries. On restore, the extension reads the latest valid snapshot on the active branch.

No database is created. No project file is written. Todo Rail follows Pi’s session model instead of creating a parallel one.

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

Pi extensions run with the user’s full system permissions. Review extension source before installation.

`pi-todo-rail` does not start network services, spawn subprocesses, or write external state.

## License

MIT — [j-joker/pi-todo-rail](https://github.com/j-joker/pi-todo-rail)
