import { configDefaults, defineConfig } from 'vitest/config';

// Worktrees under .claude/ are other checkouts of this repo, each with its own copy of the tests.
// A few scoring tests take about 2 s alone and pass 5 s when every file runs in parallel, so the
// timeout leaves room for that load rather than failing on it.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '.claude/**'], testTimeout: 20_000 },
});
