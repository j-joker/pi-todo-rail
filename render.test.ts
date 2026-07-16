import assert from "node:assert/strict";
import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { KeybindingsManager, TUI_KEYBINDINGS, visibleWidth } from "@earendil-works/pi-tui";
import { formatTodoContext } from "./context.ts";
import { TodoPanel, type TodoPanelAction } from "./panel.ts";
import { type Todo, TodoStore } from "./state.ts";
import { registerTodoTool, styledList } from "./tool.ts";
import { clearTodoWidget, isTodoMotionEnabled, updateTodoWidget } from "./widget.ts";

const theme = {
	fg: (_color: string, text: string) => text,
	bg: (_color: string, text: string) => text,
	bold: (text: string) => text,
	italic: (text: string) => text,
	strikethrough: (text: string) => text,
} as unknown as Theme;

const todos: Todo[] = [
	{ id: 1, text: "Inspect the current terminal layout", done: true },
	{ id: 2, text: "Polish the selected execution step", done: false, note: "Keep the hierarchy quiet" },
	{ id: 3, text: "Verify narrow widths and 中文内容", done: false, note: "Waiting for a representative terminal" },
	{ id: 4, text: "Reload the extension", done: false },
];

const keybindings = new KeybindingsManager(TUI_KEYBINDINGS);

