package com.solara.transactionservice;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableAsync
public class TransactionServiceApplication {

	private static final Logger log = LoggerFactory.getLogger(TransactionServiceApplication.class);

	public static void main(String[] args) {
		SpringApplication.run(TransactionServiceApplication.class, args);
		log.info("Transaction service started");
	}

}
