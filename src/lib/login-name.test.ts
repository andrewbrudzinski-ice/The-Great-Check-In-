import { test } from "node:test";
import assert from "node:assert/strict";
import { handleFromEmail, loginEmail, loginHandle, loginNameProblem, LOGIN_DOMAIN } from "./login-name.ts";

test("names map to stable placeholder logins", () => {
  assert.equal(loginHandle("  Big Mike "), "bigmike");
  assert.equal(loginEmail("Big Mike"), `bigmike@${LOGIN_DOMAIN}`);
  assert.equal(loginEmail("bigmike"), loginEmail("BIG  mike")); // case/spaces don't matter
  assert.equal(loginEmail("Andrew@Gmail.com"), "andrew@gmail.com"); // real emails still work
  assert.equal(handleFromEmail(`bigmike@${LOGIN_DOMAIN}`), "bigmike");
  assert.equal(handleFromEmail("andrew@gmail.com"), "andrew@gmail.com");
});

test("name validation", () => {
  assert.equal(loginNameProblem("Andrew"), null);
  assert.equal(loginNameProblem("j.r_2-x"), null);
  assert.match(loginNameProblem("a")!, /2 characters/);
  assert.match(loginNameProblem("andrew!")!, /letters/);
  assert.match(loginNameProblem("x".repeat(30))!, /24/);
});
