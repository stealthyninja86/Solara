package com.solara.transactionservice.service;

import com.solara.transactionservice.model.ColumnRole;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

public final class CsvHeaderDictionary {

    private static final Map<ColumnRole, Pattern> PATTERNS = buildPatterns();

    private CsvHeaderDictionary() {
    }

    public static Optional<ColumnRole> lookup(String header) {
        String normalized = normalize(header);
        if (normalized.isEmpty()) {
            return Optional.empty();
        }
        for (Map.Entry<ColumnRole, Pattern> entry : PATTERNS.entrySet()) {
            if (entry.getValue().matcher(normalized).matches()) {
                return Optional.of(entry.getKey());
            }
        }
        return Optional.empty();
    }

    private static Map<ColumnRole, Pattern> buildPatterns() {
        Map<ColumnRole, Pattern> patterns = new LinkedHashMap<>();
        patterns.put(ColumnRole.DATE, compilePattern(
                "date", "dated", "txn date", "transaction date", "value date",
                "posting date", "posted date", "booking date", "date of transaction"));
        patterns.put(ColumnRole.DESCRIPTION, compilePattern(
                "details", "narration", "description", "particulars", "remarks",
                "transaction details", "transaction particulars", "transaction description",
                "transaction remarks", "trans details", "trans particulars", "txn details",
                "txn description", "description of transaction", "description of transactions"));
        patterns.put(ColumnRole.REF_NO, compilePattern(
                "ref", "ref no", "ref number", "ref no/cheque no", "ref/cheque no",
                "reference", "reference no", "reference number", "reference id",
                "utr", "utr no", "utr number", "cheque no", "cheque number", "chq no",
                "chq/ref no", "instrument no", "instrument number", "transaction id",
                "transaction reference", "transaction no", "txn ref", "txn ref no",
                "txn id", "serial no"));
        patterns.put(ColumnRole.DEBIT, compilePattern(
                "debit", "debits", "dr", "withdrawal", "withdrawals", "withdrawal amount",
                "withdrawal amt", "with amt", "with. amt", "debit amount", "dr amount",
                "dr amt", "amount debited", "paid out", "withdrawal (dr)", "debit (dr)"));
        patterns.put(ColumnRole.CREDIT, compilePattern(
                "credit", "credits", "cr", "deposit", "deposits", "deposit amount",
                "deposit amt", "dep amt", "dep. amt", "credit amount", "cr amount",
                "cr amt", "amount credited", "paid in", "deposit (cr)", "credit (cr)"));
        patterns.put(ColumnRole.BALANCE, compilePattern(
                "balance", "bal", "closing balance", "running balance", "book balance",
                "opening balance", "balance (dr/cr)", "closing bal", "balance amount",
                "balance amt"));
        patterns.put(ColumnRole.AMOUNT, compilePattern(
                "amount", "transaction amount", "txn amount", "txn amt", "transaction value"));
        patterns.put(ColumnRole.MERCHANT, compilePattern(
                "merchant", "merchant name", "payee", "vendor", "counterparty", "party"));
        return patterns;
    }

    private static Pattern compilePattern(String... tokens) {
        String joined = Arrays.stream(tokens)
                .map(CsvHeaderDictionary::normalize)
                .map(Pattern::quote)
                .collect(Collectors.joining("|"));
        return Pattern.compile("^(" + joined + ")$", Pattern.CASE_INSENSITIVE);
    }

    private static String normalize(String header) {
        return header.replace("\uFEFF", "")
                .toLowerCase(Locale.ROOT)
                .replaceAll("[./]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }
}
