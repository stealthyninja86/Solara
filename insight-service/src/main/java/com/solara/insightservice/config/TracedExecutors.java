package com.solara.insightservice.config;

import org.springframework.core.task.TaskDecorator;
import org.springframework.core.task.support.ContextPropagatingTaskDecorator;

import java.util.concurrent.Executor;

public final class TracedExecutors {

    private static final TaskDecorator DECORATOR = new ContextPropagatingTaskDecorator();

    private TracedExecutors() {
    }

    public static Executor decorated(Executor delegate) {
        return command -> delegate.execute(DECORATOR.decorate(command));
    }
}
