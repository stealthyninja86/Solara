# Kubernetes Manifests — Best Practices Reference

> **Generic reference** for production-grade K8s manifests. Applies to any Spring Boot + Postgres + Kafka deployment on EKS/GKE/AKS. Not project-specific.

---

## 1. StatefulSets for Databases

**When to use:** Any workload that writes to disk and needs data to survive restarts (databases, message brokers, caches with persistence).

**Pattern:**
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres          # must match the headless Service name
  replicas: 1                    # 3 for multi-AZ production
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: [ReadWriteOnce]
        storageClassName: gp3
        resources:
          requests:
            storage: 10Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  clusterIP: None                # headless - each pod gets pod-0.postgres DNS
  selector:
    app: postgres
  ports:
    - port: 5432
```

**Key decisions:**
- **Headless Service** (`clusterIP: None`) - required for StatefulSet pod DNS (`pod-0.postgres`, `pod-1.postgres`). Without it, multi-replica peer discovery breaks.
- **volumeClaimTemplates** - each pod gets its own PVC. PVCs survive pod restarts but are deleted when the StatefulSet is deleted (unless `persistentVolumeReclaimPolicy: Retain`).
- **Single vs multi-replica** - single for demo/dev, 3 for production (sync replication). Single-replica does not need headless DNS.

---

## 2. Resource Requests and Limits

**Why it matters:** Kubernetes uses requests to schedule pods onto nodes. Limits enforce caps. Mismatched values cause OOM kills or CPU throttling.

**JVM in containers - the number one gotcha:**
```yaml
# WRONG - JVM defaults to 25% of NODE memory, not container memory
env:
  - name: JAVA_TOOL_OPTIONS
    value: ""    # missing - JVM guesses wrong

# RIGHT - explicit heap sizing relative to container memory
env:
  - name: JAVA_TOOL_OPTIONS
    value: "-XX:MaxRAMPercentage=75.0 -XX:InitialRAMPercentage=50.0"
resources:
  requests:
    cpu: 500m
    memory: 1Gi
  limits:
    cpu: 500m        # optional - remove to avoid CFS throttling
    memory: 1Gi
```

**QoS classes (Kubernetes):**
| Class | Condition | Eviction priority |
|---|---|---|
| **Guaranteed** | requests == limits for ALL resources | Lowest (last to evict) |
| **Burstable** | requests < limits for ANY resource | Medium |
| **BestEffort** | no requests or limits | Highest (first to evict) |

**When to remove CPU limits:** CPU limits cause Linux CFS bandwidth throttling - a process can be throttled even when the node has spare CPU. For latency-sensitive services (API gateways, databases), remove CPU limits and keep only CPU requests.

**Memory sizing rule of thumb:**
- JVM heap = 75% of container memory limit
- Remaining 25% = thread stacks, metaspace, direct buffers, native allocations
- Example: 1Gi container = 768MB heap max

---

## 3. Probes

**Three probe types, three different jobs:**

| Probe | Job | Fails when | Action |
|---|---|---|---|
| **Startup** | "Is the app still starting?" | App takes too long to boot | Kill + restart |
| **Liveness** | "Is the process alive?" | Process deadlocked or hung | Kill + restart |
| **Readiness** | "Can it serve traffic?" | Dependencies unavailable | Remove from Service endpoints |

**Startup probe pattern (JVM services):**
```yaml
startupProbe:
  httpGet:
    path: /actuator/health/liveness
    port: 8080
  failureThreshold: 30     # 30 x 10s = 5 min max startup window
  periodSeconds: 10
  timeoutSeconds: 5
```
- Runs ONLY during startup. Once it succeeds, liveness and readiness take over.
- Prevents Kubernetes from killing slow-starting JVMs (Flyway migrations, Kafka consumer rebalance).
- Without startup probe, `initialDelaySeconds` is a fixed guess - too low causes restart loops, too high delays readiness.

**Liveness probe - keep it simple:**
```yaml
livenessProbe:
  httpGet:
    path: /actuator/health/liveness    # Spring Boot: checks process is alive
    port: 8080
  periodSeconds: 15
  timeoutSeconds: 5
