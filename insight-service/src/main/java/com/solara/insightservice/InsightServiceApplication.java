package com.solara.insightservice;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class InsightServiceApplication {

    private static final Logger log = LoggerFactory.getLogger(InsightServiceApplication.class);

    public static void main(String[] args) {
        SpringApplication.run(InsightServiceApplication.class, args);
        log.info("Insight service started");
    }
}
