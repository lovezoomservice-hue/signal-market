.PHONY: help install start pipeline test test:i dashboard clean

help:
	@echo "Signal Market - Commands"
	@echo ""
	@echo "  make install    Install dependencies"
	@echo "  make start      Start API server"
	@echo "  make pipeline   Run data pipeline"
	@echo "  make test       Run acceptance tests"
	@echo "  make test:i     Run integration tests"
	@echo "  make dashboard  Start dashboard"
	@echo "  make clean      Clean output files"

install:
	npm install

start:
	node l4/api_server.js

pipeline:
	node run_pipeline.js

scheduler:
	node scheduler.js

test:
	node test/acceptance.js

test:i:
	node test/integration.js

dashboard:
	node ui/dashboard.js

alerts:
	node l4/alerts.js

monitor:
	node monitoring/performance.js

clean:
	rm -rf output/raw/* output/clean/* output/events/* output/probability/*