// Dynamic model context stays compact and follows the first unfinished todo.
assert.equal(formatTodoContext([]), undefined);
assert.match(formatTodoContext(todos) ?? "", /Current todo: #2 Polish the selected execution step.*\(1\/4 done\)/);
assert.match(formatTodoContext(todos.map((todo) => ({ ...todo, done: true }))) ?? "", /All 4 todos are complete/);

// Panel stays within every width.
for (const width of [12, 24, 40, 60, 80, 120]) {
	const panel = new TodoPanel(todos, theme, keybindings, () => {}, 2);
	for (const line of panel.render(width)) {
		assert.ok(visibleWidth(line) <= width, `panel line exceeded ${width} columns: ${line}`);
	}
}

// Empty state and manual actions.
const emptyPanel = new TodoPanel([], theme, keybindings, () => {});
assert.ok(emptyPanel.render(60).some((line) => line.includes("No todos")));

let action: TodoPanelAction | undefined;
const defaultPanel = new TodoPanel(todos, theme, keybindings, (next) => {
	action = next;
});
assert.ok(
	defaultPanel.render(80).some((line) => line.includes("> *  Polish the selected execution step")),
	"selected current row should render as > *",
);
defaultPanel.handleInput("\r");
assert.deepEqual(action, { type: "focus", id: 2 }, "panel should open on the current item");

action = undefined;
const actionPanel = new TodoPanel(todos, theme, keybindings, (next) => {
	action = next;
}, 3);
actionPanel.handleInput("\r");
assert.deepEqual(action, { type: "focus", id: 3 });
action = undefined;
actionPanel.handleInput(" ");
assert.deepEqual(action, { type: "toggle", id: 3 });

// The current item is derived, but users can switch it by moving one before it.
const store = new TodoStore();
store.replace(todos.map((todo) => ({ text: todo.text, done: todo.done, note: todo.note })));
assert.equal(store.current()?.text, "Polish the selected execution step");
store.focus(3);
assert.equal(store.current()?.text, "Verify narrow widths and 中文内容");
store.focus(1);
assert.equal(store.current()?.text, "Inspect the current terminal layout");
assert.equal(store.current()?.done, false, "focusing a done task reopens it");
store.setDone(store.current()!.id, true);
assert.equal(store.current()?.text, "Verify narrow widths and 中文内容");

// Old v1 snapshots (status-based) still restore.
store.restore([
	{
		type: "custom",
		customType: "todo-state",
		data: {
			version: 1,
			todos: [
				{ id: 1, text: "old done", status: "done" },
				{ id: 2, text: "old active", status: "active" },
				{ id: 3, text: "old blocked", status: "blocked", note: "reason" },
			],
			nextId: 4,
		},
	},
]);
assert.equal(store.getAll().length, 3);
assert.equal(store.current()?.text, "old active");
assert.equal(store.getAll()[2]?.note, "reason");

type WidgetFactory = ((tui: unknown, theme: Theme) => { render(width: number): string[] }) | undefined;

// The rail shows the first unfinished task plus progress.
let widgetFactory: WidgetFactory;
const ctx = {
	ui: {
		setWidget: (_key: string, factory: WidgetFactory) => {
			widgetFactory = factory;
		},
	},
} as unknown as ExtensionContext;
updateTodoWidget(ctx, todos, { animate: false });
assert.ok(widgetFactory, "widget factory was not registered");
const widget = widgetFactory!({}, theme);
for (const width of [10, 24, 40, 80]) {
	const lines = widget.render(width);
	assert.equal(lines.length, 1, "widget should be a single line");
	for (const line of lines) {
		assert.ok(visibleWidth(line) <= width, `widget line exceeded ${width} columns: ${line}`);
	}
}
assert.ok(widget.render(80)[0]?.includes("Polish the selected"), "widget should show the first unfinished task");
assert.ok(widget.render(80)[0]?.trimStart().startsWith("*"), "widget should use * for the current todo");
assert.ok(widget.render(80)[0]?.includes("1/4"), "widget should show progress");
assert.ok(widget.render(10)[0]?.includes("1/4"), "narrow widget should preserve progress");
assert.ok(widget.render(80)[0]?.includes("Ctrl+R"), "widget should show the previous-item shortcut");
assert.ok(widget.render(80)[0]?.includes("Ctrl+N"), "widget should show the direct-complete shortcut");

// All done → widget clears.
let cleared = false;
const clearCtx = {
	ui: {
		setWidget: (_key: string, factory: unknown) => {
			if (factory === undefined) cleared = true;
		},
	},
} as unknown as ExtensionContext;
updateTodoWidget(clearCtx, todos.map((todo) => ({ ...todo, done: true })), { animate: false });
assert.ok(cleared, "widget should clear when everything is done");

// A verified current-item completion hands off to the next item in three non-blocking frames.
assert.equal(isTodoMotionEnabled({ TERM: "xterm-256color" }), true);
assert.equal(isTodoMotionEnabled({ TODO_MOTION: "0", TERM: "xterm-256color" }), false);
assert.equal(isTodoMotionEnabled({ REDUCE_MOTION: "1", TERM: "xterm-256color" }), false);
assert.equal(isTodoMotionEnabled({ CI: "1", TERM: "xterm-256color" }), false);
assert.equal(isTodoMotionEnabled({ TERM: "dumb" }), false);

let animationFactory: WidgetFactory;
let requestedRenders = 0;
const animationCtx = {
	ui: {
		setWidget: (_key: string, factory: WidgetFactory) => {
			animationFactory = factory;
		},
	},
} as unknown as ExtensionContext;
const beforeHandoff: Todo[] = [
	{ id: 21, text: "Finish implementation", done: false },
	{ id: 22, text: "Run verification", done: false },
];
updateTodoWidget(animationCtx, beforeHandoff, { animate: false });
updateTodoWidget(
	animationCtx,
	beforeHandoff.map((todo) => (todo.id === 21 ? { ...todo, done: true } : todo)),
	{ animate: true, frameDurationMs: 30, env: { TERM: "xterm-256color" } },
);
assert.ok(animationFactory, "animated widget factory should be registered");
const animatedWidget = animationFactory!({ requestRender: () => requestedRenders++ }, theme);
assert.ok(animatedWidget.render(80)[0]?.includes("x  Finish implementation"), "handoff should acknowledge the completed item first");
await new Promise((resolve) => setTimeout(resolve, 40));
assert.ok(animatedWidget.render(80)[0]?.includes("→  Run verification"), "handoff should point to the next item");
await new Promise((resolve) => setTimeout(resolve, 40));
assert.ok(animatedWidget.render(80)[0]?.includes("*  Run verification"), "handoff should settle on the new current item");
assert.ok(requestedRenders >= 2, "animation should request a render for each transition");
clearTodoWidget(animationCtx);

// Collapsed tool list keeps the current item first and folds done history into a count.
const mixed: Todo[] = [
	{ id: 1, text: "done one", done: true },
	{ id: 2, text: "done two", done: true },
	{ id: 3, text: "current task", done: false },
	{ id: 4, text: "next a", done: false },
	{ id: 5, text: "next b", done: false },
	{ id: 6, text: "next c", done: false },
	{ id: 7, text: "next d", done: false },
	{ id: 8, text: "done three", done: true },
];
const collapsed = styledList(mixed, false);
const collapsedLines = collapsed.split("\n");
assert.ok(collapsedLines[0]?.includes("*") && collapsedLines[0]?.includes("current task"), "collapsed list should lead with the current marker");
assert.equal(collapsedLines.length, 5, "collapsed list should show 4 unfinished items plus a summary");
assert.ok(!collapsed.includes("done one"), "collapsed list should hide done history");
assert.ok(collapsed.includes("x 3"), "collapsed summary should count hidden done items");
assert.ok(collapsed.includes("+1 more"), "collapsed summary should count remaining unfinished items");

const expandedList = styledList(mixed, true);
assert.equal(expandedList.split("\n").length, 8, "expanded list should show every item in order");
assert.ok(expandedList.includes("x  #1 done one"), "expanded list should keep done markers");
assert.equal(styledList(mixed.map((todo) => ({ ...todo, done: true })), false), "All done");

// Store errors are model-facing and stay English.
assert.throws(() => new TodoStore().remove(99), /Todo #99 not found\./);
assert.throws(() => new TodoStore().add("   "), /Todo text must not be empty\./);

// Tool cards render compact call rows and structured, state-oriented results.
let registeredTool: any;
const toolStore = new TodoStore();
registerTodoTool(
	{ registerTool: (definition: unknown) => { registeredTool = definition; } } as unknown as ExtensionAPI,
	toolStore,
	() => {},
);
assert.ok(registeredTool, "todo tool should register");
assert.equal(registeredTool.renderShell, "self", "todo tool should bypass Pi's colored default shell");
const callText = registeredTool.renderCall({ action: "add", text: "Verify tool card" }, theme).render(80).join("\n");
assert.match(callText, /Todo\s+add/);
assert.ok(!callText.includes("Verify tool card"), "call row should not repeat the todo text");

const addResult = await registeredTool.execute(
	"call-1",
	{ action: "add", text: "Verify tool card" },
	undefined,
	undefined,
	{} as ExtensionContext,
);
assert.equal(addResult.content[0]?.text, "Added #1: Verify tool card", "model-facing content should stay English");
assert.equal(addResult.details.action, "add");
assert.equal(addResult.details.todo.id, 1);
assert.equal(addResult.details.message, undefined, "tool details should be structured rather than prose-driven");
const addCard = registeredTool.renderResult(addResult, { expanded: false }, theme).render(80).map((line: string) => line.trimEnd()).join("\n");
assert.match(addCard, /^\+\s+#1\s+Verify tool card\s+0\/1$/);

const doneCall = registeredTool.renderCall({ action: "done", id: 1 }, theme).render(80).join("\n");
assert.match(doneCall, /Todo\s+done\s+#1/);
const doneResult = await registeredTool.execute(
	"call-2",
	{ action: "done", id: 1 },
	undefined,
	undefined,
	{} as ExtensionContext,
);
assert.equal(doneResult.content[0]?.text, "Completed #1: Verify tool card");
assert.equal(doneResult.details.todo.done, true);
assert.equal(toolStore.current(), undefined, "done should advance past the completed item");
const doneCard = registeredTool.renderResult(doneResult, { expanded: false }, theme).render(80).map((line: string) => line.trimEnd()).join("\n");
assert.match(doneCard, /^x\s+#1\s+Verify tool card\s+1\/1$/);

const doneAgain = await registeredTool.execute(
	"call-3",
	{ action: "done", id: 1 },
	undefined,
	undefined,
	{} as ExtensionContext,
);
assert.equal(doneAgain.content[0]?.text, "Todo #1 is already done.", "done should be idempotent");

const removeResult = await registeredTool.execute(
	"call-4",
	{ action: "remove", id: 1 },
	undefined,
	undefined,
	{} as ExtensionContext,
);
const removeCard = registeredTool.renderResult(removeResult, { expanded: false }, theme).render(80).map((line: string) => line.trimEnd()).join("\n");
assert.match(removeCard, /^-\s+#1\s+Verify tool card$/);

console.log("todo TUI render checks passed");
