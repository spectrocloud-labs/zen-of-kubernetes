# If you update this file, please follow:
# https://suva.sh/posts/well-documented-makefiles/

.DEFAULT_GOAL:=help

PROJECT ?= "spectro-common-dev"
IMG_TAG ?= "latest"
HRM_IMG ?= "gcr.io/${PROJECT}/${USER}/spectro-zen-of-kubernetes:${IMG_TAG}"
UI_IMG ?= "gcr.io/${PROJECT}/${USER}/spectro-zen-of-kubernetes-ui:${IMG_TAG}"

GOOS ?= $(shell go env GOOS)
GOARCH ?= $(shell go env GOARCH)
GOPATH ?= $(shell go env GOPATH)

BIN_DIR ?= ./bin
TARGETARCH ?= amd64
DEVICE_ADDRESS ?= 48a44b18-555a-e689-8140-f16dc6fdd3d6

GOLANGCI_VERSION ?= 1.50.1

bin-dir:
	test -d $(BIN_DIR) || mkdir $(BIN_DIR)

##@ Help Targets
help:  ## Display this help
	@awk 'BEGIN {FS = ":.*##"; printf "\nUsage:\n  make \033[36m<target>\033[0m\n"} /^[a-zA-Z_-]+:.*?##/ { printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2 } /^##@/ { printf "\n\033[0m%s\033[0m\n", substr($$0, 5) } ' $(MAKEFILE_LIST)

##@ Build Targets
build: build-hrm build-scanner ## Build all

build-hrm: ## Build heart rate monitor
	go build -o $(BIN_DIR)/hrm heartrate-monitor/main.go

build-scanner: ## Build scanner
	go build -o $(BIN_DIR)/scan scanner/main.go

##@ Static Analysis Targets
static: fmt vet lint ## Run static code analysis

fmt: ## Run go fmt against code
	go fmt ./...

vet: ## Run go vet against code
	go vet ./...

lint: golangci-lint ## Run golangci-lint against code
	$(GOLANGCI_LINT) run

##@ Dev Targets
hrm: build-hrm ## Run heart rate monitor backend
	$(BIN_DIR)/hrm $(DEVICE_ADDRESS) 0

vite: ## Run frontend
	(cd heartrate-ui && yarn dev)

##@ Test Targets
.PHONY: test
test: ## Run unit tests
	go test -covermode=atomic -coverpkg=./... -coverprofile=profile.cov ./... -timeout 120m

##@ Container Image Targets
docker: docker-build docker-push  ## Build all docker images and pushes them to container registry

docker-build: docker-hrm docker-ui ## Build docker images

docker-hrm:
	docker buildx build --platform linux/${TARGETARCH} --load  . -f heartrate-monitor/Dockerfile -t ${HRM_IMG}

docker-ui:
	docker buildx build --platform linux/${TARGETARCH} --load  . -f heartrate-ui/Dockerfile -t ${UI_IMG}

docker-push: ## Push docker images to container registry
	docker push ${HRM_IMG}
	docker push ${UI_IMG}

docker-rmi:  ## Remove docker image from local docker engine
	docker rmi -f ${HRM_IMG}
	docker rmi -f ${UI_IMG}

# binaries
golangci-lint: bin-dir
	if ! test -f $(BIN_DIR)/golangci-lint-linux-amd64; then \
		curl -LOs https://github.com/golangci/golangci-lint/releases/download/v$(GOLANGCI_VERSION)/golangci-lint-$(GOLANGCI_VERSION)-linux-amd64.tar.gz; \
		tar -zxf golangci-lint-$(GOLANGCI_VERSION)-linux-amd64.tar.gz; \
		mv golangci-lint-$(GOLANGCI_VERSION)-*/golangci-lint $(BIN_DIR)/golangci-lint-linux-amd64; \
		chmod +x $(BIN_DIR)/golangci-lint-linux-amd64; \
		rm -rf ./golangci-lint-$(GOLANGCI_VERSION)-linux-amd64*; \
	fi
	if ! test -f $(BIN_DIR)/golangci-lint-$(GOOS)-$(GOARCH); then \
		curl -LOs https://github.com/golangci/golangci-lint/releases/download/v$(GOLANGCI_VERSION)/golangci-lint-$(GOLANGCI_VERSION)-$(GOOS)-$(GOARCH).tar.gz; \
		tar -zxf golangci-lint-$(GOLANGCI_VERSION)-$(GOOS)-$(GOARCH).tar.gz; \
		mv golangci-lint-$(GOLANGCI_VERSION)-*/golangci-lint $(BIN_DIR)/golangci-lint-$(GOOS)-$(GOARCH); \
		chmod +x $(BIN_DIR)/golangci-lint-$(GOOS)-$(GOARCH); \
		rm -rf ./golangci-lint-$(GOLANGCI_VERSION)-$(GOOS)-$(GOARCH)*; \
	fi
GOLANGCI_LINT=$(BIN_DIR)/golangci-lint-$(GOOS)-$(GOARCH)