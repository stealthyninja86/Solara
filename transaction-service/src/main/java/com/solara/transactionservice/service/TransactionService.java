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

import java.util.List;
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
                request.merchant(), request.paymentMode(), request.type());
        transaction = transactionRepository.save(transaction);

        outboxRepository.save(OutboxEntity.forTransaction(transaction));

        return toResponse(transaction);
    }

    @Transactional
    public TransactionResponse update(UUID id, UpdateTransactionRequest updateRequest) {
        Transaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));

        transaction.applyPartialUpdate(updateRequest);
        transaction = transactionRepository.save(transaction);

        outboxRepository.save(OutboxEntity.forTransaction(transaction, "transaction.updated.v1"));

        return toResponse(transaction);
    }

    public TransactionResponse findById(UUID id) {
        Transaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));
        return toResponse(transaction);
    }

    public List<TransactionResponse> findAll() {
        return transactionRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public void delete(UUID id) {
        Transaction transaction = transactionRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transaction not found"));

        outboxRepository.save(OutboxEntity.forDeletedTransaction(transaction));
        transactionRepository.delete(transaction);
    }

    private TransactionResponse toResponse(Transaction transaction) {
        return new TransactionResponse(
                transaction.getId(), transaction.getUserId(), transaction.getAmount(),
                transaction.getDescription(), transaction.getMerchant(), transaction.getPaymentMode(),
                transaction.getType(), transaction.getCurrency(), transaction.getTimestamp(),
                transaction.getCreatedAt(), transaction.getUpdatedAt());
    }
}