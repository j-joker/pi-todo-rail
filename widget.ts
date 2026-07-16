import type { ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import type { Todo } from "./state.ts";

const WIDGET_KEY = "todo-execution-rail";
const DEFAULT_FRAME_MS = 100;

interface TodoWidgetOptions {
	/** Disable on session restore/tree navigation; enabled for live mutations by default. */
	animate?: boolean;
	/** Test hook; production uses 100ms per transition frame. */
	frameDurationMs?: number;
	/** Test hook and terminal reduced-motion override source. */
	env?: Record<string, string | undefined>;
}

interface RailFrame {
	marker: "x" | "→" | "*";
	text: string;
	note?: string;
	tone: "done" | "handoff" | "current";
}

let previousCurrent: Todo | undefined;
let animationTimer: ReturnType<typeof setTimeout> | undefined;
let animationGeneration = 0;

export function isTodoMotionEnabled(env: Record<string, string | undefined> = process.env): boolean {
	return (
		env.TODO_MOTION !== "0" &&
		env.REDUCE_MOTION !== "1" &&
		env.PI_REDUCED_MOTION !== "1" &&
		!env.CI &&
		env.TERM !== "dumb"
	);
}

function cancelAnimation(): void {
	animationGeneration++;
	if (animationTimer) {
		clearTimeout(animationTimer);
		animationTimer = undefined;
	}
}

export function clearTodoWidget(ctx: ExtensionContext): void {
	cancelAnimation();
	previousCurrent = undefined;
	ctx.ui.setWidget(WIDGET_KEY, undefined);
}

function styledFrame(frame: RailFrame, theme: Theme): string {
	const note = frame.note ? theme.fg("dim", ` (${frame.note})`) : "";
	if (frame.tone === "done") {
		return `${theme.fg("dim", frame.marker)}  ${theme.fg("dim", frame.text)}${note}`;
	}
	if (frame.tone === "handoff") {
		return `${theme.fg("dim", frame.marker)}  ${theme.fg("text", frame.text)}${note}`;
	}
	return `${theme.fg("accent", frame.marker)}  ${theme.fg("text", frame.text)}${note}`;
}

export function updateTodoWidget(
	ctx: ExtensionContext,
	todos: readonly Todo[],
	options: TodoWidgetOptions = {},
): void {
	cancelAnimation();
	const generation = animationGeneration;
	const total = todos.length;
	if (total === 0) {
		previousCurrent = undefined;
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		return;
	}

	const done = todos.filter((todo) => todo.done).length;
	if (done === total) {
		previousCurrent = undefined;
		ctx.ui.setWidget(WIDGET_KEY, undefined);
		return;
	}

	const current = todos.find((todo) => !todo.done)!;
	const previous = previousCurrent;
	const previousNow = previous ? todos.find((todo) => todo.id === previous.id) : undefined;
	const shouldAnimate =
		(options.animate ?? true) &&
		isTodoMotionEnabled(options.env) &&
		previous !== undefined &&
		previous.id !== current.id &&
		previousNow?.done === true;

	const frames: RailFrame[] = shouldAnimate
		? [
				{ marker: "x", text: previous.text, note: previous.note, tone: "done" },
				{ marker: "→", text: current.text, note: current.note, tone: "handoff" },
				{ marker: "*", text: current.text, note: current.note, tone: "current" },
			]
		: [{ marker: "*", text: current.text, note: current.note, tone: "current" }];
	previousCurrent = { ...current };

	ctx.ui.setWidget(WIDGET_KEY, (tui, theme) => {
		let frameIndex = 0;
		if (frames.length > 1 && generation === animationGeneration) {
			const frameDurationMs = Math.max(1, options.frameDurationMs ?? DEFAULT_FRAME_MS);
			const advance = () => {
				if (generation !== animationGeneration) return;
				frameIndex = Math.min(frameIndex + 1, frames.length - 1);
				tui.requestRender();
				if (frameIndex < frames.length - 1) {
					animationTimer = setTimeout(advance, frameDurationMs);
				} else {
					animationTimer = undefined;
				}
			};
			animationTimer = setTimeout(advance, frameDurationMs);
		}

		return {
			render(width: number): string[] {
				const renderWidth = Math.max(1, width);
				const left = styledFrame(frames[frameIndex]!, theme);
				const controls = theme.fg("dim", `Ctrl+R previous  ·  Ctrl+N done  ·  ${done}/${total}`);
				const controlsWidth = visibleWidth(controls);
				if (renderWidth >= controlsWidth + 6) {
					const clippedLeft = truncateToWidth(left, renderWidth - controlsWidth - 2, "…");
					const gap = renderWidth - visibleWidth(clippedLeft) - controlsWidth;
					return [`${clippedLeft}${" ".repeat(gap)}${controls}`];
				}

				const progress = theme.fg("dim", `${done}/${total}`);
				const progressWidth = visibleWidth(progress);
				if (renderWidth <= progressWidth + 2) return [truncateToWidth(progress, renderWidth, "")];
				const clippedLeft = truncateToWidth(left, renderWidth - progressWidth - 2, "…");
				const gap = renderWidth - visibleWidth(clippedLeft) - progressWidth;
				return [`${clippedLeft}${" ".repeat(gap)}${progress}`];
			},
			invalidate() {},
		};
	});
}