```
- Do NOT check external dependencies (DB, Kafka) in liveness - if DB is temporarily slow, liveness kills the pod, causing cascading restarts.
- Use a lightweight endpoint that responds even when dependencies are down.

**Readiness probe - check dependencies:**
```yaml
readinessProbe:
  httpGet:
    path: /actuator/health/readiness    # Spring Boot: checks DB, Redis, Kafka
    port: 8080
  periodSeconds: 10
  timeoutSeconds: 5
```
- Removes pod from Service endpoints if dependencies are unavailable.
- Traffic stops flowing to the pod until it recovers.

**Common mistake:** `initialDelaySeconds` on liveness/readiness instead of using startup probe. This is a guess, not a health check.

---

## 4. Security Contexts

**Industry standard (CNCF/Wiz/Snyk):** Every container should run as non-root with minimal privileges.

**Pod-level security context:**
```yaml
spec:
  securityContext:
    runAsNonRoot: true
    runAsUser: 1000
    runAsGroup: 1000
    fsGroup: 1000
    seccompProfile:
      type: RuntimeDefault
```

**Container-level security context:**
```yaml
containers:
  - name: app
    securityContext:
      allowPrivilegeEscalation: false
      readOnlyRootFilesystem: true
      capabilities:
        drop: ["ALL"]
```

**Workload-specific exceptions:**

| Workload | Writable paths needed | Notes |
|---|---|---|
| Spring Boot | `/tmp` (emptyDir) | Spring writes temp files |
| PostgreSQL | `/var/lib/postgresql/data` (PVC), `/var/run/postgresql` (emptyDir) | Postgres uid 999, refuses to start as root by default |
| Kafka | `/var/lib/kafka/data` (PVC) | KRaft needs writable log dirs |
| Redis | `/data` (emptyDir) | Redis uid 999 |
| Nginx | `/var/cache/nginx`, `/var/run` (emptyDir) | Needs root or special config |

**Example with emptyDir for writable paths:**
```yaml
containers:
  - name: app
    securityContext:
      readOnlyRootFilesystem: true
    volumeMounts:
      - name: tmp
        mountPath: /tmp
volumes:
  - name: tmp
    emptyDir: {}
```

---

## 5. Pod Disruption Budgets

**When to use:** Only when replicas > 1. PDBs protect against voluntary disruptions (node drains, cluster upgrades).

**Single-replica gotcha:** `minAvailable: 1` on a single-replica Deployment blocks `kubectl drain` entirely - the node can never be drained.

```yaml
# Only meaningful when replicas >= 2
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: app-pdb
spec:
  minAvailable: 1      # at least 1 pod must always be running
  # OR
  # maxUnavailable: 1  # at most 1 pod can be unavailable
  selector:
    matchLabels:
      app: my-app
```

**Decision:** Skip for single-replica demo/dev. Add when scaling to 2+ replicas.

---

## 6. Network Policies

**Default posture:** Default-deny all traffic, then explicitly allow what is needed. Without NetworkPolicies, all pods can talk to all pods - lateral movement risk.

```yaml
# Default deny all
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
---
# Allow specific traffic
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-frontend-to-gateway
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  ingress:
    - from:
        - podSelector:
            matchLabels:
              app: frontend
      ports:
        - port: 4000
```

**Requires:** A CNI that supports NetworkPolicy (Calico, Cilium, AWS VPC CNI with network policy support). Default EKS VPC CNI does NOT enforce NetworkPolicy - you need Calico or Cilium installed.

**Decision:** Skip for demo. Add for prod with Calico/Cilium.

---

## 7. Secret Management

**Rule:** Never commit secrets to git. Period.

**Options (least to most secure):**

| Method | Security | Complexity | Best for |
|---|---|---|---|
| `kubectl create secret` | Medium (audit log) | Low | Demo, single cluster |
| `secret.yaml` with placeholders | Low (manual replace) | Lowest | Demo only |
| Sealed Secrets (Bitnami) | High (encrypted in git) | Medium | Multi-cluster, GitOps |
| External Secrets Operator | Highest (AWS SM / Vault) | High | Production |

**Sealed Secrets pattern:**
```bash
# Install controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/latest/download/controller.yaml

# Encrypt a secret
kubectl create secret generic my-secret --dry-run=client --from-literal=password=abc -o yaml \
  | kubeseal -o yaml > sealed-secret.yaml
