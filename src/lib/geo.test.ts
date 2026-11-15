import { test } from "node:test";
import assert from "node:assert/strict";
import { flipSign, parseCoordPair } from "./geo.ts";

test("pasted map pins", () => {
  assert.deepEqual(parseCoordPair("40.7411, -73.9897"), { lat: 40.7411, lng: -73.9897 });
  assert.deepEqual(parseCoordPair(" -33.86 151.21 "), { lat: -33.86, lng: 151.21 });
  assert.deepEqual(parseCoordPair("(40.7,-73.9)"), { lat: 40.7, lng: -73.9 });
  assert.equal(parseCoordPair("-73.9897"), null); // a single number is just a number
  assert.equal(parseCoordPair("140, 20"), null); // latitude out of range
  assert.equal(parseCoordPair("hello"), null);
});

test("sign flip for keypads without a minus key", () => {
  assert.equal(flipSign("73.98"), "-73.98");
  assert.equal(flipSign("-73.98"), "73.98");
  assert.equal(flipSign(""), "-");
});
