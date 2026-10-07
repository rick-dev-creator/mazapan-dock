// The dock's decisions (Apps.js.tmpl), run under node: node --test tests/
//
// Apps.js is a QML JavaScript library: its first line, `.pragma library`,
// isn't JavaScript, so it's taken out and the rest is loaded as a module.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const source = readFileSync(new URL("../Apps.js.tmpl", import.meta.url), "utf8")
  .replace(/^\.pragma library\n/, "")
const names = ["webAppMark", "webAppOf", "remember", "inOrder", "arrange", "step", "overlaps", "covered", "pin"]
const Apps = new Function(source + `\nreturn { ${names.join(", ")} }`)()

test("a web app's mark is the part of its window class that names it", () => {
  assert.equal(Apps.webAppMark("https://web.whatsapp.com/"), "-web.whatsapp.com__-")
  assert.equal(Apps.webAppMark("https://mail.google.com/mail/u/0"), "-mail.google.com__mail_u_0-")
})

test("a web app's mark ignores the user, the port, the query and the case", () => {
  assert.equal(Apps.webAppMark("https://me@Example.COM:8443/a?x=1#y"), "-example.com__a-")
  assert.equal(Apps.webAppMark("https://example.com"), "-example.com__-")
})

test("something that isn't a URL has no mark", () => {
  assert.equal(Apps.webAppMark("not a url"), "")
  assert.equal(Apps.webAppMark(""), "")
})

test("a window is a web app's when its class carries the web app's mark", () => {
  const webApps = [{ id: "whatsapp", mark: "-web.whatsapp.com__-" }]
  assert.equal(Apps.webAppOf("chrome-web.whatsapp.com__-Default", webApps), "whatsapp")
  assert.equal(Apps.webAppOf("brave-web.whatsapp.com__-Profile_1", webApps), "whatsapp")
  assert.equal(Apps.webAppOf("chromium", webApps), "")
})

test("apps keep the order they showed up in, new ones at the end", () => {
  assert.deepEqual(Apps.remember(["b", "a"], ["a", "b"], ["a", "b", "c"]), ["b", "a", "c"])
  assert.deepEqual(Apps.remember([], [], ["x"]), ["x"])
})

test("an app that closes leaves the order, and opened again goes at the end", () => {
  const closed = Apps.remember(["b", "a", "c"], ["b", "a", "c"], ["c", "a"])
  assert.deepEqual(closed, ["a", "c"])
  assert.deepEqual(Apps.remember(closed, ["c", "a"], ["c", "a", "b"]), ["a", "c", "b"])
})

test("an app in the order that wasn't open yet keeps its place", () => {
  // At the start the order is read before the windows are there.
  assert.deepEqual(Apps.remember(["b", "a", "c"], [], []), ["b", "a", "c"])
  assert.deepEqual(Apps.remember(["b", "a", "c"], [], ["c", "b"]), ["b", "a", "c"])
})

test("the open apps come in the order they showed up in, the closed ones left out", () => {
  assert.deepEqual(Apps.inOrder(["b", "a", "c"], ["c", "b"]), ["b", "c"])
  assert.deepEqual(Apps.inOrder(["b"], ["z", "b"]), ["b", "z"])
})

test("pinned apps come first, in their order, open or not", () => {
  const items = Apps.arrange(["files", "browser"], [{ app: "browser", focused: false }], [])
  assert.deepEqual(items.map(i => [i.app, i.pinned, i.windows.length]), [["files", true, 0], ["browser", true, 1]])
})

test("apps that aren't pinned follow, in the order they showed up", () => {
  const windows = [{ app: "c" }, { app: "browser" }, { app: "a" }]
  const items = Apps.arrange(["browser"], windows, ["a", "c"])
  assert.deepEqual(items.map(i => i.app), ["browser", "a", "c"])
  assert.deepEqual(items.map(i => i.pinned), [true, false, false])
})

test("an app's windows are grouped under it, and it's focused when one of them is", () => {
  const windows = [{ app: "term", focused: false, id: 1 }, { app: "term", focused: true, id: 2 }]
  const [term] = Apps.arrange([], windows, [])
  assert.deepEqual(term.windows.map(w => w.id), [1, 2])
  assert.equal(term.focused, true)
})

test("the next window goes round, the previous too", () => {
  const ws = [{ id: 1 }, { id: 2, focused: true }, { id: 3 }]
  assert.equal(Apps.step(ws, 1).id, 3)
  assert.equal(Apps.step(ws, -1).id, 1)
  assert.equal(Apps.step([{ id: 1 }, { id: 2 }, { id: 3, focused: true }], 1).id, 1)
})

test("with none of the app's windows focused, the next is the first", () => {
  assert.equal(Apps.step([{ id: 1 }, { id: 2 }], 1).id, 1)
  assert.equal(Apps.step([], 1), null)
})

test("rectangles that only touch don't overlap", () => {
  const dock = { x: 100, y: 1000, width: 400, height: 60 }
  assert.equal(Apps.overlaps({ x: 0, y: 0, width: 1920, height: 1000 }, dock), false)
  assert.equal(Apps.overlaps({ x: 0, y: 0, width: 1920, height: 1001 }, dock), true)
  assert.equal(Apps.overlaps({ x: 500, y: 900, width: 100, height: 200 }, dock), false)
})

test("the dock is covered by a window over its place, or by any full-screen window", () => {
  const dock = { x: 100, y: 1000, width: 400, height: 60 }
  assert.equal(Apps.covered([{ x: 0, y: 0, width: 800, height: 500 }], dock), false)
  assert.equal(Apps.covered([{ x: 0, y: 0, width: 800, height: 500 }, { x: 200, y: 950, width: 50, height: 80 }], dock), true)
  assert.equal(Apps.covered([{ x: 0, y: 0, width: 10, height: 10, fullscreen: true }], dock), true)
  assert.equal(Apps.covered([], dock), false)
})

test("pinning adds an app at the end; one already pinned stays where it is", () => {
  assert.deepEqual(Apps.pin(["a", "b"], "c", true), ["a", "b", "c"])
  assert.deepEqual(Apps.pin(["a", "b"], "a", true), ["a", "b"])
})

test("unpinning takes the app out, and nothing else", () => {
  assert.deepEqual(Apps.pin(["a", "b"], "a", false), ["b"])
  assert.deepEqual(Apps.pin(["a"], "z", false), ["a"])
})
