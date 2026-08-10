package com.solara.transactionservice.controller;

import com.solara.transactionservice.dto.request.CreateTransactionRequest;
import com.solara.transactionservice.dto.request.UpdateTransactionRequest;
import com.solara.transactionservice.dto.response.BulkImportResponse;
import com.solara.transactionservice.dto.response.BulkJobResponse;
import com.solara.transactionservice.dto.response.TransactionResponse;
import com.solara.transactionservice.model.ImportJob;
import com.solara.transactionservice.repository.ImportJobRepository;
import com.solara.transactionservice.service.BulkImportService;
import com.solara.transactionservice.service.TransactionService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/transactions")
public class TransactionController {

    private final TransactionService transactionService;
    private final BulkImportService bulkImportService;
    private final ImportJobRepository importJobRepository;
    private final Path uploadDirectory;

    private static final Logger log = LoggerFactory.getLogger(TransactionController.class);

    private static Path resolveUploadDirectory(String path) {
        Path dir = Path.of(path);
        return dir.isAbsolute() ? dir : Path.of(System.getProperty("user.dir"), path);
    }

    public TransactionController(TransactionService transactionService,
                                  BulkImportService bulkImportService,
                                  ImportJobRepository importJobRepository,
                                  @Value("${app.upload.directory:data/uploads}") String uploadDirectoryPath) {
        this.transactionService = transactionService;
        this.bulkImportService = bulkImportService;
        this.importJobRepository = importJobRepository;
        this.uploadDirectory = resolveUploadDirectory(uploadDirectoryPath);
    }

    @PostMapping
    public ResponseEntity<TransactionResponse> create(
            @Valid @RequestBody CreateTransactionRequest request) {
        log.info("create requested: userId={}, amount={}, merchant={}", request.userId(), request.amount(), request.merchant());
        TransactionResponse response = transactionService.create(request);
        log.info("create completed: id={}", response.id());
        return ResponseEntity.status(HttpStatus.CREATED).body(response);
    }

    @GetMapping("/{id}")
    public ResponseEntity<TransactionResponse> findById(@PathVariable UUID id,
                                                        @RequestParam("userId") UUID userId) {
        log.debug("findById requested: id={}, userId={}", id, userId);
        TransactionResponse response = transactionService.findById(id, userId);
        return ResponseEntity.ok(response);
    }

    @GetMapping
    public ResponseEntity<List<TransactionResponse>> findAll(
            @RequestParam("userId") UUID userId) {
        List<TransactionResponse> responses = transactionService.findAll(userId);
        log.debug("findAll returned: userId={}, count={}", userId, responses.size());
        return ResponseEntity.ok(responses);
    }

    @PutMapping("/{id}")
    public ResponseEntity<TransactionResponse> update(
            @PathVariable UUID id,
            @RequestParam("userId") UUID userId,
            @Valid @RequestBody UpdateTransactionRequest request) {
        log.info("update requested: id={}, userId={}, merchant={}", id, userId, request.merchant());
        TransactionResponse response = transactionService.update(id, userId, request);
        log.info("update completed: id={}", response.id());
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id,
                                       @RequestParam("userId") UUID userId) {
        log.info("delete requested: id={}, userId={}", id, userId);
        transactionService.delete(id, userId);
        log.info("delete completed: id={}", id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/bulk")
    public ResponseEntity<BulkImportResponse> bulkImport(
            @RequestParam("userId") UUID userId,
            @RequestBody @Valid List<@Valid CreateTransactionRequest> requests) {
        log.info("bulk JSON import requested: userId={}, rowCount={}", userId, requests.size());
        ImportJob job = new ImportJob(userId, requests.size());
        job = importJobRepository.save(job);
        bulkImportService.processJsonImport(job.getId(), userId, requests);
        log.info("bulk JSON import accepted: jobId={}, userId={}", job.getId(), userId);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(new BulkImportResponse(job.getId()));
    }

    @PostMapping("/bulk/upload")
    public ResponseEntity<BulkImportResponse> bulkUpload(
            @RequestParam("userId") UUID userId,
            @RequestParam("file") MultipartFile file) throws IOException {

        log.info("bulk CSV upload requested: userId={}, fileName={}, size={} bytes",
                userId, file.getOriginalFilename(), file.getSize());
        Files.createDirectories(uploadDirectory);

        ImportJob job = new ImportJob(userId, 0);
        job = importJobRepository.save(job);

        Path filePath = uploadDirectory.resolve(job.getId() + ".csv");
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);
        job.setRawFilePath(filePath.toString());
        importJobRepository.save(job);
        log.debug("uploaded file persisted: jobId={}, path={}", job.getId(), filePath);

        bulkImportService.processCsvImport(job.getId(), userId,
                file.getInputStream());

        log.info("bulk CSV upload accepted: jobId={}, userId={}", job.getId(), userId);
        return ResponseEntity.status(HttpStatus.ACCEPTED)
                .body(new BulkImportResponse(job.getId()));
    }

    @GetMapping("/bulk/{jobId}")
    public ResponseEntity<BulkJobResponse> getBulkJobStatus(@PathVariable UUID jobId,
                                                            @RequestParam("userId") UUID userId) {
        log.debug("bulk status requested: jobId={}, userId={}", jobId, userId);
        ImportJob job = importJobRepository.findById(jobId)
                .orElseThrow(() -> new IllegalArgumentException("Import job not found: " + jobId));
        if (!job.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Import job not found: " + jobId);
        }
        log.debug("bulk status returned: jobId={}, status={}, imported={}, failed={}",
                jobId, job.getStatus(), job.getImportedRows(), job.getFailedRows());
        return ResponseEntity.ok(new BulkJobResponse(
                job.getId(), job.getStatus(),
                job.getTotalRows(), job.getImportedRows(), job.getFailedRows(),
                job.getErrorReport(),
                job.getCreatedAt(), job.getCompletedAt(),
                job.getMinDate(), job.getMaxDate()));
    }
}
