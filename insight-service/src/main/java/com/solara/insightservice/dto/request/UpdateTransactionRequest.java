package com.solara.insightservice.dto.request;

import com.solara.insightservice.model.TransactionCategory;

import jakarta.validation.constraints.Size;

public record UpdateTransactionRequest(
    @Size(max = 200) String merchant,
    @Size(max = 500) String originalDescription,
    @Size(max = 500) String description,
    TransactionCategory category,
    Boolean needsReview
) {}
