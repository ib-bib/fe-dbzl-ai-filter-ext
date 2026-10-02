import "./style.css";
import ReactDOM from "react-dom/client";
import App from "./App";

// defineContentScript and createShadowRootUi are auto-imported by WXT
export default defineContentScript({
  matches: ["*://*.dubizzle.com/*"],
  cssInjectionMode: "ui",

  async main(ctx) {
      let isMounting = false;
      const tryMount = async () => {
        if (isMounting) return;
        isMounting = true;
        
        try {
          if (document.querySelector('ai-filter-root')) {
              return; // Already mounted
          }

          const ui = await createShadowRootUi(ctx, {
            name: "ai-filter-root",
            position: "inline",
            anchor: "body",
            append: "last",
            onMount: (container) => {
              const appWrapper = document.createElement("div");
              appWrapper.style.width = "100%";
              appWrapper.style.marginBottom = "24px";
              appWrapper.style.marginTop = "16px";
              appWrapper.style.display = "block";
              
              container.append(appWrapper);

              const root = ReactDOM.createRoot(appWrapper);
              root.render(<App />);
              return root;
            },
            onRemove: (root) => {
              root?.unmount();
            },
          });

          ui.mount();
        } finally {
            isMounting = false;
        }
      };

      // Run initially
      tryMount();

      // Observe DOM for SPA navigations or lazy-loaded elements
      const observer = new MutationObserver(() => {
          if (!document.querySelector('ai-filter-root') && window.location.pathname !== "/" && window.location.pathname !== "") {
              tryMount();
          }
      });
      observer.observe(document.body, { childList: true, subtree: true });
    },
});
