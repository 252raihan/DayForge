// Registers the "@/" alias resolver (tests/loader.mjs) before the test runner
// loads any test file. Loaded with `node --import ./tests/loader-register.mjs`.
import { register } from "node:module";

register("./loader.mjs", import.meta.url);
