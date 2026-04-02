#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAIN_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.yml"
INFRA_COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.infra.yml"

ensure_compose_files() {
	if [[ ! -f "${MAIN_COMPOSE_FILE}" ]]; then
		echo "Error: Missing ${MAIN_COMPOSE_FILE}" >&2
		exit 1
	fi

	if [[ ! -f "${INFRA_COMPOSE_FILE}" ]]; then
		echo "Error: Missing ${INFRA_COMPOSE_FILE}" >&2
		exit 1
	fi
}

dc_main() {
	docker compose -f "${MAIN_COMPOSE_FILE}" "$@"
}

dc_infra() {
	docker compose -f "${INFRA_COMPOSE_FILE}" "$@"
}

show_help() {
	cat <<'EOF'
Docker helper for EpiLink.

Usage:
	./docker.sh <command> [options]

Main stack commands (docker-compose.yml):
	up                 Build and start full stack in attached mode
	start              Start full stack containers (no rebuild)
	stop               Stop full stack containers
	down               Stop and remove full stack containers
	restart            Restart full stack (down + up)
	build              Build full stack images
	logs [svc]         Tail logs for full stack or a specific service
	ps                 Show full stack container status

Infra-only commands (docker-compose.infra.yml):
	dev                Start redis + qdrant in detached mode
	dev-start          Start infra containers (no recreate/build)
	dev-stop           Stop infra containers
	dev-down           Stop and remove infra containers
	dev-restart        Restart infra (dev-down + dev)
	dev-logs [svc]     Tail infra logs (optionally redis or qdrant)
	dev-ps             Show infra container status

Maintenance commands:
	clean              down --remove-orphans for main and infra
	clean-volumes      clean + remove named volumes for both stacks
	config             Validate and print resolved main compose config
	dev-config         Validate and print resolved infra compose config
	help               Show this help

Development tips:
	- Enable BuildKit for faster builds: export DOCKER_BUILDKIT=1
	- Use docker-compose.override.yml for volume mounts (auto-loaded by docker compose)
	  Services will reload on code changes without rebuilding
	- Run with: ./docker.sh up (loads override automatically)

Examples:
	./docker.sh up                    # starts full stack with hot-reload via override.yml
	./docker.sh logs backend          # tail backend logs
	./docker.sh dev                   # start only redis + qdrant
	./docker.sh dev-logs redis        # tail redis logs
	./docker.sh clean-volumes         # remove all volumes
EOF
}

main() {
	ensure_compose_files

	local cmd="${1:-help}"
	shift || true

	case "${cmd}" in
		up)
			dc_main up --build "$@"
			;;
		start)
			dc_main start "$@"
			;;
		stop)
			dc_main stop "$@"
			;;
		down)
			dc_main down "$@"
			;;
		restart)
			dc_main down
			dc_main up -d --build "$@"
			;;
		build)
			dc_main build "$@"
			;;
		logs)
			if [[ $# -gt 0 ]]; then
				dc_main logs -f "$1"
			else
				dc_main logs -f
			fi
			;;
		ps)
			dc_main ps "$@"
			;;
		dev)
			dc_infra up -d "$@"
			;;
		dev-start)
			dc_infra start "$@"
			;;
		dev-stop)
			dc_infra stop "$@"
			;;
		dev-down)
			dc_infra down "$@"
			;;
		dev-restart)
			dc_infra down
			dc_infra up -d "$@"
			;;
		dev-logs)
			if [[ $# -gt 0 ]]; then
				dc_infra logs -f "$1"
			else
				dc_infra logs -f
			fi
			;;
		dev-ps)
			dc_infra ps "$@"
			;;
		clean)
			dc_main down --remove-orphans
			dc_infra down --remove-orphans
			;;
		clean-volumes)
			dc_main down --remove-orphans -v
			dc_infra down --remove-orphans -v
			;;
		config)
			dc_main config
			;;
		dev-config)
			dc_infra config
			;;
		help|-h|--help)
			show_help
			;;
		*)
			echo "Error: Unknown command '${cmd}'" >&2
			echo "Run './docker.sh help' for usage." >&2
			exit 1
			;;
	esac
}

main "$@"
