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
import io.micrometer.core.instrument.MeterRegistry;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
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

    private static final Logger log = LoggerFactory.getLogger(BulkImportService.class);

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
    private static final Pattern DESCRIPTION_VERB_PATTERN = Pattern.compile(
            "\\b(payment|transfer|sent|received|paid|purchase|refund|charge|fee|interest|credited|debited)\\b",
            Pattern.CASE_INSENSITIVE);

    private final TransactionRepository transactionRepository;
    private final OutboxRepository outboxRepository;
    private final ImportJobRepository importJobRepository;
    private final MeterRegistry meterRegistry;

    public BulkImportService(TransactionRepository transactionRepository,
                             OutboxRepository outboxRepository,
                             ImportJobRepository importJobRepository,
                             MeterRegistry meterRegistry) {
        this.transactionRepository = transactionRepository;
        this.outboxRepository = outboxRepository;
        this.importJobRepository = importJobRepository;
        this.meterRegistry = meterRegistry;
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
                .setTrim(true)
                .setIgnoreEmptyLines(true)
                .build()
                .parse(new InputStreamReader(csvContent))
                .getRecords();

        int headerIndex = -1;
        for (int i = 0; i < records.size(); i++) {
            if (isHeaderRow(records.get(i))) {
                headerIndex = i;
                break;
            }
        }
        if (headerIndex < 0) {
            log.warn("No header row found in CSV for job={}; skipping import", jobId);
            return;
        }

        ColumnRole[] roles = classifyColumns(records.get(headerIndex),
                records.subList(headerIndex + 1, records.size()));
        List<Transaction> transactions = new ArrayList<>(records.size() - headerIndex - 1);

        for (int i = headerIndex + 1; i < records.size(); i++) {
            CSVRecord record = records.get(i);
            String narration = valueAt(record, roles, ColumnRole.DESCRIPTION);
            if (narration.isEmpty()) narration = valueAt(record, roles, ColumnRole.NARRATION);
            String merchant = valueAt(record, roles, ColumnRole.MERCHANT);
            if (narration.isEmpty() && merchant.isEmpty()) continue;

            BigDecimal debit = parseDecimal(valueAt(record, roles, ColumnRole.DEBIT));
            BigDecimal credit = parseDecimal(valueAt(record, roles, ColumnRole.CREDIT));
            BigDecimal amount = parseDecimal(valueAt(record, roles, ColumnRole.AMOUNT));

            boolean hasDebitCreditColumn = hasRole(roles, ColumnRole.DEBIT) || hasRole(roles, ColumnRole.CREDIT);
            PaymentMode mode = detectPaymentMode(narration.isEmpty() ? merchant : narration);
            if (debit != null && debit.signum() > 0) {
                transactions.add(new Transaction(userId, debit, narration, merchant, mode, TransactionType.DEBIT, true));
            } else if (credit != null && credit.signum() > 0) {
                transactions.add(new Transaction(userId, credit, narration, merchant, mode, TransactionType.CREDIT, true));
            } else if (amount != null) {
                transactions.add(new Transaction(userId, amount.abs(), narration, merchant, mode,
                        hasDebitCreditColumn
                                ? (amount.signum() >= 0 ? TransactionType.CREDIT : TransactionType.DEBIT)
                                : TransactionType.DEBIT, true));
            }
        }
        save(jobId, transactions);
    }

    private boolean isHeaderRow(CSVRecord record) {
        int matches = 0;
        for (String value : record) {
            String v = value.toLowerCase();
            if (v.contains("date") || v.contains("narration") || v.contains("chq")
                    || v.contains("ref") || v.contains("cheque") || v.contains("withdraw")
                    || v.contains("debit") || v.contains("deposit") || v.contains("credit")
                    || v.contains("balance") || v.contains("closing") || v.contains("merchant")
                    || v.contains("amount") || v.contains("paymentmode") || v.contains("description")) {
                matches++;
            }
        }
        return matches >= 2;
    }

    private ColumnRole[] classifyColumns(CSVRecord header, List<CSVRecord> dataRecords) {
        int columns = header.size();
        List<CSVRecord> sample = dataRecords.subList(0, Math.min(dataRecords.size(), 10));
        ColumnRole[] roles = new ColumnRole[columns];

        for (int col = 0; col < columns; col++) {
            String headerValue = col < header.size() ? header.get(col).toLowerCase() : "";
            if (DEBIT_PATTERN.matcher(headerValue).find()) {
                roles[col] = ColumnRole.DEBIT;
            } else if (CREDIT_PATTERN.matcher(headerValue).find()) {
                roles[col] = ColumnRole.CREDIT;
            } else if (BALANCE_PATTERN.matcher(headerValue).find()) {
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

        if (values.stream().allMatch(BulkImportService::isDate)) return ColumnRole.DATE;
        if (values.stream().allMatch(v -> v.matches("\\d{10,16}"))) return ColumnRole.REF_NO;

        boolean anyText = values.stream().anyMatch(BulkImportService::isTextValue);
        if (!anyText) {
            if (values.stream().allMatch(v -> parseDecimal(v) != null)) return ColumnRole.AMOUNT;
            return ColumnRole.UNKNOWN;
        }

        if (values.stream().anyMatch(BulkImportService::isDescriptionLike)) return ColumnRole.DESCRIPTION;
        if (values.stream().allMatch(BulkImportService::isMerchantLike)) return ColumnRole.MERCHANT;
        return ColumnRole.NARRATION;
    }

    private static boolean isTextValue(String value) {
        return value.matches(".*\\p{L}.*") && parseDecimal(value) == null;
    }

    private static boolean isDescriptionLike(String value) {
        return value.length() > 25 || DESCRIPTION_VERB_PATTERN.matcher(value).find();
    }

    private static boolean isMerchantLike(String value) {
        return value.length() >= 3
                && value.length() <= 40
                && value.matches("[\\p{L}\\p{N}.&'\\- ]+")
                && !DESCRIPTION_VERB_PATTERN.matcher(value).find();
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

    private static boolean hasRole(ColumnRole[] roles, ColumnRole role) {
        for (ColumnRole candidate : roles) {
            if (candidate == role) return true;
        }
        return false;
    }

    private void save(UUID jobId, List<Transaction> transactions) {
        try {
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

            meterRegistry.counter("solara.import.jobs", "outcome", "completed").increment();
            meterRegistry.counter("solara.import.rows", "outcome", "imported").increment(transactions.size());
        } catch (Exception e) {
            meterRegistry.counter("solara.import.jobs", "outcome", "failed").increment();
            throw e;
        }
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
