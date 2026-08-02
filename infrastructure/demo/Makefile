# =============================================================================
# Solara demo host — script-only provisioning (NO Terraform)
#
# Launches ONE t4g.small EC2 instance in the default VPC running the repo's
# docker-compose stack. user-data installs Docker + nginx, clones the repo,
# boots the stack, builds the frontend, and nginx serves dist/ + proxies /api.
#
# Why scripts and not Terraform? This is a single resource you start/stop on
# demand; Terraform's state/diff ceremony earns nothing at this scale. The
# Fargate scale-up (aws_deployment_tutorial.md) is the Terraform story.
#
# State lives OUTSIDE the repo in ~/.aws/state so the working tree stays clean.
# AWS pricing facts (verified 2026-08-02): t4g.small $0.0168/hr on, ~$0 usage
# stopped (EBS persists ~$2.40/mo); public IPv4 $0.005/hr while running.
# =============================================================================

AWS           ?= aws
REGION        ?= us-east-1
INSTANCE_TYPE ?= t4g.small
KEY_NAME      ?= solara-demo
SG_NAME       ?= solara-demo
TAG_NAME      ?= solara-demo
STATE_DIR     ?= ${HOME}/.aws/state
SSH_USER      ?= ec2-user
MY_IP         ?= $(shell curl -fsS --max-time 5 https://checkip.amazonaws.com 2>/dev/null || echo 0.0.0.0)

HERE             := $(abspath $(lastword $(MAKEFILE_LIST)))
HERE_DIR         := $(dir $(HERE))
USER_DATA_FILE   := $(HERE_DIR)user-data.sh
INSTANCE_ID_FILE := $(STATE_DIR)/instance-id
SG_ID_FILE       := $(STATE_DIR)/sg-id
KEY_FILE         := $(STATE_DIR)/$(KEY_NAME).pem

# AL2023 AMI names are al2023-ami-2023.0.<builddate>.<build>-kernel-<ver>-arm64
# (the "2023.0" is the release line; the year in the name does NOT track the calendar).
# "2023*arm64" excludes the minimal AMIs (al2023-ami-minimal-*) which are also arm64.
AMI := $(shell $(AWS) ec2 describe-images --region $(REGION) \
  --owners 137112412989 \
  --filters Name=name,Values=al2023-ami-2023*arm64 Name=architecture,Values=arm64 Name=state,Values=available \
  --query 'sort_by(Images, &CreationDate)[-1].ImageId' --output text)

.PHONY: help compute state bootstrap provision wait stop ip ssh deploy open-ssh teardown clean

help: ## show this help
	@grep -E '^[a-zA-Z_-]+:.*## ' $(MAKEFILE_LIST) | sed 's/:.*## / — /' | sort

# --- discovery -----------------------------------------------------------------

compute: ## print the latest Amazon Linux 2023 (arm64) AMI id
	@echo "$(AMI)"

state: ## show where state lives
	@echo "state dir  : $(STATE_DIR)"
	@echo "key file   : $(KEY_FILE)"
	@echo "instance id: $$(cat $(INSTANCE_ID_FILE) 2>/dev/null || echo '<none>')"
	@echo "sg id      : $$(cat $(SG_ID_FILE) 2>/dev/null || echo '<none>')"

# --- bootstrap: key pair + security group (idempotent) --------------------------

bootstrap: ## create SSH key pair + security group if needed
	@mkdir -p $(STATE_DIR)
	@if [ ! -f $(KEY_FILE) ]; then echo "creating key pair '$(KEY_NAME)'…"; \
		$(AWS) ec2 create-key-pair --region $(REGION) --key-name $(KEY_NAME) \
		  --query 'KeyMaterial' --output text > $(KEY_FILE); chmod 600 $(KEY_FILE); \
	else echo "key pair already on disk"; fi
	@if [ ! -f $(SG_ID_FILE) ]; then echo "creating security group '$(SG_NAME)'…"; \
		$(AWS) ec2 create-security-group --region $(REGION) --group-name $(SG_NAME) \
		  --description 'Solara demo: SSH + HTTP' --query 'GroupId' --output text > $(SG_ID_FILE); \
	fi
	@echo "opening 22 from $(MY_IP)/32 and 80 from 0.0.0.0/0 (idempotent)…"
	-$(AWS) ec2 authorize-security-group-ingress --region $(REGION) --group-id "$$(cat $(SG_ID_FILE))" \
	  --protocol tcp --port 22 --cidr $(MY_IP)/32
	-$(AWS) ec2 authorize-security-group-ingress --region $(REGION) --group-id "$$(cat $(SG_ID_FILE))" \
	  --protocol tcp --port 80 --cidr 0.0.0.0/0
	@echo "==> ready. next: make provision"

# --- lifecycle --------------------------------------------------------------------

provision: bootstrap ## create the EC2 instance; stack boots itself via user-data
	@test ! -f $(INSTANCE_ID_FILE) || { echo "instance already provisioned $$(cat $(INSTANCE_ID_FILE)) — make stop / teardown"; exit 0; }
	@test -n "$(AMI)" || { echo "no AL2023 arm64 AMI found (check: make compute)"; exit 1; }
	@echo "== launching $(INSTANCE_TYPE) AMI $(AMI) in default VPC…"
	IID=$$($(AWS) ec2 run-instances --region $(REGION) \
	  --image-id $(AMI) --instance-type $(INSTANCE_TYPE) \
	  --key-name $(KEY_NAME) --security-group-ids "$$(cat $(SG_ID_FILE))" \
	  --user-data file://$(USER_DATA_FILE) \
	  --block-device-mappings '[{"DeviceName":"/dev/xvda","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
	  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=$(TAG_NAME)}]' \
	  --query 'Instances[0].InstanceId' --output text); \
	echo "$$IID" > $(INSTANCE_ID_FILE); \
	echo "launched $$IID — waiting to reach 'running'…"
	@until [ "$$($(AWS) ec2 describe-instances --region $(REGION) --instance-ids "$$(cat $(INSTANCE_ID_FILE))" --query 'Reservations[0].Instances[0].State.Name' --output text)" = running ]; do sleep 5; done
	@echo "instance running. Public IP: $$($(AWS) ec2 describe-instances --region $(REGION) --instance-ids "$$(cat $(INSTANCE_ID_FILE))" --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)"
	@echo "== user-data is installing Docker + nginx and the stack (15–40 min first boot). Wait, then:"
	@echo "   make wait    # poll nginx until UI is up"

