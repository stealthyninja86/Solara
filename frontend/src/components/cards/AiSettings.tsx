import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "../../hooks/useAuth";
import { useLlmModels } from "../../hooks/useLlmModels";
import { useLlmProviders } from "../../hooks/useLlmProviders";
import { DropdownSelect } from "../ui/DropdownSelect";
import { ModelSelect } from "../ui/ModelSelect";
import type { LlmProvider, ProviderInfo } from "../../types";

const INPUT_CLASSES = "w-full rounded-md border border-[var(--color-border-emphasis)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-text-tertiary)]";
const INPUT_ERROR_CLASSES = "w-full rounded-md border border-[var(--color-bad)] bg-[var(--color-bg-deep)] px-3 py-2 text-caption text-[var(--color-text)] outline-none transition-colors focus:border-[var(--color-bad)]";

export function AiSettings() {
  const { aiSettings, updateSettings, llmProvider, llmApiKey, llmChatModel } = useAuth();

  const llmOn = aiSettings ?? false;
  const [llmSaving, setLlmSaving] = useState(false);
  const [llmSuccess, setLlmSuccess] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);

  const [provider, setProvider] = useState<LlmProvider>("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [keyValid, setKeyValid] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [keyValidating, setKeyValidating] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>(llmChatModel ?? "");
  const [showTutorial, setShowTutorial] = useState(false);
  const { models, loading: modelsLoading, error: modelsError, fetchModels } = useLlmModels();
  const { providers, defaultProvider, loading: providersLoading, fetchProviders } = useLlmProviders();
  const mountedRef = useRef(true);

  const currentProvider: ProviderInfo | undefined = providers.find((p) => p.value === provider);
  const requiresApiKey = currentProvider?.requiresApiKey ?? true;
  const keyPlaceholder = currentProvider?.keyPlaceholder ?? "Enter API key...";

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Fetch providers once on mount
  useEffect(() => { fetchProviders(); }, [fetchProviders]);

  // Once providers and profile both arrive, set the correct provider + auto-validate
  useEffect(() => {
    if (providersLoading || !providers.length) return;
    const effective = llmProvider || defaultProvider;
    if (!effective) return;

    // Only set provider if it hasn't been set yet (or user hasn't changed it)
    setProvider((prev) => {
      if (prev && prev !== "") return prev; // user already picked one
      return effective;
    });
  }, [providersLoading, providers, llmProvider, defaultProvider]);

  // Single effect: fetch models when provider resolves, then validate saved model
  const didAutoValidate = useRef(false);
  const prevProvider = useRef(provider);
  useEffect(() => {
    if (!provider) return;

    const isUserSwitch = didAutoValidate.current && provider !== prevProvider.current;
    prevProvider.current = provider;

    if (isUserSwitch) {
      setKeyError(null);
      setKeyValidating(false);
      setKeyValid(false);
      setSelectedModel("");
      setApiKeyInput("");
      setKeySaved(false);
      setShowTutorial(false);
    }

    const needsKey = requiresApiKey;
    const savedKey = isUserSwitch ? null : llmApiKey;
    const typedKey = apiKeyInput.trim();
    const keyToUse = typedKey || savedKey || null;

    // For providers needing a key: if no key available, try without key (backend resolves from DB)
    // If that fails, show the input
    const fetchKey = needsKey ? (keyToUse || undefined) : undefined;

    const doFetch = async () => {
      try {
        if (needsKey) setKeyValidating(true);
        const m = await fetchModels(provider, fetchKey);
        if (!mountedRef.current) return;
        if (m.length > 0) {
          setKeyValid(true);
          setKeySaved(needsKey && !typedKey);
          const savedModel = selectedModel;
          if (!didAutoValidate.current || isUserSwitch) {
            if (savedModel && m.find((x) => x.name === savedModel)) {
              setSelectedModel(savedModel);
            } else if (m[0]) {
              setSelectedModel(m[0].name);
            }
          } else if (savedModel && !m.find((x) => x.name === savedModel)) {
            if (m[0]) setSelectedModel(m[0].name);
          }
        } else if (needsKey) {
          setKeyValid(false);
          if (!keyToUse) {
            setApiKeyInput("");
          } else {
            setKeyError("No models returned — check your API key");
          }
        }
      } catch {
        if (!mountedRef.current) return;
        if (needsKey) {
          setKeyValid(false);
          if (!keyToUse) {
            setApiKeyInput("");
          } else {
            setKeyError("Failed to fetch models");
          }
        }
      } finally {
        if (mountedRef.current && needsKey) setKeyValidating(false);
      }
    };

    doFetch();
    didAutoValidate.current = true;
  }, [provider, requiresApiKey, llmApiKey, apiKeyInput]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleValidate = useCallback(async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      setKeyValid(false);
      setKeyError("Please enter a valid API key");
      return;
    }
    setKeyValidating(true);
    setKeyError(null);
    try {
      const result = await fetchModels(provider, key);
      if (!mountedRef.current) return;
      if (result.length > 0) {
        setKeyValid(true);
        if (!selectedModel) setSelectedModel(result[0]?.name ?? "");
      } else {
        setKeyValid(false);
        setKeyError("No models returned — check your API key");
      }
    } catch {
      if (!mountedRef.current) return;
      setKeyValid(false);
      setKeyError("Invalid API key");
    } finally {
      if (mountedRef.current) setKeyValidating(false);
    }
  }, [apiKeyInput, fetchModels, provider, selectedModel]);

  const showModels = !requiresApiKey || keyValid;
  const canSave = requiresApiKey ? keyValid && selectedModel !== "" : selectedModel !== "";

  async function handleToggle() {
    if (llmSaving) return;
    setLlmSaving(true);
    setLlmSuccess(false);
    setLlmError(null);
    try {
      await updateSettings({ aiSettings: !llmOn });
      setLlmSuccess(true);
      setTimeout(() => setLlmSuccess(false), 3000);
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "Failed to update settings");
    } finally {
      setLlmSaving(false);
    }
  }

  async function handleSave() {
    if (llmSaving) return;
    setLlmSaving(true);
    setLlmSuccess(false);
    setLlmError(null);
    try {
      const keyToSave = apiKeyInput.trim() || llmApiKey || null;
      await updateSettings({
        aiSettings: true,
        llmProvider: provider,
        llmApiKey: requiresApiKey ? keyToSave : null,
        llmChatModel: selectedModel,
      });
      setLlmSuccess(true);
      setTimeout(() => setLlmSuccess(false), 3000);
    } catch (e) {
      setLlmError(e instanceof Error ? e.message : "Failed to update settings");
    } finally {
      setLlmSaving(false);
    }
  }

  return (
    <section className="card max-w-lg rounded-2xl p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-caption font-semibold text-[var(--color-text)]">AI Features</h2>
          <p className="mt-0.5 text-small">
            {llmOn
              ? "AI categorizes transactions and writes your finance insights"
              : "AI is off — no LLM calls, insight cards are hidden"}
          </p>
        </div>
        <button
          onClick={handleToggle}
          className={`relative inline-block h-6 w-11 rounded-full p-0 transition-colors ${
            llmOn ? "bg-[var(--color-ok)]" : "bg-[var(--color-border-emphasis)]"
          }`}
          role="switch"
          aria-checked={llmOn}
        >
          <span
            className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
              llmOn ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {llmOn && (
        <div className="mt-5 flex flex-col gap-4 border-t border-[var(--color-border-subtle)] pt-5">
          <div>
            <label className="mb-1.5 block text-small font-medium text-[var(--color-text-secondary)]">Provider</label>
            {providersLoading ? (
              <div className="text-small text-[var(--color-text-tertiary)]">Loading providers...</div>
            ) : (
              <DropdownSelect
                value={provider}
                options={providers.map((p) => ({ value: p.value, label: p.label }))}
                onChange={(v) => setProvider(v as LlmProvider)}
              />
            )}
            <p className="mt-1 text-tiny text-[var(--color-text-tertiary)]">
              {currentProvider?.description}
            </p>
            {currentProvider?.dashboardUrl && (
              <a
                href={currentProvider.dashboardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-flex items-center gap-1 text-tiny text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
              >
                <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M4.5 2.5h5.5v5.5M10 2L2 10" />
                </svg>
                View Dashboard
              </a>
            )}
          </div>

          {requiresApiKey && (
            <div>
              <label className="mb-1.5 block text-small font-medium text-[var(--color-text-secondary)]">API Key</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={
                    keyValid && keySaved && !apiKeyInput
                      ? "Key saved — type new key to replace"
                      : keyPlaceholder
                  }
                  className={`flex-1 ${keyError ? INPUT_ERROR_CLASSES : INPUT_CLASSES}`}
                />
                <button
                  type="button"
                  onClick={handleValidate}
                  disabled={keyValidating || !apiKeyInput.trim()}
                  className="button button-secondary shrink-0"
                >
                  {keyValidating ? "Checking..." : "Validate"}
                </button>
              </div>
              <div className="mt-1.5 min-h-4">
                {keyValid && <span className="text-small text-[var(--color-ok)]">&#10003; Valid key</span>}
                {keyError && <span className="text-small text-[var(--color-bad)]">{keyError}</span>}
              </div>

              {currentProvider?.tutorial && currentProvider.tutorial.length > 0 && (
                <div className="mt-3">
                  <button
                    type="button"
                    onClick={() => setShowTutorial((s) => !s)}
                    className="flex items-center gap-1.5 text-small text-[var(--color-text-tertiary)] hover:text-[var(--color-text-secondary)] transition-colors"
                  >
                    <svg
                      className={`h-3 w-3 transition-transform ${showTutorial ? "rotate-90" : ""}`}
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M4.5 2.5l4 3.5-4 3.5" />
                    </svg>
                    How to get your API key
                  </button>
                  {showTutorial && (
                    <div className="mt-2 rounded-md border border-[var(--color-border-subtle)] bg-[var(--color-bg-subtle)] p-4">
                      <ol className="space-y-2 text-small text-[var(--color-text-secondary)]">
                        {currentProvider.tutorial.map((step, i) => (
                          <li key={i} className="flex gap-2">
                            <span className="shrink-0 text-[var(--color-text-tertiary)]">{i + 1}.</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showModels && (
            <div>
              <label className="mb-1.5 block text-small font-medium text-[var(--color-text-secondary)]">Model</label>
              {modelsLoading ? (
                <div className="text-small text-[var(--color-text-tertiary)]">Loading models...</div>
              ) : modelsError ? (
                <div className="text-small text-[var(--color-bad)]">{modelsError}</div>
              ) : models.length === 0 ? (
                <div className="text-small text-[var(--color-text-tertiary)]">
                  {requiresApiKey ? "Enter a valid API key to see available models" : "No models found — is Ollama running?"}
                </div>
              ) : (
                <ModelSelect
                  value={selectedModel}
                  models={models}
                  onChange={setSelectedModel}
                  dashboardUrl={currentProvider?.dashboardUrl}
                />
              )}
            </div>
          )}

          <div className="flex items-center gap-3">
            <button onClick={handleSave} disabled={llmSaving || !canSave} className="button button-primary">
              {llmSaving ? "Saving..." : "Save"}
            </button>
            {llmSuccess && <span className="text-caption text-[var(--color-ok)]">Saved</span>}
            {llmError && <span className="text-caption text-[var(--color-bad)]">{llmError}</span>}
          </div>
        </div>
      )}
    </section>
  );
}
