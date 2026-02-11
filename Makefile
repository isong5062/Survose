.PHONY: test test-all test-eleven-labs test-llm-output run-backend help

# Default target
help:
	@echo "Available targets:"
	@echo "  make test          - Run all tests"
	@echo "  make test-all      - Run all tests (same as test)"
	@echo "  make test-eleven-labs - Run only ElevenLabs tests"
	@echo "  make test-llm-output  - Run only LLM output tests"
	@echo "  make run-backend   - Run FastAPI backend (from project root)"
	@echo "  make help          - Show this help message"

# Run all tests
test: test-all

test-all:
	@echo "Running all tests..."
	pytest tests/ -v

# Run only ElevenLabs tests
test-eleven-labs:
	@echo "Running ElevenLabs tests..."
	pytest tests/eleven_labs/ -v

# Run only LLM output tests
test-llm-output:
	@echo "Running LLM output tests..."
	pytest tests/survey_generation/ -v

# Run FastAPI backend (install deps: pip install -r src/backend/requirements.txt)
run-backend:
	cd src/backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Install requirements
install-requirements:
	pip install -r requirements.txt