wait: ## poll until http://<ip>/ answers 200 (first boot is slow: 15-40 min Maven builds)
	@test -f $(INSTANCE_ID_FILE) || { echo "provision first"; exit 1; }
	@IP=$$($(MAKE) -s ip); \
	for i in $$(seq 1 600); do \
		if curl -fsS --max-time 3 "http://$$IP/" -o /dev/null; then echo "UI up at http://$$IP/ (after ~$$((i*5))s)"; exit 0; fi; \
		sleep 5; \
	done; \
	echo "nginx not answering after 50 min. ssh in and check: journalctl -u docker -u nginx, docker compose ps, /var/log/cloud-init-output.log"; exit 1

ip: ## public IPv4 of the instance (for the browser)
	@test -f $(INSTANCE_ID_FILE) || { echo "provision first"; exit 1; }
	$(AWS) --region $(REGION) ec2 describe-instances --instance-ids "$$(cat $(INSTANCE_ID_FILE))" \
	  --query 'Reservations[0].Instances[0].PublicIpAddress' --output text

ssh: ## ssh to the demo host
	@test -f $(INSTANCE_ID_FILE) || { echo "provision first"; exit 1; }
	ssh -i $(KEY_FILE) -o StrictHostKeyChecking=accept-new $(SSH_USER)@$$($(MAKE) -s ip)

stop: ## stop the instance (only EBS bills while stopped)
	@test -f $(INSTANCE_ID_FILE) || { echo "provision first"; exit 1; }
	$(AWS) ec2 stop-instances --region $(REGION) --instance-ids "$$(cat $(INSTANCE_ID_FILE))"

deploy: ## git pull + rebuild services + frontend on the host (full redeploy)
	@test -f $(INSTANCE_ID_FILE) || { echo "provision first"; exit 1; }
	ssh -i $(KEY_FILE) -o StrictHostKeyChecking=accept-new $(SSH_USER)@$$($(MAKE) -s ip) \
	  'cd /srv/solara && git pull --ff-only && docker compose up -d --build && npm --prefix frontend ci && npm --prefix frontend run build && nginx -s reload'

open-ssh: ## (re)open port 22 to your current IP (after a network change)
	$(AWS) ec2 authorize-security-group-ingress --region $(REGION) --group-id "$$(cat $(SG_ID_FILE))" \
	  --protocol tcp --port 22 --cidr $(MY_IP)/32

# --- teardown ---------------------------------------------------------------------

teardown: ## terminate the instance, delete SG + key pair (DESTRUCTIVE)
	@test -f $(INSTANCE_ID_FILE) || { echo "nothing provisioned"; exit 0; }
	@echo "### This TERMINATES the demo host and DELETES the security group + key pair."
	@read -p "type delete to continue: " a; [ "$$a" = delete ] || { echo aborted; exit 0; }
	-$(AWS) ec2 terminate-instances --region $(REGION) --instance-ids "$$(cat $(INSTANCE_ID_FILE))"
	@echo "waiting for termination…"
	@for i in $$(seq 1 24); do \
		s=$$($(AWS) --region=$(REGION) ec2 describe-instances --instance-ids "$$(cat $(INSTANCE_ID_FILE))" --query 'Reservations[0].Instances[0].State.Name' --output text 2>/dev/null); \
		[ "$$s" = terminated ] && echo done && break; sleep 5; done
	-$(AWS) ec2 delete-security-group --region $(REGION) --group-id "$$(cat $(SG_ID_FILE))" 2>/dev/null
	-$(AWS) ec2 delete-key-pair --region $(REGION) --key-name $(KEY_NAME)
	rm -f $(INSTANCE_ID_FILE) $(SG_ID_FILE) $(KEY_FILE)
	@echo "== demo host removed. Recreate with make provision"

clean: teardown ## alias for teardown (DESTRUCTIVE)