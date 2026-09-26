import { configDefaults, defineConfig } from 'vitest/config';

// Worktrees under .claude/ are other checkouts of this repo, each with its own copy of the tests.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '.claude/**'] },
});
