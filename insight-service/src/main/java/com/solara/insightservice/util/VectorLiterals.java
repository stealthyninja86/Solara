package com.solara.insightservice.util;

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
