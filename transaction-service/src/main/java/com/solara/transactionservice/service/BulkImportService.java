package com.solara.transactionservice.service;

import com.solara.transactionservice.dto.request.CreateTransactionRequest;
import com.solara.transactionservice.model.ColumnRole;
import com.solara.transactionservice.model.ImportJob;
import com.solara.transactionservice.model.ImportJobStatus;
import com.solara.transactionservice.model.PaymentMode;
import com.solara.transactionservice.model.Transaction;
import com.solara.transactionservice.model.TransactionType;
import com.solara.transactionservice.outbox.OutboxEntity;
import com.solara.transactionservice.repository.ImportJobRepository;
import com.solara.transactionservice.repository.TransactionRepository;
import com.solara.transactionservice.repository.OutboxRepository;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.regex.Pattern;

@Service
public class BulkImportService {

    private static final List<DateTimeFormatter> DATE_FORMATS = List.of(
            DateTimeFormatter.ofPattern("dd/MM/yyyy"),
            DateTimeFormatter.ofPattern("d/M/yyyy"),
            DateTimeFormatter.ofPattern("dd-MM-yyyy"),
            DateTimeFormatter.ofPattern("yyyy-MM-dd"),
            DateTimeFormatter.ofPattern("dd/MM/yy"),
            DateTimeFormatter.ofPattern("d MMM yyyy"),
            DateTimeFormatter.ofPattern("dd-MMM-yyyy"));

    private static final Pattern BALANCE_PATTERN = Pattern.compile("balance|closing", Pattern.CASE_INSENSITIVE);
    private static final Pattern DEBIT_PATTERN = Pattern.compile("withdraw|debit|\\bdr\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern CREDIT_PATTERN = Pattern.compile("deposit|credit|\\bcr\\b", Pattern.CASE_INSENSITIVE);

    private final TransactionRepository transactionRepository;
    private final OutboxRepository outboxRepository;
    private final ImportJobRepository importJobRepository;

    public BulkImportService(TransactionRepository transactionRepository,
                             OutboxRepository outboxRepository,
                             ImportJobRepository importJobRepository) {
        this.transactionRepository = transactionRepository;
        this.outboxRepository = outboxRepository;
        this.importJobRepository = importJobRepository;
    }

    @Async
    @Transactional
    public void processJsonImport(UUID jobId, UUID userId, List<CreateTransactionRequest> requests) {
        save(jobId, requests.stream()
                .map(r -> new Transaction(userId, r.amount(), r.description(),
                        r.merchant(), r.paymentMode(), r.type(), true))
                .toList());
    }

    @Async
    @Transactional
    public void processCsvImport(UUID jobId, UUID userId, InputStream csvContent) throws IOException {
        List<CSVRecord> records = CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setTrim(true)
                .setIgnoreEmptyLines(true)
                .build()
                .parse(new InputStreamReader(csvContent))
                .getRecords();

        ColumnRole[] roles = classifyColumns(records);
        List<Transaction> transactions = new ArrayList<>(records.size());

        for (CSVRecord record : records) {
            String narration = valueAt(record, roles, ColumnRole.NARRATION);
            if (narration.isEmpty()) continue;

            BigDecimal debit = parseDecimal(valueAt(record, roles, ColumnRole.DEBIT));
            BigDecimal credit = parseDecimal(valueAt(record, roles, ColumnRole.CREDIT));
            BigDecimal amount = parseDecimal(valueAt(record, roles, ColumnRole.AMOUNT));

            PaymentMode mode = detectPaymentMode(narration);
            if (debit != null && debit.signum() > 0) {
                transactions.add(new Transaction(userId, debit, narration, null, mode, TransactionType.DEBIT, true));
            } else if (credit != null && credit.signum() > 0) {
                transactions.add(new Transaction(userId, credit, narration, null, mode, TransactionType.CREDIT, true));
            } else if (amount != null) {
                transactions.add(new Transaction(userId, amount.abs(), narration, null, mode,
                        amount.signum() >= 0 ? TransactionType.CREDIT : TransactionType.DEBIT, true));
            }
        }
        save(jobId, transactions);
    }

    private ColumnRole[] classifyColumns(List<CSVRecord> records) {
        int columns = records.isEmpty() ? 0 : records.get(0).size();
        List<CSVRecord> sample = records.subList(0, Math.min(records.size(), 10));
        ColumnRole[] roles = new ColumnRole[columns];
        String[] headers = records.isEmpty() ? new String[0]
                : records.get(0).getParser().getHeaderNames().toArray(new String[0]);

        for (int col = 0; col < columns; col++) {
            String header = col < headers.length ? headers[col] : "";
            if (header.toLowerCase().contains("date") || header.toLowerCase().contains("dt")) {
                roles[col] = ColumnRole.DATE;
            } else if (header.toLowerCase().contains("chq") || header.toLowerCase().contains("ref") || header.toLowerCase().contains("cheque")) {
                roles[col] = ColumnRole.REF_NO;
            } else if (DEBIT_PATTERN.matcher(header).find()) {
                roles[col] = ColumnRole.DEBIT;
            } else if (CREDIT_PATTERN.matcher(header).find()) {
                roles[col] = ColumnRole.CREDIT;
            } else if (BALANCE_PATTERN.matcher(header).find()) {
                roles[col] = ColumnRole.BALANCE;
            }
        }

        for (int col = 0; col < columns; col++) {
            if (roles[col] != null) continue;
            roles[col] = valueBasedRole(sample, col);
        }

        return roles;
    }

    private ColumnRole valueBasedRole(List<CSVRecord> sample, int col) {
        List<String> values = new ArrayList<>(3);
        for (CSVRecord record : sample) {
            if (col >= record.size()) continue;
            String v = record.get(col).trim();
            if (!v.isEmpty()) values.add(v);
            if (values.size() == 3) break;
        }
        if (values.size() < 2) return ColumnRole.UNKNOWN;

        boolean allDate = true, allRef = true, allText = true, allNumeric = true;
        for (String v : values) {
            if (!isDate(v)) allDate = false;
            if (!v.matches("\\d{10,16}")) allRef = false;
            if (v.length() <= 15 || v.matches("[\\d.,\\-+]+")) allText = false;
            if (parseDecimal(v) == null) allNumeric = false;
        }

        if (allDate) return ColumnRole.DATE;
        if (allRef) return ColumnRole.REF_NO;
        if (allText) return ColumnRole.NARRATION;
        if (allNumeric) return ColumnRole.AMOUNT;
        if (values.stream().anyMatch(v -> v.length() > 10)) return ColumnRole.NARRATION;
        return ColumnRole.UNKNOWN;
    }

    private static boolean isDate(String value) {
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try { LocalDate.parse(value, fmt); return true; }
            catch (DateTimeParseException ignored) {}
        }
        return false;
    }