```

**External Secrets Operator pattern:**
```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: db-credentials
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: SecretStore
  target:
    name: db-credentials
  data:
    - secretKey: password
      remoteRef:
        key: prod/db/password
```

---

## 8. Graceful Shutdown

**Why it matters:** When Kubernetes deletes a pod, it sends SIGTERM. Without proper shutdown handling:
- In-flight HTTP requests are dropped
- Kafka outbox events may not be published
- Database connections may not be closed cleanly

**Spring Boot pattern:**
```yaml
spec:
  terminationGracePeriodSeconds: 60    # default is 30s - too short for JVM
  containers:
    - name: app
      lifecycle:
        preStop:
          exec:
            command: ["sh", "-c", "sleep 5"]    # wait for Service deregistration
```

**How it works:**
1. Pod enters `Terminating` state
2. Kubernetes removes pod from Service endpoints (stops new traffic)
3. `preStop` hook fires (sleep 5s - gives load balancer time to deregister)
4. SIGTERM sent to process
5. Spring Boot shuts down gracefully (finishes in-flight requests, flushes outbox)
6. After `terminationGracePeriodSeconds`, SIGKILL forces termination

**Recommended values:**

| Workload | terminationGracePeriodSeconds | Reason |
|---|---|---|
| Spring Boot (with Kafka outbox) | 60 | Needs time to flush outbox + finish HTTP requests |
| Spring Boot (simple REST) | 30 | Default is usually enough |
| PostgreSQL | 30 | `pg_ctl stop -m smart` waits for connections to close |
| Kafka | 30 | Graceful broker shutdown, log flush |
| Redis | 30 | RDB/AOF save if persistence enabled |

**Spring Boot graceful shutdown config (application.properties):**
```properties
server.shutdown=graceful
spring.lifecycle.timeout-per-shutdown-phase=30s
```

---

## 9. Pod Anti-Affinity

**When to use:** Multi-node clusters where you want to spread replicas across nodes. Prevents single-node failure from killing all replicas.

**Pattern:**
```yaml
spec:
  affinity:
    podAntiAffinity:
      preferredDuringSchedulingIgnoredDuringExecution:
        - weight: 100
          podAffinityTerm:
            labelSelector:
              matchExpressions:
                - key: app
                  operator: In
                  values: ["my-app"]
            topologyKey: kubernetes.io/hostname
```

**`preferred` vs `required`:**
- `preferredDuringSchedulingIgnoredDuringExecution` - scheduler tries to spread, but will co-locate if needed (safe for single-node)
- `requiredDuringSchedulingIgnoredDuringExecution` - scheduler will NOT place two pods on the same node (blocks scheduling if not enough nodes)

**Decision:** Skip for single-node demo. Use `preferred` for multi-node prod.

---

## Quick Checklist

Before deploying to production, verify:

- [ ] StatefulSets for all stateful workloads (DB, Kafka, Redis with persistence)
- [ ] Headless Services for StatefulSets (clusterIP: None)
- [ ] JVM `-XX:MaxRAMPercentage=75.0` on all Spring Boot containers
- [ ] `requests = limits` for Guaranteed QoS (or document why Burstable)
- [ ] Startup probe on all JVM services (failureThreshold: 30, periodSeconds: 10)
- [ ] Liveness probe checks process only, NOT dependencies
- [ ] Readiness probe checks dependencies (DB, Kafka, Redis)
- [ ] `terminationGracePeriodSeconds: 60` for Spring Boot with outbox
- [ ] Security context: `runAsNonRoot`, `readOnlyRootFilesystem`, `drop: ["ALL"]`
- [ ] PDBs when replicas > 1
- [ ] Network policies with Calico/Cilium
- [ ] Secrets via External Secrets Operator (never git)

---

## Sources

- Kubernetes docs: Probes, StatefulSets, Security Contexts, PDBs, Network Policies
- CNCF/Wiz/Snyk: Container security best practices
- Spring Boot docs: Graceful shutdown, virtual threads
- reintech.io: JVM resource sizing in Kubernetes
- DevOpsBoys/Spacelift: StatefulSet headless Service pattern
- Linux Foundation: CFS bandwidth control and CPU throttling
