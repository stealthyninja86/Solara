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
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
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
    private final TransactionTemplate requiresNewTransactionTemplate;

    public BulkImportService(TransactionRepository transactionRepository,
                             OutboxRepository outboxRepository,
                             ImportJobRepository importJobRepository,
                             MeterRegistry meterRegistry,
                             PlatformTransactionManager transactionManager) {
        this.transactionRepository = transactionRepository;
        this.outboxRepository = outboxRepository;
        this.importJobRepository = importJobRepository;
        this.meterRegistry = meterRegistry;
        this.requiresNewTransactionTemplate = new TransactionTemplate(transactionManager);
        this.requiresNewTransactionTemplate.setPropagationBehavior(
                org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
    }

    @Async
    @Transactional
    public void processJsonImport(UUID jobId, UUID userId, List<CreateTransactionRequest> requests) {
        long start = System.currentTimeMillis();
        log.info("Bulk JSON import processing started: jobId={}, userId={}, rowCount={}", jobId, userId, requests.size());
        List<Transaction> transactions = requests.stream()
                .map(r -> {
                    Transaction transaction = new Transaction(userId, r.amount(),
                            TransactionService.sanitizeNarration(r.description()),
                            r.merchant(), r.paymentMode(), r.type(), true);
                    if (r.transactionDate() != null) {
                        transaction.setTimestamp(r.transactionDate().atStartOfDay(ZoneOffset.UTC).toInstant());
                    }
                    return transaction;
                })
                .toList();
        save(jobId, transactions, 0);
        log.info("Bulk JSON import completed: jobId={}, durationMs={}", jobId, System.currentTimeMillis() - start);
    }

    @Async
    @Transactional
    public void processCsvImport(UUID jobId, UUID userId, InputStream csvContent) throws IOException {
        long start = System.currentTimeMillis();
        log.info("Bulk CSV import processing started: jobId={}, userId={}", jobId, userId);
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
            log.warn("No header row found in CSV for job={}; marking job failed", jobId);
            failJob(jobId, 0, 0, "No header row found in the CSV file");
            return;
        }
        log.info("CSV header row found at line {} for job={}: {}", headerIndex + 1, jobId, records.get(headerIndex));

        ColumnRole[] roles = classifyColumns(records.get(headerIndex),
                records.subList(headerIndex + 1, records.size()));
        log.info("Classified CSV roles for job={}: {} (header columns={}, data rows={})",
                jobId, Arrays.toString(roles), records.get(headerIndex).size(),
                records.size() - headerIndex - 1);
        int dataRowCount = records.size() - headerIndex - 1;
        importJobRepository.findById(jobId).ifPresent(job -> {
            job.setTotalRows(dataRowCount);
            importJobRepository.save(job);
        });
        List<Transaction> transactions = new ArrayList<>(dataRowCount);
        int failedRows = 0;

        for (int i = headerIndex + 1; i < records.size(); i++) {
            CSVRecord record = records.get(i);
            if (record.size() == 1 && record.get(0).isBlank()) {
                log.debug("Skipping blank CSV line {} for job={}", i + 1, jobId);
                continue;
            }
            String narration = TransactionService.sanitizeNarration(valueAt(record, roles, ColumnRole.DESCRIPTION));
            if (narration.isEmpty()) narration = TransactionService.sanitizeNarration(valueAt(record, roles, ColumnRole.NARRATION));
            String merchant = valueAt(record, roles, ColumnRole.MERCHANT);
            if (narration.isEmpty() && merchant.isEmpty()) {
                failedRows++;
                log.warn("Skipping CSV line {} for job={}: no DESCRIPTION/MERCHANT value found (values={}, roles={})",
                        i + 1, jobId, record, Arrays.toString(roles));
                continue;
            }
            LocalDate transactionDate = parseDate(valueAt(record, roles, ColumnRole.DATE));
            if (hasRole(roles, ColumnRole.DATE) && transactionDate == null) {
                failedRows++;
                log.warn("Skipping CSV line {} for job={}: no valid date (values={}, roles={})",
                        i + 1, jobId, record, Arrays.toString(roles));
                continue;
            }

            BigDecimal debit = parseDecimal(valueAt(record, roles, ColumnRole.DEBIT));
            BigDecimal credit = parseDecimal(valueAt(record, roles, ColumnRole.CREDIT));
            BigDecimal amount = parseDecimal(valueAt(record, roles, ColumnRole.AMOUNT));

            boolean hasDebitCreditColumn = hasRole(roles, ColumnRole.DEBIT) || hasRole(roles, ColumnRole.CREDIT);
            PaymentMode mode = detectPaymentMode(narration.isEmpty() ? merchant : narration);

            Transaction transaction = null;
            if (debit != null && debit.signum() > 0) {
                transaction = new Transaction(userId, debit, narration, merchant, mode, TransactionType.DEBIT, true);
            } else if (credit != null && credit.signum() > 0) {
                transaction = new Transaction(userId, credit, narration, merchant, mode, TransactionType.CREDIT, true);
            } else if (amount != null) {
                transaction = new Transaction(userId, amount.abs(), narration, merchant, mode,
                        hasDebitCreditColumn
                                ? (amount.signum() >= 0 ? TransactionType.CREDIT : TransactionType.DEBIT)
                                : TransactionType.DEBIT, true);
            } else {
                failedRows++;
                log.warn("Skipping CSV line {} for job={}: no positive DEBIT/CREDIT/AMOUNT value found " +
                        "(debit={}, credit={}, amount={})", i + 1, jobId, debit, credit, amount);
            }
            if (transaction != null) {
                if (transactionDate != null) {
                    transaction.setTimestamp(transactionDate.atStartOfDay(ZoneOffset.UTC).toInstant());
                }
                log.debug("Imported CSV line {} for job={}: type={}, amount={}, merchant='{}', mode={}, date={}",
                        i + 1, jobId, transaction.getType(), transaction.getAmount(),
                        transaction.getMerchant(), transaction.getPaymentMode(), transactionDate);
                transactions.add(transaction);
            }
        }
        log.debug("Parsed {} CSV rows into transactions for job={} ({} failed)", transactions.size(), jobId, failedRows);
        save(jobId, transactions, failedRows);
        log.info("Bulk CSV import completed: jobId={}, rows={}, durationMs={}",
                jobId, transactions.size(), System.currentTimeMillis() - start);
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

        for (int col = 0; col < columns; col++) {
            if (roles[col] != ColumnRole.UNKNOWN) continue;
            String headerValue = header.get(col);
            Optional<ColumnRole> dictionaryRole = CsvHeaderDictionary.lookup(headerValue);
            if (dictionaryRole.isPresent()) {
                log.debug("classifyColumns(col={}): header '{}' matched header dictionary as {}", col, headerValue, dictionaryRole.get());
                roles[col] = dictionaryRole.get();
            }
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
        if (values.size() < 2) {
            log.debug("valueBasedRole(col={}): only {} non-empty value(s) in sample; returning UNKNOWN", col, values.size());
            return ColumnRole.UNKNOWN;
        }
        log.debug("valueBasedRole(col={}): sample values={}", col, values);

        ColumnRole role;
        if (values.stream().allMatch(BulkImportService::isDate)) {
            role = ColumnRole.DATE;
        } else if (values.stream().allMatch(v -> v.matches("\\d{10,16}"))) {
            role = ColumnRole.REF_NO;
        } else {
            boolean anyText = values.stream().anyMatch(BulkImportService::isTextValue);
            if (!anyText) {
                role = values.stream().allMatch(v -> parseDecimal(v) != null)
                        ? ColumnRole.AMOUNT
                        : ColumnRole.UNKNOWN;
            } else if (values.stream().anyMatch(BulkImportService::isDescriptionLike)) {
                role = ColumnRole.DESCRIPTION;
            } else if (values.stream().allMatch(BulkImportService::isMerchantLike)) {
                role = ColumnRole.MERCHANT;
            } else {
                role = ColumnRole.NARRATION;
            }
        }
        log.debug("valueBasedRole(col={}): classified as {}", col, role);
        return role;
    }

    private static boolean isTextValue(String value) {
        return value.chars().anyMatch(Character::isLetter) && parseDecimal(value) == null;
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

    private static LocalDate parseDate(String value) {
        if (value == null || value.isBlank()) return null;
        for (DateTimeFormatter fmt : DATE_FORMATS) {
            try { return LocalDate.parse(value.trim(), fmt); }
            catch (DateTimeParseException ignored) {}
        }
        return null;
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

    private void save(UUID jobId, List<Transaction> transactions, int failedRows) {
        long start = System.currentTimeMillis();
        try {
            ImportJob job = importJobRepository.findById(jobId)
                    .orElseThrow(() -> new IllegalArgumentException("Import job not found: " + jobId));
            job.setStatus(ImportJobStatus.PROCESSING);
            importJobRepository.save(job);
            transactionRepository.saveAll(transactions);
            outboxRepository.saveAll(transactions.stream().map(OutboxEntity::forTransaction).toList());
            job.setStatus(ImportJobStatus.COMPLETED);
            job.setImportedRows(transactions.size());
            job.setFailedRows(failedRows);
            job.setCompletedAt(Instant.now());
            LocalDate minDate = transactions.stream()
                    .map(t -> t.getTimestamp() != null
                            ? t.getTimestamp().atZone(java.time.ZoneOffset.UTC).toLocalDate()
                            : null)
                    .filter(java.util.Objects::nonNull)
                    .min(LocalDate::compareTo)
                    .orElse(null);
            LocalDate maxDate = transactions.stream()
                    .map(t -> t.getTimestamp() != null
                            ? t.getTimestamp().atZone(java.time.ZoneOffset.UTC).toLocalDate()
                            : null)
                    .filter(java.util.Objects::nonNull)
                    .max(LocalDate::compareTo)
                    .orElse(null);
            job.setMinDate(minDate);
            job.setMaxDate(maxDate);
            importJobRepository.save(job);
            outboxRepository.save(OutboxEntity.forBulkImportCompletion(job, transactions.size(), failedRows));

            meterRegistry.counter("solara.import.jobs", "outcome", "completed").increment();
            meterRegistry.counter("solara.import.rows", "outcome", "imported").increment(transactions.size());
            log.info("Bulk import save completed: jobId={}, status={}, rows={}, failedRows={}, outboxEntriesQueued={}, durationMs={}",
                    jobId, ImportJobStatus.COMPLETED, transactions.size(), failedRows, transactions.size(),
                    System.currentTimeMillis() - start);
        } catch (Exception e) {
            meterRegistry.counter("solara.import.jobs", "outcome", "failed").increment();
            log.error("Bulk import save failed: jobId={}, attemptedRows={}, failedRows={}, error={}",
                    jobId, transactions.size(), failedRows, e.getMessage(), e);
            failJob(jobId, transactions.size(), failedRows, e.getMessage());
            throw e;
        }
    }

    private void failJob(UUID jobId, int attemptedRows, int failedRows, String message) {
        requiresNewTransactionTemplate.executeWithoutResult(status ->
                importJobRepository.findById(jobId).ifPresent(job -> {
                    job.setStatus(ImportJobStatus.FAILED);
                    job.setTotalRows(Math.max(job.getTotalRows(), attemptedRows));
                    job.setFailedRows(failedRows);
                    job.setErrorReport(message != null && message.length() > 2000
                            ? message.substring(0, 2000) : message);
                    job.setCompletedAt(Instant.now());
                    importJobRepository.save(job);
                }));
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
