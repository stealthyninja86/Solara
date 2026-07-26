package com.solara.transactionservice.service;

import com.solara.transactionservice.dto.request.CreateTransactionRequest;
import com.solara.transactionservice.dto.request.UpdateTransactionRequest;
import com.solara.transactionservice.dto.response.TransactionResponse;
import com.solara.transactionservice.model.Transaction;
import com.solara.transactionservice.outbox.OutboxEntity;
import com.solara.transactionservice.repository.OutboxRepository;
import com.solara.transactionservice.repository.TransactionRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.UUID;

@Service
public class TransactionService {

    private final TransactionRepository transactionRepository;
    private final OutboxRepository outboxRepository;

    public TransactionService(TransactionRepository transactionRepository,
                              OutboxRepository outboxRepository) {
        this.transactionRepository = transactionRepository;
        this.outboxRepository = outboxRepository;
    }

    @Transactional
    public TransactionResponse create(CreateTransactionRequest request) {
        Transaction transaction = new Transaction(request.userId(), request.amount(), request.description(),
                request.merchant(), request.paymentMode());
        transaction = transactionRepository.save(transaction);

        String payload = String.format("""
                {"eventId":"%s","eventVersion":1,"eventType":"transaction.created.v1","occurredAt":"%s","payload":%s}
                """, transaction.getId(), Instant.now(), buildTransactionPayload(transaction));

        OutboxEntity outbox = new OutboxEntity(transaction.getId(), "transaction.created.v1", payload);
        outboxRepository.save(outbox);

        return toResponse(transaction);
    }

    @Transactional
    public TransactionResponse update(UUID id, UpdateTransactionRequest updateRequest) {
        Transaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));

        if (updateRequest.amount() != null)
            transaction.setAmount(updateRequest.amount());
        if (updateRequest.description() != null)
            transaction.setDescription(updateRequest.description());
        if (updateRequest.merchant() != null)
            transaction.setMerchant(updateRequest.merchant());
        if (updateRequest.paymentMode() != null)
            transaction.setPaymentMode(updateRequest.paymentMode());

        transaction.setTimestamp(Instant.now());

        transaction = transactionRepository.save(transaction);

        String payload = String.format("""
                {"eventId":"%s","eventVersion":1,"eventType":"transaction.updated.v1","occurredAt":"%s","payload":%s}
                """, transaction.getId(), Instant.now(), buildTransactionPayload(transaction));

        OutboxEntity outbox = new OutboxEntity(transaction.getId(), "transaction.updated.v1", payload);
        outboxRepository.save(outbox);

        return toResponse(transaction);
    }

    @Transactional
    public void delete(UUID id) {
        Transaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));

        String payload = String.format("""
                {"eventId":"%s","eventVersion":1,"eventType":"transaction.deleted.v1","occurredAt":"%s","payload":{"transactionId":"%s","userId":"%s"}}
                """, UUID.randomUUID(), Instant.now(), transaction.getId(), transaction.getUserId());

        OutboxEntity outbox = new OutboxEntity(transaction.getId(), "transaction.deleted.v1", payload);
        outboxRepository.save(outbox);

        transactionRepository.delete(transaction);
    }

    private TransactionResponse toResponse(Transaction transaction) {
        return new TransactionResponse(
                transaction.getId(), transaction.getUserId(), transaction.getAmount(),
                transaction.getDescription(), transaction.getMerchant(), transaction.getPaymentMode(),
                transaction.getCurrency(), transaction.getTimestamp(),
                transaction.getCreatedAt(), transaction.getUpdatedAt());
    }

    private String buildTransactionPayload(Transaction transaction) {
        return String.format("""
                {"transactionId":"%s","userId":"%s","description":"%s","amount":%s,"currency":"%s","merchant":"%s","paymentMode":"%s","timestamp":"%s"}
                """,
                transaction.getId(), transaction.getUserId(),
                transaction.getDescription() != null ? transaction.getDescription() : "",
                transaction.getAmount(), transaction.getCurrency(),
                transaction.getMerchant(), transaction.getPaymentMode(),
                transaction.getTimestamp());
    }
}