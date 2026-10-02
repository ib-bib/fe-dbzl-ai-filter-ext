import React, { useState, useEffect, useRef } from "react";

const TypingEffect = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let timeout: NodeJS.Timeout;

    if (!isDeleting && displayText === text) {
      timeout = setTimeout(() => setIsDeleting(true), 2000);
    } else if (isDeleting && displayText === "") {
      timeout = setTimeout(() => setIsDeleting(false), 500);
    } else {
      timeout = setTimeout(() => {
        setDisplayText(prev =>
          isDeleting
            ? prev.slice(0, -1)
            : text.slice(0, prev.length + 1)
        );
      }, isDeleting ? 40 : 80);
    }

    return () => clearTimeout(timeout);
  }, [displayText, isDeleting, text]);

  return (
    <span className="typing-effect">
      {displayText}
    </span>
  );
};

declare var chrome: any;

const isRefinementQuery = (oldPrompt: string, newPrompt: string): boolean => {
  if (!oldPrompt || !newPrompt) return false;

  const oldWords = oldPrompt.toLowerCase().match(/\b\w+\b/g) || [];
  const newWords = newPrompt.toLowerCase().match(/\b\w+\b/g) || [];

  if (oldWords.length === 0) return false;
  if (oldWords.length > newWords.length) return false;

  let i = 0;
  let j = 0;

  while (i < oldWords.length && j < newWords.length) {
    if (oldWords[i] === newWords[j]) {
      i++;
    }
    j++;
  }

  // If we matched all words from the old prompt in the exact same relative order,
  // it means the user strictly inserted or appended new words.
  return i === oldWords.length;
};

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);

  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeFilter, setActiveFilter] = useState(false);
  const [useVision, setUseVision] = useState(false);
  const [lastSearchedPrompt, setLastSearchedPrompt] = useState("");
  const [lastUseVision, setLastUseVision] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [stats, setStats] = useState({ kept: 0, hidden: 0 });
  const [usage, setUsage] = useState<any>(null);
  const [placeholder, setPlaceholder] = useState("✨ E.g. I am looking for...");
  const [hasListings, setHasListings] = useState(false);

  const processedItemIds = useRef<Set<string>>(new Set());
  const itemElementsMap = useRef<Map<string, HTMLElement>>(new Map());

  const [autoRunPending, setAutoRunPending] = useState(false);

  // Check initial auth state (silent)
  useEffect(() => {
    if (chrome?.identity?.getAuthToken) {
      chrome.identity.getAuthToken({ interactive: false }, function (token: string) {
        if (!chrome.runtime.lastError && token) {
          setAuthToken(token);
          setIsAuthenticated(true);
        } else {
          sessionStorage.removeItem("pending_ai_prompt");
        }
      });
    } else {
      sessionStorage.removeItem("pending_ai_prompt");
    }
  }, []);

  // Update placeholder dynamically based on URL (handles SPA navigation)
  useEffect(() => {
    let lastPath = window.location.pathname;

    const updatePlaceholder = () => {
      const segments = window.location.pathname.split('/').filter(Boolean);

      // Filter out language, location, and generic segments
      const ignored = ['en', 'ar', 'dubai', 'abudhabi', 'sharjah', 'ajman', 'alain', 'fujairah', 'ras-al-khaimah', 'umm-al-quwain', 'uae', 'search'];
      const relevantSegments = segments.filter(s => !ignored.includes(s.toLowerCase()));

      if (relevantSegments.length > 0) {
        // The last segment is usually the most specific category
        let category = relevantSegments[relevantSegments.length - 1] || "";

        // Clean up the string: replace hyphens with spaces and capitalize
        category = category.replace(/-/g, ' ');
        category = category.replace(/\b\w/g, c => c.toUpperCase());

        setPlaceholder(`✨ E.g. Describe the ${category} you are looking for...`);
      } else {
        setPlaceholder("✨ E.g. I am looking for...");
      }
    };

    updatePlaceholder();

    // Since Dubizzle is an SPA, observe body mutations to check if URL changed
    // We also want to check if listings exist to conditionally show the AI floating pill
    let checkTimeout: NodeJS.Timeout;

    const checkListings = () => {
      const items = document.querySelectorAll('[data-testid="listing-price"], div[class*="price"]');
      setHasListings(items.length > 0);
    };

    const observer = new MutationObserver(() => {
      if (window.location.pathname !== lastPath) {
        lastPath = window.location.pathname;
        updatePlaceholder();
      }

      clearTimeout(checkTimeout);
      checkTimeout = setTimeout(checkListings, 500);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    checkListings();

    return () => {
      observer.disconnect();
      clearTimeout(checkTimeout);
    };
  }, []);



  const handleLogin = () => {
    if (chrome?.identity?.getAuthToken) {
      chrome.identity.getAuthToken({ interactive: true }, function (token: string) {
        if (chrome.runtime.lastError) {
          console.warn("Auth Error (Using Dev Mock):", chrome.runtime.lastError.message);
          setAuthToken("mock-dev-token-uuid-1234");
          setIsAuthenticated(true);
        } else if (token) {
          setAuthToken(token);
          setIsAuthenticated(true);
        }
      });
    } else {
      setAuthToken("mock-dev-token-uuid-1234");
      setIsAuthenticated(true);
    }
  };

  const extractItems = () => {
    const priceElements = document.querySelectorAll('[data-testid="listing-price"], div[class*="price"]');
    const newItems: any[] = [];

    priceElements.forEach((priceEl, index) => {
      const container = priceEl.closest('a') as HTMLElement;
      if (!container) return;

      const id = container.getAttribute('href') || `item-${index}`;

      if (processedItemIds.current.has(id)) return;

      itemElementsMap.current.set(id, container);

      const titleEl = container.querySelector('h2, [data-testid="subheading"]');
      const title = titleEl ? titleEl.textContent?.trim() : "Unknown";
      const price = priceEl.textContent?.trim() || "Unknown";
      const description = container.innerText || container.textContent || "";
      const imgEls = container.querySelectorAll('img');
      const image_urls: string[] = Array.from(imgEls).slice(0, 5).map(img => img.src).filter(Boolean);

      newItems.push({ id, title, price, url: id, image_urls, description });
    });

    return newItems;
  };

  const handleFilter = async (isNewBatch = false) => {
    const currentPrompt = prompt.trim();
    if (!currentPrompt) return;

    if (!isNewBatch) {
      const isRefinement = lastSearchedPrompt && isRefinementQuery(lastSearchedPrompt, currentPrompt) && useVision === lastUseVision;

      if (isRefinement) {
        // Refinement: Keep hidden items hidden to save compute. Re-evaluate only the kept items.
        itemElementsMap.current.forEach((container, id) => {
          if (container.style.display !== "none") {
            processedItemIds.current.delete(id); // Remove from processed so it gets extracted again
          }
        });
      } else {
        // Completely new search: Reset DOM state
        itemElementsMap.current.forEach(container => {
          container.style.display = "";
        });
        processedItemIds.current.clear();
        itemElementsMap.current.clear();
        setStats({ kept: 0, hidden: 0 });
      }

      setLastSearchedPrompt(currentPrompt);
      setLastUseVision(useVision);
    }

    setLoading(true);
    setErrorMsg(null);

    // We only perform pure DOM filtering based on the user's prompt.
    // The user applies native filters on Dubizzle themselves.
    const aiPromptRemaining = prompt;

    // It's a new prompt if it's not a pagination batch AND the prompt or vision toggle changed.
    const isNewPrompt = !isNewBatch && (prompt !== lastSearchedPrompt || useVision !== lastUseVision);

    if (!aiPromptRemaining.trim()) {
      setLoading(false);
      return;
    }

    const itemsToProcess = extractItems();

    if (itemsToProcess.length === 0) {
      setLoading(false);
      return;
    }

    try {
      const apiUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
      const response = await fetch(`${apiUrl}/api/filter`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPromptRemaining,
          items: itemsToProcess,
          use_vision: useVision,
          auth_token: authToken,
          is_new_prompt: isNewPrompt
        })
      });

      if (response.status === 429) {
        setErrorMsg("Daily API Quota Exceeded. Please try again tomorrow.");
        setLoading(false);
        return;
      }

      const data = await response.json();

      if (data.disabled || response.status !== 200) {
        setErrorMsg(data.reason || (data.disabled ? "Service disabled." : "Server error."));
        setLoading(false);
        return;
      }

      if (data.usage) {
        setUsage(data.usage);
      }

      const keepIds = data.keep_ids || [];

      itemsToProcess.forEach(item => {
        processedItemIds.current.add(item.id);
        const container = itemElementsMap.current.get(item.id);
        if (container) {
          if (!keepIds.includes(item.id)) {
            container.style.display = "none";
          } else {
            container.style.display = "";
          }
        }
      });

      setActiveFilter(true);

      // Update stats and clean up stale elements
      let kept = 0;
      let hidden = 0;
      for (const id of Array.from(processedItemIds.current)) {
        const el = itemElementsMap.current.get(id);
        if (el && document.body.contains(el)) {
          if (el.style.display === "none") hidden++;
          else kept++;
        } else {
          processedItemIds.current.delete(id);
          itemElementsMap.current.delete(id);
        }
      }
      setStats({ kept, hidden });

    } catch (error) {
      console.error("Error filtering listings:", error);
      setErrorMsg("Failed to connect to backend.");
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    itemElementsMap.current.forEach(container => {
      container.style.display = "";
    });
    processedItemIds.current.clear();
    itemElementsMap.current.clear();
    setPrompt("");
    setLastSearchedPrompt("");
    setActiveFilter(false);
    setStats({ kept: 0, hidden: 0 });
    setErrorMsg(null);
  };

  // Pagination Observer
  useEffect(() => {
    if (!activeFilter || loading) return;

    let timeout: NodeJS.Timeout;
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldCheck = true;
          break;
        }
      }

      if (shouldCheck) {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          // Debounce to allow rendering
          const unhandled = extractItems();
          if (unhandled.length > 0) {
            handleFilter(true);
          }
        }, 1000);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      clearTimeout(timeout);
    };
  }, [activeFilter, loading, prompt, authToken]);

  const [isOpen, setIsOpen] = useState(false);

  if (!hasListings) return null;

  return (
    <div className="floating-container">
      {isOpen && (
        <div className="dialog-card dialog-card-responsive">
          <div className="dialog-header">
            <span className="dialog-title">✨ AI Assistant</span>
            <button type="button" onClick={() => setIsOpen(false)} className="close-btn">×</button>
          </div>

          <div className="dialog-body">
            {/* Search Bar */}
            <div className="search-row">
              <textarea
                className="textarea-field"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                disabled={loading}
                placeholder={placeholder}
                rows={3}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isAuthenticated) {
                      handleLogin();
                    } else {
                      handleFilter();
                    }
                  }
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div
                    className="vision-toggle-btn"
                    onClick={() => {
                      if (!loading) setUseVision(!useVision);
                    }}
                    style={{
                      cursor: loading ? 'not-allowed' : 'pointer',
                      color: useVision ? '#0ea5e9' : '#64748b',
                      opacity: loading ? 0.6 : 1
                    }}
                    title="Use image analysis for visual traits (Slower)"
                  >
                    🖼️ Vision
                    <div className="vision-toggle-track" style={{
                      backgroundColor: useVision ? '#0ea5e9' : '#cbd5e1'
                    }}>
                      <div className="vision-toggle-thumb" style={{
                        left: useVision ? '14px' : '2px'
                      }} />
                    </div>
                  </div>
                </div>

                {!isAuthenticated ? (
                  <button type="button" className="login-btn" onClick={handleLogin}>
                    Login
                  </button>
                ) : activeFilter ? (
                  <button type="button" className="clear-btn" onClick={handleClear}>Clear</button>
                ) : (
                  <button type="button" className="submit-btn" onClick={() => handleFilter()} disabled={loading}>
                    {loading ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" strokeDasharray="31.4 31.4" strokeDashoffset="0"><animate attributeName="stroke-dashoffset" values="0; 62.8" dur="1s" repeatCount="indefinite" /></circle>
                      </svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: 'translateX(-1px)' }}>
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Status Area */}
            {(errorMsg || activeFilter || loading || usage) && (
              <div className="status-area">
                {errorMsg && (
                  <div className="error-card">{errorMsg}</div>
                )}
                {(activeFilter || loading) && !errorMsg && (
                  <div className="active-state-container">
                    {loading ? (
                      <div className="skeleton-box" style={{ width: "160px", height: "16px", borderRadius: "6px" }} />
                    ) : (
                      <div className="stats-badge">
                        Showing {stats.kept} results • <span style={{ opacity: 0.8 }}>{stats.hidden} hidden by AI</span>
                      </div>
                    )}
                    {loading && (
                      <div className="pagination-loader">
                        <TypingEffect text={activeFilter ? "Evaluating new listings..." : "Filtering results..."} />
                      </div>
                    )}
                  </div>
                )}

                {/* Usage Footer */}
                {usage && !errorMsg && (
                  <div style={{ marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #e2e8f0', fontSize: '11px', color: '#64748b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>
                      Text Searches: <b>{Math.max(0, usage.total_limit - usage.current_requests)}</b> left
                    </span>
                    <span>
                      Vision Scans: <b>{Math.max(0, usage.vision_limit - usage.current_vision)}</b> left
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="floating-pill"
      >
        <span className="pill-icon">✨</span>
        <span className="pill-text">{isOpen ? "Close" : "AI Filter"}</span>
      </button>
    </div>
  );
}


