# Solara

AI-powered personal finance intelligence platform.

95% of finance apps show you *what happened*. This one tells you **what to do about it**.

## Core API

```
POST /api/v1/categorize
Input:  Netflix | 15.99 EUR
Output: Entertainment | 98% confidence
```

Strategy pattern: RuleBasedStrategy → LLMStrategy → RAGStrategy → CacheStrategy → FallbackStrategy

## Beyond categorization

- **Actionable insights**: *"Switch from Brand A to Brand B, save $40/month"*
- **Subscription audit**: Unused subscriptions detected automatically
- **Safe-to-spend**: What you can actually afford right now
- **Budget alerts**: Store-level overspend detection 
