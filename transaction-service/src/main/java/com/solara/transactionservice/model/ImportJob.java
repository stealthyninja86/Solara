package com.solara.transactionservice.model;

import jakarta.persistence.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

@Entity
@Table(name = "import_jobs")
public class ImportJob {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImportJobStatus status;

    @Column(name = "total_rows", nullable = false)
    private int totalRows;

    @Column(name = "imported_rows", nullable = false)
    private int importedRows;

    @Column(name = "failed_rows", nullable = false)
    private int failedRows;

    @Column(name = "error_report", columnDefinition = "TEXT")
    private String errorReport;

    @Column(name = "raw_file_path", length = 500)
    private String rawFilePath;

    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "min_date")
    private LocalDate minDate;

    @Column(name = "max_date")
    private LocalDate maxDate;

    public ImportJob() {}

    public ImportJob(UUID userId, int totalRows) {
        this.userId = userId;
        this.totalRows = totalRows;
        this.status = ImportJobStatus.PENDING;
        this.importedRows = 0;
        this.failedRows = 0;
    }

    @PrePersist
    protected void onCreate() {
        createdAt = Instant.now();
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public UUID getUserId() { return userId; }
    public void setUserId(UUID userId) { this.userId = userId; }
    public ImportJobStatus getStatus() { return status; }
    public void setStatus(ImportJobStatus status) { this.status = status; }
    public int getTotalRows() { return totalRows; }
    public void setTotalRows(int totalRows) { this.totalRows = totalRows; }
    public int getImportedRows() { return importedRows; }
    public void setImportedRows(int importedRows) { this.importedRows = importedRows; }
    public int getFailedRows() { return failedRows; }
    public void setFailedRows(int failedRows) { this.failedRows = failedRows; }
    public String getErrorReport() { return errorReport; }
    public void setErrorReport(String errorReport) { this.errorReport = errorReport; }
    public String getRawFilePath() { return rawFilePath; }
    public void setRawFilePath(String rawFilePath) { this.rawFilePath = rawFilePath; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
    public Instant getCompletedAt() { return completedAt; }
    public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
    public LocalDate getMinDate() { return minDate; }
    public void setMinDate(LocalDate minDate) { this.minDate = minDate; }
    public LocalDate getMaxDate() { return maxDate; }
    public void setMaxDate(LocalDate maxDate) { this.maxDate = maxDate; }
}
