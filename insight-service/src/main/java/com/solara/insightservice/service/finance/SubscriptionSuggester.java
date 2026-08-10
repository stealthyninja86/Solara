package com.solara.insightservice.service.finance;

import com.solara.insightservice.dto.response.SubscriptionResponse;
import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.model.TransactionCategory;
import com.solara.insightservice.repository.CategorizedTransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
public class SubscriptionSuggester {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionSuggester.class);

    private static final int LOOKBACK_DAYS = 365;

    private final CategorizedTransactionRepository categorizedTransactionRepository;

    public SubscriptionSuggester(CategorizedTransactionRepository categorizedTransactionRepository) {
        this.categorizedTransactionRepository = categorizedTransactionRepository;
    }

    public List<SubscriptionResponse> suggest(UUID userId) {
        long start = System.currentTimeMillis();
        Instant since = Instant.now().minus(LOOKBACK_DAYS, ChronoUnit.DAYS);
        Map<String, List<CategorizedTransaction>> paymentsByMerchant = categorizedTransactionRepository
                .findDebitsSince(userId, since)
                .stream()
                .filter(transaction -> transaction.getNormalizedMerchant() != null
                        && !transaction.getNormalizedMerchant().isBlank())
                .collect(Collectors.groupingBy(CategorizedTransaction::getNormalizedMerchant));

        List<SubscriptionResponse> result = paymentsByMerchant.values().stream()
                .filter(payments -> payments.size() >= 2)
                .filter(payments -> distinctMonths(payments) >= 2)
                .map(this::toSubscriptionResponse)
                .sorted(Comparator.comparing(SubscriptionResponse::amount, Comparator.reverseOrder()))
                .limit(20)
                .toList();
        log.debug("Subscriptions suggested: userId={}, candidateMerchants={}, suggestions={}, durationMs={}",
                userId, paymentsByMerchant.size(), result.size(), System.currentTimeMillis() - start);
        return result;
    }

    private SubscriptionResponse toSubscriptionResponse(List<CategorizedTransaction> payments) {
        String merchant = payments.stream()
                .map(CategorizedTransaction::getMerchant)
                .filter(name -> name != null && !name.isBlank())
                .findFirst()
                .orElse(payments.getFirst().getNormalizedMerchant());
        BigDecimal amount = payments.stream()
                .map(CategorizedTransaction::getAmount)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .divide(BigDecimal.valueOf(payments.size()), 2, RoundingMode.HALF_UP);
        TransactionCategory category = payments.stream()
                .map(CategorizedTransaction::getCategory)
                .filter(Objects::nonNull)
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()))
                .entrySet().stream()
                .max(Comparator.comparingLong(Map.Entry::getValue))
                .map(Map.Entry::getKey)
                .orElse(null);
        LocalDate lastPaid = payments.stream()
                .map(transaction -> transaction.getCreatedAt().atZone(ZoneId.of("UTC")).toLocalDate())
                .max(Comparator.naturalOrder())
                .orElse(null);
        return new SubscriptionResponse(merchant, category, amount, "monthly", payments.size(), lastPaid);
    }

    private long distinctMonths(List<CategorizedTransaction> payments) {
        return payments.stream()
                .map(transaction -> YearMonth.from(transaction.getCreatedAt().atZone(ZoneId.of("UTC"))))
                .distinct()
                .count();
    }
}