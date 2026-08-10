package com.solara.transactionservice.unit;

import com.solara.transactionservice.service.TransactionService;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TransactionServiceTest {

    @Test
    void sanitizeNarrationHandlesNullOrBlankInput() {
        assertThat(TransactionService.sanitizeNarration(null)).isNull();
        assertThat(TransactionService.sanitizeNarration("   ")).isEqualTo("   ");
    }

    @Test
    void sanitizeNarrationCollapsesRepeatedWhitespace() {
        assertThat(TransactionService.sanitizeNarration("NEFT   CREDIT  ICICI  ")).isEqualTo("NEFT CREDIT ICICI");
    }
}