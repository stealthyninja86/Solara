package com.solara.insightservice.dto.request;

import com.solara.insightservice.model.TransactionCategory;

import jakarta.validation.constraints.NotNull;

public record RecategorizeRequest(
    @NotNull TransactionCategory category
) {}
