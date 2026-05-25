# Makefile for the Particle Lab — thin wrappers around the npm scripts plus the
# composite gate targets from CLAUDE.md ("build, lint, test must pass before commit").
# Run `make` (or `make help`) to list targets.

NPM := npm

.DEFAULT_GOAL := help
.PHONY: help install ci dev build preview typecheck lint lint-fix test test-watch coverage check verify clean clean-all

help: ## Show available targets
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies (npm install)
	$(NPM) install

ci: ## Clean, reproducible install from the lockfile (npm ci)
	$(NPM) ci

dev: ## Start the Vite dev server
	$(NPM) run dev

build: ## Type-check and build for production
	$(NPM) run build

preview: build ## Build, then serve the production bundle locally
	$(NPM) run preview

typecheck: ## Type-check all projects (tsc -b)
	$(NPM) run typecheck

lint: ## Lint with ESLint
	$(NPM) run lint

lint-fix: ## Lint and auto-fix
	$(NPM) run lint -- --fix

test: ## Run the test suite once (Vitest)
	$(NPM) test

test-watch: ## Run tests in watch mode
	$(NPM) run test:watch

coverage: ## Run tests with coverage report
	$(NPM) run test:coverage

check: typecheck lint test ## Fast pre-commit gate: typecheck + lint + test

verify: check build ## Full gate: typecheck + lint + test + production build

clean: ## Remove build output and caches
	rm -rf dist coverage node_modules/.tmp

clean-all: clean ## Also remove installed dependencies
	rm -rf node_modules
