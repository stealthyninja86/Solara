package com.solara.transactionservice.dto.response;

import com.solara.transactionservice.model.ImportJobStatus;

import java.time.Instant;
import java.time.LocalDate;
import java.util.UUID;

public record BulkJobResponse(
        UUID jobId, ImportJobStatus status,
        int totalRows, int importedRows, int failedRows,
        String errorReport,
        Instant createdAt, Instant completedAt,
        LocalDate minDate, LocalDate maxDate
) {}
