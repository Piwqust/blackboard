export function createDrawingHistory(limit = 60) {
  const histories = new Map();
  function state(id) {
    if (!histories.has(id)) histories.set(id, { undo: [], redo: [] });
    return histories.get(id);
  }
  function apply(drawings, command, undo) {
    if (command.kind === "batch") {
      for (const entry of undo
        ? [...command.commands].reverse()
        : command.commands)
        apply(drawings, entry, undo);
      return;
    }
    if (command.kind === "insert") {
      if (undo) {
        const index = drawings.findIndex((s) => s.id === command.stroke.id);
        if (index >= 0) drawings.splice(index, 1);
      } else
        drawings.splice(
          Math.min(command.index, drawings.length),
          0,
          structuredClone(command.stroke),
        );
    } else if (command.kind === "remove") {
      if (undo)
        drawings.splice(
          Math.min(command.index, drawings.length),
          0,
          structuredClone(command.stroke),
        );
      else {
        const index = drawings.findIndex((s) => s.id === command.stroke.id);
        if (index >= 0) drawings.splice(index, 1);
      }
    } else if (command.kind === "update") {
      const index = drawings.findIndex((s) => s.id === command.before.id);
      if (index >= 0)
        drawings[index] = structuredClone(
          undo ? command.before : command.after,
        );
    } else if (command.kind === "replace")
      drawings.splice(
        0,
        drawings.length,
        ...structuredClone(undo ? command.before : command.after),
      );
  }
  return {
    record(id, command) {
      const h = state(id);
      const last = h.undo.at(-1),
        now = Date.now();
      if (
        !h.redo.length &&
        command.mergeKey &&
        last?.mergeKey === command.mergeKey &&
        now - last.timestamp < 500
      ) {
        last.after = structuredClone(command.after);
        last.timestamp = now;
        return;
      }
      if (command.mergeKey) command = { ...command, timestamp: now };
      h.undo.push(structuredClone(command));
      h.undo.splice(0, Math.max(0, h.undo.length - limit));
      h.redo = [];
    },
    undo(id, drawings) {
      const h = state(id);
      let command = h.undo.pop();
      if (!command && drawings.length)
        command = {
          kind: "insert",
          index: drawings.length - 1,
          stroke: structuredClone(drawings.at(-1)),
        };
      if (!command) return false;
      apply(drawings, command, true);
      h.redo.push(command);
      return true;
    },
    redo(id, drawings) {
      const h = state(id),
        command = h.redo.pop();
      if (!command) return false;
      apply(drawings, command, false);
      h.undo.push(command);
      return true;
    },
    canUndo(id, drawings) {
      return !!state(id).undo.length || !!drawings?.length;
    },
    canRedo(id) {
      return !!state(id).redo.length;
    },
    clear() {
      histories.clear();
    },
  };
}
