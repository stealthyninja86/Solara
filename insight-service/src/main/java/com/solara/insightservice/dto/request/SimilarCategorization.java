package com.solara.insightservice.dto.request;

import com.solara.insightservice.model.TransactionCategory;

public record SimilarCategorization(String merchant, TransactionCategory category, String description) {}
