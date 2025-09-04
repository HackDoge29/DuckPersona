# Makefile
.PHONY: help install build test deploy clean setup

help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  %-15s %s\n", $1, $2}' $(MAKEFILE_LIST)

install: ## Install all dependencies
	npm install
	cd contracts && npm install
	cd lambda && npm install

build: ## Build all components
	npm run build

test: ## Run all tests
	npm run test

deploy-contracts: ## Deploy smart contracts
	npm run deploy:contracts

deploy-aws: ## Deploy AWS infrastructure
	npm run deploy

deploy: build deploy-contracts deploy-aws ## Full deployment

setup-webhook: ## Setup Telegram webhook
	npm run setup:telegram

local-start: ## Start local development environment
	docker-compose up -d
	npm run start:local

clean: ## Clean build artifacts
	rm -rf dist/
	rm -rf node_modules/
	cd contracts && rm -rf artifacts/ cache/ node_modules/
	cd lambda && rm -rf dist/ node_modules/

setup: install build ## Initial project setup

dev: ## Start development mode
	npm run dev

logs: ## Show AWS Lambda logs
	aws logs tail --follow /aws/lambda/DuckPersona-OrchestratorFunction