import type { Theme } from "@earendil-works/pi-coding-agent";
import type { Todo } from "./state.ts";

export type TodoVisualState = "done" | "current" | "pending";

export function currentTodoId(todos: readonly Todo[]): number | undefined {
	return todos.find((todo) => !todo.done)?.id;
}

export function todoProgress(todos: readonly Todo[]): { done: number; total: number; label: string } {
	const total = todos.length;
	const done = todos.filter((todo) => todo.done).length;
	return { done, total, label: `${done}/${total}` };
}

export function todoVisualState(todo: Todo, currentId: number | undefined): TodoVisualState {
	if (todo.done) return "done";
	if (todo.id === currentId) return "current";
	return "pending";
}

export function todoGlyph(theme: Theme, state: TodoVisualState): string {
	if (state === "done") return theme.fg("success", "✓");
	if (state === "current") return theme.fg("accent", "●");
	return theme.fg("muted", "○");
}

export function todoTitle(theme: Theme, progress?: string, state: "active" | "done" = "active"): string {
	const glyph = state === "done" ? theme.fg("success", "✓") : theme.fg("accent", "●");
	const label = theme.fg("toolTitle", theme.bold("Todo"));
	return `${glyph} ${label}${progress ? ` ${theme.fg("dim", progress)}` : ""}`;
}

export function todoListLine(
	theme: Theme,
	todo: Todo,
	currentId: number | undefined,
	connector: "├─" | "└─" | "" = "",
	selected = false,
): string {
	const state = todoVisualState(todo, currentId);
	const branch = connector ? `${theme.fg("dim", connector)} ` : "";
	const glyph = todoGlyph(theme, state);
	const id = theme.fg("dim", `#${todo.id}`);
	const textTone = state === "done" ? "dim" : selected || state === "current" ? "text" : "muted";
	const text = theme.fg(textTone, todo.text);
	const note = todo.note ? theme.fg("dim", `  ${todo.note}`) : "";
	return `${branch}${glyph} ${id} ${text}${note}`;
}

/** Theme-aware tree. Collapsed mode prioritizes unfinished work and summarizes the rest. */
export function todoTree(todos: readonly Todo[], theme: Theme, expanded: boolean, limit = 4): string {
	if (todos.length === 0) return theme.fg("muted", "No todos");

	const currentId = currentTodoId(todos);
	const unfinished = todos.filter((todo) => !todo.done);
	const visible = expanded ? [...todos] : unfinished.slice(0, limit);
	const hiddenPending = expanded ? 0 : Math.max(0, unfinished.length - visible.length);
	const hiddenDone = expanded ? 0 : todos.length - unfinished.length;
	const hasSummary = hiddenPending > 0 || hiddenDone > 0;
	const lines = visible.map((todo, index) => {
		const isLast = index === visible.length - 1 && !hasSummary;
		return todoListLine(theme, todo, currentId, isLast ? "└─" : "├─");
	});

	if (hasSummary) {
		const parts: string[] = [];
		if (hiddenPending > 0) parts.push(`${hiddenPending} more`);
		if (hiddenDone > 0) parts.push(`${hiddenDone} done`);
		lines.push(`${theme.fg("dim", "└─")} ${theme.fg("muted", `… ${parts.join(" · ")}`)}`);
	}

	return lines.join("\n");
}
