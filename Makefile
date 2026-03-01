.PHONY: help build quick-build up down restart logs clean test lint shell-backend shell-db

help: ## Show this help
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

build: ## Full rebuild of all containers (no cache)
	docker compose build --no-cache

quick-build: ## Quick build using cache
	docker compose build

up: ## Start all containers in background
	docker compose up -d

down: ## Stop and remove containers
	docker compose down

restart: ## Restart all containers
	docker compose restart

logs: ## Follow logs of all containers
	docker compose logs -f

ready: ## Wait until the API is ready to serve requests (run after 'make up')
	@echo "Waiting for API to be ready..."
	@until curl -sf http://localhost:8000/docs > /dev/null 2>&1; do sleep 1; printf "."; done
	@echo ""
	@echo "✅ API is ready at http://localhost:8000"
	@echo "✅ Frontend is ready at http://localhost:5173"

clean: ## Stop containers and remove volumes (WARNING: Deletes database data!)
	docker compose down -v

test: ## Run backend tests and frontend validation
	docker compose exec api pytest tests/ -v
	cd frontend && npm run type-check

lint: ## Run linting for backend and frontend
	docker compose exec api flake8 .
	cd frontend && npm run lint

shell-backend: ## Open a shell inside the backend container
	docker compose exec api /bin/bash

shell-db: ## Open a psql shell inside the database container
	docker compose exec postgres psql -U postgres -d gym_tracker
