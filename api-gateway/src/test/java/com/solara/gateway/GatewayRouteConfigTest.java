package com.solara.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.cloud.gateway.route.RouteDefinition;
import org.springframework.cloud.gateway.route.RouteDefinitionLocator;
import reactor.core.publisher.Flux;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class GatewayRouteConfigTest {

    @Autowired
    RouteDefinitionLocator routeDefinitionLocator;

    @Test
    void insightRoutesOverrideTheGlobalResponseTimeout() {
        List<RouteDefinition> insightRoutes = Flux.from(routeDefinitionLocator.getRouteDefinitions())
                .filter(route -> route.getId().startsWith("insight-service-"))
                .collectList()
                .block();

        assertThat(insightRoutes).isNotEmpty();
        for (RouteDefinition route : insightRoutes) {
            assertThat(String.valueOf(route.getMetadata().get("response-timeout")))
                    .isEqualTo("120000");
        }
    }

    @Test
    void authRouteKeepsNoTimeoutMetadata() {
        List<RouteDefinition> authRoutes = Flux.from(routeDefinitionLocator.getRouteDefinitions())
                .filter(route -> route.getId().equals("auth-service"))
                .collectList()
                .block();

        assertThat(authRoutes).hasSize(1);
        assertThat(authRoutes.get(0).getMetadata()).doesNotContainKey("response-timeout");
    }
}