    private static String valueAt(CSVRecord record, ColumnRole[] roles, ColumnRole role) {
        for (int i = 0; i < roles.length; i++) {
            if (roles[i] == role && i < record.size()) return record.get(i);
        }
        return "";
    }

    private void save(UUID jobId, List<Transaction> transactions) {
        ImportJob job = importJobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Import job not found: " + jobId));
        job.setStatus(ImportJobStatus.PROCESSING);
        importJobRepository.save(job);
        transactionRepository.saveAll(transactions);
        outboxRepository.saveAll(transactions.stream().map(OutboxEntity::forTransaction).toList());
        job.setStatus(ImportJobStatus.COMPLETED);
        job.setImportedRows(transactions.size());
        job.setCompletedAt(Instant.now());
        importJobRepository.save(job);
        outboxRepository.save(OutboxEntity.forBulkImportCompletion(job, transactions.size(), 0));
    }

    private static BigDecimal parseDecimal(String raw) {
        if (raw == null || raw.isBlank()) return null;
        try {
            return new BigDecimal(raw.trim().replaceAll("[₹$€£,]", ""));
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private static PaymentMode detectPaymentMode(String narration) {
        if (narration == null) return PaymentMode.OTHER;
        String upper = narration.toUpperCase();
        if (upper.contains("UPI")) return PaymentMode.UPI;
        if (upper.contains("NEFT")) return PaymentMode.NEFT;
        if (upper.contains("RTGS")) return PaymentMode.RTGS;
        if (upper.contains("IMPS")) return PaymentMode.IMPS;
        if (upper.contains("POS") || upper.contains("SWIPE")) return PaymentMode.DEBIT_CARD;
        if (upper.contains("CHQ")) return PaymentMode.CHEQUE;
        if (upper.contains("CHRG") || upper.contains("CHG") || upper.contains("COMMISSION"))
            return PaymentMode.ONLINE;
        return PaymentMode.OTHER;
    }
}
