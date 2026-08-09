package com.solara.insightservice.service;

import com.solara.insightservice.dto.request.SubscriptionRequest;
import com.solara.insightservice.dto.response.TrackedSubscriptionResponse;
import com.solara.insightservice.model.CategorizedTransaction;
import com.solara.insightservice.model.Subscription;
import com.solara.insightservice.model.SubscriptionFrequency;
import com.solara.insightservice.model.SubscriptionKind;
import com.solara.insightservice.model.SubscriptionStatus;
import com.solara.insightservice.repository.SubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class SubscriptionService {

    private static final Logger log = LoggerFactory.getLogger(SubscriptionService.class);

    private static final int MATCHER_EARLY_DAYS = 3;

    private static final int DEFAULT_BILL_TOLERANCE_PERCENT = 20;
    private static final int MIN_BILL_TOLERANCE_PERCENT = 5;
    private static final int MAX_BILL_TOLERANCE_PERCENT = 50;

    private final SubscriptionRepository subscriptionRepository;

    public SubscriptionService(SubscriptionRepository subscriptionRepository) {
        this.subscriptionRepository = subscriptionRepository;
    }

    @Transactional(readOnly = true)
    public List<TrackedSubscriptionResponse> listTracked(UUID userId) {
        LocalDate today = LocalDate.now();
        return subscriptionRepository.findByUserIdOrderByStatusAscNextExpectedDateAsc(userId).stream()
                .map(subscription -> toResponse(subscription, today))
                .toList();
    }

    @Transactional
    public TrackedSubscriptionResponse createTracked(UUID userId, SubscriptionRequest request) {
        SubscriptionFrequency frequency = validateFrequency(request);
        SubscriptionKind kind = validateKind(request);
        Subscription subscription = new Subscription(
                UUID.randomUUID(),
                userId,
                request.merchant().trim(),
                CategorizedTransaction.normalizeMerchant(request.merchant().trim()),
                frequency,
                request.amount(),
                LocalDate.now().plus(frequency.getPeriod()));
        applyObligationFields(subscription, request, kind);
        log.info("tracked obligation created: userId={}, merchant={}, kind={}, frequency={}, amount={}",
                userId, subscription.getMerchant(), kind, frequency, request.amount());
        return toResponse(subscriptionRepository.save(subscription), LocalDate.now());
    }

    @Transactional
    public TrackedSubscriptionResponse updateTracked(UUID userId, UUID subscriptionId, SubscriptionRequest request) {
        Subscription subscription = findOwned(userId, subscriptionId);
        if (subscription.getStatus() == SubscriptionStatus.CANCELLED) {
            throw new IllegalArgumentException("cancelled subscriptions cannot be edited");
        }
        if (subscription.getStatus() == SubscriptionStatus.PAID_OFF) {
            throw new IllegalArgumentException("paid-off obligations cannot be edited");
        }
        SubscriptionFrequency frequency = validateFrequency(request);
        SubscriptionKind kind = validateKind(request);
        subscription.setMerchant(request.merchant().trim());
        subscription.setNormalizedMerchant(CategorizedTransaction.normalizeMerchant(request.merchant().trim()));
        subscription.setFrequency(frequency);
        subscription.setAmount(request.amount());
        applyObligationFields(subscription, request, kind);
        log.info("tracked obligation updated: userId={}, subscriptionId={}, merchant={}, kind={}, frequency={}, amount={}",
                userId, subscriptionId, subscription.getMerchant(), kind, frequency, subscription.getAmount());
        return toResponse(subscriptionRepository.save(subscription), LocalDate.now());
    }

    @Transactional
    public TrackedSubscriptionResponse cancelTracked(UUID userId, UUID subscriptionId) {
        Subscription subscription = findOwned(userId, subscriptionId);
        if (subscription.getStatus() == SubscriptionStatus.CANCELLED) {
            throw new IllegalArgumentException("subscription is already cancelled");
        }
        if (subscription.getStatus() == SubscriptionStatus.PAID_OFF) {
            throw new IllegalArgumentException("paid-off obligations cannot be cancelled");
        }
        subscription.setStatus(SubscriptionStatus.CANCELLED);
        log.info("tracked obligation cancelled: userId={}, subscriptionId={}", userId, subscriptionId);
        return toResponse(subscriptionRepository.save(subscription), LocalDate.now());
    }

    private Subscription findOwned(UUID userId, UUID subscriptionId) {
        return subscriptionRepository.findByUserIdAndId(userId, subscriptionId)
                .orElseThrow(() -> new IllegalArgumentException("tracked subscription not found"));
    }

    private SubscriptionFrequency validateFrequency(SubscriptionRequest request) {
        if (request.merchant() == null || request.merchant().isBlank()) {
            throw new IllegalArgumentException("merchant is required");
        }
        if (request.amount() == null || request.amount().signum() <= 0) {
            throw new IllegalArgumentException("amount must be greater than zero");
        }
        try {
            return SubscriptionFrequency.valueOf(request.frequency().toUpperCase());
        } catch (Exception ex) {
            throw new IllegalArgumentException("frequency must be one of DAILY, WEEKLY, MONTHLY, YEARLY");
        }
    }

    private SubscriptionKind validateKind(SubscriptionRequest request) {
        if (request.kind() == null || request.kind().isBlank()) {
            return SubscriptionKind.SUBSCRIPTION;
        }
        try {
            return SubscriptionKind.valueOf(request.kind().toUpperCase());
        } catch (Exception ex) {
            throw new IllegalArgumentException("kind must be one of SUBSCRIPTION, BILL, RENT, EMI");
        }
    }

    private int resolveTolerance(SubscriptionKind kind, Integer tolerance) {
        if (kind != SubscriptionKind.BILL) {
            return 0;
        }
        if (tolerance == null) {
            return DEFAULT_BILL_TOLERANCE_PERCENT;
        }
        if (tolerance < MIN_BILL_TOLERANCE_PERCENT || tolerance > MAX_BILL_TOLERANCE_PERCENT) {
            throw new IllegalArgumentException(
                    "amount tolerance must be between " + MIN_BILL_TOLERANCE_PERCENT + " and "
                            + MAX_BILL_TOLERANCE_PERCENT + " percent");
        }
        return tolerance;
    }

    private int resolveTenure(SubscriptionKind kind, Integer tenureMonths) {
        if (kind != SubscriptionKind.EMI) {
            return 0;
        }
        if (tenureMonths == null || tenureMonths <= 0) {
            throw new IllegalArgumentException("tenure months is required for EMIs");
        }
        return tenureMonths;
    }

    private int resolvePaidMonths(SubscriptionKind kind, Integer paidMonths, int tenureMonths) {
        if (kind != SubscriptionKind.EMI) {
            return 0;
        }
        int paid = paidMonths != null ? paidMonths : 0;
        if (paid < 0 || paid > tenureMonths) {
            throw new IllegalArgumentException("paid months must be between 0 and the tenure");
        }
        return paid;
    }

    private void applyObligationFields(Subscription subscription, SubscriptionRequest request, SubscriptionKind kind) {
        int tolerance = resolveTolerance(kind, request.amountTolerancePercent());
        int tenure = resolveTenure(kind, request.tenureMonths());
        int paid = resolvePaidMonths(kind, request.paidMonths(), tenure);
        subscription.setKind(kind);
        subscription.setAmountTolerancePercent(kind == SubscriptionKind.BILL ? tolerance : null);
        subscription.setTenureMonths(kind == SubscriptionKind.EMI ? tenure : null);
        subscription.setPaidMonths(kind == SubscriptionKind.EMI ? paid : 0);
        if (request.payeeMerchant() != null && !request.payeeMerchant().isBlank()) {
            subscription.setPayeeMerchant(CategorizedTransaction.normalizeMerchant(request.payeeMerchant().trim()));
        } else {
            subscription.setPayeeMerchant(null);
        }
    }

    /**
     * Charge matcher: every saved DEBIT categorized transaction is weighed against this user's
     * active tracked obligations. A charge claims a cycle when the normalized merchant (or the
     * linked payee merchant for bills) matches, the amount falls inside the per-kind band, and the
     * charge date falls inside the expected window
     * [nextExpectedDate - 3 days, nextExpectedDate + frequency grace days].
     *
     * <p>Amount rules per kind: SUBSCRIPTION/RENT/EMI require the exact tracked amount (the user
     * keeps it accurate via the manage modal); BILL accepts the tracked amount within the declared
     * tolerance band ({@code amount ± tolerance%}, default ±20%).
     *
     * <p>On a match the tracked {@code amount} follows the observed charge (bills drift month to
     * month, so the anchor re-centers on reality), we record the charge and roll the expected date
     * forward one period from the ACTUAL charge date. EMIs also advance {@code paidMonths}; the
     * obligation flips to PAID_OFF once the final EMI lands. State flags (ON_SCHEDULE / LATE /
     * NOT_SEEN) are derived from lastChargeDate + the rolled nextExpectedDate.
     *
     * <p>Replays: when a {@code transaction.updated.v1} event re-delivers a charge that already
     * matched (same transaction id), we re-sync the amount only — no window check, no date roll,
     * no EMI advance — so an amount correction propagates to the card without double-counting the
     * cycle.
     *
     * <p>Idempotency is per-window, not per-charge: two same-merchant same-amount debits inside
     * one window each roll the date forward once (a genuinely rare double-bill). We deliberately
     * do not add a same-day guard — if a provider re-bills in the same cycle that second charge is
     * usually a real event worth surfacing as its own charge.
     *
     * @param debit the categorized DEBIT transaction just saved
     */
    @Transactional
    public void matchCharge(CategorizedTransaction debit) {
        if (debit.getUserId() == null || debit.getNormalizedMerchant() == null || debit.getCreatedAt() == null
                || debit.getAmount() == null) {
            return;
        }
        List<Subscription> candidates = new ArrayList<>(subscriptionRepository
                .findByUserIdAndNormalizedMerchantAndStatus(debit.getUserId(), debit.getNormalizedMerchant(),
                        SubscriptionStatus.ACTIVE));
        candidates.addAll(subscriptionRepository
                .findByUserIdAndPayeeMerchantAndStatus(debit.getUserId(), debit.getNormalizedMerchant(),
                        SubscriptionStatus.ACTIVE));
        List<Subscription> distinct = candidates.stream()
                .distinct()
                .toList();
        if (distinct.isEmpty()) {
            return;
        }
        LocalDate chargeDate = debit.getCreatedAt().atZone(ZoneOffset.UTC).toLocalDate();
        for (Subscription subscription : distinct) {
            boolean replay = debit.getTransactionId() != null
                    && debit.getTransactionId().equals(subscription.getLastChargeTransactionId());
            if (!replay) {
                if (!amountMatches(subscription, debit.getAmount())) {
                    continue;
                }
                SubscriptionFrequency frequency = subscription.getFrequency();
                LocalDate windowStart = subscription.getNextExpectedDate().minusDays(MATCHER_EARLY_DAYS);
                LocalDate windowEnd = subscription.getNextExpectedDate().plusDays(frequency.getGraceDays());
                if (chargeDate.isBefore(windowStart) || chargeDate.isAfter(windowEnd)) {
                    continue;
                }
            }
            // The tracked amount follows the observed charge: bills drift month to month, and an
            // updated transaction (same day edit, amount corrected) must reflect on the card too.
            subscription.setAmount(debit.getAmount());
            subscription.setLastChargeDate(chargeDate);
            subscription.setLastChargeAmount(debit.getAmount());
            if (debit.getTransactionId() != null) {
                subscription.setLastChargeTransactionId(debit.getTransactionId());
            }
            if (!replay) {
                SubscriptionFrequency frequency = subscription.getFrequency();
                subscription.setNextExpectedDate(chargeDate.plus(frequency.getPeriod()));
                if (subscription.getKind() == SubscriptionKind.EMI) {
                    advanceEmi(subscription);
                }
                log.info("tracked obligation charge matched: userId={}, subscriptionId={}, merchant={}, "
                                + "kind={}, amount={}, chargeDate={}, nextExpectedDate={}, status={}",
                        debit.getUserId(), subscription.getId(), subscription.getMerchant(),
                        subscription.getKind(), debit.getAmount(), chargeDate,
                        subscription.getNextExpectedDate(), subscription.getStatus());
            } else {
                log.info("tracked obligation amount synced from charge edit: userId={}, subscriptionId={}, "
                                + "merchant={}, kind={}, newAmount={}",
                        debit.getUserId(), subscription.getId(), subscription.getMerchant(),
                        subscription.getKind(), debit.getAmount());
            }
            subscriptionRepository.save(subscription);
        }
    }

    private boolean amountMatches(Subscription subscription, BigDecimal debitAmount) {
        if (subscription.getKind() != SubscriptionKind.BILL) {
            return subscription.getAmount().compareTo(debitAmount) == 0;
        }
        int tolerancePercent = subscription.getAmountTolerancePercent() != null
                ? subscription.getAmountTolerancePercent()
                : DEFAULT_BILL_TOLERANCE_PERCENT;
        BigDecimal band = subscription.getAmount()
                .multiply(BigDecimal.valueOf(tolerancePercent))
                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
        return debitAmount.compareTo(subscription.getAmount().subtract(band)) >= 0
                && debitAmount.compareTo(subscription.getAmount().add(band)) <= 0;
    }

    private void advanceEmi(Subscription subscription) {
        int tenure = subscription.getTenureMonths() != null ? subscription.getTenureMonths() : 0;
        int paid = (subscription.getPaidMonths() != null ? subscription.getPaidMonths() : 0) + 1;
        subscription.setPaidMonths(paid);
        if (tenure > 0 && paid >= tenure) {
            subscription.setStatus(SubscriptionStatus.PAID_OFF);
            log.info("EMI paid off: userId={}, subscriptionId={}, merchant={}, tenure={}",
                    subscription.getUserId(), subscription.getId(), subscription.getMerchant(), tenure);
        }
    }

    private TrackedSubscriptionResponse toResponse(Subscription subscription, LocalDate today) {
        String cycleState = deriveCycleState(subscription, today);
        return new TrackedSubscriptionResponse(
                subscription.getId(),
                subscription.getMerchant(),
                subscription.getFrequency(),
                subscription.getAmount(),
                subscription.getNextExpectedDate(),
                subscription.getLastChargeDate(),
                subscription.getLastChargeAmount(),
                subscription.getKind(),
                subscription.getAmountTolerancePercent(),
                subscription.getTenureMonths(),
                subscription.getPaidMonths(),
                subscription.getPayeeMerchant(),
                subscription.getStatus(),
                cycleState);
    }

    private String deriveCycleState(Subscription subscription, LocalDate today) {
        if (subscription.getStatus() == SubscriptionStatus.PAID_OFF) {
            return "PAID_OFF";
        }
        if (subscription.getStatus() == SubscriptionStatus.CANCELLED) {
            return "CANCELLED";
        }
        if (subscription.getLastChargeDate() == null) {
            return "AWAITING_FIRST_CHARGE";
        }
        SubscriptionFrequency frequency = subscription.getFrequency();
        LocalDate notSeenThreshold = subscription.getNextExpectedDate()
                .plus(frequency.getPeriod().multipliedBy(2));
        if (!today.isBefore(notSeenThreshold)) {
            return "NOT_SEEN";
        }
        LocalDate lateThreshold = subscription.getNextExpectedDate().plusDays(frequency.getGraceDays());
        if (!today.isBefore(lateThreshold)) {
            return "LATE";
        }
        return "ON_SCHEDULE";
    }
}
