package com.solara.insightservice.util;

/**
 * Formats an embedding as the Postgres/pgvector array literal used in
 * {@code vector_cosine_ops} queries ({@code '[0.1,0.2,...]'}). Shared by every
 * site that talks to pgvector — the merchant profile sync job, the embedding
 * worker, and the RAG context retriever previously each carried their own copy.
 */
public final class VectorLiterals {

    private VectorLiterals() {
    }

    public static String toPostgresLiteral(float[] values) {
        StringBuilder builder = new StringBuilder("[");
        for (int i = 0; i < values.length; i++) {
            if (i > 0) builder.append(",");
            builder.append(values[i]);
        }
        return builder.append("]").toString();
    }
}
