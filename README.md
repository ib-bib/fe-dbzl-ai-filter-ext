# Dubizzle AI Smart Filter (Frontend Extension)

An AI-native browser extension that seamlessly integrates into Dubizzle's interface, empowering users to filter classifieds listings using natural language. Built with React and the WXT framework, this extension transforms a traditional UI into an intelligent, AI-driven experience.

## Architecture & Technical Highlights

This repository demonstrates the ability to translate complex AI capabilities into an intuitive, high-performance frontend system.

### Key Features
- **Seamless SPA Integration**: Dubizzle is a Single Page Application (SPA). This extension utilizes a `MutationObserver` to dynamically track route changes and DOM updates without requiring page reloads. It intelligently adapts the AI placeholder and detects when new listings are dynamically injected into the DOM (e.g., during infinite scrolling or pagination) to batch-process them smoothly.
- **Client-Side DOM Manipulation**: To avoid costly and easily-blocked backend web scraping, the extension securely extracts listing data directly from the DOM within the user's authenticated session. It manipulates the DOM in real-time to hide irrelevant listings (`display: none`), ensuring a fast, native-feeling user experience.
- **State Management & Refinement**: Implements intelligent state management to track processed items. If a user refines their search query (e.g., adding "and must have a balcony"), the system only re-evaluates the currently visible listings, saving immense compute and API costs.
- **Delightful UX/UI**: Features a responsive floating dialogue, subtle micro-animations, and dynamic typing effects that keep the user informed during asynchronous LLM evaluations. The UI feels like a premium, integrated part of the host website.
- **Google OAuth Authentication**: Securely authenticates users via `chrome.identity`, maintaining session state and allowing for usage tracking and rate-limiting on the backend.

## Why I Made These Choices

- **WXT Framework over Vanilla Extension API**: Using WXT allows for modern frontend tooling (TypeScript, Vite, React) while compiling down to a highly optimized browser extension. It significantly improves developer productivity and codebase maintainability.
- **Client-Side Data Extraction**: By extracting the text and image URLs locally, we protect the backend from anti-bot mechanisms and significantly reduce the payload size and latency.
- **End-to-End Ownership**: This project showcases the ability to design, build, and maintain a complete frontend feature, bridging the gap between raw backend AI capabilities and a polished, user-facing product.

## Build Requirements

- **Node.js** (v18+)
- **WXT Framework** (React, TypeScript)

## Setup & Running Locally

1. Create a `.env` file based on `.env.example` and add your configuration (e.g., backend API URL, Google Client ID).
2. Install dependencies:
   ```bash
   npm install
   ```
3. Run the development server (this will launch a browser with the extension loaded):
   ```bash
   npm run dev
   ```
4. To build for production:
   ```bash
   npm run build
   ```
