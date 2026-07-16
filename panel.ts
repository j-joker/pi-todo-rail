import type { Theme } from "@earendil-works/pi-coding-agent";
import { type KeybindingsManager, Key, matchesKey, truncateToWidth } from "@earendil-works/pi-tui";
import type { Todo } from "./state.ts";

export type TodoPanelAction =
	| { type: "close" }
	| { type: "focus"; id: number }
	| { type: "toggle"; id: number };

function prettyKey(key: string | undefined, fallback: string): string {
	if (!key) return fallback;
	const names: Record<string, string> = { up: "↑", down: "↓", enter: "↵", return: "↵", escape: "Esc", esc: "Esc" };
	return key
		.split("+")
		.map((part) => names[part] ?? (part.length === 1 ? part.toUpperCase() : `${part[0]?.toUpperCase()}${part.slice(1)}`))
		.join("+");
}

/** Minimal manual control: select, focus, toggle done, close. */
export class TodoPanel {
	private selected = 0;
	private readonly maxVisible = 10;

	constructor(
		private readonly todos: Todo[],
		private readonly theme: Theme,
		private readonly keybindings: KeybindingsManager,
		private readonly done: (action: TodoPanelAction) => void,
		selectedId?: number,
	) {
		const index =
			selectedId === undefined
				? todos.findIndex((todo) => !todo.done)
				: todos.findIndex((todo) => todo.id === selectedId);
		this.selected = Math.max(0, index);
	}

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "tui.select.cancel")) return this.done({ type: "close" });
		if (this.keybindings.matches(data, "tui.select.up")) return this.moveSelection(-1);
		if (this.keybindings.matches(data, "tui.select.down")) return this.moveSelection(1);
		if (this.keybindings.matches(data, "tui.select.pageUp")) return this.moveSelection(-this.maxVisible);
		if (this.keybindings.matches(data, "tui.select.pageDown")) return this.moveSelection(this.maxVisible);

		const todo = this.todos[this.selected];
		if (!todo) return;
		if (this.keybindings.matches(data, "tui.select.confirm")) return this.done({ type: "focus", id: todo.id });
		if (matchesKey(data, Key.space)) return this.done({ type: "toggle", id: todo.id });
	}

	render(width: number): string[] {
		const renderWidth = Math.max(1, width);
		const theme = this.theme;
		const currentId = this.todos.find((todo) => !todo.done)?.id;
		const lines: string[] = [""];

		if (this.todos.length === 0) {
			lines.push(truncateToWidth(`  ${theme.fg("dim", "No todos")}`, renderWidth, ""));
		} else {
			const start = Math.max(0, Math.min(this.selected - Math.floor(this.maxVisible / 2), this.todos.length - this.maxVisible));
			const end = Math.min(this.todos.length, start + this.maxVisible);
			for (let index = start; index < end; index++) {
				const todo = this.todos[index]!;
				const selected = index === this.selected;
				const selection = selected ? theme.fg("accent", ">") : " ";
				const status = todo.done ? theme.fg("dim", "x") : todo.id === currentId ? theme.fg("accent", "*") : " ";
				const text = theme.fg(todo.done ? "dim" : selected || todo.id === currentId ? "text" : "muted", todo.text);
				const note = todo.note ? theme.fg("dim", ` (${todo.note})`) : "";
				lines.push(truncateToWidth(`${selection} ${status}  ${text}${note}`, renderWidth, ""));
			}
			if (this.todos.length > this.maxVisible) {
				lines.push(truncateToWidth(`  ${theme.fg("dim", `${start + 1}–${end} / ${this.todos.length}`)}`, renderWidth, ""));
			}
		}

		const up = prettyKey(this.keybindings.getKeys("tui.select.up")[0], "↑");
		const down = prettyKey(this.keybindings.getKeys("tui.select.down")[0], "↓");
		const enter = prettyKey(this.keybindings.getKeys("tui.select.confirm")[0], "↵");
		const cancel = prettyKey(this.keybindings.getKeys("tui.select.cancel")[0], "Esc");
		lines.push("");
		lines.push(
			truncateToWidth(
				`  ${theme.fg("text", `${up}/${down}`)} ${theme.fg("dim", "select")}   ${theme.fg("text", enter)} ${theme.fg("dim", "current")}   ${theme.fg("text", "Space")} ${theme.fg("dim", "done/reopen")}   ${theme.fg("text", cancel)} ${theme.fg("dim", "close")}`,
				renderWidth,
				"",
			),
		);
		lines.push("");
		return lines;
	}

	invalidate(): void {}

	private moveSelection(delta: number): void {
		if (this.todos.length === 0) return;
		this.selected = Math.max(0, Math.min(this.todos.length - 1, this.selected + delta));
	}
}
