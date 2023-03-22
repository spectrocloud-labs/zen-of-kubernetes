# Build the zen of kubernetes binary
FROM --platform=linux/amd64 golang:1.19.6 AS builder

WORKDIR /workspace

# Copy the go module manifests & download dependencies
COPY go.mod go.mod
COPY go.sum go.sum
RUN go mod download

# Copy the go source
COPY . .

# Build
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 GO111MODULE=on go build -a -o hrm heartrate-monitor/main.go

# Finalize
# FROM gcr.io/distroless/static:latest AS hrm

# Use for debugging
FROM --platform=linux/amd64 alpine:3.17 AS hrm

# https://stackoverflow.com/questions/28868393/accessing-bluetooth-dongle-from-inside-docker
RUN apk add --no-cache bash bluez

WORKDIR /
COPY --from=builder /workspace/hrm .

ENTRYPOINT ["/hrm"]
