# Deployment Progress Tracker — Solara EKS (main)

> Single source: `documentation/deployments/deployment.md` (1500 lines). Demo and Prod are same YAML, only lifecycle differs.

| Phase | What | Status | Verified | Notes |
|---|---|---|---|---|
| **0** | Design decisions (6 tradeoffs) | Done | 2026-08-21 | Single EKS stack, ECR, eksctl, NodePort vs ALB |
| **1** | Architecture overview | Done | 2026-08-21 | 3 services + gateway + 5 containers |
| **2** | Project structure & file map | Done | 2026-08-21 | `cluster.yaml` + manifests + ECR |
| **3** | Single EC2 historical (local-dev) | Done | 2026-08-15 | Host `i-05cc9dd009a9e8401` stopped, EBS $2.40/mo |
| **4** | Pivot research + cost model | Done | 2026-08-21 | Rs.47-52/demo, Rs.29k/mo prod, 8 sources |
| **5** | ECR — 5 repos | Done | 2026-08-21 | `solara/{api-gateway,auth,transaction,insight,frontend}` at `609394381484.dkr.ecr.us-east-1.amazonaws.com` |
| **6** | GitHub Actions workflow | Done | 2026-08-22 | `deploy.yml` on `main` with `build-test` + `build-and-push` (needs IAM role `github-solara-ecr` in AWS Console) |
| **7** | EKS cluster (`cluster.yaml`) | Done | 2026-08-22 | `infrastructure/aws/eks/cluster.yaml` — t4g.medium, gp3 20GB, v1.30 |
| **8** | Manifests (12 files) | Done | 2026-08-22 | 5 Deployments + 5 Services + Secret + in-cluster data (3 Postgres, Redis, Kafka) |
| **9** | Best practices audit | Done | 2026-08-22 | `documentation/deployments/k8s-manifests-audit.md` — generic K8s reference, 3 fixes applied (startup probes, graceful shutdown, JVM flags) |

**Current state:**
- All YAML files written to `infrastructure/aws/eks/`
- `deploy.yml` updated with `build-and-push` job (uncommitted)
- All files untracked in git (not yet committed)

**Remaining before first deploy:**
1. `git add` + `git commit` the YAML files and workflow
2. Create IAM role `github-solara-ecr` in AWS Console (root, one-time)
3. `eksctl create cluster -f infrastructure/aws/eks/cluster.yaml` (15 min)
4. Generate JWT keys + `kubectl apply -f manifests/`
5. `eksctl delete cluster --wait` after demo

Updated: 2026-08-22
